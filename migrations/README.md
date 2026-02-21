# Database Migrations (Adding New Fields)

This repo uses plain SQL migration files in the `migrations/` folder, applied by a small Node script.

## How migrations are applied

- Runner: `scripts/migrate.mjs`
- Command: `npm run migrate`
  - This runs: `dotenv -e .env node scripts/migrate.mjs`
  - Requires `DATABASE_URL` in `.env`
- The runner creates/uses a table called `schema_migrations` to record which migration filenames have been applied.
- **Important:** The runner wraps each migration in its own transaction (`BEGIN`/`COMMIT`).
  - Therefore **do not** put `BEGIN`, `COMMIT`, or `ROLLBACK` inside migration files.

## Adding a new field (recommended workflow)

When you add a column/field to the `venues` table, do these steps in order.

### 1) Create a new migration SQL file

- Add a new numbered file in `migrations/`, e.g.:
  - `003_add_<field>_to_venues.sql`
- Keep it **idempotent** where reasonable so it can be safely re-run:
  - Use `ADD COLUMN IF NOT EXISTS`
  - When possible, backfill existing rows
  - Then set `DEFAULT` and `NOT NULL`

Example pattern:

```sql
-- Migration: Add <field> to venues

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS <field_name> <type>;

-- Backfill existing rows (if needed)
UPDATE venues
SET <field_name> = <some_value>
WHERE <field_name> IS NULL;

-- Enforce desired constraints
ALTER TABLE venues
  ALTER COLUMN <field_name> SET DEFAULT <default_value>;

ALTER TABLE venues
  ALTER COLUMN <field_name> SET NOT NULL;
```

Notes:

- If the new field is **optional**, skip the `SET NOT NULL`.
- For large tables, consider batching backfills (not needed for our current size).

### 2) Update Netlify functions to read/write the new field

Any new DB field usually requires updates to:

- `netlify/functions/api-venues-list.mjs`
  - Add the column to the `SELECT` list
  - Add it to `toVenueDto(row)`

- `netlify/functions/api-venues-update.mjs`
  - Add it to `toVenueDto(row)`
  - If it’s editable, add it to the `UPDATE ... SET` statement
  - Add a `has("field") ? value : null` param so PATCH works correctly

- `netlify/functions/api-venues-create.mjs`
  - If you want imports/creates to set it, add to `INSERT` + `ON CONFLICT DO UPDATE`
  - Decide on a server-side default when the client doesn’t provide it

### 3) Update frontend types + UI

- Update the `Venue` TypeScript interface(s) used in:
  - `src/pages/Admin.tsx`
  - `src/pages/VenueDetail.tsx`
  - Any components that display the field

- If the field is editable from the UI:
  - Add UI controls (e.g. a `Switch` for booleans)
  - Persist via `PATCH /.netlify/functions/api-venues-update`
  - Prefer optimistic update + rollback on error

### 4) Run the migration

```bash
npm run migrate
```

### 5) Sanity-check the DB

Recommended checks:

```sql
-- Column exists + default + nullability
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'venues' AND column_name = '<field_name>';

-- Distribution (for boolean-like fields)
SELECT <field_name>, COUNT(*)
FROM venues
GROUP BY <field_name>
ORDER BY <field_name>;
```

## Example: `live` boolean toggle

The `live` field was added using this playbook:

- Migration:
  - `migrations/002_add_live_column.sql`
  - Adds `live BOOLEAN`, backfills to `TRUE`, sets `DEFAULT TRUE` and `NOT NULL`

- API:
  - `api-venues-list`: SELECTs and returns `live`
  - `api-venues-update`: PATCHes `live`
  - `api-venues-create`: inserts/upserts `live` (defaults to `true` when omitted)

- UI:
  - Admin table: `Switch` toggle persists via `api-venues-update`
  - Venue detail: displays `Live: Yes/No`

## Common pitfalls

- **Nested transactions:** Don’t put `BEGIN/COMMIT` in migration SQL files.
- **Forgetting to SELECT a new column:** If the DB has the column but the list endpoint doesn’t select it, the UI will never see it.
- **PATCH parameter order:** When adding a new column to the update SQL, make sure you re-number placeholders (`$1`, `$2`, ...) and shift params accordingly.
- **Vite env vars:** Don’t rely on non-`VITE_` env vars in browser code unless you intentionally expose them.
