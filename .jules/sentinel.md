
## 2025-03-08 - Missing Authentication on Member Lookup Endpoint
**Vulnerability:** The `/api/admin/member` endpoint in `server.js` lacked an authentication check (`await ensureAdmin(req, res)` was deliberately omitted in the code to make it universally accessible), allowing unauthenticated users to look up other users' information (like IP addresses, email, and roles) by providing an email or username.
**Learning:** Even utility or "universal" lookup endpoints that interact with PII (Personally Identifiable Information) must have robust authorization checks. Removing admin constraints on sensitive endpoints to circumvent permission issues can create significant data leak vulnerabilities.
**Prevention:** Always use `ensureAdmin` or equivalent authorization barriers for any endpoints returning PII, regardless of its intended universal utility. Never remove authorization checks from administrative routes without implementing a secure, limited-scope alternative.

## 2025-03-08 - Fix database password leak in process list
**Vulnerability:** The database connection string, which includes the database password, was passed directly to `pg_dump` as a command-line argument in `server.js` (`app.post('/api/admin/backup-db', ...)`). This leaked the password to the system process list (`ps aux`).
**Learning:** Process arguments (e.g. spawned via `spawnChild` or `exec`) are visible to all users on the same machine via the process list. Sensitive credentials should never be passed as arguments.
**Prevention:** Pass sensitive credentials to subprocesses securely via environment variables (e.g., `PGPASSWORD` for PostgreSQL utilities) or secure stdin piping, rather than command-line arguments.
