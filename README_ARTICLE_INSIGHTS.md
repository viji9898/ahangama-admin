# Article Insights

`/ga/article-engagement` reads anonymous aggregate article events from GA4 through
`/.netlify/functions/api-article-insights`. It must not receive or display
names, email addresses, pass IDs, booking details, or URL query strings.
Both the route and API require an authorized admin session.

## GA4 custom definitions

This repository has Analytics Data API read access only. Register definitions
in GA4 Admin:

1. Open **Admin > Data display > Custom definitions** for the property in
   `GA4_PROPERTY_ID`.
2. Select **Create custom dimension** for each parameter below.
3. Set **Scope** to **Event**, use the parameter name exactly, and use a clear
   display name such as `Article content ID`.
4. Register: `content_id`, `content_title`, `article_category`, `author_name`,
   `component_location`, `article_section`, `progress_percent`,
   `target_content_id`, and `link_type`.
5. Select **Create custom metric**. Set the event parameter to
   `active_read_seconds`, scope to **Event**, and unit of measurement to
   **Seconds**.

The API verifies these definitions on every dashboard request and displays
their status. New definitions can take 24–48 hours to become reportable and do
not backfill events collected before registration.

The optional breakdown parameters `source_domain`, `destination_url`,
`utm_source`, `utm_medium`, and `utm_campaign` must also be registered as
event-scoped custom dimensions for their tables and filters to populate.
`pagePath` and `deviceCategory` are built-in GA4 dimensions.

## Counting limitations

The reading milestones use `eventCount`, not users. The shared browser tracker
emits each milestone once per article render, which avoids counting one person
twice during the same render while allowing legitimate repeat reads. The GA4
Data API cannot independently deduplicate a duplicated client event by render
because no anonymous render identifier is collected.

GA4 has no intrinsic article section order. The dashboard preserves the order
returned by GA4. To guarantee editorial order, add a non-PII `section_index`
parameter to `article_section_view`, register it as an event-scoped dimension,
and order the section report by that value.