# Copilot Project Instructions

Project: Ahangama Admin

Stack:

- Vite + React + TypeScript
- Netlify Functions (ESM)
- Neon Postgres
- pg driver
- Google Identity Services auth

Rules:

- NEVER access database from frontend.
- All DB access must happen inside Netlify Functions.
- Use process.env.DATABASE_URL only in backend.
- Use JWT in httpOnly cookie named "admin_session".
- Only allow emails listed in ADMIN_EMAILS env variable.
- Functions must export `handler`.
- Use ESM imports (no require).
- Keep code minimal and clean.
- Do not introduce Prisma or additional ORMs.
- Use JSONB for offers column.

Database:
Table: venues

- id TEXT PRIMARY KEY
- destination_slug TEXT
- name TEXT
- slug TEXT
- categories TEXT[]
- emoji TEXT[]
- offers JSONB
- updated_at TIMESTAMPTZ
- created_at TIMESTAMPTZ
  Unique index: (destination_slug, slug)

Design philosophy:
Simple. Clean. Serverless. Minimal dependencies.
