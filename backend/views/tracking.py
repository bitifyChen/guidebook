import hashlib
import time
from datetime import datetime, timezone

from common.firebase import get_firestore_client, get_rtdb_reference


def _get_payload(request):
    payload = {}
    payload.update(request.args.to_dict())

    if request.is_json:
        payload.update(request.get_json(silent=True) or {})
    else:
        payload.update(request.form.to_dict())

    return payload


def _first_value(payload, *keys):
    for key in keys:
        value = payload.get(key)
        if value not in (None, ""):
            return value
    return None


def _to_float(value, field):
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a number")


def _to_optional_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_timestamp_ms(value):
    if value in (None, ""):
        return int(time.time() * 1000)

    if isinstance(value, (int, float)):
        numeric = float(value)
    else:
        text = str(value).strip()
        try:
            numeric = float(text)
        except ValueError:
            try:
                return int(
                    datetime.fromisoformat(text.replace("Z", "+00:00"))
                    .astimezone(timezone.utc)
                    .timestamp()
                    * 1000
                )
            except ValueError:
                return int(time.time() * 1000)

    if numeric < 10_000_000_000:
        numeric *= 1000
    return int(numeric)


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _load_tracking_token(token):
    token_hash = _hash_token(token)
    snapshot = get_firestore_client().collection("trackingTokens").document(token_hash).get()
    if not snapshot.exists:
        return None
    data = snapshot.to_dict() or {}
    data["tokenHash"] = token_hash
    return data


def _is_enabled_token(token_data):
    return bool(token_data and token_data.get("enabled", True) and not token_data.get("revokedAt"))


def _load_participant_trip_ids(participant_id, fallback_trip_id=None):
    if not participant_id:
        return []

    snapshot = get_firestore_client().collection("participants").document(participant_id).get()
    if not snapshot.exists:
        return [fallback_trip_id] if fallback_trip_id else []

    data = snapshot.to_dict() or {}
    trip_ids = data.get("tripIds") or ([data.get("tripId")] if data.get("tripId") else [])
    if fallback_trip_id:
        trip_ids.append(fallback_trip_id)

    return list(dict.fromkeys([trip_id for trip_id in trip_ids if trip_id]))


def _should_throttle(path, min_interval_seconds):
    if not min_interval_seconds:
        return False

    current = get_rtdb_reference(path).get() or {}
    updated_at = current.get("updatedAt") or 0
    return int(time.time() * 1000) - int(updated_at) < int(min_interval_seconds) * 1000


def handle_traccar_location(request):
    payload = _get_payload(request)
    token = _first_value(payload, "token", "trackingToken")
    if not token:
        return {"status": "error", "message": "Missing tracking token"}, 401

    token_data = _load_tracking_token(token)
    if not _is_enabled_token(token_data):
        return {"status": "error", "message": "Invalid tracking token"}, 403

    participant_id = token_data.get("participantId")
    trip_ids = _load_participant_trip_ids(participant_id, token_data.get("tripId"))
    if not participant_id or not trip_ids:
        return {"status": "error", "message": "Tracking token is incomplete"}, 403

    try:
        lat = _to_float(_first_value(payload, "lat", "latitude"), "lat")
        lng = _to_float(_first_value(payload, "lon", "lng", "longitude"), "lng")
    except ValueError as error:
        return {"status": "error", "message": str(error)}, 400

    device_id = _first_value(payload, "id", "deviceId", "deviceid") or token_data.get("deviceId")
    min_interval_seconds = int(token_data.get("minIntervalSeconds") or 0)
    throttle_path = f"trackingThrottle/{participant_id}"

    if _should_throttle(throttle_path, min_interval_seconds):
        return {"status": "ignored", "reason": "throttled"}, 200

    timestamp_ms = _to_timestamp_ms(_first_value(payload, "timestamp", "time", "ts", "fixTime"))
    location = {
        "lat": lat,
        "lng": lng,
        "ts": timestamp_ms,
        "updatedAt": int(time.time() * 1000),
        "source": "traccar",
    }

    optional_fields = {
        "acc": _to_optional_float(_first_value(payload, "accuracy", "acc")),
        "bat": _to_optional_float(_first_value(payload, "battery", "batt", "bat")),
        "spd": _to_optional_float(_first_value(payload, "speed", "spd")),
    }
    location.update({key: value for key, value in optional_fields.items() if value is not None})
    if device_id:
        location["deviceId"] = str(device_id)

    for trip_id in trip_ids:
        get_rtdb_reference(f"tripLocations/{trip_id}/{participant_id}").set(location)
    get_rtdb_reference(throttle_path).set({"updatedAt": location["updatedAt"]})

    return {
        "status": "ok",
        "tripIds": trip_ids,
        "participantId": participant_id,
        "updatedAt": location["updatedAt"],
    }, 200
