# Sentinel's Journal

This journal records critical security learnings, patterns, and architectural insights discovered during security audits and fixes.

Format:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** [What you found]`
`**Learning:** [Why it existed]`
`**Prevention:** [How to avoid next time]`

## 2026-01-27 - Argument Injection in Admin API
**Vulnerability:** The `/admin/pull-code` endpoint allowed unvalidated user input (`branch` parameter) to be passed to a `git` subprocess via an environment variable that was then consumed by a shell script which used it as an argument. This enabled Argument Injection (e.g., passing `-o/tmp/pwned`).
**Learning:** Python's `subprocess` module, even when used with lists (avoiding shell injection), is still vulnerable to Argument Injection if the first argument (executable) accepts flags and subsequent arguments are user-controlled. In this case, passing the input via ENV var to a script which then uses it in `git checkout $VAR` without validation was the vector.
**Prevention:** Always validate user input against a strict allowlist regex (e.g., `^[a-zA-Z0-9_./-]+$`) and explicitly reject inputs starting with `-` before passing them to subprocesses or environment variables used by subprocesses.
