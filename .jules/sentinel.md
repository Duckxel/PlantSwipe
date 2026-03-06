
## 2025-03-08 - Missing Authentication on Member Lookup Endpoint
**Vulnerability:** The `/api/admin/member` endpoint in `server.js` lacked an authentication check (`await ensureAdmin(req, res)` was deliberately omitted in the code to make it universally accessible), allowing unauthenticated users to look up other users' information (like IP addresses, email, and roles) by providing an email or username.
**Learning:** Even utility or "universal" lookup endpoints that interact with PII (Personally Identifiable Information) must have robust authorization checks. Removing admin constraints on sensitive endpoints to circumvent permission issues can create significant data leak vulnerabilities.
**Prevention:** Always use `ensureAdmin` or equivalent authorization barriers for any endpoints returning PII, regardless of its intended universal utility. Never remove authorization checks from administrative routes without implementing a secure, limited-scope alternative.
