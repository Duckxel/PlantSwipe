# 📧 Contact Support Edge Function

<div align="center">

![Supabase](https://img.shields.io/badge/Supabase-Edge%20Function-3ecf8e?style=flat-square&logo=supabase)
![Resend](https://img.shields.io/badge/Email-Resend-000?style=flat-square)
![Deno](https://img.shields.io/badge/Runtime-Deno-000?style=flat-square&logo=deno)

**Receives contact form submissions from Aphylia and relays them to support using Resend.**

</div>

---

## 📋 Overview

This Supabase Edge Function handles contact form submissions from the Aphylia application. It:

- Receives form data (name, email, message, type)
- Validates the submission
- Sends an email to the appropriate recipient (support or business)
- Returns success/error status

---

## ⚙️ Environment Variables

Configure these in the Supabase dashboard under **Project Settings → Functions → contact-support → Environment variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | ✅ | Resend API key (or `SUPABASE_RESEND_API_KEY`) |
| `RESEND_FROM` | ❌ | From email (defaults to `support@aphylia.app`) |
| `RESEND_BUSINESS_FROM` | ❌ | From email for business inquiries |
| `RESEND_FROM_NAME` | ❌ | Display name (defaults to `Aphylia Support Form`) |
| `RESEND_BUSINESS_FROM_NAME` | ❌ | Display name for business (defaults to `Aphylia Business Form`) |
| `CONTACT_SUPPORT_EMAIL` | ❌ | Support recipients (comma-separated, falls back to `support@aphylia.app`) |
| `CONTACT_BUSINESS_EMAIL` | ❌ | Business recipients (comma-separated, falls back to `contact@aphylia.app`) |

### Legacy Variables

For backwards compatibility, these are also honored:

- `SMTP_FROM`, `SUPABASE_SMTP_SENDER` → Fallback for `RESEND_FROM`
- `SMTP_FROM_NAME` → Fallback for `RESEND_FROM_NAME`
- `SUPPORT_EMAIL_TO`, `SUPPORT_EMAIL` → Fallback for `CONTACT_SUPPORT_EMAIL`
- `BUSINESS_EMAIL_TO`, `BUSINESS_EMAIL`, `CONTACT_EMAIL_TO` → Fallback for `CONTACT_BUSINESS_EMAIL`

---

## 🚀 Deployment

### Deploy the Function

```bash
# Deploy to your Supabase project
supabase functions deploy contact-support \
  --project-ref <your-project-ref> \
  --no-verify-jwt
```

> **Note**: Use `--no-verify-jwt` so the function can be called from the public website without authentication.

### Set Environment Variables

After deploying, configure the environment variables in the Supabase dashboard:

1. Go to **Project Settings → Functions**
2. Click on `contact-support`
3. Add the required environment variables

---

## 🧪 Local Development

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Deno runtime (bundled with Supabase CLI)

### Create Environment File

Create `supabase/functions/.env.local`:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM=test@yourdomain.com
CONTACT_SUPPORT_EMAIL=you@example.com
```

### Serve Locally

```bash
supabase functions serve contact-support --env-file ./functions/.env.local
```

### Test the Function

```bash
curl -X POST http://localhost:54321/functions/v1/contact-support \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "message": "This is a test message",
    "type": "support"
  }'
```

---

## 📖 Usage

### Request Format

```typescript
POST /functions/v1/contact-support
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "I need help with my garden...",
  "type": "support" | "business"
}
```

### Response

**Success:**

```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

**Error:**

```json
{
  "success": false,
  "error": "Error message here"
}
```

### From the Frontend

```typescript
import { supabase } from '@/lib/supabaseClient'

const { data, error } = await supabase.functions.invoke('contact-support', {
  body: {
    name: formData.name,
    email: formData.email,
    message: formData.message,
    type: 'support'
  }
})

if (error) {
  console.error('Failed to send message:', error)
} else {
  console.log('Message sent successfully!')
}
```

---

## 🔍 Email Routing

| Form Type | Recipients | From Name |
|-----------|------------|-----------|
| `support` | `CONTACT_SUPPORT_EMAIL` | `RESEND_FROM_NAME` |
| `business` | `CONTACT_BUSINESS_EMAIL` | `RESEND_BUSINESS_FROM_NAME` |

---

## 🐛 Troubleshooting

### Common Issues

**Email not sending:**
- Check `RESEND_API_KEY` is correctly set
- Verify the from domain is verified in Resend
- Check Supabase function logs for errors

**Function not found:**
- Ensure function is deployed: `supabase functions list`
- Verify project reference is correct

**CORS errors:**
- The function includes CORS headers by default
- Check browser console for detailed error

### View Logs

```bash
# View function logs
supabase functions logs contact-support --project-ref <your-project-ref>
```

---

## 📚 Resources

| Resource | Link |
|----------|------|
| Supabase Edge Functions | [Documentation](https://supabase.com/docs/guides/functions) |
| Resend API | [Documentation](https://resend.com/docs) |
| Supabase CLI | [Installation](https://supabase.com/docs/guides/cli) |

---

<div align="center">

**Part of Aphylia** 🌿

[**Technical Documentation**](../../README.md) • [**Main README**](../../../README.md)

</div>
