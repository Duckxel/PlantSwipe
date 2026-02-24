import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add parent directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

class TestPsqlPasswordLeak(unittest.TestCase):
    @patch('app.subprocess.Popen')
    @patch('app.subprocess.run')
    @patch('app._psql_available', return_value=True)
    @patch('app._build_database_url', return_value='postgres://user:supersecretpassword@localhost:5432/db')
    @patch('app._get_sql_files_in_order', return_value=['dummy.sql'])
    @patch('app._sql_sync_parts_dir', return_value='/tmp')
    @patch('app._verify_request')
    def test_sync_schema_psql_password_leak(self, mock_verify, mock_dir, mock_files, mock_db, mock_psql_avail, mock_run, mock_popen):
        # Setup mock_run to return success for psql calls (schema sync)
        mock_res = MagicMock()
        mock_res.returncode = 0
        mock_res.stdout = ""
        mock_res.stderr = ""
        mock_run.return_value = mock_res

        # Setup mock_popen for the secret update
        mock_process = MagicMock()
        mock_process.communicate.return_value = (None, None)
        mock_process.returncode = 0
        mock_popen.return_value = mock_process

        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://example.com',
            'SUPABASE_SERVICE_ROLE_KEY': 'key'
        }):
            client = app.test_client()
            client.post('/admin/sync-schema')

            # Check subprocess.run calls (schema sync)
            for call in mock_run.call_args_list:
                args, kwargs = call
                cmd = args[0]

                # Skip version check or other calls that are not the main sync
                if '--version' in cmd or (len(cmd) > 0 and cmd[0] == 'git'):
                    continue

                # cmd should be a list like ['psql', db_url, ...]
                # Check if password is in any argument
                print(f"DEBUG: cmd={cmd}")
                for arg in cmd:
                    if 'supersecretpassword' in arg:
                        self.fail(f"Password leak detected in subprocess.run arguments: {cmd}")

                # Check if PGPASSWORD is in env
                env = kwargs.get('env', {})
                self.assertIn('PGPASSWORD', env, "PGPASSWORD not set in environment for subprocess.run")
                self.assertEqual(env['PGPASSWORD'], 'supersecretpassword', "PGPASSWORD incorrect")

            # Check subprocess.Popen calls (secrets update)
            for call in mock_popen.call_args_list:
                args, kwargs = call
                cmd = args[0]
                for arg in cmd:
                    if 'supersecretpassword' in arg:
                        self.fail(f"Password leak detected in subprocess.Popen arguments: {cmd}")

                env = kwargs.get('env', {})
                self.assertIn('PGPASSWORD', env, "PGPASSWORD not set in environment for subprocess.Popen")
                self.assertEqual(env['PGPASSWORD'], 'supersecretpassword', "PGPASSWORD incorrect")

if __name__ == "__main__":
    unittest.main()
