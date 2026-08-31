from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from firebase_admin import firestore

from common.auth import verify_admin_request
from common.firebase import get_firestore_client, get_rtdb_reference
from views.location_track_archive import (
    count_archived_track_points,
    delete_archived_location_tracks,
    get_archived_track_points,
)


MAX_TRACK_POINTS = 10000
INVALID_KEY_CHARACTERS = set("/.#$[]")
SUPPORTED_DELETE_SCOPES = {"point", "day", "all"}


def _json_error(message, status=400):
    return {"status": "error", "message": message}, status


def _request_payload(request):
    payload = request.args.to_dict()
    if request.method != "GET":
        payload.update(request.get_json(silent=True) or {})
    return payload


def _validate_key(value, field):
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{field} is required.")
    if len(normalized) > 256 or any(char in INVALID_KEY_CHARACTERS for char in normalized):
        raise ValueError(f"{field} is invalid.")
    return normalized


def get_track_date_range(date_value, timezone_name):
    try:
        timezone = ZoneInfo(timezone_name or "UTC")
    except ZoneInfoNotFoundError:
        timezone = ZoneInfo("UTC")

    try:
        start = datetime.strptime(str(date_value or ""), "%Y-%m-%d").replace(
            tzinfo=timezone
        )
    except ValueError as exc:
        raise ValueError("date must use YYYY-MM-DD format.") from exc

    end = start + timedelta(days=1)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def _normalize_trip_ids(data):
    trip_ids = data.get("tripIds") or ([data.get("tripId")] if data.get("tripId") else [])
    return [str(trip_id) for trip_id in trip_ids if trip_id]


def _load_track_context(trip_id, participant_id):
    db = get_firestore_client()
    trip_snapshot = db.collection("trips").document(trip_id).get()
    if not trip_snapshot.exists:
        raise LookupError("Trip was not found.")

    participant_snapshot = db.collection("participants").document(participant_id).get()
    if not participant_snapshot.exists:
        raise LookupError("Participant was not found.")

    trip = trip_snapshot.to_dict() or {}
    participant = participant_snapshot.to_dict() or {}
    if trip_id not in _normalize_trip_ids(participant):
        raise PermissionError("Participant does not belong to this trip.")

    return {
        "trip": {"id": trip_id, **trip},
        "participant": {"id": participant_id, **participant},
        "timezone": str(trip.get("timezone") or "UTC"),
    }


def _authorize(request):
    try:
        admin, auth_error = verify_admin_request(request)
        if auth_error:
            status = 401 if "authorization" in auth_error.lower() else 403
            return None, _json_error(auth_error, status)
        return admin, None
    except Exception as exc:
        return None, _json_error(f"Authorization failed: {exc}", 401)


def _normalize_point(point_id, data):
    if not isinstance(data, dict):
        return None
    try:
        lat = float(data.get("lat"))
        lng = float(data.get("lng"))
        timestamp = int(float(data.get("ts")))
    except (TypeError, ValueError):
        return None

    point = {"id": point_id, **data, "lat": lat, "lng": lng, "ts": timestamp}
    for field in ("acc", "spd", "bat", "alt", "course"):
        if point.get(field) is None:
            continue
        try:
            point[field] = float(point[field])
        except (TypeError, ValueError):
            point.pop(field, None)
    return point


def _sort_points(value):
    points = []
    for point_id, data in (value or {}).items():
        point = _normalize_point(point_id, data)
        if point:
            points.append(point)
    return sorted(points, key=lambda item: item["ts"])


def _get_day_points(track_ref, date_value, timezone_name):
    start_time, end_time = get_track_date_range(date_value, timezone_name)
    value = (
        track_ref.order_by_child("ts")
        .start_at(start_time)
        .end_at(end_time - 1)
        .get()
        or {}
    )
    return _sort_points(value), start_time, end_time


def _get_scope_points(track_ref, scope, point_id="", date_value="", timezone_name="UTC"):
    if scope == "point":
        normalized_point_id = _validate_key(point_id, "pointId")
        data = track_ref.child(normalized_point_id).get()
        point = _normalize_point(normalized_point_id, data)
        return [point] if point else []
    if scope == "day":
        points, _, _ = _get_day_points(track_ref, date_value, timezone_name)
        return points
    return _sort_points(track_ref.get() or {})


def _scope_summary(scope, points, date_value="", participant_name=""):
    return {
        "scope": scope,
        "date": date_value if scope == "day" else "",
        "participantName": participant_name,
        "pointCount": len(points),
        "firstTimestamp": points[0]["ts"] if points else None,
        "lastTimestamp": points[-1]["ts"] if points else None,
    }


def _merge_points(*point_groups):
    by_id = {}
    for points in point_groups:
        for point in points or []:
            normalized = _normalize_point(str(point.get("id") or ""), point)
            if normalized:
                by_id[normalized["id"]] = normalized
    return sorted(by_id.values(), key=lambda item: item["ts"])


def handle_get_admin_location_tracks(request):
    _, auth_response = _authorize(request)
    if auth_response:
        return auth_response

    payload = _request_payload(request)
    try:
        trip_id = _validate_key(payload.get("tripId"), "tripId")
        participant_id = _validate_key(payload.get("participantId"), "participantId")
        context = _load_track_context(trip_id, participant_id)
        points, start_time, end_time = _get_day_points(
            get_rtdb_reference(f"tripLocationTracks/{trip_id}/{participant_id}"),
            payload.get("date"),
            context["timezone"],
        )
        archived_points = get_archived_track_points(
            get_firestore_client(),
            trip_id,
            participant_id,
            payload.get("date"),
        )
        points = _merge_points(archived_points, points)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except LookupError as exc:
        return _json_error(str(exc), 404)
    except PermissionError as exc:
        return _json_error(str(exc), 403)

    truncated = len(points) > MAX_TRACK_POINTS
    visible_points = points[:MAX_TRACK_POINTS]
    return {
        "status": "ok",
        "tripId": trip_id,
        "participantId": participant_id,
        "date": payload.get("date"),
        "timezone": context["timezone"],
        "tripStatus": context["trip"].get("status") or "",
        "startTime": start_time,
        "endTime": end_time,
        "pointCount": len(points),
        "truncated": truncated,
        "points": visible_points,
    }, 200


def _load_delete_request(request):
    payload = _request_payload(request)
    trip_id = _validate_key(payload.get("tripId"), "tripId")
    participant_id = _validate_key(payload.get("participantId"), "participantId")
    scope = str(payload.get("scope") or "").strip().lower()
    if scope not in SUPPORTED_DELETE_SCOPES:
        raise ValueError("scope must be point, day, or all.")

    context = _load_track_context(trip_id, participant_id)
    track_ref = get_rtdb_reference(f"tripLocationTracks/{trip_id}/{participant_id}")
    points = _get_scope_points(
        track_ref,
        scope,
        point_id=payload.get("pointId"),
        date_value=payload.get("date"),
        timezone_name=context["timezone"],
    )
    firestore_client = get_firestore_client()
    if scope in {"point", "day"}:
        archived_points = get_archived_track_points(
            firestore_client,
            trip_id,
            participant_id,
            payload.get("date"),
        )
        if scope == "point":
            archived_points = [
                point
                for point in archived_points
                if str(point.get("id")) == str(payload.get("pointId") or "")
            ]
        combined_points = _merge_points(points, archived_points)
        archived_count = len(archived_points)
    else:
        combined_points = points
        archived_count = count_archived_track_points(
            firestore_client,
            trip_id,
            participant_id,
            scope,
        )
    return (
        payload,
        trip_id,
        participant_id,
        scope,
        context,
        track_ref,
        combined_points,
        archived_count,
    )


def handle_preview_admin_location_track_deletion(request):
    _, auth_response = _authorize(request)
    if auth_response:
        return auth_response

    try:
        (
            payload,
            trip_id,
            participant_id,
            scope,
            context,
            _,
            points,
            archived_count,
        ) = _load_delete_request(request)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except LookupError as exc:
        return _json_error(str(exc), 404)
    except PermissionError as exc:
        return _json_error(str(exc), 403)

    return {
        "status": "ok",
        "tripId": trip_id,
        "participantId": participant_id,
        "tripStatus": context["trip"].get("status") or "",
        **_scope_summary(
            scope,
            points,
            date_value=payload.get("date") or "",
            participant_name=context["participant"].get("name") or "",
        ),
        "pointCount": (
            len(points) + archived_count if scope == "all" else len(points)
        ),
    }, 200


def _delete_points(track_ref, scope, points):
    if not points:
        return 0
    if scope == "all":
        track_ref.delete()
        return len(points)
    track_ref.update({point["id"]: None for point in points})
    return len(points)


def handle_delete_admin_location_tracks(request):
    admin, auth_response = _authorize(request)
    if auth_response:
        return auth_response

    try:
        (
            payload,
            trip_id,
            participant_id,
            scope,
            context,
            track_ref,
            points,
            _,
        ) = _load_delete_request(request)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except LookupError as exc:
        return _json_error(str(exc), 404)
    except PermissionError as exc:
        return _json_error(str(exc), 403)

    expected_name = str(context["participant"].get("name") or "").strip()
    if scope == "all" and str(payload.get("confirmation") or "").strip() != expected_name:
        return _json_error("Participant name confirmation does not match.", 400)

    archived_deleted_count = delete_archived_location_tracks(
        get_firestore_client(),
        trip_id,
        participant_id,
        scope,
        date_value=payload.get("date") or "",
        point_id=payload.get("pointId") or "",
    )
    rtdb_points = _get_scope_points(
        track_ref,
        scope,
        point_id=payload.get("pointId"),
        date_value=payload.get("date"),
        timezone_name=context["timezone"],
    )
    rtdb_deleted_count = _delete_points(track_ref, scope, rtdb_points)
    deleted_count = archived_deleted_count + rtdb_deleted_count
    log_ref = get_firestore_client().collection("locationTrackDeletionLogs").document()
    log_ref.set(
        {
            "tripId": trip_id,
            "participantId": participant_id,
            "participantName": expected_name,
            "scope": scope,
            "date": payload.get("date") if scope == "day" else "",
            "pointId": payload.get("pointId") if scope == "point" else "",
            "deletedCount": deleted_count,
            "archivedDeletedCount": archived_deleted_count,
            "rtdbDeletedCount": rtdb_deleted_count,
            "firstTimestamp": points[0]["ts"] if points else None,
            "lastTimestamp": points[-1]["ts"] if points else None,
            "createdByUid": admin.get("uid"),
            "createdByName": admin.get("name"),
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    )

    return {
        "status": "ok",
        "logId": log_ref.id,
        "tripId": trip_id,
        "participantId": participant_id,
        "scope": scope,
        "deletedCount": deleted_count,
    }, 200
