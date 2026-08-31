import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from views.location_tracks import (
    get_track_date_range,
    handle_delete_admin_location_tracks,
    handle_get_admin_location_tracks,
)


class FakeRequest:
    def __init__(self, method="POST", payload=None, args=None):
        self.method = method
        self._payload = payload or {}
        self.args = FakeArgs(args or {})

    def get_json(self, silent=True):
        return self._payload


class FakeArgs(dict):
    def to_dict(self):
        return dict(self)


class FakeSnapshot:
    def __init__(self, data=None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return dict(self._data or {})


class FakeDocument:
    def __init__(self, snapshot=None, document_id="log-id", writes=None):
        self.snapshot = snapshot
        self.id = document_id
        self.writes = writes if writes is not None else []

    def get(self):
        return FakeSnapshot(self.snapshot)

    def set(self, payload, merge=False):
        self.writes.append(payload)

    def collection(self, name):
        return FakeCollection(name, {}, self.writes)

    def delete(self):
        self.snapshot = None


class FakeCollection:
    def __init__(self, name, fixtures, writes):
        self.name = name
        self.fixtures = fixtures
        self.writes = writes

    def document(self, document_id=None):
        if self.name == "locationTrackDeletionLogs":
            return FakeDocument(document_id="audit-log", writes=self.writes)
        return FakeDocument(self.fixtures.get((self.name, document_id)))

    def stream(self):
        return []


class FakeFirestore:
    def __init__(self, fixtures):
        self.fixtures = fixtures
        self.writes = []

    def collection(self, name):
        return FakeCollection(name, self.fixtures, self.writes)


class FakeTrackReference:
    def __init__(self, values, key=None):
        self.values = values
        self.key = key
        self.start = None
        self.end = None

    def order_by_child(self, field):
        self.order_field = field
        return self

    def start_at(self, value):
        self.start = value
        return self

    def end_at(self, value):
        self.end = value
        return self

    def child(self, key):
        return FakeTrackReference(self.values, key=key)

    def get(self):
        if self.key is not None:
            return self.values.get(self.key)
        if self.start is None and self.end is None:
            return dict(self.values)
        return {
            key: value
            for key, value in self.values.items()
            if self.start <= value.get("ts", 0) <= self.end
        }

    def update(self, payload):
        for key, value in payload.items():
            if value is None:
                self.values.pop(key, None)
            else:
                self.values[key] = value

    def delete(self):
        self.values.clear()


def point(timestamp, lat=25.0, lng=121.0):
    return {"ts": timestamp, "lat": lat, "lng": lng, "acc": 12, "bat": 85}


class AdminLocationTrackTests(unittest.TestCase):
    def setUp(self):
        self.firestore = FakeFirestore(
            {
                ("trips", "trip-a"): {
                    "title": "Test Trip",
                    "timezone": "Asia/Taipei",
                    "status": "active",
                },
                ("participants", "member-a"): {
                    "name": "Member A",
                    "tripIds": ["trip-a"],
                },
            }
        )
        self.start, self.end = get_track_date_range("2026-08-13", "Asia/Taipei")
        self.values = {
            "point-a": point(self.start + 1000),
            "point-b": point(self.start + 2000),
            "point-next-day": point(self.end + 1000),
        }
        self.track_ref = FakeTrackReference(self.values)

    def patches(self):
        return (
            patch(
                "views.location_tracks.verify_admin_request",
                return_value=({"uid": "admin", "name": "Admin"}, None),
            ),
            patch(
                "views.location_tracks.get_firestore_client",
                return_value=self.firestore,
            ),
            patch(
                "views.location_tracks.get_rtdb_reference",
                return_value=self.track_ref,
            ),
        )

    def test_date_range_uses_trip_timezone(self):
        start, end = get_track_date_range("2026-08-13", "Asia/Taipei")
        self.assertEqual(end - start, 24 * 60 * 60 * 1000)
        self.assertEqual(start, 1786550400000)

    def test_query_returns_only_selected_day(self):
        auth_patch, firestore_patch, rtdb_patch = self.patches()
        with auth_patch, firestore_patch, rtdb_patch as rtdb_mock:
            payload, status = handle_get_admin_location_tracks(
                FakeRequest(
                    method="GET",
                    args={
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "date": "2026-08-13",
                    },
                )
            )

        self.assertEqual(status, 200)
        self.assertEqual([item["id"] for item in payload["points"]], ["point-a", "point-b"])
        rtdb_mock.assert_called_once_with("tripLocationTracks/trip-a/member-a")

    def test_unauthorized_request_does_not_read_rtdb(self):
        with patch(
            "views.location_tracks.verify_admin_request",
            return_value=(None, "Admin permission required"),
        ), patch("views.location_tracks.get_rtdb_reference") as rtdb:
            payload, status = handle_get_admin_location_tracks(
                FakeRequest(method="GET")
            )

        self.assertEqual(status, 403)
        self.assertEqual(payload["status"], "error")
        rtdb.assert_not_called()

    def test_rejects_participant_outside_selected_trip(self):
        self.firestore.fixtures[("participants", "member-a")]["tripIds"] = [
            "trip-b"
        ]
        auth_patch, firestore_patch, rtdb_patch = self.patches()
        with auth_patch, firestore_patch, rtdb_patch as rtdb_mock:
            payload, status = handle_get_admin_location_tracks(
                FakeRequest(
                    method="GET",
                    args={
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "date": "2026-08-13",
                    },
                )
            )

        self.assertEqual(status, 403)
        self.assertEqual(payload["status"], "error")
        rtdb_mock.assert_not_called()

    def test_deletes_only_selected_point_and_writes_audit_log(self):
        auth_patch, firestore_patch, rtdb_patch = self.patches()
        with auth_patch, firestore_patch, rtdb_patch as rtdb_mock:
            payload, status = handle_delete_admin_location_tracks(
                FakeRequest(
                    payload={
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "scope": "point",
                        "pointId": "point-a",
                    }
                )
            )

        self.assertEqual(status, 200)
        self.assertEqual(payload["deletedCount"], 1)
        self.assertNotIn("point-a", self.values)
        self.assertIn("point-b", self.values)
        self.assertEqual(self.firestore.writes[0]["scope"], "point")

    def test_deletes_only_selected_day(self):
        auth_patch, firestore_patch, rtdb_patch = self.patches()
        with auth_patch, firestore_patch, rtdb_patch as rtdb_mock:
            payload, status = handle_delete_admin_location_tracks(
                FakeRequest(
                    payload={
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "scope": "day",
                        "date": "2026-08-13",
                    }
                )
            )

        self.assertEqual(status, 200)
        self.assertEqual(payload["deletedCount"], 2)
        self.assertEqual(set(self.values), {"point-next-day"})

    def test_all_scope_requires_exact_participant_name(self):
        auth_patch, firestore_patch, rtdb_patch = self.patches()
        with auth_patch, firestore_patch, rtdb_patch:
            payload, status = handle_delete_admin_location_tracks(
                FakeRequest(
                    payload={
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "scope": "all",
                        "confirmation": "Wrong Name",
                    }
                )
            )

        self.assertEqual(status, 400)
        self.assertIn("point-a", self.values)

    def test_all_scope_clears_only_selected_participant_path(self):
        other_trip_values = {"other": point(self.start + 3000)}
        auth_patch, firestore_patch, rtdb_patch = self.patches()
        with auth_patch, firestore_patch, rtdb_patch as rtdb_mock:
            payload, status = handle_delete_admin_location_tracks(
                FakeRequest(
                    payload={
                        "tripId": "trip-a",
                        "participantId": "member-a",
                        "scope": "all",
                        "confirmation": "Member A",
                    }
                )
            )

        self.assertEqual(status, 200)
        self.assertEqual(self.values, {})
        self.assertEqual(set(other_trip_values), {"other"})
        rtdb_mock.assert_called_once_with("tripLocationTracks/trip-a/member-a")


if __name__ == "__main__":
    unittest.main()
