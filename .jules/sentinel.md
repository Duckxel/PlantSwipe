# Sentinel's Journal

This journal records critical security learnings, patterns, and architectural insights discovered during security audits and fixes.

Format:
`## YYYY-MM-DD - [Title]`
`**Vulnerability:** [What you found]`
`**Learning:** [Why it existed]`
`**Prevention:** [How to avoid next time]`

## 2026-01-27 - Git Argument Injection via Env Vars
**Vulnerability:** Admin API passed unvalidated branch names to a shell script via environment variables. The script used `git checkout "$BRANCH"`. While quoted to prevent shell injection, it allowed argument injection (e.g., starting with `-`) which could trigger unintended git flags.
**Learning:** Quoting variables in shell scripts (`"$VAR"`) prevents word splitting but does NOT prevent argument injection if the variable starts with a dash.
**Prevention:** Validate all inputs against a strict allowlist (e.g., regex `^[a-zA-Z0-9_./-]+$`) before passing them to subprocesses, even if they are just environment variables.
