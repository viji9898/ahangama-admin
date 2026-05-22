# Daily Team Email

This document covers the scheduled daily team email that sends the previous day's QR performance report.

## What it does

- Runs a Netlify scheduled function named `daily-team-email`.
- Builds a report for the previous day in London time.
- Pulls QR analytics from GA4 and venue/admin data from Postgres.
- Optionally adds an AI-written summary when OpenAI credentials are present.
- Sends the email through SendGrid.
- Records a send ledger in Postgres so the same report date is not sent twice unless forced.

## Main files

- `netlify/functions/daily-team-email.mjs`: scheduled function entrypoint.
- `netlify/functions/api-daily-team-email-preview.mjs`: admin preview and manual send endpoint.
- `netlify/functions/_lib/dailyTeamEmail.mjs`: report building, preview payload, email composition, and send logic.
- `netlify/functions/_lib/ga4QrAnalytics.mjs`: GA4 data collection used by the report.
- `migrations/005_create_daily_team_email_sends.sql`: send ledger table.
- `netlify.toml`: schedule registration.

## Schedule

The Netlify schedule is configured in `netlify.toml`:

```toml
[functions."daily-team-email"]
  schedule = "@daily"
```

The report date is always resolved as the previous day using the `Europe/London` timezone.

## Required setup

Required environment variables:

- `DATABASE_URL`: Postgres connection string.
- `GA4_PROPERTY_ID`: GA4 property used for QR analytics.
- `GOOGLE_CLIENT_EMAIL`: service account email for GA4 access.
- `GOOGLE_PRIVATE_KEY`: service account private key for GA4 access.
- `SENDGRID_API_KEY`: SendGrid API key used to deliver the email.

Optional environment variables:

- `DAILY_REPORT_TO_EMAILS`: comma-separated recipient list. Default: `team@ahangama.com`.
- `DAILY_REPORT_FROM_EMAIL`: sender email. Default: `hello@ahangama.com`.
- `DAILY_REPORT_DESTINATION_SLUG`: destination slug used in venue/admin summary queries. Default: `ahangama`.
- `OPENAI_API_KEY`: enables AI summary generation.
- `OPENAI_MODEL`: overrides the AI model. Default: `gpt-5-mini`.

## Database requirement

Apply the migration that creates the send ledger before using the scheduled sender:

```bash
npm run migrate
```

The relevant migration is `migrations/005_create_daily_team_email_sends.sql`.

## Manual preview and send

The admin UI uses `/.netlify/functions/api-daily-team-email-preview`.

Behavior:

- `GET /.netlify/functions/api-daily-team-email-preview`: returns the preview payload for the default report date.
- `GET /.netlify/functions/api-daily-team-email-preview?date=YYYY-MM-DD`: preview a specific report date.
- `GET /.netlify/functions/api-daily-team-email-preview?send=1`: send the email for the resolved report date.
- `GET /.netlify/functions/api-daily-team-email-preview?send=1&force=1`: send even if the ledger says it was already sent.

This endpoint requires an authenticated admin session.

## Sending rules

- The scheduled job generates the report, then calls the shared send routine.
- A report is skipped when an entry already exists for the same `report_name` and `report_date`.
- Forced sends bypass that check only on the preview endpoint.
- If OpenAI summary generation fails, the email still sends without the AI summary.
- If SendGrid rejects the request, nothing is written to the send ledger.

## Local development

Start the app and Netlify functions together:

```bash
npm run dev
```

Useful local checks:

- Open the admin home page and use the daily email preview card.
- Hit `/.netlify/functions/api-daily-team-email-preview` while signed in as an admin.
- Invoke `/.netlify/functions/daily-team-email` manually if you want to exercise the scheduled handler directly.

## Troubleshooting

- `Missing env var: DATABASE_URL`: Postgres is not configured.
- `Missing env var: SENDGRID_API_KEY`: SendGrid is not configured.
- GA4 auth failures usually mean `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, or `GA4_PROPERTY_ID` is missing or invalid.
- `already-sent`: the report date already exists in `daily_team_email_sends`; use `force=1` only for intentional re-sends.
- Missing AI summary with a successful send means the OpenAI call failed but the fallback path worked as designed.