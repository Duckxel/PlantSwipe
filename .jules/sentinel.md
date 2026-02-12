# Sentinel's Journal

This journal records critical security learnings, patterns, and architectural insights discovered during security audits and fixes.

Format:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** [What you found]`
`**Learning:** [Why it existed]`
`**Prevention:** [How to avoid next time]`

## 2025-02-17 - Unprotected Admin Defaults & Argument Injection
**Vulnerability:** The admin API defaulted `APP_SECRET` to "change-me" if the environment variable was missing, allowing unauthorized control. Additionally, the `branch` parameter in `/admin/pull-code` lacked validation, permitting argument injection into `git` commands (e.g., passing flags like `-o...`).
**Learning:** Default values for sensitive secrets must never be usable in production. Even if "safe" defaults are convenient for dev, they create "Fail Open" scenarios. Also, passing user input to shell commands (even via `shlex` or list arguments) requires strict validation, especially against leading hyphens which can be interpreted as flags.
**Prevention:** Enforce "Fail Secure": critical secrets must be validated at startup/request time, and the app should refuse to operate if they are weak or default. Use strict allowlist regex validation for any input passed to shell commands.
