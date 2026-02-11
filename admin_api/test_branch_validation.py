
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add current directory to path so we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set env vars before importing app to satisfy config
os.environ["ADMIN_STATIC_TOKEN"] = "test-token"
os.environ["ADMIN_BUTTON_SECRET"] = "change-me"

from app import app

class TestSecurity(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.headers = {"X-Admin-Token": "test-token"}

    @patch("app.subprocess.Popen")
    @patch("app.os.path.isfile")
    def test_branch_validation(self, mock_isfile, mock_popen):
        # Mock script existence so it doesn't abort 500
        mock_isfile.return_value = True

        # Mock Popen to return a process with stdout/stderr
        process_mock = MagicMock()
        process_mock.stdout = ["line1", "line2"]
        process_mock.wait.return_value = 0
        mock_popen.return_value = process_mock

        # 1. Valid branch
        response = self.app.post("/admin/pull-code?branch=main", headers=self.headers)
        self.assertEqual(response.status_code, 200, "Valid branch should work")

        # Verify subprocess called with env var
        args, kwargs = mock_popen.call_args
        self.assertEqual(kwargs['env']['PLANTSWIPE_TARGET_BRANCH'], 'main')

        # 2. Malicious branch (Argument Injection candidate)
        malicious_branch = "-o/tmp/pwned"
        response = self.app.post(f"/admin/pull-code?branch={malicious_branch}", headers=self.headers)

        self.assertEqual(response.status_code, 400, "Malicious branch should be rejected with 400")

        # 3. Invalid characters
        invalid_chars = "feature/blah;rm -rf /"
        response = self.app.post(f"/admin/pull-code?branch={invalid_chars}", headers=self.headers)
        self.assertEqual(response.status_code, 400, "Branch with invalid characters should be rejected")

if __name__ == "__main__":
    unittest.main()
