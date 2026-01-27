# Security Audit Report - Aphylia (Plant-Swipe)

**Audit Date:** January 27, 2026  
**Auditor:** Automated Security Review  
**Application Version:** 1.0.0  
**Overall Risk Level:** LOW-MEDIUM

---

## Executive Summary

This security audit was conducted to assess the security posture of the Aphylia application before release. The application demonstrates **strong security practices** in most areas with a few recommendations for improvement.

### Key Findings

| Category | Status | Risk Level |
|----------|--------|------------|
| Authentication & Authorization | ✅ PASS | Low |
| Data Protection | ✅ PASS | Low |
| API Security | ✅ PASS | Low |
| Application Security | ✅ PASS | Low |
| Infrastructure Security | ⚠️ REVIEW | Medium |
| Monitoring & Logging | ✅ PASS | Low |

---

## 1. Authentication & Authorization

### Findings

#### ✅ Password Security
- **Supabase Auth** handles password hashing with bcrypt (industry standard)
- No passwords logged or stored in plain text
- Password change confirmation emails implemented
- reCAPTCHA Enterprise v3 protection on login/signup (GDPR-compliant, consent-aware)

#### ✅ Session Management  
- Sessions stored securely via Supabase Auth
- Auto token refresh enabled (`autoRefreshToken: true`)
- Session persistence with secure storage key
- 30-second timeout on fetch requests to prevent hanging

#### ✅ Role-Based Access Control (RBAC)
- Multiple roles supported: `admin`, `editor`, `pro`, `merchant`, `creator`, `vip`, `plus`
- Admin verification on all admin endpoints via `isAdminFromRequest()`
- Threat level system (0-3) for user risk management
- Garden membership roles: `owner`, `member`

#### ✅ OAuth/SSO
- Supabase handles OAuth integrations securely
- Environment-based configuration for credentials

### Recommendations
- Consider implementing MFA (Multi-Factor Authentication) for admin accounts

#### ✅ Account Lockout (IMPLEMENTED)
- IP-based rate limiting for authentication attempts
- 10 failed attempts per 15 minutes triggers temporary block
- Rate limit clearing requires authentication (prevents bypass attacks)
- Minimal information disclosure (only returns `blocked: true/false`)
- Endpoints:
  - `GET /api/auth/check-rate-limit` - Check if IP is blocked (minimal response)
  - `POST /api/auth/record-attempt` - Record failed attempt only
  - `POST /api/auth/clear-rate-limit` - Clear rate limit (requires auth)

---

## 2. Data Protection

### Findings

#### ✅ Encryption in Transit
- All API calls use HTTPS via Supabase
- CSP headers enforce secure connections
- WebSocket connections use WSS protocol

#### ✅ Data Retention & GDPR Compliance
- **GDPR-compliant data export** endpoint (`/api/account/export`)
- **GDPR-compliant account deletion** endpoint (`/api/account/delete-gdpr`)
- **GDPR audit logging** table (`public.gdpr_audit_log`)
- Automated data retention cron job:
  - Anonymizes web visits older than 90 days
  - Deletes orphaned messages after 30 days
  - Removes expired push subscriptions after 180 days
  - Clears old notifications after 90 days
  - Purges audit logs after 3 years

#### ✅ Consent Management
- Granular consent tracking columns in profiles table
- Cookie consent with GDPR-compliant banner (French law compliant - equal "Reject All" prominence)
- Marketing consent with timestamps
- Terms and privacy policy acceptance tracking

#### ✅ Database Security
- Row Level Security (RLS) policies on sensitive tables
- Parameterized queries using `postgres.js` template literals (SQL injection protection)
- Service role key only used server-side

### Recommendations
- Consider field-level encryption for highly sensitive data (e.g., user messages)
- Document data classification levels

---

## 3. API Security

### Findings

#### ✅ Rate Limiting
Comprehensive rate limiting implemented:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Plant Scans | 60/hour | Per user |
| AI Chat | 120/hour | Per user |
| Translations | 200/hour | Per user/IP |
| Image Uploads | 100/hour | Per user |
| Bug Reports | 10/hour | Per IP |
| Contact Form | 5/5min | Per IP |
| Garden Activity | 100/hour | Per user |
| Journal Entries | 20/hour | Per user |
| Push Notifications | 100/hour | Per user |

#### ✅ Input Validation
- Zod schema validation available
- HTML escaping for user inputs (`htmlEscapeMap`)
- File upload MIME type validation
- Username/display name validation and normalization
- Sanitized path segments for file uploads

#### ✅ Authentication Mechanisms
- Bearer token authentication via Supabase JWT
- User extraction from request headers (`getUserFromRequest()`)
- Admin token support for system operations

#### ✅ Error Handling
- Generic error messages to users
- Detailed errors logged server-side only
- No stack traces exposed to clients

### Recommendations
- Add request body size validation for all POST endpoints (currently 15MB global limit)
- Consider API versioning for future compatibility

---

## 4. Application Security

### Findings

#### ✅ XSS Protection
- **DOMPurify** used for all HTML sanitization
- `dangerouslySetInnerHTML` only used with sanitized content
- React's default escaping for JSX

Files using DOMPurify:
- `PrivacyPage.tsx`
- `TermsPage.tsx`
- `BlogPostPage.tsx`
- `AdminEmailTemplatePage.tsx`
- And 23 other files

#### ✅ CSRF Protection
- CSRF token system implemented for sensitive operations
- Tokens are single-use and expire after 15 minutes
- Protected endpoints:
  - `/api/security/password-changed`
  - `/api/security/email-changed-notification`
  - `/api/security/check-email-available`

#### ✅ Content Security Policy (CSP)
Implemented CSP headers:
```
default-src 'self' *.aphylia.app
script-src 'self' 'unsafe-inline' 'unsafe-eval' *.aphylia.app [trusted domains]
style-src 'self' 'unsafe-inline' *.aphylia.app fonts.googleapis.com
connect-src 'self' *.aphylia.app wss://*.aphylia.app *.supabase.co
img-src * data: blob:
object-src 'none'
base-uri 'self'
frame-ancestors 'self'
```

#### ✅ File Upload Security
- MIME type validation (whitelist approach)
- File size limits (configurable, default ~15MB)
- Image dimension limits
- Automatic WebP conversion and optimization
- Unique filename generation with UUID
- No path traversal vulnerabilities (sanitized paths)

Allowed image types:
- JPEG, PNG, WebP, AVIF, HEIC, HEIF, GIF, TIFF, BMP, SVG

### Recommendations
- Consider removing `'unsafe-eval'` from CSP if possible
- Add `Strict-Transport-Security` (HSTS) header for production
- Consider adding `X-Content-Type-Options: nosniff` header

---

## 5. Infrastructure Security

### Findings

#### ✅ No Exposed Secrets
- All credentials loaded from environment variables
- `.env` files properly gitignored
- No hardcoded API keys, passwords, or secrets found in codebase
- Supabase anon key (public) properly separated from service role key (private)

#### ✅ Dependencies
Key dependencies are up-to-date:
- `express`: 4.19.2
- `supabase-js`: 2.57.2
- `dompurify`: 3.3.0
- `sharp`: 0.34.5
- `react`: 19.1.1
- `jsonwebtoken`: 9.0.2

#### ⚠️ Potential Concerns
- No automated dependency vulnerability scanning in CI/CD (recommend adding)
- `'unsafe-eval'` in CSP (required for some libraries but increases risk)

### Recommendations
- Add `npm audit` or `snyk` to CI/CD pipeline
- Review and update dependencies quarterly
- Consider using `helmet.js` for additional security headers
- Add HTTPS redirect enforcement in production

---

## 6. Monitoring & Logging

### Findings

#### ✅ Security Logging
- **Admin Activity Logs** (`admin_activity_logs` table) - 30+ logged actions
- **GDPR Audit Logs** (`gdpr_audit_log` table) - Data export/deletion tracking
- Rate limit logging with identifiers
- CSRF validation failure logging
- reCAPTCHA verification logging

Logged admin actions include:
- User lookups
- Role changes (promote/demote)
- Banning users
- Threat level changes
- Schema syncs
- Code deployments

#### ✅ Error Logging
- Server-side console logging for errors
- Stack traces logged internally (not exposed to users)
- Warning logs for security-relevant events

### Recommendations
- Consider integrating with external logging service (e.g., Datadog, Sentry)
- Add alerting for:
  - Multiple failed login attempts
  - Admin privilege escalation
  - Unusual rate limit hits
  - CSRF validation failures
- Implement log rotation/retention policy

---

## 7. Third-Party Integrations

### Services Used

| Service | Purpose | Security Notes |
|---------|---------|----------------|
| Supabase | Auth, Database, Storage | SOC 2 Type II compliant |
| Google Analytics | Usage analytics | GDPR-compliant (consent-aware) |
| Google reCAPTCHA | Bot protection | GDPR-compliant (consent-aware) |
| DeepL | Translation | API key protected |
| OpenAI | AI Chat | API key protected |
| Kindwise | Plant identification | API key protected |
| Resend | Email delivery | API key protected |
| Web Push (VAPID) | Push notifications | Key pair protected |

### Findings
- ✅ All API keys stored in environment variables
- ✅ Google services load only after user consent
- ✅ Service communications use HTTPS

---

## 8. Compliance Checklist

### GDPR Compliance
- [x] Right to Access (data export)
- [x] Right to Erasure (account deletion)
- [x] Right to Data Portability (JSON export)
- [x] Consent Management (granular preferences)
- [x] Cookie Consent Banner (with Reject All option)
- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Audit logging for personal data access

### Security Best Practices
- [x] HTTPS enforcement
- [x] CSRF protection
- [x] XSS protection (DOMPurify)
- [x] SQL injection protection (parameterized queries)
- [x] Rate limiting
- [x] Input validation
- [x] Secure session management
- [x] Content Security Policy
- [x] File upload validation
- [ ] HSTS header (recommended)
- [ ] MFA support (recommended)

---

## 9. Action Items

### Critical (Before Release)
None identified.

### High Priority (Within 30 days)
1. ✅ ~~Add HSTS header for production deployment~~ (IMPLEMENTED)
2. Set up automated dependency vulnerability scanning
3. Configure external logging/alerting service

### Medium Priority (Within 90 days)
1. Implement MFA for admin accounts
2. ✅ ~~Add account lockout after failed login attempts~~ (IMPLEMENTED)
3. Review and potentially remove `'unsafe-eval'` from CSP
4. ✅ ~~Add `X-Content-Type-Options: nosniff` header~~ (IMPLEMENTED)

### Low Priority (Ongoing)
1. Quarterly dependency updates
2. Annual security review
3. Penetration testing (external)

### Implemented Security Headers
The following security headers have been added:
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `X-XSS-Protection: 1; mode=block` - XSS protection for legacy browsers
- `Referrer-Policy: strict-origin-when-cross-origin` - Limits referrer leakage
- `Permissions-Policy` - Restricts browser feature access
- `Strict-Transport-Security` (production only) - Enforces HTTPS

---

## 10. Conclusion

The Aphylia application demonstrates **mature security practices** across most domains. The implementation of GDPR compliance, rate limiting, CSRF protection, and comprehensive audit logging shows a security-conscious development approach.

Key strengths:
- Strong authentication via Supabase
- Comprehensive GDPR compliance
- Effective rate limiting system
- Proper input sanitization (DOMPurify, parameterized queries)
- Extensive admin activity logging

The application is **ready for production release** with the recommended high-priority items addressed in the deployment configuration.

---

**Report Generated:** January 27, 2026  
**Next Review:** April 27, 2026 (Quarterly)
