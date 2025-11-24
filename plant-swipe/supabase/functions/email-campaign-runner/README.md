# email-campaign-runner

This Supabase Edge Function scans the `admin_email_campaigns` table for due campaigns and sends templated emails to the entire user base using [Resend](https://resend.com/). Each email is rendered per recipient so `{{user}}` placeholders are replaced with the user’s display name.

## Environment variables

Configure these variables in the Supabase dashboard (`Project Settings → Functions → email-campaign-runner`):

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (injected automatically when deploying via CLI) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key so the function can read auth users and update tables |
| `RESEND_API_KEY` | Resend API key (alternatively `EMAIL_CAMPAIGN_RESEND_KEY` or `SUPABASE_RESEND_API_KEY`) |
| `EMAIL_CAMPAIGN_FROM` | Friendly from header, e.g. `Plant Swipe <support@aphylia.app>` (falls back to `RESEND_FROM`) |
| `EMAIL_CAMPAIGN_REPLY_TO` | Optional reply-to email |
| `EMAIL_CAMPAIGN_BATCH_SIZE` | Optional max recipients per Resend batch (default 40, max 100) |

## Invocation

Run locally with the Supabase CLI:

```bash
supabase functions serve email-campaign-runner --env-file ./functions/.env.local
```

Deploy to your project:

```bash
supabase functions deploy email-campaign-runner --project-ref <project-ref> --no-verify-jwt
```

Invoke manually (the function also supports scheduled invocations):

```bash
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "https://<project-ref>.functions.supabase.co/email-campaign-runner" \
  -d '{"campaignId":"<uuid>"}'
```

Payload options:

| Field | Type | Description |
| --- | --- | --- |
| `campaignId` | string | Manually process the specified campaign (even if still in draft) |
| `campaignLimit` | number | Max number of scheduled campaigns to process per run (default 1) |
| `recipientLimit` | number | Optional safety cap on recipients processed in this run |
| `batchSize` | number | Overrides the per-batch send size (1-100) |

The function responds with an array of campaign summaries including counts, batch outcomes, and any failure reasons for logging/monitoring.
