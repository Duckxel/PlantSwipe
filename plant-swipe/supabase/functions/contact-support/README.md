# contact-support Supabase Function

This Edge Function receives contact form submissions from the Plant Swipe application and relays them to `support@aphylia.app` using [Resend](https://resend.com/).

## Environment variables

Configure the function with your Resend API credentials.

| Variable | Description |
| --- | --- |
| `RESEND_API_KEY` | Resend API key (or set `SUPABASE_RESEND_API_KEY`) |
| `RESEND_FROM` | From email address (defaults to `support@aphylia.app`) |
| `RESEND_FROM_NAME` | Display name for the sender (defaults to `Plant Swipe Contact`) |

> The function still accepts the legacy `SMTP_FROM` / `SUPABASE_SMTP_SENDER` / `SMTP_FROM_NAME` environment variables for backward compatibility when computing the `from` header, but the SMTP transport has been replaced by Resend.

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

