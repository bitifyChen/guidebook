import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from firebase_admin import firestore

from common.firebase import get_firestore_client, get_rtdb_reference
from common.location_track_archive import (
    ARCHIVE_CODEC,
    MAX_ARCHIVE_PAYLOAD_BYTES,
    build_archive_payload,
    build_archive_segment,
    decode_archive_payload,
    encode_archive_payload,
    summarize_archive_payload,
)


DEFAULT_BUFFER_HOURS = 48
DEFAULT_MAX_ARCHIVES = 200
INVALID_KEY_CHARACTERS = set("/.#$[]")


def _json_error(message, status=400):
    return {"status": "error", "message": message}, status


def _validate_key(value, field):
    normalized = str(value or "").strip()
    if (
        not normalized
        or len(normalized) > 256
        or any(character in INVALID_KEY_CHARACTERS for character in normalized)
    ):
        raise ValueError(f"{field} is invalid.")
    return normalized


def _validate_date(value):
    normalized = str(value or "").strip()
    try:
        datetime.strptime(normalized, "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError("date must use YYYY-MM-DD format.") from exc
    return normalized


def _request_secret(request):
    authorization = request.headers.get("Authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


def _verify_archive_request(request):
    configured_secret = os.getenv("MAINTENANCE_API_TOKEN", "").strip()
    if not configured_secret:
        return False, "MAINTENANCE_API_TOKEN is not configured."
    if not hmac.compare_digest(_request_secret(request), configured_secret):
        return False, "Archive authorization failed."
    return True, ""


def _safe_timezone(value):
    try:
        return ZoneInfo(value or "UTC")
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def _local_date(timestamp, timezone_name):
    return datetime.fromtimestamp(timestamp / 1000, _safe_timezone(timezone_name)).strftime(
        "%Y-%m-%d"
    )


def _date_end_timestamp(date_value, timezone_name):
    day_start = datetime.strptime(date_value, "%Y-%m-%d").replace(
        tzinfo=_safe_timezone(timezone_name)
    )
    return int((day_start + timedelta(days=1)).timestamp() * 1000)


def _normalize_positive_integer(value, fallback, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return fallback
    return min(max(1, number), maximum)


def _batch_checksum(raw_points):
    canonical = json.dumps(
        raw_points or {},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _archive_document(firestore_client, participant_id, date_value):
    return (
        firestore_client.collection("participantTrackArchives")
        .document(participant_id)
        .collection("days")
        .document(date_value)
    )


def _load_existing_payload(document_snapshot, participant_id, date_value):
    if not document_snapshot.exists:
        return build_archive_payload(participant_id, date_value, []), 0
    data = document_snapshot.to_dict() or {}
    if data.get("codec") != ARCHIVE_CODEC or not data.get("payload"):
        raise ValueError("Existing archive has an unsupported payload format.")
    return decode_archive_payload(data["payload"]), int(data.get("revision") or 0)


def _merge_segment(existing_segment, trip_id, timezone_name, raw_points):
    batch_checksum = _batch_checksum(raw_points)
    previous_batches = list(existing_segment.get("sourceBatchChecksums") or [])
    if batch_checksum in previous_batches:
        return existing_segment, False

    merged_points = {
        str(point.get("id")): point
        for point in (existing_segment.get("points") or [])
        if point.get("id")
    }
    merged_points.update(raw_points or {})
    segment = build_archive_segment(trip_id, timezone_name, merged_points)
    segment["sourceBatchChecksums"] = [*previous_batches, batch_checksum][-32:]

    previous_summary = existing_segment.get("summary") or {}
    segment["summary"]["sourcePointCount"] = int(
        previous_summary.get("sourcePointCount") or 0
    ) + len(raw_points or {})
    return segment, True


def _payload_bytes(value):
    if hasattr(value, "to_bytes"):
        return value.to_bytes()
    return bytes(value)


def _write_and_verify_archive(
    firestore_client,
    participant_id,
    date_value,
    trip_id,
    timezone_name,
    raw_points,
):
    document = _archive_document(firestore_client, participant_id, date_value)
    snapshot = document.get()
    payload, current_revision = _load_existing_payload(
        snapshot, participant_id, date_value
    )
    segments = list(payload.get("segments") or [])
    existing_segment = next(
        (segment for segment in segments if segment.get("tripId") == trip_id),
        {"tripId": trip_id, "points": [], "summary": {}},
    )
    merged_segment, changed = _merge_segment(
        existing_segment, trip_id, timezone_name, raw_points
    )

    if changed:
        segments = [
            segment for segment in segments if segment.get("tripId") != trip_id
        ]
        segments.append(merged_segment)
        payload = build_archive_payload(participant_id, date_value, segments)
        payload_bytes, checksum = encode_archive_payload(payload)
        if len(payload_bytes) > MAX_ARCHIVE_PAYLOAD_BYTES:
            raise ValueError(
                f"Archive payload is too large ({len(payload_bytes)} bytes)."
            )
        revision = current_revision + 1
        document.set(
            {
                "participantId": participant_id,
                "date": date_value,
                "codec": ARCHIVE_CODEC,
                "payload": payload_bytes,
                "payloadBytes": len(payload_bytes),
                "checksum": checksum,
                "revision": revision,
                **summarize_archive_payload(payload),
                "archivedAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
    else:
        existing_data = snapshot.to_dict() or {}
        payload_bytes = _payload_bytes(existing_data.get("payload"))
        checksum = existing_data.get("checksum")
        revision = current_revision

    verified_snapshot = document.get()
    if not verified_snapshot.exists:
        raise ValueError("Archive verification failed: document is missing.")
    verified_data = verified_snapshot.to_dict() or {}
    verified_bytes = _payload_bytes(verified_data.get("payload"))
    if hashlib.sha256(verified_bytes).hexdigest() != verified_data.get("checksum"):
        raise ValueError("Archive verification failed: checksum mismatch.")
    verified_payload = decode_archive_payload(verified_bytes)
    if (
        verified_payload.get("participantId") != participant_id
        or verified_payload.get("date") != date_value
        or not any(
            segment.get("tripId") == trip_id
            for segment in verified_payload.get("segments") or []
        )
    ):
        raise ValueError("Archive verification failed: payload identity mismatch.")
    firestore_client.collection("participants").document(participant_id).set(
        {
            "trackArchiveVersion": int(
                datetime.now(timezone.utc).timestamp() * 1000
            ),
            "trackArchiveUpdatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    return {
        "changed": changed,
        "revision": revision,
        "payloadBytes": len(payload_bytes),
        "checksum": checksum,
        "segment": merged_segment,
    }


def _load_trip_timezone(firestore_client, trip_id, cache):
    if trip_id in cache:
        return cache[trip_id]
    snapshot = firestore_client.collection("trips").document(trip_id).get()
    timezone_name = (snapshot.to_dict() or {}).get("timezone") if snapshot.exists else None
    cache[trip_id] = timezone_name or "UTC"
    return cache[trip_id]


def _iter_track_pairs(state_tree):
    for trip_id in sorted((state_tree or {}).keys()):
        participants = state_tree.get(trip_id)
        if not isinstance(participants, dict):
            continue
        for participant_id in sorted(participants.keys()):
            yield str(trip_id), str(participant_id)


def _eligible_day_groups(raw_points, timezone_name, cutoff_timestamp):
    groups = {}
    for point_id, point in (raw_points or {}).items():
        if not isinstance(point, dict):
            continue
        try:
            timestamp = int(float(point.get("ts")))
        except (TypeError, ValueError):
            continue
        date_value = _local_date(timestamp, timezone_name)
        if _date_end_timestamp(date_value, timezone_name) > cutoff_timestamp:
            continue
        groups.setdefault(date_value, {})[point_id] = point
    return groups


def run_location_track_archive(
    *,
    now=None,
    buffer_hours=DEFAULT_BUFFER_HOURS,
    max_archives=DEFAULT_MAX_ARCHIVES,
    dry_run=False,
):
    now = now or datetime.now(timezone.utc)
    cutoff_timestamp = int((now - timedelta(hours=buffer_hours)).timestamp() * 1000)
    firestore_client = get_firestore_client()
    state_tree = get_rtdb_reference("trackingTrackState").get() or {}
    timezone_cache = {}
    results = []
    failures = []
    archived_count = 0
    deleted_point_count = 0
    stopped_early = False

    for trip_id, participant_id in _iter_track_pairs(state_tree):
        track_reference = get_rtdb_reference(
            f"tripLocationTracks/{trip_id}/{participant_id}"
        )
        raw_points = (
            track_reference.order_by_child("ts").end_at(cutoff_timestamp).get() or {}
        )
        if not raw_points:
            continue
        timezone_name = _load_trip_timezone(
            firestore_client, trip_id, timezone_cache
        )
        day_groups = _eligible_day_groups(
            raw_points, timezone_name, cutoff_timestamp
        )
        for date_value in sorted(day_groups.keys()):
            if archived_count >= max_archives:
                stopped_early = True
                break
            day_points = day_groups[date_value]
            try:
                if dry_run:
                    segment = build_archive_segment(
                        trip_id, timezone_name, day_points
                    )
                    archive_result = {
                        "changed": False,
                        "revision": None,
                        "payloadBytes": None,
                        "segment": segment,
                    }
                else:
                    archive_result = _write_and_verify_archive(
                        firestore_client,
                        participant_id,
                        date_value,
                        trip_id,
                        timezone_name,
                        day_points,
                    )
                    track_reference.update(
                        {point_id: None for point_id in day_points.keys()}
                    )
                    deleted_point_count += len(day_points)

                archived_count += 1
                results.append(
                    {
                        "tripId": trip_id,
                        "participantId": participant_id,
                        "date": date_value,
                        "sourcePointCount": len(day_points),
                        "pointCount": archive_result["segment"]["summary"]["pointCount"],
                        "stopsCount": archive_result["segment"]["summary"]["stopsCount"],
                        "revision": archive_result["revision"],
                        "payloadBytes": archive_result["payloadBytes"],
                        "changed": archive_result["changed"],
                    }
                )
            except Exception as exc:
                failures.append(
                    {
                        "tripId": trip_id,
                        "participantId": participant_id,
                        "date": date_value,
                        "sourcePointCount": len(day_points),
                        "message": str(exc),
                    }
                )
        if stopped_early:
            break

    run_summary = {
        "status": "partial" if failures or stopped_early else "ok",
        "dryRun": dry_run,
        "bufferHours": buffer_hours,
        "cutoffTimestamp": cutoff_timestamp,
        "archivedCount": archived_count,
        "deletedPointCount": deleted_point_count,
        "failureCount": len(failures),
        "hasMore": stopped_early,
        "archives": results,
        "failures": failures,
    }
    if not dry_run:
        firestore_client.collection("locationTrackArchiveRuns").document().set(
            {
                **{
                    key: value
                    for key, value in run_summary.items()
                    if key not in {"archives", "failures"}
                },
                "failures": failures[:20],
                "createdAt": firestore.SERVER_TIMESTAMP,
            }
        )
    return run_summary


def handle_location_track_archive(request):
    authorized, message = _verify_archive_request(request)
    if not authorized:
        status = 503 if "not configured" in message else 401
        return _json_error(message, status)

    payload = request.get_json(silent=True) or {}
    buffer_hours = _normalize_positive_integer(
        payload.get("bufferHours", os.getenv("TRACK_ARCHIVE_BUFFER_HOURS")),
        DEFAULT_BUFFER_HOURS,
        168,
    )
    max_archives = _normalize_positive_integer(
        payload.get("maxArchives", os.getenv("TRACK_ARCHIVE_MAX_ARCHIVES")),
        DEFAULT_MAX_ARCHIVES,
        1000,
    )
    try:
        result = run_location_track_archive(
            buffer_hours=buffer_hours,
            max_archives=max_archives,
            dry_run=bool(payload.get("dryRun", False)),
        )
    except Exception as exc:
        return _json_error(f"Archive job failed: {exc}", 500)
    return result, 200


def handle_get_location_track_archive(request):
    try:
        trip_id = _validate_key(request.args.get("tripId"), "tripId")
        participant_id = _validate_key(
            request.args.get("participantId"), "participantId"
        )
        date_value = _validate_date(request.args.get("date"))
    except ValueError as exc:
        return _json_error(str(exc), 400)

    try:
        snapshot = _archive_document(
            get_firestore_client(), participant_id, date_value
        ).get()
        if not snapshot.exists:
            return {
                "status": "ok",
                "found": False,
                "tripId": trip_id,
                "participantId": participant_id,
                "date": date_value,
            }, 200

        data = snapshot.to_dict() or {}
        if data.get("codec") != ARCHIVE_CODEC or not data.get("payload"):
            raise ValueError("Archive payload format is unsupported.")
        payload = decode_archive_payload(data["payload"])
        segment = next(
            (
                item
                for item in payload.get("segments") or []
                if item.get("tripId") == trip_id
            ),
            None,
        )
        if segment is None:
            return {
                "status": "ok",
                "found": False,
                "tripId": trip_id,
                "participantId": participant_id,
                "date": date_value,
            }, 200
        return {
            "status": "ok",
            "found": True,
            "tripId": trip_id,
            "participantId": participant_id,
            "date": date_value,
            "revision": int(data.get("revision") or 0),
            "checksum": data.get("checksum") or "",
            "points": segment.get("points") or [],
            "stops": segment.get("stops") or [],
            "summary": segment.get("summary") or {},
        }, 200
    except Exception as exc:
        return _json_error(f"Archive read failed: {exc}", 500)


def get_archived_track_points(
    firestore_client, trip_id, participant_id, date_value
):
    if not date_value:
        return []
    snapshot = _archive_document(
        firestore_client, participant_id, date_value
    ).get()
    if not snapshot.exists:
        return []
    data = snapshot.to_dict() or {}
    if data.get("codec") != ARCHIVE_CODEC or not data.get("payload"):
        raise ValueError("Archive payload format is unsupported.")
    payload = decode_archive_payload(data["payload"])
    segment = next(
        (
            item
            for item in payload.get("segments") or []
            if item.get("tripId") == trip_id
        ),
        None,
    )
    return list(segment.get("points") or []) if segment else []


def _write_revised_payload(document, document_data, payload):
    segments = payload.get("segments") or []
    if not segments:
        document.delete()
        return
    payload_bytes, checksum = encode_archive_payload(payload)
    if len(payload_bytes) > MAX_ARCHIVE_PAYLOAD_BYTES:
        raise ValueError("Revised archive payload is too large.")
    document.set(
        {
            "participantId": payload.get("participantId"),
            "date": payload.get("date"),
            "codec": ARCHIVE_CODEC,
            "payload": payload_bytes,
            "payloadBytes": len(payload_bytes),
            "checksum": checksum,
            "revision": int(document_data.get("revision") or 0) + 1,
            **summarize_archive_payload(payload),
            "archivedAt": document_data.get("archivedAt")
            or firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    verified = document.get().to_dict() or {}
    verified_bytes = _payload_bytes(verified.get("payload"))
    if hashlib.sha256(verified_bytes).hexdigest() != verified.get("checksum"):
        raise ValueError("Revised archive checksum verification failed.")
    decode_archive_payload(verified_bytes)


def _delete_from_archive_document(document, trip_id, scope, point_id=""):
    snapshot = document.get()
    if not snapshot.exists:
        return 0
    document_data = snapshot.to_dict() or {}
    if document_data.get("codec") != ARCHIVE_CODEC or not document_data.get(
        "payload"
    ):
        raise ValueError("Archive payload format is unsupported.")
    payload = decode_archive_payload(document_data["payload"])
    segments = list(payload.get("segments") or [])
    segment = next(
        (item for item in segments if item.get("tripId") == trip_id), None
    )
    if not segment:
        return 0

    if scope == "point":
        remaining_points = [
            point
            for point in segment.get("points") or []
            if str(point.get("id")) != point_id
        ]
        deleted_count = len(segment.get("points") or []) - len(remaining_points)
        if not deleted_count:
            return 0
        revised_segment = build_archive_segment(
            trip_id,
            segment.get("timezone") or "UTC",
            {
                str(point.get("id")): point
                for point in remaining_points
                if point.get("id")
            },
        )
        segments = [
            revised_segment if item.get("tripId") == trip_id else item
            for item in segments
        ]
    else:
        deleted_count = len(segment.get("points") or [])
        segments = [item for item in segments if item.get("tripId") != trip_id]

    payload["segments"] = segments
    _write_revised_payload(document, document_data, payload)
    return deleted_count


def count_archived_track_points(
    firestore_client,
    trip_id,
    participant_id,
    scope,
    date_value="",
    point_id="",
):
    if scope in {"point", "day"}:
        points = get_archived_track_points(
            firestore_client, trip_id, participant_id, date_value
        )
        if scope == "point":
            return sum(1 for point in points if str(point.get("id")) == point_id)
        return len(points)

    days = (
        firestore_client.collection("participantTrackArchives")
        .document(participant_id)
        .collection("days")
    )
    total = 0
    for snapshot in days.stream():
        data = snapshot.to_dict() or {}
        if data.get("codec") != ARCHIVE_CODEC or not data.get("payload"):
            continue
        payload = decode_archive_payload(data["payload"])
        segment = next(
            (
                item
                for item in payload.get("segments") or []
                if item.get("tripId") == trip_id
            ),
            None,
        )
        total += len(segment.get("points") or []) if segment else 0
    return total


def delete_archived_location_tracks(
    firestore_client,
    trip_id,
    participant_id,
    scope,
    date_value="",
    point_id="",
):
    if scope in {"point", "day"}:
        if not date_value:
            if scope == "point":
                return 0
            raise ValueError("date is required for archived day deletion.")
        deleted_count = _delete_from_archive_document(
            _archive_document(firestore_client, participant_id, date_value),
            trip_id,
            scope,
            point_id=point_id,
        )
    else:
        days = (
            firestore_client.collection("participantTrackArchives")
            .document(participant_id)
            .collection("days")
        )
        deleted_count = sum(
            _delete_from_archive_document(snapshot.reference, trip_id, "day")
            for snapshot in list(days.stream())
        )

    if deleted_count:
        firestore_client.collection("participants").document(participant_id).set(
            {
                "trackArchiveVersion": int(
                    datetime.now(timezone.utc).timestamp() * 1000
                ),
                "trackArchiveUpdatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
    return deleted_count
