## 2025-03-09 - Insecure Random Number Generation

**Vulnerability:** The `generateVerificationCode` function in `server.js` used `Math.random()` to generate email verification codes. `Math.random()` is not cryptographically secure and is predictable.
**Learning:** Security-sensitive values like verification codes, passwords, and tokens must use a cryptographically secure pseudo-random number generator (CSPRNG).
**Prevention:** Use `crypto.randomInt` or `crypto.randomBytes` instead of `Math.random()` for any security-related random string generation.
