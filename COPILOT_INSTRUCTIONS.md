# Copilot Project Instructions

Project: Ahangama Admin

Stack:

- Vite + React + TypeScript
- Netlify Functions (ESM)
- Neon Postgres
- pg driver
- Google Identity Services auth

Bootstrap:

- Initialize a new app with: `npm create vite@latest my-app -- --template react-ts`
- Install dependencies with: `npm install`
- Add stack packages with: `npm install react-router-dom antd dayjs @react-oauth/google leaflet react-leaflet pg jsonwebtoken google-auth-library dotenv @aws-sdk/client-s3 @aws-sdk/s3-presigned-post`
- Add Netlify CLI with: `npm install -D netlify-cli`
- Run local development with: `npm run dev`

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
