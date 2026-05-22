---
description: "Use when working on authentication, login flows, Google sign-in, session cookies, JWT validation, logout flows, or protected frontend/backend routes."
name: "Authentication Pattern"
applyTo: ["src/auth/**", "src/pages/Login.tsx", "src/main.tsx", "src/App.tsx", "netlify/functions/auth-*.mjs", "netlify/functions/_lib/auth.mjs"]
---

# Authentication Pattern

Detailed reference: [README_AUTH_GEN.md](../../README_AUTH_GEN.md)

Use this auth pattern unless the task explicitly requires a different approach.

- Use Google sign-in only to prove identity.
- Perform authorization on the backend.
- Never trust frontend-only route guards for real access control.
- Store session state in an httpOnly cookie.
- Sign and verify session tokens with a server-only secret such as `JWT_SECRET`.
- Never expose backend auth secrets to the browser or any public env variable.
- Provide a backend session-check endpoint so the frontend can restore auth state on load.
- Provide a backend logout endpoint that clears the session cookie.
- Protect backend functions or APIs with shared auth validation.
- Keep auth logic minimal and centralized rather than duplicating checks across files.

When implementing auth changes:

- keep identity verification separate from authorization
- prefer shared helpers for backend auth checks
- ensure frontend requests that depend on cookies use `credentials: "include"`
- keep cookie settings explicit and environment-aware
- return `401` for unauthenticated requests and `403` for authenticated but unauthorized requests