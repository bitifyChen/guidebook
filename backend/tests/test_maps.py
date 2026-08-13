import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from views.maps import resolve_google_maps_url


class GoogleMapsResolverTests(unittest.TestCase):
    def test_rejects_non_google_urls_before_request(self):
        with self.assertRaisesRegex(ValueError, "Only supported Google Maps"):
            resolve_google_maps_url("https://example.com/maps/dir/a/b")

    @patch("views.maps.requests.Session")
    def test_follows_google_redirects_without_reading_response_body(
        self, session_class
    ):
        first_response = MagicMock()
        first_response.is_redirect = True
        first_response.is_permanent_redirect = False
        first_response.headers = {
            "Location": "https://www.google.com/maps/dir/one/two"
        }
        second_response = MagicMock()
        second_response.is_redirect = False
        second_response.is_permanent_redirect = False
        second_response.status_code = 200

        session = session_class.return_value.__enter__.return_value
        session.get.side_effect = [first_response, second_response]

        result = resolve_google_maps_url("https://maps.app.goo.gl/route-token")

        self.assertEqual(result, "https://www.google.com/maps/dir/one/two")
        self.assertEqual(session.get.call_count, 2)
        self.assertTrue(session.get.call_args.kwargs["stream"])
        first_response.close.assert_called_once()
        second_response.close.assert_called_once()

    @patch("views.maps.requests.Session")
    def test_rejects_redirects_to_untrusted_hosts(self, session_class):
        response = MagicMock()
        response.is_redirect = True
        response.is_permanent_redirect = False
        response.headers = {"Location": "https://127.0.0.1/internal"}
        session = session_class.return_value.__enter__.return_value
        session.get.return_value = response

        with self.assertRaisesRegex(ValueError, "Only supported Google Maps"):
            resolve_google_maps_url("https://maps.app.goo.gl/route-token")

        response.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
