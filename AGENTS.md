# Aphylia Development Guidelines

> **For AI Agents and Human Developers**  
> Read this document thoroughly before making any changes to the codebase.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Repository Layout](#repository-layout)
3. [Dependency Management](#dependency-management)
4. [Database Guidelines](#database-guidelines)
5. [Privacy & Compliance (GDPR/CNIL)](#privacy--compliance-gdprcnil)
6. [Code Quality Standards](#code-quality-standards)
7. [Security Requirements](#security-requirements)
8. [Testing & Validation](#testing--validation)
9. [Quick Reference](#quick-reference)
10. [Summary](#summary)

---

## Introduction

Aphylia is a plant care application serving users in the European Union. All contributions must adhere to strict quality, security, and legal compliance standards.

**Before you begin:**
- Read relevant documentation files
- Start with `plant-swipe/README.md` for setup and commands
- Read `plant-swipe/src/REUSABLE_COMPONENTS.md` before creating any new UI components, hooks, or validation utilities
- Check `EXTERNAL_APIS.md` for all third-party services and APIs used in the application
- Understand the existing architecture
- Follow the guidelines in this document
- Ask questions if anything is unclear

---

## Repository Layout

- `plant-swipe/` - main web app (React/Vite) and Express API server (`server.js`)
- `plant-swipe/src/` - frontend UI and client logic
- `plant-swipe/supabase/` - database schema, migrations, and Edge Functions
- `admin_api/` - Flask admin API and service config
- `scripts/` - operational scripts for deployment and maintenance

---

## Dependency Management

### Adding or Updating Dependencies

When adding, removing, or updating any dependency:

#### 1. Update the Lockfile

**Always** regenerate the lockfile after modifying `plant-swipe/package.json`:

```bash
cd plant-swipe
bun install
```

**Never** manually edit `bun.lock`.

#### 2. Restart the Development Server

After any dependency change, restart the dev servers if they are running:

```bash
cd plant-swipe

# Terminal A (API server)
bun run serve

# Terminal B (frontend dev server)
bun run dev
```

The development server **must be restarted** to pick up new dependencies. Hot-reload does not detect `node_modules` changes.

#### 3. Verify Compatibility

Before committing:
- Ensure the application builds (includes type checking): `cd plant-swipe && bun run build`
- Run linting: `cd plant-swipe && bun run lint`
- If translations were touched: `cd plant-swipe && bun run check-translations`
- Test core functionality manually

#### 4. Document Major Dependencies

When adding a significant new dependency, add a comment explaining:
- Why it was chosen
- What it's used for
- Any alternatives considered

---

## Database Guidelines

### Mandatory Reading

**Before making ANY database changes, you MUST read:**

```
plant-swipe/supabase/DATABASE_SCHEMA.md
```

This document contains:
- Complete table reference
- Column definitions
- RLS policy patterns
- Cron job schedules
- Best practices and pitfalls

**Failure to read this documentation will result in:**
- Duplicate data structures
- Missing RLS policies
- Security vulnerabilities
- Schema inconsistencies

### Schema Files Location

The database schema is split into 15 files in:

```
plant-swipe/supabase/sync_parts/
├── 01_extensions_and_setup.sql
├── 02_profiles_and_purge.sql
├── 03_plants_and_colors.sql
├── ...
└── 15_gdpr_and_preferences.sql
```

### Making Database Changes

#### Step 1: Identify the Correct File

Choose the appropriate file based on the feature area:
- User-related → `02_profiles_and_purge.sql`
- Garden-related → `06_core_tables_and_rls.sql`
- Notifications → `11_notifications_and_tasks.sql`
- GDPR/Security → `15_gdpr_and_preferences.sql`

#### Step 2: Make Your Changes

Follow these rules:
- Use `IF NOT EXISTS` for CREATE statements
- Use `IF EXISTS` for DROP statements
- Always enable RLS on new tables
- Create appropriate indexes
- Add COMMENT statements for documentation

#### Step 3: Update Documentation (MANDATORY)

**After ANY schema change, you MUST update `plant-swipe/supabase/DATABASE_SCHEMA.md`:**

- Add new tables to the appropriate section
- Document all columns with types and purposes
- Document any new RLS policies
- Document any new cron jobs or functions

**This is not optional.** Undocumented schema changes will cause maintenance issues.

#### Step 4: Add to Allowed Tables

If creating a new table, add it to `allowed_tables` in `plant-swipe/supabase/sync_parts/01_extensions_and_setup.sql`:

```sql
allowed_tables constant text[] := array[
  -- ... existing tables ...
  'your_new_table',  -- ADD HERE
];
```

Tables not in this list will be **automatically deleted** during schema sync.

#### Step 5: Test Your Changes

1. Run schema sync from Admin panel
2. Verify the sync completes without errors
3. Test CRUD operations on affected tables
4. Verify RLS policies work correctly

---

## Privacy & Compliance (GDPR/CNIL)

### Overview

Aphylia serves users in the European Union and must comply with:
- **GDPR** (General Data Protection Regulation) - EU-wide
- **CNIL** (Commission Nationale de l'Informatique et des Libertés) - France-specific

### Core Principles

#### 1. Data Minimization

**Collect only what you need.**

```javascript
// ✗ Bad - Collecting unnecessary data
const userData = { name, email, phone, address, birthDate, ssn };

// ✓ Good - Only essential data
const userData = { name, email };
```

#### 2. Purpose Limitation

Data must only be used for its stated purpose.

- User email → Authentication, notifications (if consented)
- Garden location → Weather-based recommendations
- **Never** use data for undisclosed purposes

#### 3. Consent Management

**Always obtain explicit consent before:**
- Sending marketing emails
- Collecting analytics data
- Using cookies beyond essential functionality
- Sharing data with third parties

Check consent before processing:

```javascript
// Check user consent before sending marketing
if (profile.marketing_consent && profile.email_promotions) {
  await sendMarketingEmail(user);
}
```

#### 4. Data Retention

**Do not keep data longer than necessary.**

Existing retention policies:
- Web visits: 35 days
- Completed bug reports: 10 days
- Admin activity logs: 90 days
- Email verification codes: 5 minutes

When adding new data types, define and document retention periods.

#### 5. Right to Access & Deletion

Users have the right to:
- Export all their data
- Request data deletion
- Know what data is stored

**Never** implement features that prevent data export or deletion.

### Implementation Checklist

When adding features that handle personal data:

- [ ] Is the data collection necessary?
- [ ] Is the purpose clearly defined?
- [ ] Is consent obtained where required?
- [ ] Is there a retention policy?
- [ ] Can users access/export this data?
- [ ] Can users delete this data?
- [ ] Is the data properly secured?
- [ ] Is data processing logged in `gdpr_audit_log`?

### Sensitive Data Handling

**Never store:**
- Passwords in plain text (use Supabase Auth)
- Credit card numbers (use payment processors)
- Government IDs without encryption
- Health data without explicit consent

**Always:**
- Use HTTPS for data transmission
- Encrypt sensitive data at rest
- Log access to personal data
- Implement proper access controls

### Cookie Compliance

The application uses cookie consent tracking:

```sql
-- Cookie consent levels
'essential'   -- Required for functionality
'analytics'   -- Usage tracking
'all'         -- Full consent
'rejected'    -- Only essential
```

Respect user choices:

```javascript
// Check consent before loading analytics
if (cookieConsent.level === 'analytics' || cookieConsent.level === 'all') {
  initializeAnalytics();
}
```

---

## Code Quality Standards

### Reusable Components (Mandatory Reading)

**Before creating any new UI component, hook, or validation utility, you MUST read:**

```
plant-swipe/src/REUSABLE_COMPONENTS.md
```

This document catalogues all shared components including:
- `ValidatedInput` — Form input with validation feedback (loading/check/error states)
- `PasswordRules` — Password strength checklist
- `SearchInput` — Search input with icon, loading, clear button
- `useFieldValidation` — Debounced async field validation hook
- Email, username, and password validation utilities

**Rules:**
- Always reuse existing components instead of creating new ones
- If you add, modify, or remove a reusable component — **update `src/REUSABLE_COMPONENTS.md`**
- Use `ValidatedInput` + `useFieldValidation` for any field that needs live validation
- Use `PasswordRules` + `validatePassword` whenever a password field is created

### TypeScript

- Enable strict mode
- No `any` types without justification
- Document complex types with comments

### React/Frontend

- Use functional components with hooks
- Implement proper error boundaries
- Handle loading and error states
- Support internationalization (i18n)

### Backend/API

- Validate all inputs
- Use parameterized queries (never string concatenation)
- Implement proper error handling
- Log errors with context

### Commits

- Write clear, descriptive commit messages
- One logical change per commit
- Reference issue numbers when applicable

---

## Security Requirements

### Authentication

- Always verify user authentication before data access
- Use Supabase Auth for all authentication
- Never bypass RLS policies without justification

### Authorization

- Implement RLS policies on all tables
- Verify user permissions before operations
- Use `SECURITY DEFINER` functions sparingly

### Input Validation

```javascript
// ✗ Bad - No validation
const { email } = req.body;
await sendEmail(email);

// ✓ Good - Validate input
const { email } = req.body;
if (!email || !isValidEmail(email)) {
  return res.status(400).json({ error: 'Invalid email' });
}
await sendEmail(email);
```

### Secrets Management

- Never commit secrets to the repository
- Use environment variables for configuration
- Store API keys in `admin_secrets` table (encrypted)

---

## Testing & Validation

### Before Submitting Changes

1. **Build Check**
   ```bash
   npm run build
   ```

2. **Type Check**
   ```bash
   npx tsc --noEmit
   ```

3. **Lint Check**
   ```bash
   npm run lint
   ```

4. **Manual Testing**
   - Test the feature as a regular user
   - Test edge cases and error handling
   - Verify mobile responsiveness

### Database Changes

1. Run schema sync and verify no errors
2. Test affected queries
3. Verify RLS policies work correctly
4. Test with both authenticated and anonymous users

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start frontend dev server (plant-swipe) |
| `bun run serve` | Start API server (plant-swipe) |
| `bun run build` | Production build (includes type check) |
| `bun run lint` | Lint check |
| `bun run check-translations` | Validate locale files |

### Key Files

| File | Purpose |
|------|---------|
| `plant-swipe/supabase/DATABASE_SCHEMA.md` | Database documentation |
| `plant-swipe/src/REUSABLE_COMPONENTS.md` | Reusable UI components & hooks reference |
| `EXTERNAL_APIS.md` | All external APIs and third-party services |
| `plant-swipe/supabase/sync_parts/*.sql` | Schema definition files |
| `plant-swipe/server.js` | Backend API |
| `plant-swipe/src/PlantSwipe.tsx` | Main app component |
| `admin_api/app.py` | Admin API entrypoint |

### Contacts

For questions about:
- Database schema → Check `DATABASE_SCHEMA.md`
- External APIs & services → Check `EXTERNAL_APIS.md`
- Frontend architecture → Check component documentation
- Security concerns → Escalate to team lead

---

## Summary

**Remember:**

1. **Dependencies** → Update lockfile, restart server
2. **Database** → Read docs first, update docs after
3. **Privacy** → GDPR/CNIL compliance is mandatory
4. **Security** → Validate inputs, use RLS, no secrets in code
5. **Quality** → Test thoroughly before submitting

**When in doubt, ask.** It's better to clarify than to introduce bugs or compliance issues.
