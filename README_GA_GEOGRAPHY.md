# GA4 Geographic Visitor Map

The Analytics overview at `/ga` loads geographic audience data from the
authenticated `/.netlify/functions/ga-geography` endpoint. Service-account and
geocoding credentials remain in the Netlify Function environment and are never
sent to the browser.

## Required environment variables

Add these values to `.env` locally and to the Netlify site environment:

```dotenv
GA4_PROPERTY_ID=123456789
GA4_HOST_NAME=ahangama.com
GOOGLE_CLIENT_EMAIL=analytics-reader@example.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_MAPS_API_KEY=server-side-key
DATABASE_URL=postgresql://...
```

- Grant the service-account email Viewer access to the GA4 property.
- Enable the Google Analytics Data API for its Google Cloud project.
- Enable the Google Geocoding API for `GOOGLE_MAPS_API_KEY` and restrict the
  key to that API. Do not use a `VITE_` variable for this server-side key.
- `GA4_HOST_NAME` is optional and defaults to `ahangama.com`.

## Coordinate and analytics caching

GA4 does not provide coordinates for the `city`, `region`, and `country`
dimensions. New locations are geocoded on the server and stored in
`ga_geography_coordinate_cache`. Successful and not-found results are reused;
transient geocoding failures are not cached. Analytics responses are cached in
each warm function instance for one hour per host and 7/30/90-day period. To
keep cold requests within serverless execution limits, at most 25 uncached
locations are resolved per request, in active-user order.

Apply the coordinate-cache migration before opening the dashboard:

```bash
npm run migrate
```

Without the migration, the endpoint can use its warm-instance memory cache but
will report that persistent caching is unavailable. Without a geocoding key,
already cached coordinates still render and new cities remain unresolved.

## Local testing

```bash
npm install
npm run migrate
npm run dev
```

Sign in as an allowed admin, open `http://localhost:8888/ga`, and switch among
7, 30, and 90 days. Confirm that the request to `ga-geography` succeeds, map
markers update without navigation, and repeat requests within an hour do not
issue another GA4 report from the same warm function instance.