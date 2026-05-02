## 2024-05-24 - Replace Math.random with crypto in server.js
**Vulnerability:** Weak random number generation using `Math.random()` was used for generating unique IDs and filenames.
**Learning:** `Math.random()` is not cryptographically secure and can lead to predictable IDs, which might be exploited for file enumeration or overwriting.
**Prevention:** Use Node's `crypto` module (e.g., `crypto.randomBytes(4).toString('hex')`) for generating unique and secure identifiers on the backend.
