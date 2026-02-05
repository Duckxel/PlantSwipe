# Sentinel's Journal

This journal records critical security learnings, patterns, and architectural insights discovered during security audits and fixes.

Format:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** [What you found]`
`**Learning:** [Why it existed]`
`**Prevention:** [How to avoid next time]`

## 2025-02-18 - Weak Default Secret Configuration
**Vulnerability:** The Admin API's `APP_SECRET` defaulted to "change-me" in code, allowing potential authentication bypass if the environment variable `ADMIN_BUTTON_SECRET` was not set.
**Learning:** Hardcoded default secrets in code ("secure by default" violation) are dangerous because they fail open if configuration is missing. Relying on documentation or "hope" that users change defaults is insufficient.
**Prevention:** Enforce "Fail Secure". If critical secrets are missing or set to known defaults in production environments, the application should refuse to start. Added a check to `admin_api/app.py` to exit with a critical error if the secret is "change-me" in production.
