
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

## 2025-03-08 - Missing Authentication and Authorization on Garden Weather Endpoints
**Vulnerability:** A duplicate, unauthenticated endpoint for fetching garden weather data (`/api/garden/:id/weather`) existed in `server.js`. Furthermore, both instances of this route lacked an authorization check verifying if the user was actually a member of the garden (`await isGardenMember(req, gardenId, user.id)`). This allowed any authenticated user to query the weather for arbitrary `gardenId`s, exposing the precise garden location (city, country, latitude, longitude) metadata which is considered Personally Identifiable Information (PII) and constituting an Insecure Direct Object Reference (IDOR).
**Learning:** Checking if a user is simply logged in (`getUserFromRequestOrToken`) is insufficient for endpoints interacting with user-specific data. You must also authorize that the specific user has access to the specific requested resource to prevent IDOR vulnerabilities.
**Prevention:** Always pair authentication checks with explicit resource-level authorization validation (like `isGardenMember` for gardens or checking data ownership) when handling sensitive, user-specific data and PII.

## 2025-03-08 - Missing Authentication on User Roles Lookup Endpoint
**Vulnerability:** The `/api/admin/roles/:userId` endpoint in `server.js` was using `isAdminFromRequest(req)` to check if the caller was an admin, but it failed to properly authenticate the request and return proper 401 Unauthorized responses for unauthenticated requests, unlike most other administrative endpoints that use `ensureAdmin(req, res)`. This caused inconsistent security enforcement and potential leakage of sensitive profile roles if the custom check logic were misconfigured.
**Learning:** Checking for administrative privileges directly using boolean helpers like `isAdminFromRequest` skips standard authentication flow controls (e.g., yielding explicit 401 Unauthenticated instead of 403 Forbidden or continuing on error states). It also makes the code prone to authorization bypass if the helper assumes an authenticated context.
**Prevention:** Consistently use the standard `ensureAdmin(req, res)` or similar encompassing middleware at the very beginning of administrative routes to strictly enforce both authentication and authorization, ensuring uniform and secure API behavior.

## 2024-03-30 - Inconsistent Admin Endpoint Authorization
**Vulnerability:** Several sensitive admin endpoints in server.js were using a manual boolean check `isAdminFromRequest(req)` and returning 403, rather than the standardized `ensureAdmin(req, res)`.
**Learning:** Using the raw boolean check bypasses `ensureAdmin`'s centralized handling of authentication flows, standard 401/403 responses, and token/public-mode validation mechanisms, leading to potential IDOR and authentication bypass.
**Prevention:** Always use `await ensureAdmin(req, res)` to enforce strict authentication and authorization in administrative endpoints.
