import hashlib
import math
import secrets
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


def _load_participant_trip_ids(participant_id):
    if not participant_id:
        return []

    snapshot = get_firestore_client().collection("participants").document(participant_id).get()
    if not snapshot.exists:
        return []

    data = snapshot.to_dict() or {}
    trip_ids = data.get("tripIds") or ([data.get("tripId")] if data.get("tripId") else [])
    return list(dict.fromkeys([trip_id for trip_id in trip_ids if trip_id]))


def _distance_meters(first, second):
    earth_radius = 6_371_000
    lat1 = math.radians(float(first["lat"]))
    lat2 = math.radians(float(second["lat"]))
    delta_lat = lat2 - lat1
    delta_lng = math.radians(float(second["lng"]) - float(first["lng"]))
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
    )
    value = max(0.0, min(1.0, value))
    return earth_radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _should_record_history(
    trip_id,
    participant_id,
    location,
    min_interval_seconds=30,
    min_distance_meters=15,
    heartbeat_seconds=300,
):
    state_path = f"trackingTrackState/{trip_id}/{participant_id}"
    previous = get_rtdb_reference(state_path).get() or {}
    if not previous.get("receivedAt"):
        return True

    elapsed_ms = int(location["updatedAt"]) - int(previous.get("receivedAt") or 0)
    if elapsed_ms >= int(heartbeat_seconds) * 1000:
        return True
    if elapsed_ms < int(min_interval_seconds) * 1000:
        return False

    try:
        return _distance_meters(previous, location) >= float(min_distance_meters)
    except (KeyError, TypeError, ValueError):
        return True


def _build_history_point(location):
    fields = ("lat", "lng", "ts", "acc", "bat", "spd", "source")
    return {key: location[key] for key in fields if location.get(key) is not None}


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
    trip_ids = _load_participant_trip_ids(participant_id)
    if not participant_id or not trip_ids:
        return {"status": "error", "message": "Tracking token is incomplete"}, 403

    token_trip_id = token_data.get("tripId")
    history_trip_ids = (
        [token_trip_id]
        if token_trip_id in trip_ids
        else trip_ids
        if len(trip_ids) == 1
        else []
    )

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

    updates = {
        f"tripLocations/{trip_id}/{participant_id}": location for trip_id in trip_ids
    }
    history_recorded = False
    history_point = _build_history_point(location)
    history_min_interval = int(token_data.get("historyMinIntervalSeconds") or 30)
    history_min_distance = float(token_data.get("historyMinDistanceMeters") or 15)
    history_heartbeat = int(token_data.get("historyHeartbeatSeconds") or 300)

    if token_data.get("historyEnabled", True):
        for trip_id in history_trip_ids:
            if not _should_record_history(
                trip_id,
                participant_id,
                location,
                history_min_interval,
                history_min_distance,
                history_heartbeat,
            ):
                continue
            point_id = f"{timestamp_ms}_{secrets.token_hex(4)}"
            updates[
                f"tripLocationTracks/{trip_id}/{participant_id}/{point_id}"
            ] = history_point
            updates[f"trackingTrackState/{trip_id}/{participant_id}"] = {
                "lat": location["lat"],
                "lng": location["lng"],
                "ts": location["ts"],
                "receivedAt": location["updatedAt"],
            }
            history_recorded = True

    updates[throttle_path] = {"updatedAt": location["updatedAt"]}
    get_rtdb_reference("/").update(updates)

    return {
        "status": "ok",
        "tripIds": trip_ids,
        "participantId": participant_id,
        "updatedAt": location["updatedAt"],
        "historyRecorded": history_recorded,
    }, 200
