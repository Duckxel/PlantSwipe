# Send Automatic Email

This Supabase Edge Function sends automatic emails based on trigger events (e.g., welcome emails for new users).

## Configuration

The function looks up the `admin_email_triggers` table to check if a trigger is enabled and which template to use.

### Database Tables

- `admin_email_triggers`: Configuration for each automatic email type
- `admin_email_templates`: Email templates with subject and body
- `admin_email_template_translations`: Translated versions of templates
- `admin_automatic_email_sends`: Tracks which emails have been sent to prevent duplicates

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for admin access | Yes |
| `RESEND_API_KEY` | Resend API key for sending emails | Yes |
| `EMAIL_CAMPAIGN_FROM` | From address (e.g., "Aphylia <info@aphylia.app>") | No |
| `EMAIL_CAMPAIGN_REPLY_TO` | Reply-to address | No |
| `WEBSITE_URL` | Website URL for links in emails | No |

## Payload

```json
{
  "triggerType": "WELCOME_EMAIL",
  "userId": "uuid-of-user",
  "userEmail": "user@example.com",
  "userDisplayName": "John",
  "userLanguage": "en"
}
```

## Response

### Success
```json
{
  "sent": true,
  "messageId": "resend-message-id",
  "template": "Welcome Email Template"
}
```

### Skipped (valid but not sent)
```json
{
  "sent": false,
  "reason": "trigger_disabled" | "no_template" | "already_sent" | "trigger_not_found",
  "message": "Human readable message"
}
```

## Supported Trigger Types

- `WELCOME_EMAIL` - Sent when a new user creates an account

## Invoking

From the Node.js server or frontend after successful signup:

```javascript
await supabase.functions.invoke('send-automatic-email', {
  body: {
    triggerType: 'WELCOME_EMAIL',
    userId: user.id,
    userEmail: user.email,
    userDisplayName: displayName,
    userLanguage: 'en'
  }
})
```
