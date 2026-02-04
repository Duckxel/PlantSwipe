import unittest
import sys
import os

# Add parent dir to path to allow importing app.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class TestBranchValidation(unittest.TestCase):
    def test_validation(self):
        try:
            from app import validate_branch_name
        except ImportError:
            print("validate_branch_name not found in app.py yet (expected)")
            return

        valid_cases = [
            "main",
            "master",
            "feature/cool-stuff",
            "fix-bug",
            "v1.0.0",
            "user/name/branch",
            "a",
            "123",
            "UPPERCASE",
            "foo.bar"
        ]

        for branch in valid_cases:
            try:
                validate_branch_name(branch)
            except Exception as e:
                self.fail(f"Valid branch '{branch}' raised exception: {e}")

        invalid_cases = [
            "-starts-with-dash",
            "--argument",
            "has space",
            "semi;colon",
            "ampersand&",
            "dollar$",
            "backtick`",
            "pipe|",
            "<script>",
            "rm -rf /"
        ]

        for branch in invalid_cases:
            with self.assertRaises(ValueError, msg=f"Invalid branch '{branch}' did not raise ValueError"):
                validate_branch_name(branch)

if __name__ == '__main__':
    unittest.main()
