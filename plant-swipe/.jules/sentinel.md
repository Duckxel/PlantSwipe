## 2025-03-09 - Insecure Random Number Generation

**Vulnerability:** The `generateVerificationCode` function in `server.js` used `Math.random()` to generate email verification codes. `Math.random()` is not cryptographically secure and is predictable.
**Learning:** Security-sensitive values like verification codes, passwords, and tokens must use a cryptographically secure pseudo-random number generator (CSPRNG).
**Prevention:** Use `crypto.randomInt` or `crypto.randomBytes` instead of `Math.random()` for any security-related random string generation.
## 2024-05-18 - Fix Insecure Randomness in Email Templates
**Vulnerability:** Weak random number generation (`Math.random()`) was being used to generate tracking IDs/nonces for email campaigns in both the Node.js backend (`server.js`) and Supabase Edge Functions (`email-campaign-runner`).
**Learning:** `Math.random()` is not cryptographically secure, and can lead to predictable IDs which attackers could potentially guess. The application runs in both Node.js and Deno (Edge functions), meaning the fix needs environment-specific implementations.
**Prevention:** When addressing cryptographic needs in the `plant-swipe` project, use Node's `crypto` module (e.g., `crypto.randomInt`) for backend files like `server.js`, and the Web Crypto API (e.g., `crypto.getRandomValues`) for Supabase Edge Functions which run in a Deno environment.
