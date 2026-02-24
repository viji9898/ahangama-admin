# Ahangama Admin — Venue Schema (DB ↔ API)

This document lists the venue fields used by the Ahangama Admin stack, including DB column mapping, types, and defaults.

## Conventions

- **API/Frontend** uses **camelCase**.
- **Database** uses **snake_case**.
- API returns a **Venue DTO** with camelCase keys.

## Core venue fields

| API field         | DB column          |    Type | Required | Default / Notes                      |
| ----------------- | ------------------ | ------: | :------: | ------------------------------------ |
| `id`              | `id`               |  string |    ✅    | Create defaults to `slug` if omitted |
| `destinationSlug` | `destination_slug` |  string |    ✅    | lowercased                           |
| `name`            | `name`             |  string |    ✅    |                                      |
| `slug`            | `slug`             |  string |    ✅    | unique with `destinationSlug`        |
| `status`          | `status`           |  string |    ✅    | DB default: `active`                 |
| `live`            | `live`             | boolean |    ✅    | DB default: `true`                   |

## Curation & filtering fields (NEW)

| API field        | DB column         |                                             Type | Required | Default / Notes                                         |
| ---------------- | ----------------- | -----------------------------------------------: | :------: | ------------------------------------------------------- |
| `editorialTags`  | `editorial_tags`  |                                         string[] |    ✅    | DB default: `[]`                                        |
| `isPassVenue`    | `is_pass_venue`   |                                          boolean |    ✅    | DB default: `false` (backfill uses `offers.length > 0`) |
| `staffPick`      | `staff_pick`      |                                          boolean |    ✅    | DB default: `false`                                     |
| `priorityScore`  | `priority_score`  |                                           number |    ✅    | DB default: `0`, must be $\ge 0$                        |
| `laptopFriendly` | `laptop_friendly` |                                          boolean |    ✅    | DB default: `false`                                     |
| `powerBackup`    | `power_backup`    | `generator` \| `inverter` \| `none` \| `unknown` |    ✅    | DB default: `unknown`                                   |

### Admin UI: controlled vocabulary

The admin multi-select for `editorialTags` uses a controlled vocabulary defined in code:

- `src/constants/editorialTags.ts`

## Content + taxonomy

| API field      | DB column      |           Type | Required | Default / Notes                 |
| -------------- | -------------- | -------------: | :------: | ------------------------------- |
| `categories`   | `categories`   |       string[] |    ✅    | DB default: `[]`                |
| `emoji`        | `emoji`        |       string[] |    ✅    | DB default: `[]`                |
| `stars`        | `stars`        | number \| null |    ⛔    |                                 |
| `reviews`      | `reviews`      | number \| null |    ⛔    |                                 |
| `discount`     | `discount`     | number \| null |    ⛔    | stored as fraction (e.g. `0.1`) |
| `excerpt`      | `excerpt`      | string \| null |    ⛔    |                                 |
| `description`  | `description`  | string \| null |    ⛔    |                                 |
| `bestFor`      | `best_for`     |       string[] |    ✅    | DB default: `[]`                |
| `tags`         | `tags`         |       string[] |    ✅    | DB default: `[]`                |
| `cardPerk`     | `card_perk`    | string \| null |    ⛔    |                                 |
| `offers`       | `offers`       |     JSON array |    ✅    | DB default: `[]`                |
| `howToClaim`   | `how_to_claim` | string \| null |    ⛔    |                                 |
| `restrictions` | `restrictions` | string \| null |    ⛔    |                                 |

## Location + media

| API field      | DB column       |           Type | Required | Default / Notes |
| -------------- | --------------- | -------------: | :------: | --------------- |
| `area`         | `area`          | string \| null |    ⛔    |                 |
| `lat`          | `lat`           | number \| null |    ⛔    |                 |
| `lng`          | `lng`           | number \| null |    ⛔    |                 |
| `logo`         | `logo`          | string \| null |    ⛔    | URL             |
| `image`        | `image`         | string \| null |    ⛔    | URL             |
| `ogImage`      | `og_image`      | string \| null |    ⛔    | URL             |
| `mapUrl`       | `map_url`       | string \| null |    ⛔    | URL             |
| `instagramUrl` | `instagram_url` | string \| null |    ⛔    | URL             |
| `whatsapp`     | `whatsapp`      | string \| null |    ⛔    |                 |

## Server-managed timestamps

| API field   | DB column    |      Type | Required | Default / Notes                   |
| ----------- | ------------ | --------: | :------: | --------------------------------- |
| `updatedAt` | `updated_at` | timestamp |    ✅    | DB trigger updates on row updates |
| `createdAt` | `created_at` | timestamp |    ✅    | DB default: `now()`               |

## Default list sorting

The venue list endpoint returns venues ordered by:

```sql
ORDER BY priority_score DESC, staff_pick DESC, stars DESC
```
