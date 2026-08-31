import os
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from common.location_track_archive import (
    build_archive_payload,
    build_archive_segment,
    decode_archive_payload,
    encode_archive_payload,
)
from views.location_track_archive import (
    _merge_segment,
    _write_and_verify_archive,
    handle_get_location_track_archive,
    handle_location_track_archive,
    run_location_track_archive,
)


def point(timestamp, lat=25.0, lng=121.0, **extra):
    return {"ts": timestamp, "lat": lat, "lng": lng, "acc": 10, **extra}


class FakeRequest:
    def __init__(self, secret="", payload=None, args=None):
        self.headers = {"Authorization": f"Bearer {secret}"} if secret else {}
        self.payload = payload or {}
        self.args = args or {}

    def get_json(self, silent=True):
        return self.payload


class FakeSnapshot:
    def __init__(self, data=None):
        self.data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self.data or {})


class FakeDocument:
    def __init__(self, data=None):
        self.data = data
        self.writes = []

    def get(self):
        return FakeSnapshot(self.data)

    def set(self, value):
        self.data = dict(value)
        self.writes.append(value)


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = documents or {}
        self.created_documents = []

    def document(self, document_id=None):
        if document_id is None:
            document = FakeDocument()
            self.created_documents.append(document)
            return document
        return self.documents.setdefault(document_id, FakeDocument())


class FakeFirestore:
    def __init__(self, trip_timezone="Asia/Taipei"):
        self.trip_document = FakeDocument({"timezone": trip_timezone})
        self.run_collection = FakeCollection()

    def collection(self, name):
        if name == "trips":
            return FakeCollection({"trip-a": self.trip_document})
        if name == "locationTrackArchiveRuns":
            return self.run_collection
        raise AssertionError(f"Unexpected collection: {name}")


class FakeTrackReference:
    def __init__(self, values):
        self.values = dict(values)
        self.end = None
        self.updated = False

    def order_by_child(self, field):
        self.order_field = field
        return self

    def end_at(self, value):
        self.end = value
        return self

    def get(self):
        if self.end is None:
            return dict(self.values)
        return {
            key: value
            for key, value in self.values.items()
            if value.get("ts", 0) <= self.end
        }

    def update(self, values):
        self.updated = True
        for key, value in values.items():
            if value is None:
                self.values.pop(key, None)


class StoredDocument(FakeDocument):
    def set(self, value, merge=False):
        if merge and self.data:
            self.data.update(value)
        else:
            self.data = dict(value)
        self.writes.append(value)


class ArchiveParticipantDocument:
    def __init__(self, days):
        self.days = days

    def collection(self, name):
        if name != "days":
            raise AssertionError(f"Unexpected subcollection: {name}")
        return ArchiveDaysCollection(self.days)


class ArchiveDaysCollection:
    def __init__(self, days):
        self.days = days

    def document(self, date_value):
        return self.days.setdefault(date_value, StoredDocument())


class ArchiveRootCollection:
    def __init__(self, archives):
        self.archives = archives

    def document(self, participant_id):
        return ArchiveParticipantDocument(
            self.archives.setdefault(participant_id, {})
        )


class ParticipantCollection:
    def __init__(self, participants):
        self.participants = participants

    def document(self, participant_id):
        return self.participants.setdefault(participant_id, StoredDocument({}))


class ArchiveFirestore:
    def __init__(self):
        self.archives = {}
        self.participants = {}

    def collection(self, name):
        if name == "participantTrackArchives":
            return ArchiveRootCollection(self.archives)
        if name == "participants":
            return ParticipantCollection(self.participants)
        raise AssertionError(f"Unexpected collection: {name}")


class LocationTrackArchiveTests(unittest.TestCase):
    def test_compacts_stationary_heartbeats_and_preserves_stop_duration(self):
        minute = 60 * 1000
        raw = {
            "a": point(0),
            "b": point(5 * minute, 25.00005, 121.00005),
            "c": point(10 * minute, 25.00004, 121.00004),
            "d": point(15 * minute, 25.00003, 121.00003),
            "e": point(20 * minute, 25.01, 121.01),
        }

        segment = build_archive_segment("trip-a", "Asia/Taipei", raw)

        self.assertEqual(segment["summary"]["stopsCount"], 1)
        self.assertEqual(segment["stops"][0]["durationMinutes"], 15)
        self.assertLess(segment["summary"]["pointCount"], len(raw))
        self.assertEqual(segment["points"][0]["ts"], 0)
        self.assertEqual(segment["points"][-1]["ts"], 20 * minute)

    def test_does_not_infer_a_stop_across_a_long_location_gap(self):
        minute = 60 * 1000
        segment = build_archive_segment(
            "trip-a",
            "Asia/Taipei",
            {
                "a": point(0),
                "b": point(5 * minute),
                "c": point(25 * minute),
            },
        )

        self.assertEqual(segment["stops"], [])

    def test_rejects_an_isolated_gps_spike(self):
        minute = 60 * 1000
        segment = build_archive_segment(
            "trip-a",
            "Asia/Taipei",
            {
                "a": point(0),
                "spike": point(5 * minute, 25.02, 121.02),
                "b": point(10 * minute, 25.00001, 121.00001),
            },
        )

        self.assertEqual(segment["summary"]["rejectedPointCount"], 1)
        self.assertNotIn("spike", [item["id"] for item in segment["points"]])

    def test_archive_payload_round_trip_is_deterministic(self):
        segment = build_archive_segment(
            "trip-a", "Asia/Taipei", {"a": point(1_000)}
        )
        payload = build_archive_payload("member-a", "2026-08-01", [segment])

        first_bytes, first_checksum = encode_archive_payload(payload)
        second_bytes, second_checksum = encode_archive_payload(payload)

        self.assertEqual(first_bytes, second_bytes)
        self.assertEqual(first_checksum, second_checksum)
        self.assertEqual(decode_archive_payload(first_bytes), payload)

    def test_repeated_source_batch_does_not_create_a_new_segment_revision(self):
        raw = {"a": point(1_000), "b": point(2_000, 25.001, 121.001)}
        first, changed = _merge_segment(
            {"tripId": "trip-a", "points": [], "summary": {}},
            "trip-a",
            "Asia/Taipei",
            raw,
        )
        repeated, repeated_changed = _merge_segment(
            first, "trip-a", "Asia/Taipei", raw
        )

        self.assertTrue(changed)
        self.assertFalse(repeated_changed)
        self.assertEqual(repeated, first)

    def test_firestore_archive_is_verified_and_repeated_batches_are_idempotent(self):
        firestore_client = ArchiveFirestore()
        raw = {"a": point(1_000), "b": point(2_000, 25.001, 121.001)}

        first = _write_and_verify_archive(
            firestore_client,
            "member-a",
            "2026-08-01",
            "trip-a",
            "Asia/Taipei",
            raw,
        )
        repeated = _write_and_verify_archive(
            firestore_client,
            "member-a",
            "2026-08-01",
            "trip-a",
            "Asia/Taipei",
            raw,
        )
        stored = firestore_client.archives["member-a"]["2026-08-01"].data

        self.assertTrue(first["changed"])
        self.assertEqual(first["revision"], 1)
        self.assertFalse(repeated["changed"])
        self.assertEqual(repeated["revision"], 1)
        self.assertEqual(stored["codec"], "gzip-json-v1")
        self.assertEqual(stored["tripIds"], ["trip-a"])
        self.assertIn("trackArchiveVersion", firestore_client.participants["member-a"].data)

    def test_archive_failure_keeps_source_points(self):
        old_timestamp = int(
            datetime(2026, 8, 1, 12, tzinfo=timezone.utc).timestamp() * 1000
        )
        track_reference = FakeTrackReference({"a": point(old_timestamp)})
        state_reference = Mock()
        state_reference.get.return_value = {"trip-a": {"member-a": {}}}
        firestore_client = FakeFirestore()

        def reference(path):
            if path == "trackingTrackState":
                return state_reference
            return track_reference

        with patch(
            "views.location_track_archive.get_firestore_client",
            return_value=firestore_client,
        ), patch(
            "views.location_track_archive.get_rtdb_reference",
            side_effect=reference,
        ), patch(
            "views.location_track_archive._write_and_verify_archive",
            side_effect=ValueError("verification failed"),
        ):
            result = run_location_track_archive(
                now=datetime(2026, 8, 5, tzinfo=timezone.utc)
            )

        self.assertEqual(result["failureCount"], 1)
        self.assertIn("a", track_reference.values)
        self.assertFalse(track_reference.updated)

    def test_endpoint_requires_the_configured_secret(self):
        with patch.dict(os.environ, {"MAINTENANCE_API_TOKEN": "correct"}):
            payload, status = handle_location_track_archive(
                FakeRequest(secret="wrong")
            )

        self.assertEqual(status, 401)
        self.assertEqual(payload["status"], "error")

    def test_endpoint_runs_a_dry_run_with_the_configured_secret(self):
        with patch.dict(os.environ, {"MAINTENANCE_API_TOKEN": "correct"}), patch(
            "views.location_track_archive.run_location_track_archive",
            return_value={"status": "ok", "dryRun": True},
        ) as archive_job:
            payload, status = handle_location_track_archive(
                FakeRequest(secret="correct", payload={"dryRun": True})
            )

        self.assertEqual(status, 200)
        self.assertTrue(payload["dryRun"])
        archive_job.assert_called_once_with(
            buffer_hours=48,
            max_archives=200,
            dry_run=True,
        )

    def test_archive_read_returns_only_the_requested_trip_segment(self):
        segment_a = build_archive_segment(
            "trip-a", "Asia/Taipei", {"a": point(1_000)}
        )
        segment_b = build_archive_segment(
            "trip-b", "Asia/Tokyo", {"b": point(2_000)}
        )
        archive_payload = build_archive_payload(
            "member-a", "2026-08-01", [segment_a, segment_b]
        )
        payload_bytes, checksum = encode_archive_payload(archive_payload)
        document = FakeDocument(
            {
                "codec": "gzip-json-v1",
                "payload": payload_bytes,
                "checksum": checksum,
                "revision": 3,
            }
        )

        with patch(
            "views.location_track_archive._archive_document",
            return_value=document,
        ), patch("views.location_track_archive.get_firestore_client"):
            payload, status = handle_get_location_track_archive(
                FakeRequest(
                    args={
                        "tripId": "trip-b",
                        "participantId": "member-a",
                        "date": "2026-08-01",
                    }
                )
            )

        self.assertEqual(status, 200)
        self.assertTrue(payload["found"])
        self.assertEqual(payload["revision"], 3)
        self.assertEqual([item["id"] for item in payload["points"]], ["b"])


if __name__ == "__main__":
    unittest.main()
