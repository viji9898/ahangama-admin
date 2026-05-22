---
description: "Implement or refactor authentication using the shared Google sign-in, backend authorization, JWT session, and httpOnly cookie pattern."
name: "Implement Auth From Pattern"
argument-hint: "Describe the app, routes, stack, or auth changes you want"
agent: "agent"
---

Use [README_AUTH_GEN.md](../../README_AUTH_GEN.md) as the source of truth for the authentication pattern.

Task:

Implement or refactor authentication for the current project using this structure unless the request explicitly overrides it:

- Google sign-in or equivalent identity provider on the frontend
- backend token verification
- backend authorization check
- signed session token
- httpOnly cookie session storage
- session-check endpoint
- logout endpoint
- protected frontend routes
- protected backend routes or functions

Requirements:

- keep secrets server-only
- do not expose private auth values to the browser
- keep authorization decisions on the backend
- use shared helpers instead of repeating backend auth logic
- keep the implementation minimal and aligned with existing project conventions

When relevant, also:

- add or update env variable documentation
- explain any security-sensitive tradeoffs briefly
- add focused validation for the auth flow you touched

User request:

{{input}}