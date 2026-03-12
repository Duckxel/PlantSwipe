
## 2025-03-08 - Missing Authentication on Member Lookup Endpoint
**Vulnerability:** The `/api/admin/member` endpoint in `server.js` lacked an authentication check (`await ensureAdmin(req, res)` was deliberately omitted in the code to make it universally accessible), allowing unauthenticated users to look up other users' information (like IP addresses, email, and roles) by providing an email or username.
**Learning:** Even utility or "universal" lookup endpoints that interact with PII (Personally Identifiable Information) must have robust authorization checks. Removing admin constraints on sensitive endpoints to circumvent permission issues can create significant data leak vulnerabilities.
**Prevention:** Always use `ensureAdmin` or equivalent authorization barriers for any endpoints returning PII, regardless of its intended universal utility. Never remove authorization checks from administrative routes without implementing a secure, limited-scope alternative.

## 2025-03-08 - Fix database password leak in process list
**Vulnerability:** The database connection string, which includes the database password, was passed directly to `pg_dump` as a command-line argument in `server.js` (`app.post('/api/admin/backup-db', ...)`). This leaked the password to the system process list (`ps aux`).
**Learning:** Process arguments (e.g. spawned via `spawnChild` or `exec`) are visible to all users on the same machine via the process list. Sensitive credentials should never be passed as arguments.
**Prevention:** Pass sensitive credentials to subprocesses securely via environment variables (e.g., `PGPASSWORD` for PostgreSQL utilities) or secure stdin piping, rather than command-line arguments.

## 2025-03-08 - Hardcoded Sentry DSN Secrets
**Vulnerability:** The `SENTRY_DSN` secret was hardcoded across multiple files including the server, frontend, and admin API, exposing it to potential misuse.
**Learning:** Although some secrets like Sentry DSNs might seem less critical than database credentials, they still represent sensitive configuration data that should not be committed to version control. Treating them as environment variables not only enhances security but makes the configuration more robust and flexible for different deployment environments.
**Prevention:** Always use environment variables (e.g., `process.env.SENTRY_DSN` or `import.meta.env.VITE_SENTRY_DSN`) to load sensitive keys and configuration during initialization. Additionally, ensure the application gracefully handles the absence of these variables in local or test environments by wrapping the initialization logic in conditional checks.

## 2025-03-08 - Missing Authentication on Additional Admin Lookup Endpoints
**Vulnerability:** The `/api/admin/member-visits-series` and `/api/admin/member-suggest` endpoints in `server.js` deliberately disabled the `await ensureAdmin(req, res)` authentication checks. This allowed unauthenticated users to enumerate registered emails and retrieve user visit histories.
**Learning:** Disabling administrative checks to make features "universally accessible" or to mirror member lookup behavior exposes PII and sensitive user activity data. Such bypasses are extremely dangerous on administrative routes.
**Prevention:** Always enforce strict authentication using `ensureAdmin(req, res)` or similar mechanisms on all `/api/admin/*` endpoints. If public access is genuinely needed, create a dedicated, rate-limited, and sanitized non-admin endpoint instead of compromising an admin route.
