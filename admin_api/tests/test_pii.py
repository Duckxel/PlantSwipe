import sys
import os
import unittest
import json

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import _scrub_pii_from_string, _sentry_before_send

class TestPIIScrubbing(unittest.TestCase):
    def test_scrub_pii_string_basic(self):
        # Existing functionality - verifying it still works for basic cases
        # Note: improved regex might add quotes, so we check for containment of REDACTED
        res = _scrub_pii_from_string("password=secret")
        self.assertIn("REDACTED", res)
        self.assertNotIn("secret", res)

        res = _scrub_pii_from_string("password:secret")
        self.assertIn("REDACTED", res)
        self.assertNotIn("secret", res)

    def test_scrub_pii_json_string(self):
        # JSON string format - current implementation fails to redact this
        json_str = '{"password": "secret"}'
        scrubbed = _scrub_pii_from_string(json_str)
        print(f"Scrubbed JSON string: {scrubbed}")
        self.assertIn("REDACTED", scrubbed)
        self.assertNotIn("secret", scrubbed)

    def test_sentry_before_send_dict(self):
        # Dictionary data - current implementation skips this
        event = {
            "request": {
                "data": {"password": "secret", "other": "value"}
            }
        }
        hint = {}
        processed_event = _sentry_before_send(event, hint)

        if processed_event is None:
             # _sentry_before_send might return None if it suppresses error, but here it shouldn't
             self.fail("Event was suppressed unexpectedly")

        data = processed_event["request"]["data"]
        print(f"Processed event data: {data}")

        # Check if password is redacted
        # We expect data to be either a scrubbed dict or a scrubbed string representation
        if isinstance(data, dict):
            val = data.get("password")
            self.assertIn("REDACTED", str(val))
            self.assertNotEqual(val, "secret")
        elif isinstance(data, str):
            self.assertIn("REDACTED", data)
            self.assertNotIn("secret", data)
        else:
            self.fail(f"Unexpected data type: {type(data)}")

if __name__ == "__main__":
    unittest.main()
