import unittest
import sys
import os
import re

# Add parent directory to path to import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Set env vars to avoid exit on import if logic is added
os.environ['ADMIN_BUTTON_SECRET'] = 'test-secret-value'
os.environ['FLASK_ENV'] = 'testing'

try:
    from app import _scrub_pii_from_string
except ImportError:
    # If import fails (e.g. dependencies missing), we can define a dummy function to test the regex logic directly if we copy it here
    # But ideally we test the actual function.
    # For now, let's assume dependencies are installed or we mock them.
    # Since dependencies are installed in the environment now, this should work.
    pass

class TestSecurity(unittest.TestCase):
    def test_pii_scrubbing_json(self):
        """Test that passwords in JSON are scrubbed."""
        test_cases = [
            ('{"password": "secret"}', '{"password": [REDACTED]}'),
            ('{"password":  "secret"}', '{"password":  [REDACTED]}'),
            ('{"password":"secret"}', '{"password":[REDACTED]}'),
            ('{"user": "u", "password": "s"}', '{"user": "u", "password": [REDACTED]}'),
        ]
        for original, expected in test_cases:
            scrubbed = _scrub_pii_from_string(original)
            # Normalizing quotes if needed, but regex should produce consistent output
            self.assertEqual(scrubbed, expected, f"Failed for input: {original}")

    def test_pii_scrubbing_standard(self):
        """Test standard password formats."""
        test_cases = [
            ('password=secret', 'password=[REDACTED]'),
            ('password:secret', 'password:[REDACTED]'),
            ('password="secret"', 'password=[REDACTED]'),
        ]
        for original, expected in test_cases:
            scrubbed = _scrub_pii_from_string(original)
            self.assertEqual(scrubbed, expected, f"Failed for input: {original}")

    def test_pii_scrubbing_other(self):
        """Test other PII like emails and bearer tokens."""
        self.assertEqual(_scrub_pii_from_string('user@example.com'), '[EMAIL_REDACTED]')
        self.assertEqual(_scrub_pii_from_string('Bearer abc-123.def'), 'Bearer [REDACTED]')

if __name__ == '__main__':
    unittest.main()
