# Ahangama Admin Architecture

Frontend:

- Vite + React + TypeScript
- SPA
- Auth via Google Identity Services
- Session stored in httpOnly cookie "admin_session"

Backend:

- Netlify Functions (ESM modules)
- Folder: /netlify/functions
- DB: Neon Postgres
- Access DB using `pg` with process.env.DATABASE_URL
- Never access DB from frontend

Security:

- All protected routes must verify admin_session cookie
- Only emails listed in ADMIN_EMAILS env variable are allowed

Database:

- Table: venues
- offers column is JSONB array of:
  {
  type: string,
  label: string,
  discount: number,
  unit: "percent" | "amount",
  appliesTo: string,
  terms?: string
  }
