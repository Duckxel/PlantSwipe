# Sentinel's Journal

This journal records critical security learnings, patterns, and architectural insights discovered during security audits and fixes.

Format:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** [What you found]`
`**Learning:** [Why it existed]`
`**Prevention:** [How to avoid next time]`

## 2024-05-23 - Argument Injection in Admin API
**Vulnerability:** The `admin_api` endpoint `/admin/pull-code` accepted an unvalidated `branch` parameter which was passed to a shell script execution of `git checkout`. While quoted, this could allow Argument Injection (e.g. passing `-f` or `--help`) to disrupt the operation.
**Learning:** Shell scripts invoked with user-controlled environment variables must treat those variables with extreme caution. Quoting prevents word splitting but not argument interpretation by the called command (like `git`).
**Prevention:** Strict allowlist validation (regex) of all inputs destined for shell commands or environment variables used by shell scripts.
