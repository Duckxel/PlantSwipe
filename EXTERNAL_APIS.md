# External APIs Used in Aphylia

> **Comprehensive list of all third-party services and APIs**  
> Last updated: February 15, 2026

---

## Table of Contents

1. [Location & Geocoding](#location--geocoding)
2. [Weather](#weather)
3. [Translation](#translation)
4. [AI & Machine Learning](#ai--machine-learning)
5. [Security & Verification](#security--verification)
6. [Analytics](#analytics)
7. [Error Tracking & Monitoring](#error-tracking--monitoring)
8. [Email Services](#email-services)
9. [Backend Infrastructure](#backend-infrastructure)
10. [Fonts & Assets](#fonts--assets)
11. [Payment Processing (Planned)](#payment-processing-planned)

---

## Location & Geocoding

### 1. Open-Meteo Geocoding API

**URL:** `https://geocoding-api.open-meteo.com/v1/search`

**Purpose:**
- Location search and autocomplete suggestions
- Forward geocoding (city name → coordinates)
- Returns latitude, longitude, timezone, country, state/province

**Authentication:** None required (Free, open-source)

**Usage:**
- Location search in garden settings
- User setup wizard
- Location-based features

**Files:**
- `plant-swipe/src/components/garden/GardenLocationEditor.tsx`
- `plant-swipe/src/pages/SetupPage.tsx`
- `plant-swipe/src/pages/SettingsPage.tsx`

**API Example:**
```
GET https://geocoding-api.open-meteo.com/v1/search?name=Paris&count=8&language=en&format=json
```

---

### 2. Nominatim (OpenStreetMap)

**URL:** `https://nominatim.openstreetmap.org/reverse`

**Purpose:**
- Reverse geocoding (coordinates → city name)
- Used when user clicks "Detect Location" button

**Authentication:** None required (Free, open-source)

**Usage:**
- Converting GPS coordinates to human-readable addresses
- Auto-detection of user location

**Files:**
- `plant-swipe/src/components/garden/GardenLocationEditor.tsx`
- `plant-swipe/src/pages/SetupPage.tsx`

**API Example:**
```
GET https://nominatim.openstreetmap.org/reverse?format=json&lat=48.8566&lon=2.3522
```

**Important:** Respects Nominatim's usage policy (User-Agent header included)

---

### 3. ipapi.co

**URL:** `https://ipapi.co/json/`

**Purpose:**
- IP-based geolocation
- Automatic timezone detection
- Initial location suggestion during setup

**Authentication:** None required for basic usage

**Usage:**
- User onboarding
- Timezone detection
- Location fallback when GPS unavailable

**Files:**
- `plant-swipe/src/pages/SetupPage.tsx`
- `plant-swipe/src/pages/SettingsPage.tsx`
- `plant-swipe/server.js`

**API Example:**
```
GET https://ipapi.co/{ip}/json/
```

---

## Weather

### 4. Open-Meteo Weather API

**URL:** `https://api.open-meteo.com/v1/forecast`

**Purpose:**
- Current weather conditions
- 7-day weather forecast
- Temperature, humidity, precipitation, wind speed
- Weather-based gardening advice

**Authentication:** None required (Free, open-source)

**Usage:**
- Garden analytics dashboard
- Weather-based care recommendations
- AI gardening advice generation

**Files:**
- `plant-swipe/server.js` (line 22233, 22659)
- `plant-swipe/src/components/garden/GardenAnalyticsSection.tsx`

**API Example:**
```
GET https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7
```

**Features Used:**
- Current temperature & humidity
- Weather codes (sunny, rainy, cloudy, etc.)
- 7-day forecast
- Precipitation probability
- Wind speed

---

## Translation

### 5. DeepL Translation API

**URL:** `https://api.deepl.com/v2/translate` (Pro) or `https://api-free.deepl.com/v2/translate` (Free)

**Purpose:**
- Multi-language support (EN/FR)
- Plant database translation
- Admin content translation
- Landing page localization
- Email template translation

**Authentication:** API Key required (`DEEPL_API_KEY`)

**Usage:**
- Translating plant names, descriptions, care instructions
- Admin panel "Translate to All Languages" feature
- Notification translations
- Color names translation

**Files:**
- `plant-swipe/src/lib/deepl.ts`
- `plant-swipe/server.js` (endpoints: `/api/translate`, `/api/translate-batch`, `/api/detect-language`)
- `plant-swipe/src/components/admin/AdminLandingPanel.tsx`
- `plant-swipe/src/components/admin/AdminColorsPanel.tsx`

**Rate Limiting:**
- Max 3 concurrent requests
- 500 requests/hour per user
- Automatic retry with exponential backoff on 429 errors
- Request queuing system implemented

**API Example:**
```
POST https://api.deepl.com/v2/translate
Authorization: DeepL-Auth-Key {API_KEY}
Content-Type: application/json

{
  "text": ["Hello, world!"],
  "target_lang": "FR",
  "source_lang": "EN"
}
```

---

## AI & Machine Learning

### 6. OpenAI API (GPT Models)

**URL:** `https://api.openai.com/v1/`

**Purpose:**
- AI-powered plant care advice
- Image analysis (plant health, pests, diseases)
- Garden journal photo analysis
- Smart plant data filling
- Conversational assistant for plant care

**Authentication:** API Key required (`OPENAI_API_KEY`)

**Models Used:**
- `gpt-5.2-2025-12-11` - Main model for complex tasks
- `gpt-5-nano` - Lightweight model for simpler tasks

**Usage:**
- **Garden Advice:** Weekly personalized gardening tips based on:
  - User's plant collection
  - Weather forecast
  - Task completion history
  - Garden journal photos (vision analysis)
- **Plant Fill:** Auto-completing plant profiles from partial data
- **Image Analysis:** Analyzing plant photos for health issues
- **Assistant:** Interactive Q&A about plant care

**Files:**
- `plant-swipe/server.js` (AI endpoints)
- Garden advice generation (line 21800+)
- Plant fill AI (line 5375+)
- Vision analysis for journal photos

**Features:**
- Structured JSON output using `zodResponseFormat`
- Vision API for image analysis (up to 4 images)
- Streaming responses for chat
- Conversation history tracking

**API Example:**
```javascript
const response = await openaiClient.responses.create({
  model: 'gpt-5.2-2025-12-11',
  input: [
    { type: 'input_text', text: prompt },
    { type: 'input_image', image_url: photoUrl }
  ],
  response_format: zodResponseFormat(adviceSchema, 'gardenAdvice')
})
```

---

## Security & Verification

### 7. Google reCAPTCHA Enterprise v3

**Site Key:** `6Leg5BgsAAAAAEh94kkCnfgS9vV-Na4Arws3yUtd`

**Purpose:**
- Bot protection
- Spam prevention
- Form abuse prevention
- Account security

**Authentication:** Site key (public) + Secret key (server-side)

**Usage:**
- Login/signup forms
- Contact forms
- Sensitive operations
- GDPR-compliant (loaded only with user consent)

**Files:**
- `plant-swipe/src/lib/recaptcha.ts`
- `plant-swipe/index.html`
- `plant-swipe/src/context/AuthContext.tsx`

**Implementation:**
- Dynamic loading after cookie consent
- Graceful fallback when consent not given
- v3 invisible captcha (no user interaction)

**API Endpoints:**
```
https://www.google.com/recaptcha/api.js
https://recaptchaenterprise.googleapis.com/
```

---

## Analytics

### 8. Google Analytics 4

**Measurement ID:** `G-LDSYW5QNK5`

**Purpose:**
- User behavior tracking
- Feature usage analytics
- Conversion tracking
- Performance monitoring

**Authentication:** Measurement ID

**Usage:**
- Page view tracking
- Event tracking (sign up, login, plant actions)
- Garden activity monitoring
- **GDPR-compliant:** Only loads with explicit user consent

**Files:**
- `plant-swipe/src/lib/gdprAnalytics.ts`
- `plant-swipe/src/components/CookieConsent.tsx`

**Events Tracked:**
- User actions: sign_up, login, logout
- Plant events: view_item, add_to_wishlist, search
- Garden events: garden_create, garden_plant_add
- Feature usage

**Privacy:**
- Consent-based loading
- Cookie deletion on consent withdrawal
- IP anonymization
- No PII tracking

**API Endpoints:**
```
https://www.google-analytics.com
https://analytics.google.com
https://region1.google-analytics.com
```

---

## Error Tracking & Monitoring

### 9. Sentry

**DSN:** `https://758053551e0396eab52314bdbcf57924@o4510783278350336.ingest.de.sentry.io/4510783285821520`

**Region:** Germany (de.sentry.io)

**Purpose:**
- Error tracking and reporting
- Performance monitoring
- Release tracking
- User feedback collection

**Authentication:** DSN (Data Source Name)

**Coverage:**
- **Frontend:** `@sentry/react`
- **Backend:** `@sentry/node` (server.js)
- **Admin API:** `sentry-sdk[flask]` (Python)
- **Scripts:** `@sentry/node` (sitemap generator)

**Files:**
- `plant-swipe/src/lib/sentry.ts`
- `plant-swipe/server.js`
- `admin_api/app.py`
- `plant-swipe/scripts/generate-sitemap.js`

**Features:**
- React error boundaries
- Performance transaction tracking
- Release health monitoring
- User consent management (GDPR)
- Maintenance mode tracking

**Tags:**
- `server`: Server identifier
- `app`: Application name (plant-swipe, admin-api)
- Environment (production, development)

---

## Email Services

### 10. Resend

**URL:** `https://api.resend.com/emails`

**Purpose:**
- Transactional emails
- Contact form submissions
- Support tickets
- Business inquiries
- Email campaigns

**Authentication:** API Key required (`RESEND_API_KEY`)

**Usage:**
- Contact support form
- Bug report submissions
- Business contact form
- Email notifications
- Marketing campaigns (admin panel)

**Files:**
- `plant-swipe/supabase/functions/contact-support/index.ts`
- `plant-swipe/supabase/functions/email-campaign-runner/index.ts`

**Email Types:**
- **Support:** `support@aphylia.app`
- **Business:** `contact@aphylia.app`
- **Bug Reports:** `dev@aphylia.app`
- **From Address:** `form@aphylia.app`

**Features:**
- HTML email templates
- Multiple recipient support
- Custom from addresses
- Reply-to functionality

**API Example:**
```
POST https://api.resend.com/emails
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "from": "form@aphylia.app",
  "to": ["support@aphylia.app"],
  "subject": "Contact Form Submission",
  "html": "<html>...</html>"
}
```

---

## Backend Infrastructure

### 11. Supabase

**Project URL:** `https://*.supabase.co`

**Services Used:**
- **Database:** PostgreSQL with Row Level Security (RLS)
- **Authentication:** Email/password, OAuth
- **Storage:** File uploads (plant photos, journal images)
- **Edge Functions:** Serverless functions (contact forms, email campaigns)
- **Realtime:** WebSocket subscriptions (notifications, messaging)

**Authentication:** Project URL + Anon Key + Service Role Key

**Files:**
- `plant-swipe/src/lib/supabaseClient.ts`
- `plant-swipe/supabase/` (database schema, migrations, functions)

**Features:**
- User authentication
- Plant database storage
- Garden data management
- Real-time notifications
- Image storage
- Messaging system

**Endpoints:**
```
https://*.supabase.co (REST API)
wss://*.supabase.co (WebSocket)
```

---

## Fonts & Assets

### 12. Google Fonts

**URLs:**
- `https://fonts.googleapis.com` (CSS)
- `https://fonts.gstatic.com` (Font files)

**Fonts Used:**
- **Quicksand** (weights: 600, 700) - Primary brand font
- **DM Sans** - Content font
- **Inter** - UI font

**Purpose:**
- Typography
- Brand consistency
- Email templates
- Landing page

**Files:**
- `plant-swipe/server.js`
- `plant-swipe/src/components/tiptap-templates/simple/simple-editor.scss`
- Email templates

**API Example:**
```
https://fonts.googleapis.com/css2?family=Quicksand:wght@600;700&display=swap
```

---

## Payment Processing (Planned)

### 13. Stripe (Mentioned in Privacy Policy)

**Status:** Planned / Referenced

**Purpose:**
- Payment processing for premium features
- Subscription management
- Payment instrument handling

**Authentication:** API Key (when implemented)

**Note:** Currently mentioned in privacy policy but not yet implemented in code.

---

### 14. PayPal (Mentioned in Terms of Service)

**Status:** Planned / Referenced

**Purpose:**
- Alternative payment method
- Subscription payments

**Note:** Currently mentioned in terms of service but not yet implemented.

---

## API Summary Table

| API | Type | Auth Required | Cost | GDPR Compliant | Purpose |
|-----|------|---------------|------|----------------|---------|
| Open-Meteo Geocoding | Location | ❌ No | Free | ✅ Yes | Location search |
| Nominatim | Location | ❌ No | Free | ✅ Yes | Reverse geocoding |
| ipapi.co | IP Geo | ❌ No | Free | ⚠️ See policy | IP location |
| Open-Meteo Weather | Weather | ❌ No | Free | ✅ Yes | Weather data |
| DeepL | Translation | ✅ Yes | Paid | ✅ Yes | Multi-language |
| OpenAI | AI | ✅ Yes | Paid | ⚠️ See policy | AI features |
| Google reCAPTCHA | Security | ✅ Yes | Free | ✅ Consent-based | Bot protection |
| Google Analytics | Analytics | ❌ No | Free | ✅ Consent-based | User tracking |
| Sentry | Monitoring | ✅ Yes | Freemium | ✅ Yes | Error tracking |
| Resend | Email | ✅ Yes | Paid | ✅ Yes | Transactional email |
| Supabase | Backend | ✅ Yes | Freemium | ✅ Yes | Full stack |
| Google Fonts | Assets | ❌ No | Free | ✅ Yes | Typography |

---

## Environment Variables Required

```bash
# Translation
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api.deepl.com/v2/translate

# AI
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-5.2-2025-12-11
OPENAI_MODEL_NANO=gpt-5-nano

# Email
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=form@aphylia.app
RESEND_FROM_NAME=Aphylia Support Form

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Analytics & Monitoring (public keys - configured in code)
# GA_MEASUREMENT_ID=G-LDSYW5QNK5
# RECAPTCHA_SITE_KEY=6Leg5BgsAAAAAEh94kkCnfgS9vV-Na4Arws3yUtd
# SENTRY_DSN=https://758053551e0396eab52314bdbcf57924@...
```

---

## Security & Privacy Compliance

### GDPR Compliance

All APIs respect GDPR requirements:

1. **Consent-Based Loading:**
   - Google Analytics: Loads only with analytics consent
   - reCAPTCHA: Loads only with essential/analytics/all consent
   - Sentry: Respects user privacy settings

2. **Data Minimization:**
   - Only collect necessary data
   - No excessive API calls
   - Location data only when needed

3. **User Rights:**
   - Data export available
   - Data deletion supported
   - Consent withdrawal honored

4. **Third-Party Processors:**
   - All vendors are GDPR-compliant
   - Data Processing Agreements (DPAs) in place
   - EU/US data transfers compliant

### Rate Limiting & Quotas

- **DeepL:** 500 requests/hour per user, 3 concurrent max
- **OpenAI:** Based on API plan, usage tracked
- **Resend:** Based on subscription plan
- **Nominatim:** Fair use policy (1 request/second)
- **Open-Meteo:** No limits on free tier

---

## Cost Estimation

### Monthly Costs (Estimated for 10,000 active users)

| Service | Tier | Est. Monthly Cost |
|---------|------|-------------------|
| Supabase | Pro | $25-100 |
| DeepL | Pro | $30-200 (based on usage) |
| OpenAI | Pay-as-you-go | $100-500 (based on usage) |
| Resend | Pro | $20-100 |
| Sentry | Team | $26+ |
| Google Analytics | Free | $0 |
| reCAPTCHA | Free | $0 |
| Open-Meteo | Free | $0 |
| Nominatim | Free | $0 |
| ipapi.co | Free/Paid | $0-50 |
| Google Fonts | Free | $0 |
| **Total** | | **$201-976/month** |

*Costs vary significantly based on actual usage, especially for AI and translation services.*

---

## API Health Monitoring

To monitor API health, check:

1. **Sentry Dashboard:** Error rates, performance
2. **Supabase Dashboard:** Database queries, storage
3. **OpenAI Usage:** Token consumption, costs
4. **DeepL Account:** Translation usage, quota
5. **Google Analytics:** User traffic, events
6. **Resend Dashboard:** Email delivery rates

---

## Future API Integrations

Potential future additions:

- **Stripe:** Payment processing for premium features
- **Twilio:** SMS notifications (optional)
- **Cloudinary:** Image optimization and CDN
- **Algolia:** Advanced plant search
- **Mapbox:** Enhanced map features
- **Firebase Cloud Messaging:** Push notifications

---

## Support & Documentation

- **Open-Meteo:** https://open-meteo.com/
- **DeepL:** https://www.deepl.com/docs-api
- **OpenAI:** https://platform.openai.com/docs
- **Supabase:** https://supabase.com/docs
- **Resend:** https://resend.com/docs
- **Sentry:** https://docs.sentry.io/
- **Google Analytics:** https://developers.google.com/analytics
- **reCAPTCHA:** https://cloud.google.com/recaptcha-enterprise/docs

---

## Contact

For API-related questions:
- **Technical:** dev@aphylia.app
- **Support:** support@aphylia.app
- **Business:** contact@aphylia.app

---

*Last updated: February 15, 2026*
