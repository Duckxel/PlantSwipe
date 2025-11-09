# contact-support Supabase Function

This Edge Function receives contact form submissions from the Plant Swipe application and relays them to `support@aphylia.app` via SMTP.

## Environment variables

Configure the function with SMTP credentials that match the provider you set up in the Supabase dashboard (see [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)).

| Variable | Description |
| --- | --- |
| `SMTP_HOST` | SMTP host name (or set `SUPABASE_SMTP_HOST`) |
| `SMTP_PORT` | SMTP port (defaults to `465` if unset) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Email address used in the `From` header (optional, defaults to support address) |
| `SMTP_FROM_NAME` | Display name for the sender (optional) |

> The function automatically falls back to the Supabase-managed SMTP configuration (`SUPABASE_SMTP_*`) if you keep those environment variables in sync across your project.

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
- After deploying, assign the SMTP environment variables in the Supabase dashboard (`Project Settings → Functions → contact-support → Environment variables`).

Once deployed, the front-end invokes the function through the Supabase client using `supabase.functions.invoke('contact-support', { body })`.

