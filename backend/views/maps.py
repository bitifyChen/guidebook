from urllib.parse import urljoin, urlparse

import requests

from common.auth import verify_admin_request


MAX_REDIRECTS = 5
MAX_URL_LENGTH = 4096
REQUEST_TIMEOUT = (3, 6)
SHORT_GOOGLE_HOSTS = {"maps.app.goo.gl", "goo.gl"}
GOOGLE_MAPS_HOSTS = {
    "google.com",
    "www.google.com",
    "maps.google.com",
    "www.google.com.tw",
    "www.google.co.jp",
    "www.google.co.kr",
}
ALLOWED_HOSTS = SHORT_GOOGLE_HOSTS | GOOGLE_MAPS_HOSTS


def _json_error(message, status=400):
    return {"status": "error", "message": message}, status


def _validate_google_url(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Google Maps URL is required.")

    raw_url = value.strip()
    if len(raw_url) > MAX_URL_LENGTH:
        raise ValueError("Google Maps URL is too long.")

    parsed = urlparse(raw_url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or hostname not in ALLOWED_HOSTS:
        raise ValueError("Only supported Google Maps HTTPS URLs are allowed.")
    if parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Google Maps URL contains unsupported credentials or port.")
    return raw_url


def resolve_google_maps_url(source_url):
    current_url = _validate_google_url(source_url)

    with requests.Session() as session:
        for redirect_count in range(MAX_REDIRECTS + 1):
            response = session.get(
                current_url,
                allow_redirects=False,
                timeout=REQUEST_TIMEOUT,
                stream=True,
                headers={"User-Agent": "GuidebookRouteResolver/1.0"},
            )
            try:
                if response.is_redirect or response.is_permanent_redirect:
                    if redirect_count >= MAX_REDIRECTS:
                        raise ValueError("Google Maps URL has too many redirects.")
                    location = response.headers.get("Location", "").strip()
                    if not location:
                        raise ValueError("Google Maps redirect is missing a target URL.")
                    current_url = _validate_google_url(urljoin(current_url, location))
                    continue

                if response.status_code >= 400:
                    raise ValueError(
                        f"Google Maps returned HTTP {response.status_code}."
                    )
                return _validate_google_url(current_url)
            finally:
                response.close()

    raise ValueError("Unable to resolve Google Maps URL.")


def handle_resolve_google_maps_route(request):
    try:
        _, auth_error = verify_admin_request(request)
        if auth_error:
            status = 401 if "authorization" in auth_error.lower() else 403
            return _json_error(auth_error, status)
    except Exception as exc:
        return _json_error(f"Authorization failed: {exc}", 401)

    payload = request.get_json(silent=True) or {}
    try:
        source_url = _validate_google_url(payload.get("url"))
        resolved_url = resolve_google_maps_url(source_url)
    except requests.RequestException as exc:
        return _json_error(f"Google Maps request failed: {exc}", 502)
    except ValueError as exc:
        return _json_error(str(exc), 400)

    return {
        "status": "ok",
        "sourceUrl": source_url,
        "resolvedUrl": resolved_url,
    }, 200
