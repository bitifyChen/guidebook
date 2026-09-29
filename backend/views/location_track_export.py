import io
import json
import re
import zipfile
from datetime import date, datetime, timedelta, timezone
from xml.sax.saxutils import escape
from urllib.parse import quote

from flask import Response
from firebase_admin import firestore

from common.auth import verify_admin_request
from common.firebase import get_firestore_client, get_rtdb_reference
from views.location_track_archive import (
    ARCHIVE_CODEC,
    decode_archive_payload,
    delete_archived_location_tracks,
)
from views.location_tracks import (
    _get_day_points,
    _load_track_context,
    _merge_points,
    _normalize_point,
    get_track_date_range,
)


DEFAULT_RETENTION_DAYS = 90
MAX_EXPORT_DAYS = 366
MAX_EXPORT_PARTICIPANTS = 50
MAX_EXPORT_TRIPS = 20
COMPLETED_TRIP_STATUSES = {"completed", "archived"}
INVALID_KEY_CHARACTERS = set("/.#$[]")


def _json_error(message, status=400):
    return {"status": "error", "message": message}, status


def _authorize(request):
    try:
        admin, auth_error = verify_admin_request(request)
    except Exception as exc:
        return None, _json_error(f"Authorization failed: {exc}", 401)
    if auth_error:
        status = 401 if "authorization" in auth_error.lower() else 403
        return None, _json_error(auth_error, status)
    return admin, None


def _normalize_list(value):
    if isinstance(value, (list, tuple, set)):
        values = value
    else:
        values = str(value or "").split(",")
    return list(dict.fromkeys(str(item).strip() for item in values if str(item).strip()))


def _validate_key(value, field):
    normalized = str(value or "").strip()
    if (
        not normalized
        or len(normalized) > 256
        or any(character in INVALID_KEY_CHARACTERS for character in normalized)
    ):
        raise ValueError(f"{field} 無效。")
    return normalized


def _validate_date(value, field):
    normalized = str(value or "").strip()
    try:
        date.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(f"{field} 必須使用 YYYY-MM-DD。") from exc
    return normalized


def _iter_dates(start_date, end_date):
    current = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    while current <= end:
        yield current.isoformat()
        current += timedelta(days=1)


def _normalize_request(payload):
    trip_ids = _normalize_list(payload.get("tripIds") or payload.get("tripId"))
    participant_ids = _normalize_list(
        payload.get("participantIds") or payload.get("participantId")
    )
    if not trip_ids:
        raise ValueError("至少需要選擇一個旅程。")
    if not participant_ids:
        raise ValueError("至少需要選擇一位成員。")
    if len(trip_ids) > MAX_EXPORT_TRIPS:
        raise ValueError(f"一次最多匯出 {MAX_EXPORT_TRIPS} 個旅程。")
    if len(participant_ids) > MAX_EXPORT_PARTICIPANTS:
        raise ValueError(f"一次最多匯出 {MAX_EXPORT_PARTICIPANTS} 位成員。")

    start_date = _validate_date(payload.get("startDate"), "startDate")
    end_date = _validate_date(payload.get("endDate") or start_date, "endDate")
    if start_date > end_date:
        raise ValueError("開始日期不可晚於結束日期。")
    if (date.fromisoformat(end_date) - date.fromisoformat(start_date)).days + 1 > MAX_EXPORT_DAYS:
        raise ValueError(f"日期範圍不可超過 {MAX_EXPORT_DAYS} 天。")

    output_format = str(payload.get("format") or "geojson").strip().lower()
    if output_format not in {"geojson", "gpx"}:
        raise ValueError("format 只能是 geojson 或 gpx。")
    return {
        "tripIds": trip_ids,
        "participantIds": participant_ids,
        "startDate": start_date,
        "endDate": end_date,
        "format": output_format,
    }


def _safe_timezone(value):
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    try:
        return ZoneInfo(value or "UTC")
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _iso_timestamp(value):
    try:
        timestamp = int(float(value))
    except (TypeError, ValueError):
        return ""
    return datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat().replace(
        "+00:00", "Z"
    )


def _safe_filename(value, fallback):
    normalized = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff_-]+", "-", str(value or ""))
    normalized = normalized.strip("-_")
    return normalized[:80] or fallback


def _public_point(point):
    public = {
        "lat": float(point["lat"]),
        "lng": float(point["lng"]),
        "timestamp": _iso_timestamp(point.get("ts")),
    }
    optional_fields = {
        "accuracy": "acc",
        "speed": "spd",
        "altitude": "alt",
        "heading": "course",
        "source": "source",
    }
    for public_key, source_key in optional_fields.items():
        value = point.get(source_key)
        if value is not None and value != "":
            public[public_key] = value
    return public


def _public_stop(stop, index):
    return {
        "index": index,
        "lat": float(stop.get("lat")),
        "lng": float(stop.get("lng")),
        "arrivedAt": _iso_timestamp(stop.get("arrivedAt")),
        "leftAt": _iso_timestamp(stop.get("leftAt")),
        "durationMinutes": int(stop.get("durationMinutes") or 0),
        "pointsCount": int(stop.get("pointsCount") or 0),
    }


def build_geojson(record):
    points = [_public_point(point) for point in record["points"]]
    features = []
    if points:
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[point["lng"], point["lat"]] for point in points],
                },
                "properties": {
                    "kind": "track",
                    "participantName": record["participantName"],
                    "tripTitle": record["tripTitle"],
                    "date": record["date"],
                    "timezone": record["timezone"],
                    "pointCount": len(points),
                    "startedAt": points[0]["timestamp"],
                    "endedAt": points[-1]["timestamp"],
                },
            }
        )
    for point in points:
        properties = {key: value for key, value in point.items() if key not in {"lat", "lng"}}
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [point["lng"], point["lat"]]},
                "properties": {"kind": "track-point", **properties},
            }
        )
    for index, stop in enumerate(record.get("stops") or [], start=1):
        public_stop = _public_stop(stop, index)
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [public_stop["lng"], public_stop["lat"]],
                },
                "properties": {"kind": "stop", **public_stop},
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "properties": {
            "participantName": record["participantName"],
            "tripTitle": record["tripTitle"],
            "date": record["date"],
            "pointCount": len(points),
            "stopsCount": len(record.get("stops") or []),
        },
    }


def _gpx_extensions(point):
    fields = (
        ("accuracy", point.get("accuracy")),
        ("speed", point.get("speed")),
        ("altitude", point.get("altitude")),
        ("heading", point.get("heading")),
        ("source", point.get("source")),
    )
    values = [
        f"<guidebook:{key}>{escape(str(value))}</guidebook:{key}>"
        for key, value in fields
        if value is not None and value != ""
    ]
    return f"<extensions>{''.join(values)}</extensions>" if values else ""


def build_gpx(record):
    points = [_public_point(point) for point in record["points"]]
    track_points = []
    for point in points:
        point_attributes = f' lat="{point["lat"]:.7f}" lon="{point["lng"]:.7f}"'
        elevation = (
            f"<ele>{escape(str(point['altitude']))}</ele>"
            if point.get("altitude") is not None
            else ""
        )
        time_value = f"<time>{escape(point['timestamp'])}</time>" if point.get("timestamp") else ""
        track_points.append(
            f"<trkpt{point_attributes}>{elevation}{time_value}{_gpx_extensions(point)}</trkpt>"
        )

    waypoints = []
    for index, stop in enumerate(record.get("stops") or [], start=1):
        public_stop = _public_stop(stop, index)
        waypoints.append(
            "<wpt lat=\"{lat:.7f}\" lon=\"{lng:.7f}\">"
            "<name>{name}</name><time>{time}</time><desc>{desc}</desc></wpt>".format(
                lat=public_stop["lat"],
                lng=public_stop["lng"],
                name=escape(f"停留 {index}"),
                time=escape(public_stop["arrivedAt"]),
                desc=escape(
                    f"停留 {public_stop['durationMinutes']} 分鐘，至 {public_stop['leftAt']}"
                ),
            )
        )

    title = escape(f"{record['participantName']} - {record['tripTitle']} - {record['date']}")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<gpx version="1.1" creator="Guidebook" '
        'xmlns="http://www.topografix.com/GPX/1/1" '
        'xmlns:guidebook="https://guidebook.chenchenworkshop.com/gpx">'
        f"<metadata><name>{title}</name></metadata>"
        f"{''.join(waypoints)}"
        f"<trk><name>{title}</name><trkseg>{''.join(track_points)}</trkseg></trk>"
        "</gpx>"
    )


def _build_record(firestore_client, trip_id, participant_id, date_value, cache):
    cache_key = (trip_id, participant_id, date_value)
    if cache_key in cache:
        return cache[cache_key]

    context = _load_track_context(trip_id, participant_id)
    track_reference = get_rtdb_reference(
        f"tripLocationTracks/{trip_id}/{participant_id}"
    )
    current_points, _, _ = _get_day_points(
        track_reference, date_value, context["timezone"]
    )
    archived_points = []
    archived_stops = []
    archive_snapshot = (
        firestore_client.collection("participantTrackArchives")
        .document(participant_id)
        .collection("days")
        .document(date_value)
        .get()
    )
    if archive_snapshot.exists:
        archive_data = archive_snapshot.to_dict() or {}
        if archive_data.get("codec") == ARCHIVE_CODEC and archive_data.get("payload"):
            payload = decode_archive_payload(archive_data["payload"])
            segment = next(
                (
                    item
                    for item in payload.get("segments") or []
                    if item.get("tripId") == trip_id
                ),
                None,
            )
            if segment:
                archived_points = segment.get("points") or []
                archived_stops = segment.get("stops") or []

    points = _merge_points(archived_points, current_points)
    if not points:
        cache[cache_key] = None
        return None

    participant = context["participant"]
    trip = context["trip"]
    record = {
        "tripId": trip_id,
        "participantId": participant_id,
        "tripTitle": str(trip.get("title") or "旅程"),
        "participantName": str(participant.get("name") or "成員"),
        "date": date_value,
        "timezone": context["timezone"],
        "points": points,
        "stops": archived_stops,
    }
    cache[cache_key] = record
    return record


def _render_record(record, output_format):
    if output_format == "gpx":
        return build_gpx(record).encode("utf-8"), "gpx"
    return (
        json.dumps(build_geojson(record), ensure_ascii=False, indent=2).encode("utf-8"),
        "geojson",
    )


def _content_disposition(filename):
    ascii_filename = filename.encode("ascii", "ignore").decode("ascii") or "guidebook-track"
    ascii_filename = ascii_filename.replace('"', "'").replace("\\", "_")
    return (
        f'attachment; filename="{ascii_filename}"; '
        f"filename*=UTF-8''{quote(filename, safe='') }"
    )


def _download_response(records, output_format, force_zip=False):
    rendered = []
    used_names = set()
    for record in records:
        content, extension = _render_record(record, output_format)
        base = _safe_filename(
            f"{record['participantName']}-{record['tripTitle']}-{record['date']}",
            "guidebook-track",
        )
        filename = f"{base}.{extension}"
        suffix = 2
        while filename in used_names:
            filename = f"{base}-{suffix}.{extension}"
            suffix += 1
        used_names.add(filename)
        rendered.append((filename, content))

    if len(rendered) == 1 and not force_zip:
        filename, content = rendered[0]
        content_type = "application/gpx+xml" if output_format == "gpx" else "application/geo+json"
        response = Response(content, status=200, mimetype=content_type)
    else:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for filename, content in rendered:
                archive.writestr(filename, content)
        filename = f"guidebook-location-tracks-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}.zip"
        response = Response(buffer.getvalue(), status=200, mimetype="application/zip")
    response.headers["Content-Disposition"] = _content_disposition(filename)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Guidebook-Export-Count"] = str(len(rendered))
    return response


def handle_export_admin_location_tracks(request):
    _, auth_response = _authorize(request)
    if auth_response:
        return auth_response

    try:
        payload = _normalize_request(request.get_json(silent=True) or {})
        firestore_client = get_firestore_client()
        records = []
        cache = {}
        for trip_id in payload["tripIds"]:
            for participant_id in payload["participantIds"]:
                for date_value in _iter_dates(payload["startDate"], payload["endDate"]):
                    record = _build_record(
                        firestore_client, trip_id, participant_id, date_value, cache
                    )
                    if record:
                        records.append(record)
        if not records:
            return _json_error("指定範圍沒有可匯出的軌跡資料。", 404)
        force_zip = (
            len(payload["tripIds"]) > 1
            or len(payload["participantIds"]) > 1
            or payload["startDate"] != payload["endDate"]
        )
        return _download_response(records, payload["format"], force_zip=force_zip)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except LookupError as exc:
        return _json_error(str(exc), 404)
    except PermissionError as exc:
        return _json_error(str(exc), 403)
    except Exception as exc:
        return _json_error(f"軌跡匯出失敗：{exc}", 500)


def retention_cutoff_date(now=None, retention_days=DEFAULT_RETENTION_DAYS):
    current = now or datetime.now(timezone.utc)
    return (current.date() - timedelta(days=retention_days)).isoformat()


def _is_expired(date_value, timezone_name, now, retention_days):
    timezone_value = _safe_timezone(timezone_name)
    expiration = datetime.combine(
        date.fromisoformat(date_value) + timedelta(days=retention_days),
        datetime.min.time(),
        tzinfo=timezone_value,
    )
    return expiration <= now.astimezone(timezone_value)


def _retention_trip_context(firestore_client, trip_id, cache):
    if trip_id in cache:
        return cache[trip_id]
    snapshot = firestore_client.collection("trips").document(trip_id).get()
    if not snapshot.exists:
        cache[trip_id] = None
        return None
    trip = {"id": trip_id, **(snapshot.to_dict() or {})}
    if trip.get("status") not in COMPLETED_TRIP_STATUSES:
        cache[trip_id] = None
        return None
    cache[trip_id] = trip
    return trip


def _retention_candidates(
    firestore_client, now=None, retention_days=DEFAULT_RETENTION_DAYS
):
    current = now or datetime.now(timezone.utc)
    trip_cache = {}
    participant_cache = {}
    candidates = []
    days_collection = firestore_client.collection_group("days")
    for snapshot in days_collection.stream():
        data = snapshot.to_dict() or {}
        if data.get("codec") != ARCHIVE_CODEC or not data.get("payload"):
            continue
        payload = decode_archive_payload(data["payload"])
        participant_id = str(payload.get("participantId") or "")
        date_value = str(payload.get("date") or snapshot.id)
        if not participant_id or not date_value:
            continue
        for segment in payload.get("segments") or []:
            trip_id = str(segment.get("tripId") or "")
            trip = _retention_trip_context(firestore_client, trip_id, trip_cache)
            timezone_name = str(
                segment.get("timezone") or (trip and trip.get("timezone")) or "UTC"
            )
            if not trip or not _is_expired(date_value, timezone_name, current, retention_days):
                continue
            if participant_id not in participant_cache:
                participant_snapshot = (
                    firestore_client.collection("participants")
                    .document(participant_id)
                    .get()
                )
                participant_cache[participant_id] = (
                    (participant_snapshot.to_dict() or {}).get("name")
                    if participant_snapshot.exists
                    else ""
                )
            candidates.append(
                {
                    "tripId": trip_id,
                    "participantId": participant_id,
                    "participantName": participant_cache[participant_id] or "已移除成員",
                    "date": date_value,
                    "timezone": timezone_name,
                    "tripTitle": str(trip.get("title") or "旅程"),
                    "archivePointCount": len(segment.get("points") or []),
                    "archivePointIds": [
                        str(point.get("id"))
                        for point in segment.get("points") or []
                        if point.get("id")
                    ],
                    "archiveDocumentPath": snapshot.reference.path,
                }
            )
    return candidates


def _attach_rtdb_points(candidates):
    for candidate in candidates:
        start, end = get_track_date_range(candidate["date"], candidate["timezone"])
        reference = get_rtdb_reference(
            f"tripLocationTracks/{candidate['tripId']}/{candidate['participantId']}"
        )
        value = (
            reference.order_by_child("ts").start_at(start).end_at(end - 1).get() or {}
        )
        points = []
        for point_id, data in value.items():
            normalized = _normalize_point(str(point_id), data)
            if normalized:
                points.append(normalized)
        candidate["rtdbPointIds"] = [point["id"] for point in points]
        candidate["rtdbPointCount"] = len(points)
        candidate["pointCount"] = len(
            set(candidate.get("archivePointIds") or [])
            | set(candidate.get("rtdbPointIds") or [])
        )
    return candidates


def _retention_summary(candidates, retention_days, dry_run):
    return {
        "status": "ok",
        "dryRun": dry_run,
        "retentionDays": retention_days,
        "candidateCount": len(candidates),
        "firestoreDocumentCount": len(
            {candidate["archiveDocumentPath"] for candidate in candidates}
        ),
        "archivePointCount": sum(
            int(candidate.get("archivePointCount") or 0) for candidate in candidates
        ),
        "rtdbPointCount": sum(
            int(candidate.get("rtdbPointCount") or 0) for candidate in candidates
        ),
        "pointCount": sum(int(candidate.get("pointCount") or 0) for candidate in candidates),
        "items": [
            {
                key: value
                for key, value in candidate.items()
                if key not in {"archivePointIds", "rtdbPointIds", "archiveDocumentPath"}
            }
            for candidate in candidates
        ],
    }


def run_location_track_retention(
    *, now=None, retention_days=DEFAULT_RETENTION_DAYS, dry_run=False
):
    if retention_days != DEFAULT_RETENTION_DAYS:
        raise ValueError("目前軌跡保留期限固定為 90 天。")
    firestore_client = get_firestore_client()
    candidates = _retention_candidates(
        firestore_client, now=now, retention_days=retention_days
    )
    candidates = _attach_rtdb_points(candidates)
    summary = _retention_summary(candidates, retention_days, dry_run)
    failures = []
    deleted_archive_points = 0
    deleted_rtdb_points = 0
    if not dry_run:
        for candidate in candidates:
            try:
                if candidate.get("rtdbPointIds"):
                    reference = get_rtdb_reference(
                        f"tripLocationTracks/{candidate['tripId']}/{candidate['participantId']}"
                    )
                    reference.update(
                        {point_id: None for point_id in candidate["rtdbPointIds"]}
                    )
                    deleted_rtdb_points += len(candidate["rtdbPointIds"])
                deleted_archive_points += delete_archived_location_tracks(
                    firestore_client,
                    candidate["tripId"],
                    candidate["participantId"],
                    "day",
                    date_value=candidate["date"],
                )
            except Exception as exc:
                failures.append(
                    {
                        "tripId": candidate["tripId"],
                        "participantId": candidate["participantId"],
                        "date": candidate["date"],
                        "message": str(exc),
                    }
                )
        summary.update(
            {
                "deletedArchivePointCount": deleted_archive_points,
                "deletedRtdbPointCount": deleted_rtdb_points,
                "failureCount": len(failures),
                "failures": failures[:20],
                "status": "partial" if failures else "ok",
            }
        )
        firestore_client.collection("locationTrackRetentionRuns").document().set(
            {
                key: value
                for key, value in summary.items()
                if key not in {"items", "failures"}
            }
            | {"failures": failures[:20], "createdAt": firestore.SERVER_TIMESTAMP}
        )
    return summary


def _retention_request(request, dry_run):
    _, auth_response = _authorize(request)
    if auth_response:
        return auth_response
    if not dry_run:
        payload = request.get_json(silent=True) or {}
        if payload.get("confirmation") != "清理":
            return _json_error("執行軌跡清理前，請輸入「清理」確認。", 400)
    try:
        summary = run_location_track_retention(dry_run=dry_run)
        return summary, 200
    except Exception as exc:
        return _json_error(f"軌跡保留期限處理失敗：{exc}", 500)


def handle_preview_admin_location_track_retention(request):
    return _retention_request(request, True)


def handle_admin_location_track_retention(request):
    return _retention_request(request, False)
