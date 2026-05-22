# Authentication Implementation Guide

This document explains a generic authentication setup for a web app that uses Google Sign-In on the frontend and server-side session validation on the backend.

It is written as a reusable reference for other projects.

## Overview

This pattern separates authentication into two responsibilities:

- Google confirms the user's identity.
- The backend decides whether that identity is allowed to access protected parts of the application.

If the user is approved, the backend creates a signed session token and stores it in an httpOnly cookie such as `admin_session`.
x
## Architecture

### Frontend responsibilities

- Render the Google sign-in button.
- Receive the Google ID token after a successful sign-in.
- Send that token to the backend.
- Ask the backend whether the current browser session is still valid.
- Guard protected routes based on server-confirmed session state.

### Backend responsibilities

- Verify the Google ID token.
- Extract the authenticated user's email and profile information.
- Decide whether the user is authorized.
- Create a signed session token.
- Store that session in an httpOnly cookie.
- Validate that cookie on future requests.
- Reject unauthorized or invalid sessions.

## Typical Sign-In Flow

### 1. Frontend initializes Google OAuth

The frontend application is wrapped in a Google OAuth provider and uses a public client ID.

Example:

```tsx
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```

This allows the login screen to render a Google sign-in button.

### 2. User signs in with Google

The user clicks the Google sign-in button.
Google returns a credential response that contains an ID token.

The frontend sends that token to the backend.

Example:

```ts
await fetch("/api/auth/google", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ idToken: credential }),
});
```

Important rule:

- The frontend should not decide who is authorized.
- The frontend should only pass the Google ID token to the backend.

### 3. Backend verifies the Google token

The backend verifies the ID token using Google's server-side libraries and the configured Google client ID.

If the token is invalid, the request fails.
If the token is valid, the backend reads the Google user payload.

That payload usually includes:

- email
- name
- picture
- audience information

### 4. Backend checks authorization

After identity is confirmed, the backend decides whether the user is allowed into the application.

Common authorization strategies include:

- checking the email against an allowlist
- checking the email domain
- checking a user record in a database
- checking role mappings from a configuration source

Example allowlist approach:

```env
ADMIN_EMAILS=user1@example.com,user2@example.com
```

If the authenticated email is not allowed, the backend should return `403 Forbidden`.

### 5. Backend creates a session token

If the user is allowed, the backend creates a signed session token, commonly a JWT.

Typical payload fields:

- `email`
- `name`
- `picture`
- `role`
- `iat`
- `exp`

The token is signed with a backend secret such as `JWT_SECRET`.

This lets the server later prove that the token was issued by the application and has not been tampered with.

### 6. Backend stores the session in a cookie

The signed token is stored in an httpOnly cookie.

A common cookie configuration is:

- `Path=/`
- `HttpOnly`
- `SameSite=Lax`
- `Max-Age=604800` for a 7-day session
- `Secure` in production

Because the cookie is httpOnly, browser JavaScript cannot read or modify it directly.

### 7. Frontend checks session state

When the app loads, the frontend asks the backend whether the current session is valid.

Example:

```ts
fetch("/api/auth/me", { credentials: "include" })
```

The browser automatically sends the session cookie.

The backend should:

- read the cookie
- verify the token signature
- check token expiry
- return the current user if valid
- return `401 Unauthorized` if missing or invalid

The frontend then updates local auth state, usually something like:

- `loading`
- `authenticated`
- `user`

### 8. Protected routes are enforced

Protected routes should wait until the auth check is complete.

If the session is valid, the app renders the protected area.
If the session is invalid or missing, the app redirects to the login page.

This route protection is useful for navigation and UX, but it is not enough on its own.

## Logout Flow

Logout should call a backend endpoint that clears the session cookie.

Typical behavior:

- set the same cookie name
- set its value to empty
- set `Max-Age=0`

After that, the browser no longer has a valid session and the user is treated as signed out.

## Backend Authorization Pattern

Every protected backend route should verify the session on the server.

A common pattern is to create a shared helper such as `requireAdmin(event)` or `requireAuth(request)`.

That helper should:

1. Read the session cookie.
2. Verify the token using the server secret.
3. Confirm the user is still authorized.
4. Return the decoded user payload if valid.
5. Throw or return `401` when unauthenticated.
6. Throw or return `403` when authenticated but not allowed.

This keeps authorization logic consistent across backend routes.

## Environment Variables

### Frontend

- `VITE_GOOGLE_CLIENT_ID`

Used by the browser to initialize Google OAuth.

### Backend

- `GOOGLE_CLIENT_ID`
  Used to verify the Google ID token.
- `JWT_SECRET`
  Used to sign and verify session tokens.
- `ADMIN_EMAILS` or similar authorization config
  Used if the app authorizes users by explicit allowlist.

Depending on the project, other backend auth variables may also exist.

## What `JWT_SECRET` Does

`JWT_SECRET` is the backend secret used to sign the session token.

Simple explanation:

- the backend creates a session token after login
- the backend stamps that token with `JWT_SECRET`
- later the backend checks the same stamp again
- if the stamp matches, the token is trusted
- if it does not match, the token is rejected

If `JWT_SECRET` changes, all existing sessions immediately become invalid.

## Security Notes

- Never expose `JWT_SECRET` to the browser.
- Never place server secrets in public frontend environment variables.
- Never rely only on frontend route guards for authorization.
- Always verify authorization on the backend.
- Keep session cookies httpOnly.
- Use `Secure` cookies in production.
- Rotate secrets if they are exposed.
- Do not commit real secrets to source control.

## Implementation Checklist

- Add Google OAuth provider setup in the frontend.
- Add a login page with a Google sign-in button.
- Add a backend endpoint to verify Google ID tokens.
- Add server-side authorization logic.
- Add JWT session creation and cookie storage.
- Add a session check endpoint such as `/api/auth/me`.
- Add a logout endpoint that clears the cookie.
- Add frontend route guards.
- Add backend middleware or helper-based authorization.

## Troubleshooting

### Google sign-in button renders but login fails

Check:

- frontend Google client ID
- backend Google client ID
- network request from frontend to backend auth endpoint
- server logs for token verification errors

### Google login succeeds but access is denied

Check:

- authorization rules
- allowlisted email values
- email domain rules
- whether the expected Google account was used

### User appears signed out after refresh

Check:

- `JWT_SECRET` is present
- token signing and token verification use the same secret
- cookies are included with `credentials: "include"`
- cookie domain, path, and secure settings are correct for the environment

### Protected backend endpoint rejects a valid user

Check:

- the endpoint actually runs the shared auth helper
- the session cookie is present on the request
- the token has not expired
- the authorization check still matches the current user

## Reuse Notes

This pattern is intentionally generic.

To adapt it for another project, replace:

- endpoint names
- cookie names
- route paths
- authorization rules
- framework-specific code

The core flow stays the same:

1. Google proves identity.
2. Backend decides whether access is allowed.
3. Backend issues a signed session.
4. Frontend asks the backend whether the session is valid.
5. Backend protects private routes and APIs.