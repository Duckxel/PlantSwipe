# Aphylia Database Schema Documentation

> **Last Updated:** February 12, 2026  
> **Database:** PostgreSQL (Supabase)  
> **Total Tables:** 75+  
> **RLS Policies:** 250+

## Table of Contents

1. [Overview](#overview)
2. [Schema Files Structure](#schema-files-structure)
3. [Core Tables](#core-tables)
4. [Table Reference](#table-reference)
5. [Row Level Security (RLS)](#row-level-security-rls)
6. [Cron Jobs](#cron-jobs)
7. [Functions & RPCs](#functions--rpcs)
8. [Best Practices](#best-practices)
9. [Common Pitfalls](#common-pitfalls)

---

## Overview

The Aphylia database is built on Supabase (PostgreSQL) with extensive use of:
- **Row Level Security (RLS)** for data isolation
- **Scheduled cron jobs** for maintenance tasks
- **Custom functions/RPCs** for complex operations
- **Real-time subscriptions** for live updates

### Recent Updates (Keep Less than 10)
- **Feb 19, 2026:** Added `plant_reports` table for user-submitted reports about incorrect or outdated plant information. Columns: `id` (UUID PK), `user_id` (UUID FK auth.users), `plant_id` (text FK plants), `note` (text), `image_url` (text, nullable), `created_at` (timestamptz). RLS: authenticated users can insert own reports, admins/editors can read and delete. Admin can mark as complete (adds reporter to plant_contributors) or reject (deletes report + image from storage).
- **Feb 17, 2026:** Added `user_id` (nullable UUID, FK to `auth.users`) column to `team_members` table. Links a team member to an actual user profile. When set, the About page shows the linked user's display name as a clickable link to their profile page. Added `idx_team_members_user_id` partial index.
- **Feb 12, 2026:** Added **Shadow Ban system** for threat level 3 users. When a user's threat level is set to 3, `apply_shadow_ban()` is called to: make their profile private, make all their gardens private, make all their bookmarks private, disable friend requests, remove all email/push notification consent, cancel pending friend requests and garden invites. All pre-ban settings are stored in the new `shadow_ban_backup` JSONB column on `profiles` for full reversibility via `revert_shadow_ban()`. Updated `profiles_select_self` RLS policy, `search_user_profiles` RPC, `get_profile_public_by_display_name` RPC, and `friend_requests`/`garden_invites` insert policies to exclude shadow-banned users.
- **Feb 12, 2026:** Added `plant_recipes` table to store structured recipe ideas per plant, with `category` (breakfast_brunch, starters_appetizers, soups_salads, main_courses, side_dishes, desserts, drinks, other), `time` (quick, 30_plus, slow_cooking, undefined), and optional `link` (external recipe URL, admin-only, not AI-filled) columns. Includes migration from `recipes_ideas` in `plant_translations`. All existing recipes migrated with category='other' and time='undefined'.
- **Feb 10, 2026:** Added `impressions` table to track page view counts for plant info pages and blog posts. Admin-only read access. Includes `increment_impression` RPC function.
- **Feb 9, 2026:** Added `plant_request_fulfilled` trigger type to `notification_automations` for event-driven notifications when a plant request is fulfilled via AI prefill or manual creation. Added `/api/admin/notify-plant-requesters` endpoint.
- **Feb 8, 2026:** Added `job`, `profile_link`, `show_country` columns to `profiles` table for public profile display. Updated `get_profile_public_by_display_name` RPC to return `experience_level`, `job`, `profile_link`, `show_country`.
- **Feb 5, 2026:** Restricted `plant_contributors` RLS write policy to admins/editors only (was previously open to all authenticated users).
- **Feb 4, 2026:** Added `plant_contributors` table to store contributor names per plant.

### Required Extensions
```sql
pgcrypto      -- Cryptographic functions (gen_random_uuid, etc.)
pg_cron       -- Scheduled tasks
pg_net        -- HTTP requests from database (edge functions)
```

---

## Schema Files Structure

The schema is split into 15 files in `supabase/sync_parts/` for easier management:

| File | Description |
|------|-------------|
| `01_extensions_and_setup.sql` | Extensions, secrets, edge function helpers, scheduled tasks |
| `02_profiles_and_purge.sql` | User profiles table, data retention jobs |
| `03_plants_and_colors.sql` | Plants catalog, watering schedules, colors (uses dynamic SQL for column additions) |
| `04_translations_and_requests.sql` | Multi-language translations, plant requests (defensive migration checks) |
| `05_admin_media_and_team.sql` | Admin media uploads, team members |
| `06_core_tables_and_rls.sql` | Gardens, garden members, plants, events, inventory |
| `07_ownership_and_rpcs.sql` | Ownership rules, helper RPCs |
| `08_scheduling_and_moderation.sql` | Task scheduling, ban system, reports |
| `09_admin_logs_and_friends.sql` | Admin activity logs, friends system |
| `10_garden_invites_and_cache.sql` | Garden invitations, task caching |
| `11_notifications_and_tasks.sql` | Push notifications, task occurrences |
| `12_audit_and_analytics.sql` | Analytics, AI advice, journal |
| `13_messaging.sql` | Conversations, messages, reactions |
| `14_scanning_and_bugs.sql` | Plant scanning, bug catcher system |
| `15_gdpr_and_preferences.sql` | GDPR compliance, email verification, preferences |

---

## Core Tables

### User Management

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (linked to auth.users) |
| `user_blocks` | User blocking relationships |
| `banned_accounts` | Banned user accounts |
| `banned_ips` | Banned IP addresses |

### Plant Catalog

| Table | Purpose |
|-------|---------|
| `plants` | Master plant catalog |
| `plant_translations` | Multi-language plant names/descriptions |
| `plant_watering_schedules` | Watering frequency data |
| `plant_sources` | Plant information sources |
| `plant_infusion_mixes` | Infusion/tea recipes |
| `plant_recipes` | Structured recipe ideas with category and time |
| `plant_contributors` | Contributor names per plant (admin/editor write only) |
| `plant_reports` | User-submitted reports about incorrect/outdated plant info |
| `plant_pro_advices` | Professional growing tips |
| `plant_images` | Plant image gallery |
| `colors` | Color catalog |
| `plant_colors` | Plant-color associations |
| `color_translations` | Color name translations |
| `requested_plants` | User-requested plants to add |

### Gardens

| Table | Purpose |
|-------|---------|
| `gardens` | User gardens |
| `garden_members` | Garden membership (multi-user gardens) |
| `garden_plants` | Plants in gardens |
| `garden_plant_events` | Plant events (watering, fertilizing, etc.) |
| `garden_plant_images` | Photos of garden plants |
| `garden_inventory` | Garden-level inventory definitions |
| `garden_instance_inventory` | Actual inventory items |
| `garden_transactions` | Inventory transactions |

### Tasks & Scheduling

| Table | Purpose |
|-------|---------|
| `garden_tasks` | Task definitions |
| `garden_plant_tasks` | Tasks assigned to plants |
| `garden_plant_task_occurrences` | Individual task instances |
| `garden_task_user_completions` | Task completion records |
| `garden_watering_schedule` | Watering schedules |
| `garden_plant_schedule` | Plant-specific schedules |

### Task Caching (Performance)

| Table | Purpose |
|-------|---------|
| `garden_task_daily_cache` | Daily task aggregates per garden |
| `garden_task_weekly_cache` | Weekly task aggregates |
| `garden_plant_task_counts_cache` | Task counts per plant |
| `garden_task_occurrences_today_cache` | Today's tasks |
| `user_task_daily_cache` | User-level daily aggregates |

### Social Features

| Table | Purpose |
|-------|---------|
| `friends` | Friend relationships |
| `friend_requests` | Pending friend requests |
| `garden_invites` | Garden invitation tokens |
| `bookmarks` | Bookmark collections |
| `bookmark_items` | Individual bookmarks |

### Messaging

| Table | Purpose |
|-------|---------|
| `conversations` | Chat conversations |
| `messages` | Chat messages |
| `message_reactions` | Message reactions (emoji) |

### Notifications

| Table | Purpose |
|-------|---------|
| `notification_campaigns` | Admin notification campaigns |
| `notification_templates` | Notification message templates |
| `notification_template_translations` | Template translations |
| `notification_automations` | Automated notification rules (cron-based and event-driven) |
| `user_notifications` | User notification inbox |
| `user_push_subscriptions` | Push notification subscriptions |

### Admin & Email

| Table | Purpose |
|-------|---------|
| `admin_secrets` | Encrypted secrets storage |
| `admin_media_uploads` | Uploaded media files |
| `admin_activity_logs` | Admin action audit log |
| `admin_email_templates` | Email templates |
| `admin_email_template_translations` | Template translations |
| `admin_email_template_versions` | Template version history |
| `admin_email_campaigns` | Email campaigns |
| `admin_campaign_sends` | Campaign send records |
| `admin_email_triggers` | Automated email triggers |
| `admin_automatic_email_sends` | Automatic email send log |

### Analytics & Audit

| Table | Purpose |
|-------|---------|
| `web_visits` | Website visit tracking |
| `garden_analytics_snapshots` | Garden analytics history |
| `garden_ai_advice` | AI-generated garden advice |
| `garden_user_activity` | User activity tracking |
| `garden_activity_logs` | Garden activity history |
| `garden_journal_entries` | Garden journal |
| `garden_journal_photos` | Journal photos |
| `garden_task_audit_log` | Task change audit |
| `gdpr_audit_log` | GDPR compliance audit |
| `impressions` | Page view impressions for plants and blog posts (admin read-only) |

### Bug Catcher System

| Table | Purpose |
|-------|---------|
| `bug_reports` | User bug reports |
| `bug_actions` | Bug action definitions |
| `bug_action_responses` | User responses to bugs |
| `bug_points_history` | Bug hunter points |

### Content Management

| Table | Purpose |
|-------|---------|
| `blog_posts` | Blog articles |
| `broadcast_messages` | System announcements |
| `team_members` | About page team (supports `user_id` for profile linking) |
| `profile_admin_notes` | Admin notes on users |
| `user_reports` | User moderation reports |
| `user_report_notes` | Report notes |

### Landing Page CMS

| Table | Purpose |
|-------|---------|
| `landing_page_settings` | Landing page config |
| `landing_hero_cards` | Hero section cards |
| `landing_stats` | Statistics display |
| `landing_stats_translations` | Stats translations |
| `landing_testimonials` | User testimonials |
| `landing_faq` | FAQ entries |
| `landing_faq_translations` | FAQ translations |
| `landing_demo_features` | Demo feature list |
| `landing_demo_feature_translations` | Feature translations |
| `landing_showcase_config` | Showcase configuration |

### Security & GDPR

| Table | Purpose |
|-------|---------|
| `email_verification_codes` | OTP codes for email verification |
| `user_cookie_consent` | Cookie consent tracking |
| `plant_scans` | Plant identification scans |

---

## Table Reference

### `profiles` (Core User Table)

```sql
id                          UUID PRIMARY KEY (references auth.users)
display_name                TEXT NOT NULL (1-64 chars)
username                    TEXT (optional)
country                     TEXT
city                        TEXT
bio                         TEXT
favorite_plant              TEXT
avatar_url                  TEXT
timezone                    TEXT
experience_years            INTEGER
accent_key                  TEXT DEFAULT 'emerald'
is_private                  BOOLEAN DEFAULT false
disable_friend_requests     BOOLEAN DEFAULT false
garden_invite_privacy       TEXT DEFAULT 'anyone' ('anyone'|'friends_only')
language                    TEXT DEFAULT 'en'
notify_push                 BOOLEAN DEFAULT true
notify_email                BOOLEAN DEFAULT true
roles                       TEXT[] DEFAULT '{}'
threat_level                INTEGER DEFAULT 0 (0-3)
bug_points                  INTEGER DEFAULT 0
job                         TEXT                    -- Optional job/occupation displayed on public profile
profile_link                TEXT                    -- Optional external URL displayed on public profile
show_country                BOOLEAN DEFAULT true    -- Whether to display country on public profile
liked_plant_ids             TEXT[] DEFAULT '{}'
is_admin                    BOOLEAN DEFAULT false
-- GDPR fields
marketing_consent           BOOLEAN DEFAULT false
marketing_consent_date      TIMESTAMPTZ
terms_accepted_date         TIMESTAMPTZ
privacy_policy_accepted_date TIMESTAMPTZ
terms_version_accepted      TEXT DEFAULT '1.0.0'
privacy_version_accepted    TEXT DEFAULT '1.0.0'
-- Setup fields
setup_completed             BOOLEAN DEFAULT false
garden_type                 TEXT ('inside'|'outside'|'both')
experience_level            TEXT ('novice'|'intermediate'|'expert')
looking_for                 TEXT ('eat'|'ornamental'|'various')
notification_time           TEXT DEFAULT '10h' (0-23h)
email_verified              BOOLEAN DEFAULT false
force_password_change       BOOLEAN DEFAULT false  -- When true, user must change password before accessing app
shadow_ban_backup           JSONB                  -- Stores pre-shadow-ban settings for reversibility when threat_level=3
-- Communication preferences
email_product_updates       BOOLEAN DEFAULT true
email_tips_advice           BOOLEAN DEFAULT true
email_community_highlights  BOOLEAN DEFAULT true
email_promotions            BOOLEAN DEFAULT false
push_task_reminders         BOOLEAN DEFAULT true
push_friend_activity        BOOLEAN DEFAULT true
push_messages               BOOLEAN DEFAULT true
push_garden_updates         BOOLEAN DEFAULT true
personalized_recommendations BOOLEAN DEFAULT true
analytics_improvement       BOOLEAN DEFAULT true
```

### `gardens`

```sql
id                  UUID PRIMARY KEY
name                TEXT NOT NULL
owner_id            UUID REFERENCES profiles(id)
description         TEXT
is_public           BOOLEAN DEFAULT false
timezone            TEXT
latitude            NUMERIC
longitude           NUMERIC
location_name       TEXT
cover_image_url     TEXT
default_schedule    JSONB
irrigation_type     TEXT
soil_type           TEXT
sunlight_exposure   TEXT
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()
```

### `garden_members`

```sql
id          UUID PRIMARY KEY
garden_id   UUID REFERENCES gardens(id) ON DELETE CASCADE
user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
role        TEXT DEFAULT 'member' ('owner'|'admin'|'member')
joined_at   TIMESTAMPTZ DEFAULT now()
UNIQUE(garden_id, user_id)
```

### `garden_plants`

```sql
id              UUID PRIMARY KEY
garden_id       UUID REFERENCES gardens(id) ON DELETE CASCADE
plant_id        TEXT REFERENCES plants(id)
custom_name     TEXT
location        TEXT
quantity        INTEGER DEFAULT 1
planting_date   DATE
notes           TEXT
health_status   TEXT DEFAULT 'healthy'
last_watered    TIMESTAMPTZ
next_watering   TIMESTAMPTZ
watering_frequency_days INTEGER
image_url       TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `email_verification_codes`

```sql
id            UUID PRIMARY KEY
user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE
code          VARCHAR(8) NOT NULL
created_at    TIMESTAMPTZ DEFAULT now()
expires_at    TIMESTAMPTZ NOT NULL
used_at       TIMESTAMPTZ
target_email  TEXT DEFAULT NULL  -- For email change: the new email to switch to. NULL for standard verification.
UNIQUE(user_id, code)
```

### `plant_scans`

```sql
id                          UUID PRIMARY KEY
user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
image_url                   TEXT NOT NULL
image_path                  TEXT             -- Storage path if stored in Supabase
image_bucket                TEXT DEFAULT 'PHOTOS'
api_access_token            TEXT             -- Kindwise API access token for the request
api_model_version           TEXT             -- e.g., 'plant_id:3.1.0'
api_status                  TEXT DEFAULT 'pending'  -- pending, processing, completed, failed
api_response                JSONB            -- Full API response stored for reference
is_plant                    BOOLEAN
is_plant_probability        NUMERIC(5,4)     -- 0.0000 to 1.0000
top_match_name              TEXT
top_match_scientific_name   TEXT
top_match_probability       NUMERIC(5,4)
top_match_entity_id         TEXT
suggestions                 JSONB DEFAULT '[]'  -- All identification suggestions
similar_images              JSONB DEFAULT '[]'  -- Similar images from API
latitude                    NUMERIC(9,6)
longitude                   NUMERIC(9,6)
classification_level        TEXT DEFAULT 'species'  -- 'species', 'all', or 'genus'
matched_plant_id            TEXT REFERENCES plants(id) ON DELETE SET NULL
user_notes                  TEXT
created_at                  TIMESTAMPTZ DEFAULT NOW()
updated_at                  TIMESTAMPTZ DEFAULT NOW()
deleted_at                  TIMESTAMPTZ      -- Soft delete
```

### `impressions`

Tracks page view counts (impressions) for plant info pages and blog posts. Only admins can read the counts; the server increments via service role.

```sql
id              UUID PRIMARY KEY
entity_type     TEXT NOT NULL CHECK (entity_type IN ('plant', 'blog'))
entity_id       TEXT NOT NULL
count           BIGINT NOT NULL DEFAULT 0
last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (entity_type, entity_id)
```

### `plant_recipes`

Structured recipe ideas linked to plants, with meal category and preparation time.

```sql
id              UUID PRIMARY KEY
plant_id        TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE
name            TEXT NOT NULL                     -- Recipe/dish name in English (canonical)
name_fr         TEXT                              -- French translation (populated by DeepL)
category        TEXT NOT NULL DEFAULT 'other'     -- Meal category
time            TEXT NOT NULL DEFAULT 'undefined' -- Preparation time
link            TEXT                              -- Optional external URL to a recipe page (not filled by AI)
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Category values:** `breakfast_brunch`, `starters_appetizers`, `soups_salads`, `main_courses`, `side_dishes`, `desserts`, `drinks`, `other`

**Time values:** `quick` (Quick and Effortless), `30_plus` (30+ minutes Meals), `slow_cooking` (Slow Cooking), `undefined`

---

## Row Level Security (RLS)

### RLS Principles

1. **All tables have RLS enabled** - No direct access without policies
2. **Users can only access their own data** - Unless explicitly shared
3. **Admins have elevated access** - Via `is_admin` flag or `admin` role
4. **Service role bypasses RLS** - For server-side operations

### Common Policy Patterns

#### User's Own Data
```sql
CREATE POLICY "Users can view own data" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
```

#### Garden Member Access
```sql
CREATE POLICY "Garden members can view" ON garden_plants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM garden_members 
      WHERE garden_id = garden_plants.garden_id 
      AND user_id = auth.uid()
    )
  );
```

#### Public Data (Anonymous)
```sql
CREATE POLICY "Anyone can view public gardens" ON gardens
  FOR SELECT TO anon, authenticated
  USING (is_public = true);
```

#### Admin Access
```sql
CREATE POLICY "Admins can manage all" ON table_name
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR 'admin' = ANY(roles))
    )
  );
```

### Tables with Special RLS

| Table | Notes |
|-------|-------|
| `admin_secrets` | Service role only - no user access |
| `email_verification_codes` | Users can SELECT own, service role can ALL |
| `gdpr_audit_log` | Admin SELECT only, anyone can INSERT |
| `plant_contributors` | Anyone can SELECT; only admins/editors can INSERT/UPDATE/DELETE |
| `plant_pro_advices` | Anyone can SELECT; author or admin/editor can UPDATE/DELETE; admin/editor/pro can INSERT |
| `plant_scans` | Users can manage own scans |
| `impressions` | Admin SELECT only; server writes via service role |

---

## Cron Jobs

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `invoke-email-campaign-runner` | `* * * * *` (every minute) | Process email campaigns |
| `purge_old_web_visits` | `0 3 * * *` (3 AM daily) | Delete visits older than 35 days |
| `purge_old_bug_reports` | `0 4 * * *` (4 AM daily) | Delete completed bug reports >10 days |
| `ensure_task_occurrences` | `5 0 * * *` (12:05 AM daily) | Generate task occurrences |
| `purge_admin_activity_logs` | `0 3 * * *` (3 AM daily) | Delete logs older than 90 days |
| `cleanup_expired_garden_invites` | `0 2 * * *` (2 AM daily) | Remove expired invites |
| `cleanup_old_task_occurrences` | `0 3 * * 0` (3 AM weekly) | Archive old task data |
| `cleanup_expired_verification_codes` | `30 2 * * *` (2:30 AM daily) | Remove expired OTP codes |

---

## Functions & RPCs

### Authentication Helpers

| Function | Purpose |
|----------|---------|
| `is_admin_user(uuid)` | Check if user is admin (bypasses RLS) |
| `has_role(uuid, text)` | Check if user has specific role |
| `has_any_role(uuid, text[])` | Check if user has any of the roles |

### Garden Functions

| Function | Purpose |
|----------|---------|
| `get_garden_progress(uuid)` | Get task completion progress |
| `get_gardens_today_progress_batch(uuid[])` | Batch progress for multiple gardens |
| `get_task_occurrences_batch(uuid[])` | Get task occurrences efficiently |
| `ensure_task_occurrences_for_garden(uuid)` | Generate task instances |

### Shadow Ban Functions (Threat Level 3)

| Function | Purpose |
|----------|---------|
| `apply_shadow_ban(uuid)` | Apply shadow ban: saves current settings to `shadow_ban_backup`, then makes profile/gardens/bookmarks private, disables friend requests, removes all email/push consent, cancels pending requests/invites |
| `revert_shadow_ban(uuid)` | Revert shadow ban: restores pre-ban settings from `shadow_ban_backup` column, re-enables original privacy/notification preferences |

### Utility Functions

| Function | Purpose |
|----------|---------|
| `invoke_edge_function(text, jsonb)` | Call Supabase edge function |
| `cleanup_expired_verification_codes()` | Remove expired OTP codes |
| `reset_email_verification_on_email_change(uuid)` | Reset verification on email change |

### Notification Automation Trigger Types

| Trigger Type | Kind | Description |
|-------------|------|-------------|
| `weekly_inactive_reminder` | Cron (hourly) | Sends reminders to users inactive 7+ days |
| `daily_task_reminder` | Cron (hourly) | Sends reminders about incomplete tasks for today |
| `journal_continue_reminder` | Cron (hourly) | Encourages users who journaled yesterday to continue |
| `plant_request_fulfilled` | Event-driven | Notifies users when a plant they requested is added to the encyclopedia. Triggered by AI prefill or manual plant creation. Supports `{{plant}}` and `{{plantName}}` template variables. |

---

## Best Practices

### 1. Always Use Transactions for Multi-Table Operations

```sql
BEGIN;
  INSERT INTO gardens (...) VALUES (...);
  INSERT INTO garden_members (...) VALUES (...);
COMMIT;
```

### 2. Check Foreign Keys Before Insert

Always verify referenced records exist:
```sql
-- Before inserting into garden_plants
SELECT id FROM gardens WHERE id = $garden_id;
SELECT id FROM plants WHERE id = $plant_id;
```

### 3. Use Parameterized Queries

Never concatenate user input:
```javascript
// ✓ Good
await sql`SELECT * FROM profiles WHERE id = ${userId}`

// ✗ Bad
await sql.unsafe(`SELECT * FROM profiles WHERE id = '${userId}'`)
```

### 4. Respect RLS in Application Code

Always use the user's auth context, not service role, unless necessary:
```javascript
// User operations
const { data } = await supabase.from('gardens').select('*')

// Admin operations only
const { data } = await supabaseAdmin.from('admin_secrets').select('*')
```

### 5. Index Frequently Queried Columns

Ensure indexes exist for:
- Foreign keys (`user_id`, `garden_id`, etc.)
- Frequently filtered columns (`created_at`, `status`)
- Unique constraints

### 6. Avoid Many Consecutive ALTER TABLE Statements

PostgreSQL has a parsing bug where many consecutive `ALTER TABLE ADD COLUMN` statements 
in a single batch can trigger a "tables can have at most 1600 columns" error, even when 
the table has far fewer columns.

**Solution:** Use dynamic SQL inside a DO block:

```sql
do $$ 
declare
  col_defs text[][] := array[
    array['column_name', 'column_type_and_constraints'],
    array['another_col', 'text not null default ''value''']
  ];
begin
  for i in 1..array_length(col_defs, 1) loop
    begin
      if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
        and table_name = 'your_table' 
        and column_name = col_defs[i][1]
      ) then
        execute format('alter table public.your_table add column %I %s', 
                       col_defs[i][1], col_defs[i][2]);
      end if;
    exception when others then
      null; -- Skip if column exists with different constraints
    end;
  end loop;
end $$;
```

This pattern is used in `03_plants_and_colors.sql` for the plants table.

### 7. Make Migrations Defensive

Migration scripts that reference columns from other tables should verify those columns 
exist before running. This allows schema files to be run independently or in case of 
partial failures.

```sql
do $$
declare
  has_required_cols boolean;
begin
  -- Check if source columns exist
  select exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'source_table' 
    and column_name = 'required_column'
  ) into has_required_cols;
  
  if not has_required_cols then
    raise notice 'Skipping migration - required columns not present';
    return;
  end if;
  
  -- Run migration...
end $$;
```

This pattern is used in `04_translations_and_requests.sql` for data migrations.

---

## Common Pitfalls

### ❌ Don't Do This

#### 1. Duplicate Data
```sql
-- Don't store user email in profiles (it's in auth.users)
-- Don't store plant name in garden_plants (reference plants table)
```

#### 2. Skip RLS Policies
```sql
-- Every new table MUST have RLS enabled
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
-- And at least one policy
CREATE POLICY "..." ON new_table ...;
```

#### 3. Hard Delete User Data
```sql
-- Use soft deletes or proper cascade
-- auth.users deletion cascades to profiles
-- profiles deletion cascades to gardens, etc.
```

#### 4. Store Sensitive Data Unencrypted
```sql
-- Use admin_secrets for API keys
-- Never store passwords (Supabase Auth handles this)
```

#### 5. Create Tables Without Adding to allowed_tables
```sql
-- In 01_extensions_and_setup.sql, add new tables to:
allowed_tables constant text[] := array[
  'new_table_name',  -- ADD HERE
  ...
];
```

#### 6. Many Consecutive ALTER TABLE Statements
```sql
-- Don't do this - causes "1600 columns" parsing error:
ALTER TABLE t ADD COLUMN a TEXT;
ALTER TABLE t ADD COLUMN b TEXT;
ALTER TABLE t ADD COLUMN c TEXT;
-- ... 50+ more statements

-- Use dynamic SQL in DO block instead (see Best Practices #6)
```

### ✓ Do This Instead

#### 1. Use References
```sql
-- Reference auth.users for user data
user_id UUID REFERENCES auth.users(id)

-- Reference plants for plant data
plant_id TEXT REFERENCES plants(id)
```

#### 2. Add Proper Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_table_column ON table(column);
```

#### 3. Use CASCADE Appropriately
```sql
-- For child records that should be deleted with parent
REFERENCES parent(id) ON DELETE CASCADE

-- For records that should be preserved
REFERENCES parent(id) ON DELETE SET NULL
```

#### 4. Document Your Changes
```sql
COMMENT ON TABLE new_table IS 'Description of purpose';
COMMENT ON COLUMN new_table.column IS 'What this column stores';
```

---

## Schema Sync

To sync the database schema:

1. **From Admin Panel:** Click "Sync DB" button
2. **Manually:** Run files in `supabase/sync_parts/` in order (01-15)

The sync process:
- Executes each file individually
- Reports success/failure per file
- Continues after errors to identify all issues
- Logs results to `admin_activity_logs`

---

## Adding New Tables

1. **Create the table** in the appropriate sync_parts file
2. **Add to allowed_tables** in `01_extensions_and_setup.sql`
3. **Enable RLS** and create policies
4. **Add indexes** for foreign keys and common queries
5. **Add comments** for documentation
6. **Test** with both authenticated and anonymous users

```sql
-- Example: Adding a new table
CREATE TABLE IF NOT EXISTS public.my_new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_my_new_table_user ON public.my_new_table(user_id);

ALTER TABLE public.my_new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON public.my_new_table
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE public.my_new_table IS 'Description of what this table stores';
```

---

## Support

For questions about the database schema, contact the development team or refer to the codebase documentation.
