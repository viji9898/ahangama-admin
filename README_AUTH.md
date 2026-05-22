# Authentication README

This document explains how authentication works in the Ahangama Admin app.

## Overview

The app uses Google Sign-In on the frontend and Netlify Functions on the backend.
Google confirms the user's identity. The backend decides whether that user is allowed into the admin area.

If the user is allowed, the backend creates a signed session token and stores it in an httpOnly cookie called `admin_session`.

## Main Pieces

### Frontend

- `src/main.tsx`
  Wraps the app with `GoogleOAuthProvider` using `VITE_GOOGLE_CLIENT_ID`.
- `src/pages/Login.tsx`
  Renders the Google sign-in button and sends the Google ID token to the backend.
- `src/auth/useAuth.ts`
  Checks whether the browser already has a valid admin session.
- `src/auth/RequireAuth.tsx`
  Protects admin routes and redirects unauthenticated users to the login page.
- `src/App.tsx`
  Wires public and protected routes.

### Backend

- `netlify/functions/auth-google.mjs`
  Verifies the Google ID token, checks the allowlist, signs the session JWT, and sets the cookie.
- `netlify/functions/auth-me.mjs`
  Reads the session cookie and verifies whether the user is still signed in.
- `netlify/functions/auth-logout.mjs`
  Clears the session cookie.
- `netlify/functions/_lib/auth.mjs`
  Shared helper for protecting backend admin functions.

## Sign-In Flow

### 1. App bootstraps Google OAuth

When the app starts, `src/main.tsx` provides the Google client ID to the React app:

```tsx
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```

This is required so the login page can render the Google sign-in button.

### 2. User signs in with Google

On the login screen in `src/pages/Login.tsx`, the user clicks the Google button.
Google returns a credential response containing an ID token.

The frontend sends that token to the backend:

```ts
await fetch("/.netlify/functions/auth-google", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ idToken: credential }),
});
```

Important detail:

- The frontend does not decide who is an admin.
- The frontend only passes the Google ID token to the backend.

### 3. Backend verifies the Google token

In `netlify/functions/auth-google.mjs`, the backend uses `google-auth-library` to verify the ID token against `GOOGLE_CLIENT_ID`.

If the token is invalid, the request fails.
If the token is valid, the backend reads the Google profile payload, especially the email address.

### 4. Backend checks the admin allowlist

The backend reads `ADMIN_EMAILS` from the environment and builds a set of allowed email addresses.

Example:

```env
ADMIN_EMAILS=viji@viji.com,hello@viji.com,hello@ahangama.com
```

If the signed-in Google email is not in this list, the backend returns `403 Not authorized`.

This is the actual admin access check.

### 5. Backend creates a session JWT

If the email is allowed, the backend creates a JWT using `jsonwebtoken`.

The JWT contains basic user information such as:

- `email`
- `name`
- `picture`

The JWT is signed with `JWT_SECRET`.

This is important because the server later uses the same secret to verify that the session token is genuine and has not been altered.

### 6. Backend stores the JWT in a cookie

The signed token is stored in an httpOnly cookie named `admin_session`.

Cookie settings in the current implementation:

- `Path=/`
- `HttpOnly`
- `SameSite=Lax`
- `Max-Age=604800` (7 days)
- `Secure` only in production

Because the cookie is httpOnly, frontend JavaScript cannot read or modify it directly.

### 7. Frontend checks session state

The hook in `src/auth/useAuth.ts` calls:

```ts
fetch("/.netlify/functions/auth-me", { credentials: "include" })
```

The browser automatically includes the `admin_session` cookie.

The backend function `auth-me.mjs`:

- reads the cookie
- verifies the JWT with `JWT_SECRET`
- returns `{ ok: true, user }` if valid
- returns `401` if missing or invalid

The hook then updates React state:

- `loading`
- `authenticated`
- `user`

### 8. Protected routes are enforced

`src/auth/RequireAuth.tsx` blocks access to admin routes until authentication is confirmed.

If the session is invalid or missing, the user is redirected to `/`.

The protected routes are mounted under `/admin` in `src/App.tsx`.

## Logout Flow

Logout calls `/.netlify/functions/auth-logout`.

That function clears the `admin_session` cookie by setting:

- the same cookie name
- `Max-Age=0`

After that, the browser no longer has a valid session cookie and the user is treated as signed out.

## Backend Route Protection

Frontend route protection is useful for navigation, but it is not enough by itself.
Any backend function that needs admin access should verify the session on the server.

This repo includes a shared helper in `netlify/functions/_lib/auth.mjs` called `requireAdmin(event)`.

It does the following:

1. Checks for a special import secret header used for machine access.
2. Otherwise reads the `admin_session` cookie.
3. Verifies the JWT using `JWT_SECRET`.
4. Checks the email against `ADMIN_EMAILS`.
5. Returns the decoded user payload if valid.
6. Throws `401` or `403` if not valid.

This means admin protection exists at both levels:

- frontend route guard
- backend function authorization

## Environment Variables

These variables are required for authentication.

### Frontend

- `VITE_GOOGLE_CLIENT_ID`

Used by the Google OAuth provider in the browser.

### Backend

- `GOOGLE_CLIENT_ID`
  Used to verify the Google ID token.
- `ADMIN_EMAILS`
  Comma-separated list of email addresses allowed to access admin features.
- `JWT_SECRET`
  Secret key used to sign and verify the session JWT.
- `ADMIN_IMPORT_SECRET`
  Optional shared secret for machine-to-machine import access.

## What `JWT_SECRET` Does

`JWT_SECRET` is the backend secret used to sign the session token.

Simple explanation:

- when login succeeds, the backend creates a session token
- the backend stamps that token with `JWT_SECRET`
- later the backend checks the stamp again
- if the stamp matches, the token is trusted
- if it does not match, the token is rejected

If `JWT_SECRET` changes, all existing sessions immediately become invalid.

## Security Notes

- Never expose `JWT_SECRET` to the browser.
- Never put `JWT_SECRET` in a `VITE_` variable.
- Never trust frontend-only checks for admin access.
- The email allowlist check must remain on the backend.
- Real secrets should not be committed to source control.
- If a secret is exposed, rotate it.

## Current Behavior Summary

- Google proves the user's identity.
- The backend decides whether that identity is allowed.
- The backend creates a signed session cookie.
- The frontend uses `auth-me` to determine signed-in state.
- Protected backend functions should use `requireAdmin`.

## Local Development

Run the app with:

```bash
npm run dev
```

This uses Netlify Dev, which is required because the authentication flow depends on Netlify Functions.

## Troubleshooting

### Google button renders but login fails

Check:

- `VITE_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- browser network request to `/.netlify/functions/auth-google`

### Login succeeds with Google but access is denied

Check:

- whether the user's email exactly matches one of the values in `ADMIN_EMAILS`
- whether the Google account used is the expected one

### User keeps getting logged out or auth check fails

Check:

- `JWT_SECRET` is present
- the same `JWT_SECRET` is used for signing and verifying
- cookies are being sent with `credentials: "include"`

### Protected function rejects the user

Check:

- that the function uses `requireAdmin(event)`
- that the session cookie is present
- that the email is still allowlisted

## File Reference Map

- `src/main.tsx`
- `src/pages/Login.tsx`
- `src/auth/useAuth.ts`
- `src/auth/RequireAuth.tsx`
- `src/App.tsx`
- `netlify/functions/auth-google.mjs`
- `netlify/functions/auth-me.mjs`
- `netlify/functions/auth-logout.mjs`
- `netlify/functions/_lib/auth.mjs`