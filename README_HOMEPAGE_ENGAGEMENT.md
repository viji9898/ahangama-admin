# Homepage Engagement Analytics

The protected admin dashboard is available at `/ga/homepage-engagement`. It reads GA4 data through `/.netlify/functions/ga-homepage-engagement`; credentials remain server-side.

## Setup

Configure:

- `GA4_PROPERTY_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

The service account must have Viewer access to the GA4 property. The endpoint uses the same authentication and GA4 client as the existing analytics functions.

Register these event-scoped custom dimensions in GA4:

- `home_section`
- `component_location`
- `content_id`
- `content_title`
- `content_type`
- `position`
- `destination_url`
- `link_type`
- `control_name`
- `cta_location`
- `page_type`

GA4 custom dimensions do not backfill. Reports can therefore be empty for dates before registration. The Data API metadata endpoint does not expose registration dates, so the dashboard reports that limitation instead of guessing.

## Report definitions

All primary reports require `hostName = ahangama.com` and `pagePath = /` exactly. Preset or custom dates are compared with the immediately preceding period of equal length.

- Engagement rate: engaged sessions / sessions.
- Average engagement duration: user engagement duration / homepage users.
- Pass, newsletter, and transport rates: unique event users / homepage users.
- Section reach: section-view users / homepage users.
- Section drop-off: change in reached users from the preceding intended homepage section.
- Content CTR: selecting users / qualified-impression users.

`totalUsers` is used for user rates; event counts are shown only as action volumes. Homepage and historical article-card events remain separate event names and are normalized only in the response.

Purchase counts are deliberately unavailable until reliable homepage and cross-domain attribution exists. No estimate is produced.

## Operations

Successful endpoint responses are cached in-memory for 10 minutes. GA4 reports run with bounded concurrency and return partial results with per-report warnings. The diagnostics panel shows recent custom events, missing dimensions, blank content fields, unexpected event paths, and Data API errors.

Run focused validation with:

```sh
node --test netlify/functions/_lib/homepageEngagement.test.mjs
npx eslint netlify/functions/ga-homepage-engagement.mjs src/pages/GAHomepageEngagement.tsx
npm run build
```
