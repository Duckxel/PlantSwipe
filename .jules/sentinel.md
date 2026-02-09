# Sentinel's Journal

This journal records critical security learnings, patterns, and architectural insights discovered during security audits and fixes.

Format:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** [What you found]`
`**Learning:** [Why it existed]`
`**Prevention:** [How to avoid next time]`

## 2026-02-06 - Admin API Input Validation & Configuration
**Vulnerability:** The `/admin/pull-code` endpoint accepted raw branch names and passed them to a shell script (`scripts/refresh-plant-swipe.sh`). While the script quoted the variable, it lacked strict validation against argument injection (e.g. branch names starting with `-`) or shell metacharacters. Additionally, the `APP_SECRET` fail-secure policy (terminating in production if default) was missing in code despite being documented.
**Learning:** Admin endpoints, even if internal, are high-value targets. Trusting shell scripts to handle inputs safely is insufficient; input validation must occur at the API boundary (defense in depth). Documentation of security controls (like fail-secure defaults) can drift from implementation.
**Prevention:** Enforce strict allow-lists (regex) for all inputs passed to shell commands. Implement explicit checks for default secrets at application startup and fail hard in production environments.
