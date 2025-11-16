# contact-support Supabase Function

This Edge Function receives contact form submissions from the Aphylia application and relays them to `support@aphylia.app` using [Resend](https://resend.com/).

## Environment variables

Configure the function with your Resend API credentials.

| Variable | Description |
| --- | --- |
| `RESEND_API_KEY` | Resend API key (or `SUPABASE_RESEND_API_KEY`) |
| `RESEND_FROM` | Primary from email address (optional, defaults to `support@aphylia.app`) |
| `RESEND_BUSINESS_FROM` | Alternate from email address for business submissions (optional, falls back to `RESEND_FROM`) |
| `RESEND_FROM_NAME` | Display name for support submissions (optional, defaults to `Aphylia Support Form`) |
| `RESEND_BUSINESS_FROM_NAME` | Display name for business submissions (optional, defaults to `Aphylia Business Form`) |
| `CONTACT_SUPPORT_EMAIL` | Comma‑separated list of support recipients (falls back to `SUPPORT_EMAIL_TO`, `SUPPORT_EMAIL`, then `support@aphylia.app`) |
| `CONTACT_BUSINESS_EMAIL` | Comma‑separated list of business recipients (falls back to `BUSINESS_EMAIL_TO`, `BUSINESS_EMAIL`, `CONTACT_EMAIL_TO`, then `contact@aphylia.app`) |

> For backwards compatibility, the function still honours `SMTP_FROM`, `SUPABASE_SMTP_SENDER`, and `SMTP_FROM_NAME` when computing the `from` header if `RESEND_FROM` isn’t set.

## Local development

You can test the function locally with the Supabase CLI:

```bash
supabase functions serve contact-support --env-file ./functions/.env.local
```

Populate `.env.local` with the SMTP variables listed above. Remember to spoof `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the CLI if they are not already available in your shell.

## Deployment

Deploy the function with the Supabase CLI:

```bash
supabase functions deploy contact-support --project-ref <project-ref> --no-verify-jwt
```

- Use `--no-verify-jwt` so the function can be called from the public website without requiring authentication.
- After deploying, assign the Resend environment variables in the Supabase dashboard (`Project Settings → Functions → contact-support → Environment variables`).

Once deployed, the front-end invokes the function through the Supabase client using `supabase.functions.invoke('contact-support', { body })`.

