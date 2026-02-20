import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

class TestSecurity(unittest.TestCase):
    @patch('app.subprocess.Popen')
    @patch('app.subprocess.run')
    @patch('app._psql_available', return_value=True)
    @patch('app._build_database_url', return_value='postgres://user:pass@localhost:5432/db')
    @patch('app._get_sql_files_in_order', return_value=['dummy.sql'])
    @patch('app._sql_sync_parts_dir', return_value='/tmp')
    @patch('app._verify_request')
    def test_sync_schema_sql_injection(self, mock_verify, mock_dir, mock_files, mock_db, mock_psql_avail, mock_run, mock_popen):
        # Mock environment variables with a malicious payload
        malicious_payload = "malicious'); DROP TABLE users; --"

        # Setup mock_run to return success for psql calls (schema sync)
        mock_res = MagicMock()
        mock_res.returncode = 0
        mock_res.stdout = ""
        mock_res.stderr = ""
        mock_run.return_value = mock_res

        # Setup mock_popen for the secret update (it returns a process object)
        mock_process = MagicMock()
        mock_process.communicate.return_value = (None, None)
        mock_process.returncode = 0
        mock_popen.return_value = mock_process

        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://example.com',
            'SUPABASE_SERVICE_ROLE_KEY': malicious_payload
        }):
            client = app.test_client()
            # We don't need real authentication because we mocked _verify_request
            client.post('/admin/sync-schema')

            # Find the mock instance that was called for the secrets update
            # Since mock_run handles subprocess.run, mock_popen is only used for subprocess.Popen

            if not mock_popen.called:
                self.fail("subprocess.Popen() was not called.")

            # Check if communicate was called
            if mock_process.communicate.called:
                args, kwargs = mock_process.communicate.call_args
                sql_input = kwargs.get('input', '')

                print(f"Captured SQL: {sql_input}")

                # We assert that the quote IS escaped (i.e., doubled)
                if "malicious'');" in sql_input:
                    print("Test Passed: Quote was escaped.")
                else:
                    print("Test Failed: Quote was NOT escaped.")

                self.assertIn("malicious'');", sql_input, "SQL Injection vulnerability detected: Single quote was not escaped!")
            else:
                self.fail("subprocess.Popen().communicate() was not called.")

if __name__ == "__main__":
    unittest.main()
