import io
import sys
import unittest
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from views.location_track_export import (  # noqa: E402
    DEFAULT_RETENTION_DAYS,
    _build_record,
    _is_expired,
    _normalize_request,
    _download_response,
    _retention_candidates,
    build_geojson,
    build_gpx,
    handle_admin_location_track_retention,
    handle_export_admin_location_tracks,
    handle_preview_admin_location_track_retention,
    run_location_track_retention,
)
from common.location_track_archive import (  # noqa: E402
    build_archive_payload,
    build_archive_segment,
    encode_archive_payload,
)


class FakeRequest:
    def __init__(self, payload=None, headers=None):
        self._payload = payload or {}
        self.headers = headers or {}

    def get_json(self, silent=True):
        return self._payload


class FakeSnapshot:
    def __init__(self, document_id, data=None, path=""):
        self.id = document_id
        self._data = data
        self.exists = data is not None
        self.reference = Mock(path=path or f"days/{document_id}")

    def to_dict(self):
        return dict(self._data or {})


class FakeDocument:
    def __init__(self, document_id, data=None, days=None):
        self.document_id = document_id
        self.data = data
        self.days = days or {}

    def get(self):
        return FakeSnapshot(self.document_id, self.data)

    def collection(self, name):
        if name != "days":
            raise AssertionError(f"Unexpected subcollection: {name}")
        return FakeCollection(self.days)


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = documents or {}

    def document(self, document_id):
        return self.documents[document_id]


class FakeFirestore:
    def __init__(self, collections=None, day_snapshots=None):
        self.collections = collections or {}
        self.day_snapshots = day_snapshots or []

    def collection(self, name):
        return self.collections[name]

    def collection_group(self, name):
        if name != "days":
            raise AssertionError(f"Unexpected collection group: {name}")
        collection = Mock()
        collection.stream.return_value = self.day_snapshots
        return collection


def make_record(name="陳陳", trip_title="北海道之旅", date_value="2026-09-01"):
    return {
        "tripId": "trip-internal",
        "participantId": "participant-internal",
        "participantName": name,
        "tripTitle": trip_title,
        "date": date_value,
        "timezone": "Asia/Taipei",
        "points": [
            {
                "id": "firebase-point-id",
                "lat": 43.0618,
                "lng": 141.3545,
                "ts": 1788220800000,
                "acc": 6.5,
                "spd": 1.2,
                "alt": 20,
                "course": 90,
                "bat": 88,
                "source": "traccar",
            }
        ],
        "stops": [
            {
                "lat": 43.062,
                "lng": 141.355,
                "arrivedAt": 1788220800000,
                "leftAt": 1788222600000,
                "durationMinutes": 30,
                "pointsCount": 4,
            }
        ],
    }


class LocationTrackExportTests(unittest.TestCase):
    def test_geojson_omits_internal_ids_and_battery(self):
        payload = build_geojson(make_record())
        encoded = str(payload)

        self.assertEqual(payload["type"], "FeatureCollection")
        self.assertNotIn("firebase-point-id", encoded)
        self.assertNotIn("participant-internal", encoded)
        self.assertNotIn("trip-internal", encoded)
        self.assertNotIn("bat", encoded)
        self.assertEqual(payload["features"][0]["geometry"]["type"], "LineString")
        self.assertEqual(payload["features"][1]["properties"]["accuracy"], 6.5)

    def test_gpx_omits_battery_but_keeps_time_and_optional_fields(self):
        payload = build_gpx(make_record())

        self.assertIn("<trkpt", payload)
        self.assertIn("<time>", payload)
        self.assertIn("<guidebook:accuracy>6.5</guidebook:accuracy>", payload)
        self.assertIn("<guidebook:heading>90</guidebook:heading>", payload)
        self.assertNotIn("firebase-point-id", payload)
        self.assertNotIn("battery", payload.lower())
        self.assertNotIn("<guidebook:bat>", payload)

    def test_multiple_records_are_returned_as_zip(self):
        response = _download_response(
            [make_record(), make_record(date_value="2026-09-02")],
            "geojson",
            force_zip=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "application/zip")
        self.assertIn("filename*=UTF-8''", response.headers["Content-Disposition"])

        with zipfile.ZipFile(io.BytesIO(response.get_data())) as archive:
            names = archive.namelist()
            self.assertEqual(len(names), 2)
            self.assertTrue(all(name.endswith(".geojson") for name in names))
            self.assertTrue(all("participant-internal" not in name for name in names))

    def test_request_requires_bounded_date_range_and_supported_format(self):
        payload = _normalize_request(
            {
                "tripId": "trip-a",
                "participantIds": ["member-a"],
                "startDate": "2026-09-01",
                "endDate": "2026-09-03",
                "format": "gpx",
            }
        )
        self.assertEqual(payload["format"], "gpx")
        self.assertEqual(payload["tripIds"], ["trip-a"])

        with self.assertRaises(ValueError):
            _normalize_request(
                {
                    "tripId": "trip-a",
                    "participantId": "member-a",
                    "startDate": "2026-09-03",
                    "endDate": "2026-09-01",
                }
            )

    def test_build_record_merges_archive_and_rtdb_without_duplicate_points(self):
        archive_segment = build_archive_segment(
            "trip-a",
            "Asia/Taipei",
            {
                "archive-only": {
                    "lat": 25.0,
                    "lng": 121.0,
                    "ts": 1_000,
                },
                "shared": {
                    "lat": 25.1,
                    "lng": 121.1,
                    "ts": 2_000,
                },
            },
        )
        archive_payload = build_archive_payload(
            "member-a", "2026-09-01", [archive_segment]
        )
        archive_bytes, _ = encode_archive_payload(archive_payload)
        archive_document = FakeDocument(
            "2026-09-01",
            {"codec": "gzip-json-v1", "payload": archive_bytes},
        )
        firestore_client = FakeFirestore(
            {
                "participantTrackArchives": FakeCollection(
                    {
                        "member-a": FakeDocument(
                            "member-a",
                            days={"2026-09-01": archive_document},
                        )
                    }
                )
            }
        )
        current_points = [
            {"id": "shared", "lat": 25.1, "lng": 121.1, "ts": 2_000},
            {"id": "rtdb-only", "lat": 25.2, "lng": 121.2, "ts": 3_000},
        ]

        with patch(
            "views.location_track_export._load_track_context",
            return_value={
                "timezone": "Asia/Taipei",
                "participant": {"name": "陳陳"},
                "trip": {"title": "北海道之旅"},
            },
        ), patch(
            "views.location_track_export.get_rtdb_reference",
            return_value=Mock(),
        ), patch(
            "views.location_track_export._get_day_points",
            return_value=(current_points, 0, 0),
        ):
            record = _build_record(
                firestore_client,
                "trip-a",
                "member-a",
                "2026-09-01",
                {},
            )

        self.assertEqual(
            [point["id"] for point in record["points"]],
            ["archive-only", "shared", "rtdb-only"],
        )

    def test_retention_candidates_only_include_expired_closed_trips(self):
        old_segment_completed = build_archive_segment(
            "trip-completed", "Asia/Taipei", {"a": {"lat": 25, "lng": 121, "ts": 1}}
        )
        old_segment_archived = build_archive_segment(
            "trip-archived", "Asia/Taipei", {"b": {"lat": 25, "lng": 121, "ts": 2}}
        )
        old_segment_active = build_archive_segment(
            "trip-active", "Asia/Taipei", {"c": {"lat": 25, "lng": 121, "ts": 3}}
        )
        old_payload = build_archive_payload(
            "member-a",
            "2026-06-01",
            [old_segment_completed, old_segment_archived, old_segment_active],
        )
        old_bytes, _ = encode_archive_payload(old_payload)
        recent_payload = build_archive_payload(
            "member-a", "2026-09-01", [old_segment_completed]
        )
        recent_bytes, _ = encode_archive_payload(recent_payload)
        firestore_client = FakeFirestore(
            {
                "trips": FakeCollection(
                    {
                        "trip-completed": FakeDocument(
                            "trip-completed", {"status": "completed", "title": "完成"}
                        ),
                        "trip-archived": FakeDocument(
                            "trip-archived", {"status": "archived", "title": "封存"}
                        ),
                        "trip-active": FakeDocument(
                            "trip-active", {"status": "active", "title": "進行中"}
                        ),
                    }
                ),
                "participants": FakeCollection(
                    {"member-a": FakeDocument("member-a", {"name": "陳陳"})}
                ),
            },
            [
                FakeSnapshot(
                    "2026-06-01",
                    {"codec": "gzip-json-v1", "payload": old_bytes},
                    "participantTrackArchives/member-a/days/2026-06-01",
                ),
                FakeSnapshot(
                    "2026-09-01",
                    {"codec": "gzip-json-v1", "payload": recent_bytes},
                    "participantTrackArchives/member-a/days/2026-09-01",
                ),
            ],
        )

        candidates = _retention_candidates(
            firestore_client,
            now=datetime(2026, 9, 29, 0, 30, tzinfo=timezone.utc),
        )

        self.assertEqual(
            {(item["tripId"], item["date"]) for item in candidates},
            {
                ("trip-completed", "2026-06-01"),
                ("trip-archived", "2026-06-01"),
            },
        )

    def test_retention_dry_run_performs_no_delete_or_audit_write(self):
        firestore_client = Mock()
        candidates = [
            {
                "tripId": "trip-a",
                "participantId": "member-a",
                "participantName": "陳陳",
                "date": "2026-06-01",
                "timezone": "Asia/Taipei",
                "tripTitle": "完成旅程",
                "archivePointCount": 1,
                "archivePointIds": ["archive-a"],
                "archiveDocumentPath": "participantTrackArchives/member-a/days/2026-06-01",
                "rtdbPointIds": ["rtdb-a"],
                "rtdbPointCount": 1,
                "pointCount": 2,
            }
        ]

        with patch(
            "views.location_track_export.get_firestore_client",
            return_value=firestore_client,
        ), patch(
            "views.location_track_export._retention_candidates",
            return_value=candidates,
        ), patch(
            "views.location_track_export._attach_rtdb_points",
            return_value=candidates,
        ), patch(
            "views.location_track_export.get_rtdb_reference"
        ) as rtdb_reference, patch(
            "views.location_track_export.delete_archived_location_tracks"
        ) as delete_archive:
            summary = run_location_track_retention(dry_run=True)

        self.assertTrue(summary["dryRun"])
        self.assertEqual(summary["candidateCount"], 1)
        rtdb_reference.assert_not_called()
        delete_archive.assert_not_called()
        firestore_client.collection.assert_not_called()

    def test_retention_execute_only_deletes_candidate_paths_and_writes_audit(self):
        audit_document = Mock()
        audit_collection = Mock()
        audit_collection.document.return_value = audit_document
        firestore_client = Mock()
        firestore_client.collection.return_value = audit_collection
        candidates = [
            {
                "tripId": "trip-target",
                "participantId": "member-target",
                "participantName": "目標成員",
                "date": "2026-06-01",
                "timezone": "Asia/Taipei",
                "tripTitle": "已完成旅程",
                "archivePointCount": 2,
                "archivePointIds": ["archive-a", "archive-b"],
                "archiveDocumentPath": "participantTrackArchives/member-target/days/2026-06-01",
                "rtdbPointIds": ["rtdb-a"],
                "rtdbPointCount": 1,
                "pointCount": 3,
            }
        ]
        target_reference = Mock()

        with patch(
            "views.location_track_export.get_firestore_client",
            return_value=firestore_client,
        ), patch(
            "views.location_track_export._retention_candidates",
            return_value=candidates,
        ), patch(
            "views.location_track_export._attach_rtdb_points",
            return_value=candidates,
        ), patch(
            "views.location_track_export.get_rtdb_reference",
            return_value=target_reference,
        ) as rtdb_reference, patch(
            "views.location_track_export.delete_archived_location_tracks",
            return_value=2,
        ) as delete_archive:
            summary = run_location_track_retention(dry_run=False)

        rtdb_reference.assert_called_once_with(
            "tripLocationTracks/trip-target/member-target"
        )
        target_reference.update.assert_called_once_with({"rtdb-a": None})
        delete_archive.assert_called_once_with(
            firestore_client,
            "trip-target",
            "member-target",
            "day",
            date_value="2026-06-01",
        )
        firestore_client.collection.assert_called_once_with(
            "locationTrackRetentionRuns"
        )
        audit_document.set.assert_called_once()
        self.assertEqual(summary["deletedArchivePointCount"], 2)
        self.assertEqual(summary["deletedRtdbPointCount"], 1)
        self.assertEqual(summary["failureCount"], 0)

        with self.assertRaises(ValueError):
            _normalize_request(
                {
                    "tripId": "trip-a",
                    "participantId": "member-a",
                    "startDate": "2026-09-01",
                    "endDate": "2027-10-01",
                }
            )

    def test_retention_is_based_on_local_day_and_fixed_to_90_days(self):
        now = datetime(2026, 9, 29, 0, 30, tzinfo=timezone.utc)
        self.assertEqual(DEFAULT_RETENTION_DAYS, 90)
        self.assertTrue(_is_expired("2026-06-29", "Asia/Taipei", now, 90))
        self.assertFalse(_is_expired("2026-07-02", "Asia/Taipei", now, 90))

    def test_unauthorized_export_does_not_read_firestore(self):
        with patch(
            "views.location_track_export.verify_admin_request",
            return_value=(None, "Admin permission required"),
        ), patch("views.location_track_export.get_firestore_client") as firestore_client:
            payload, status = handle_export_admin_location_tracks(
                FakeRequest(
                    {
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "startDate": "2026-09-01",
                    }
                )
            )

        self.assertEqual(status, 403)
        self.assertEqual(payload["status"], "error")
        firestore_client.assert_not_called()

    def test_unauthorized_retention_preview_and_execute_do_not_run_job(self):
        with patch(
            "views.location_track_export.verify_admin_request",
            return_value=(None, "Admin permission required"),
        ), patch("views.location_track_export.run_location_track_retention") as job:
            preview_payload, preview_status = (
                handle_preview_admin_location_track_retention(FakeRequest())
            )
            execute_payload, execute_status = handle_admin_location_track_retention(
                FakeRequest({"confirmation": "清理"})
            )

        self.assertEqual(preview_status, 403)
        self.assertEqual(execute_status, 403)
        self.assertEqual(preview_payload["status"], "error")
        self.assertEqual(execute_payload["status"], "error")
        job.assert_not_called()

    def test_retention_execute_requires_explicit_confirmation(self):
        with patch(
            "views.location_track_export.verify_admin_request",
            return_value=({"uid": "admin"}, None),
        ), patch("views.location_track_export.run_location_track_retention") as job:
            payload, status = handle_admin_location_track_retention(FakeRequest())

        self.assertEqual(status, 400)
        self.assertIn("清理", payload["message"])
        job.assert_not_called()

    def test_retention_execute_passes_fixed_policy_after_confirmation(self):
        summary = {"status": "ok", "retentionDays": DEFAULT_RETENTION_DAYS}
        with patch(
            "views.location_track_export.verify_admin_request",
            return_value=({"uid": "admin"}, None),
        ), patch(
            "views.location_track_export.run_location_track_retention",
            return_value=summary,
        ) as job:
            payload, status = handle_admin_location_track_retention(
                FakeRequest({"confirmation": "清理"})
            )

        self.assertEqual(status, 200)
        self.assertEqual(payload, summary)
        job.assert_called_once_with(dry_run=False)


if __name__ == "__main__":
    unittest.main()
