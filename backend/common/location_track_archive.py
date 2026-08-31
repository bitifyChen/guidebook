import gzip
import hashlib
import json
import math


EARTH_RADIUS_METERS = 6_371_000
ARCHIVE_CODEC = "gzip-json-v1"
ARCHIVE_SCHEMA_VERSION = 1
MAX_ARCHIVE_PAYLOAD_BYTES = 800_000
DEFAULT_MAX_ACCURACY_METERS = 150
DEFAULT_MAX_SPIKE_GAP_MINUTES = 10
DEFAULT_STOP_RADIUS_METERS = 35
DEFAULT_STOP_MIN_DURATION_MINUTES = 15
DEFAULT_STOP_MAX_GAP_MINUTES = 10

TRACK_POINT_FIELDS = (
    "id",
    "lat",
    "lng",
    "ts",
    "acc",
    "bat",
    "spd",
    "alt",
    "course",
    "source",
)


def _to_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _to_int(value):
    number = _to_float(value)
    return int(number) if number is not None else None


def get_distance_meters(first, second):
    latitude_delta = math.radians(second["lat"] - first["lat"])
    longitude_delta = math.radians(second["lng"] - first["lng"])
    first_latitude = math.radians(first["lat"])
    second_latitude = math.radians(second["lat"])
    value = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(first_latitude)
        * math.cos(second_latitude)
        * math.sin(longitude_delta / 2) ** 2
    )
    return EARTH_RADIUS_METERS * 2 * math.atan2(
        math.sqrt(value), math.sqrt(max(0, 1 - value))
    )


def normalize_track_points(raw_points, max_accuracy_meters=DEFAULT_MAX_ACCURACY_METERS):
    if isinstance(raw_points, dict):
        entries = raw_points.items()
    else:
        entries = (
            (str(point.get("id") or index), point)
            for index, point in enumerate(raw_points or [])
            if isinstance(point, dict)
        )

    normalized = []
    rejected_count = 0
    seen_ids = set()
    seen_coordinates = set()
    for point_id, data in entries:
        if not isinstance(data, dict):
            rejected_count += 1
            continue

        lat = _to_float(data.get("lat"))
        lng = _to_float(data.get("lng"))
        timestamp = _to_int(data.get("ts"))
        accuracy = _to_float(data.get("acc", data.get("accuracy")))
        normalized_id = str(point_id or data.get("id") or "")
        if (
            not normalized_id
            or lat is None
            or lng is None
            or timestamp is None
            or not -90 <= lat <= 90
            or not -180 <= lng <= 180
            or (accuracy is not None and accuracy > max_accuracy_meters)
        ):
            rejected_count += 1
            continue

        coordinate_key = (timestamp, round(lat, 7), round(lng, 7))
        if normalized_id in seen_ids or coordinate_key in seen_coordinates:
            rejected_count += 1
            continue

        point = {
            "id": normalized_id,
            "lat": lat,
            "lng": lng,
            "ts": timestamp,
        }
        for field in ("acc", "bat", "spd", "alt", "course"):
            value = _to_float(data.get(field))
            if value is not None:
                point[field] = value
        if data.get("source"):
            point["source"] = str(data["source"])

        seen_ids.add(normalized_id)
        seen_coordinates.add(coordinate_key)
        normalized.append(point)

    normalized.sort(key=lambda item: (item["ts"], item["id"]))
    return normalized, rejected_count


def _is_isolated_spike(previous, point, following, max_gap_ms):
    if previous is None or following is None:
        return False
    previous_gap = point["ts"] - previous["ts"]
    following_gap = following["ts"] - point["ts"]
    if (
        previous_gap <= 0
        or following_gap <= 0
        or previous_gap > max_gap_ms
        or following_gap > max_gap_ms
    ):
        return False

    return (
        get_distance_meters(previous, point) > 150
        and get_distance_meters(point, following) > 150
        and get_distance_meters(previous, following) < 75
    )


def sanitize_track_points(raw_points, max_spike_gap_minutes=DEFAULT_MAX_SPIKE_GAP_MINUTES):
    points, rejected_count = normalize_track_points(raw_points)
    max_gap_ms = max_spike_gap_minutes * 60 * 1000
    cleaned = []
    for index, point in enumerate(points):
        if _is_isolated_spike(
            points[index - 1] if index else None,
            point,
            points[index + 1] if index + 1 < len(points) else None,
            max_gap_ms,
        ):
            rejected_count += 1
            continue
        cleaned.append(point)
    return cleaned, rejected_count


def _complete_stop(points, start_index, end_index, min_duration_ms):
    if end_index <= start_index:
        return None
    arrived_at = points[start_index]["ts"]
    left_at = points[end_index]["ts"]
    if left_at - arrived_at < min_duration_ms:
        return None

    cluster = points[start_index : end_index + 1]
    return {
        "id": f"{arrived_at}-{left_at}",
        "lat": sum(point["lat"] for point in cluster) / len(cluster),
        "lng": sum(point["lng"] for point in cluster) / len(cluster),
        "arrivedAt": arrived_at,
        "leftAt": left_at,
        "durationMinutes": round((left_at - arrived_at) / 60_000),
        "pointsCount": len(cluster),
        "startIndex": start_index,
        "endIndex": end_index,
    }


def detect_track_stops(
    points,
    radius_meters=DEFAULT_STOP_RADIUS_METERS,
    min_duration_minutes=DEFAULT_STOP_MIN_DURATION_MINUTES,
    max_point_gap_minutes=DEFAULT_STOP_MAX_GAP_MINUTES,
):
    if len(points) < 2:
        return []

    max_gap_ms = max_point_gap_minutes * 60 * 1000
    min_duration_ms = min_duration_minutes * 60 * 1000
    stops = []
    start_index = 0
    latitude_total = points[0]["lat"]
    longitude_total = points[0]["lng"]

    for index in range(1, len(points)):
        point = points[index]
        previous = points[index - 1]
        cluster_size = index - start_index
        center = {
            "lat": latitude_total / cluster_size,
            "lng": longitude_total / cluster_size,
        }
        if (
            point["ts"] - previous["ts"] <= max_gap_ms
            and get_distance_meters(center, point) <= radius_meters
        ):
            latitude_total += point["lat"]
            longitude_total += point["lng"]
            continue

        stop = _complete_stop(points, start_index, index - 1, min_duration_ms)
        if stop:
            stops.append(stop)
        start_index = index
        latitude_total = point["lat"]
        longitude_total = point["lng"]

    stop = _complete_stop(points, start_index, len(points) - 1, min_duration_ms)
    if stop:
        stops.append(stop)
    return stops


def compact_stationary_points(points, stops, max_anchor_gap_minutes=10):
    if not stops:
        return list(points)

    max_anchor_gap_ms = max_anchor_gap_minutes * 60 * 1000
    stop_by_start = {stop["startIndex"]: stop for stop in stops}
    compacted = []
    index = 0
    while index < len(points):
        stop = stop_by_start.get(index)
        if not stop:
            compacted.append(points[index])
            index += 1
            continue

        cluster = points[stop["startIndex"] : stop["endIndex"] + 1]
        kept = [cluster[0]]
        for point in cluster[1:-1]:
            if point["ts"] - kept[-1]["ts"] >= max_anchor_gap_ms:
                kept.append(point)
        if cluster[-1]["id"] != kept[-1]["id"]:
            kept.append(cluster[-1])
        compacted.extend(kept)
        index = stop["endIndex"] + 1
    return compacted


def _public_stop(stop):
    return {key: value for key, value in stop.items() if key not in {"startIndex", "endIndex"}}


def _track_distance(points, max_gap_minutes=DEFAULT_STOP_MAX_GAP_MINUTES):
    max_gap_ms = max_gap_minutes * 60 * 1000
    distance = 0
    for previous, point in zip(points, points[1:]):
        if point["ts"] - previous["ts"] <= max_gap_ms:
            distance += get_distance_meters(previous, point)
    return round(distance)


def build_archive_segment(trip_id, timezone_name, raw_points):
    cleaned, rejected_count = sanitize_track_points(raw_points)
    stops = detect_track_stops(cleaned)
    compacted = compact_stationary_points(cleaned, stops)
    return {
        "tripId": str(trip_id),
        "timezone": timezone_name or "UTC",
        "points": [{key: point[key] for key in TRACK_POINT_FIELDS if key in point} for point in compacted],
        "stops": [_public_stop(stop) for stop in stops],
        "summary": {
            "sourcePointCount": len(raw_points or {}),
            "pointCount": len(compacted),
            "rejectedPointCount": rejected_count,
            "removedStationaryPointCount": max(0, len(cleaned) - len(compacted)),
            "stopsCount": len(stops),
            "distanceMeters": _track_distance(cleaned),
            "startedAt": compacted[0]["ts"] if compacted else None,
            "endedAt": compacted[-1]["ts"] if compacted else None,
        },
    }


def build_archive_payload(participant_id, date_value, segments):
    return {
        "schemaVersion": ARCHIVE_SCHEMA_VERSION,
        "participantId": str(participant_id),
        "date": str(date_value),
        "segments": sorted(segments, key=lambda item: item.get("tripId", "")),
    }


def encode_archive_payload(payload):
    raw = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    return compressed, hashlib.sha256(compressed).hexdigest()


def decode_archive_payload(payload_bytes):
    if hasattr(payload_bytes, "to_bytes"):
        payload_bytes = payload_bytes.to_bytes()
    if not isinstance(payload_bytes, (bytes, bytearray)):
        raise ValueError("Archive payload must be bytes.")
    return json.loads(gzip.decompress(bytes(payload_bytes)).decode("utf-8"))


def summarize_archive_payload(payload):
    segments = payload.get("segments") or []
    summaries = [segment.get("summary") or {} for segment in segments]
    starts = [summary.get("startedAt") for summary in summaries if summary.get("startedAt")]
    ends = [summary.get("endedAt") for summary in summaries if summary.get("endedAt")]
    return {
        "tripIds": sorted(
            {str(segment.get("tripId")) for segment in segments if segment.get("tripId")}
        ),
        "pointCount": sum(int(summary.get("pointCount") or 0) for summary in summaries),
        "sourcePointCount": sum(
            int(summary.get("sourcePointCount") or 0) for summary in summaries
        ),
        "rejectedPointCount": sum(
            int(summary.get("rejectedPointCount") or 0) for summary in summaries
        ),
        "removedStationaryPointCount": sum(
            int(summary.get("removedStationaryPointCount") or 0)
            for summary in summaries
        ),
        "stopsCount": sum(int(summary.get("stopsCount") or 0) for summary in summaries),
        "distanceMeters": sum(
            int(summary.get("distanceMeters") or 0) for summary in summaries
        ),
        "startedAt": min(starts) if starts else None,
        "endedAt": max(ends) if ends else None,
    }
