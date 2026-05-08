## 2025-03-09 - Insecure Random Number Generation

**Vulnerability:** The `generateVerificationCode` function in `server.js` used `Math.random()` to generate email verification codes. `Math.random()` is not cryptographically secure and is predictable.
**Learning:** Security-sensitive values like verification codes, passwords, and tokens must use a cryptographically secure pseudo-random number generator (CSPRNG).
**Prevention:** Use `crypto.randomInt` or `crypto.randomBytes` instead of `Math.random()` for any security-related random string generation.
## 2024-05-18 - Fix Insecure Randomness in Email Templates
**Vulnerability:** Weak random number generation (`Math.random()`) was being used to generate tracking IDs/nonces for email campaigns in both the Node.js backend (`server.js`) and Supabase Edge Functions (`email-campaign-runner`).
**Learning:** `Math.random()` is not cryptographically secure, and can lead to predictable IDs which attackers could potentially guess. The application runs in both Node.js and Deno (Edge functions), meaning the fix needs environment-specific implementations.
**Prevention:** When addressing cryptographic needs in the `plant-swipe` project, use Node's `crypto` module (e.g., `crypto.randomInt`) for backend files like `server.js`, and the Web Crypto API (e.g., `crypto.getRandomValues`) for Supabase Edge Functions which run in a Deno environment.
## 2025-01-27 - Insecure Randomness in Frontend ID Generation
**Vulnerability:** `Math.random()` was being used for UUID v4 polyfills, anonymous session identifiers (`anonId`), chat message IDs, and slug fallback generation across multiple frontend components (e.g. `PlantSwipe.tsx`, `useAphyliaChat.ts`, `blogs.ts`). `Math.random()` is not cryptographically secure and could allow an attacker to predict IDs or spoof an anonymous session.
**Learning:** For any ID generation or session tokens (even on the client side), `Math.random()` is inadequate.
**Prevention:** Use `crypto.getRandomValues()` (Web Crypto API) or `crypto.randomUUID()` in the browser environment to ensure cryptographic unpredictability for identifiers and sessions.
