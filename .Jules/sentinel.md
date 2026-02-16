# Sentinel's Journal - Critical Security Learnings

## 2025-02-24 - [Fail Secure Gap]
**Vulnerability:** Documented 'Fail Secure' policy for `ADMIN_BUTTON_SECRET` was missing from implementation, allowing default credentials.
**Learning:** Never assume security policies in documentation are implemented in code. Always verify critical security controls.
**Prevention:** Implement startup checks for default secrets and fail fast if detected.
