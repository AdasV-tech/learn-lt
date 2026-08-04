# Security policy

## Reporting a vulnerability

Please report privately rather than in a public issue:
[open a security advisory](../../security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it.
You will get an acknowledgement within a few days.

## What Kalba already does

- **Passwords** hashed with Argon2id
- **Refresh tokens** are opaque random strings; only their SHA-256 hash is stored, and
  they are rotated and revoked on every use
- **Access tokens** are short-lived (15 minutes) and carry no sensitive claims
- **Login** returns the same response for a wrong password and an unknown account, so it
  cannot be used to enumerate users
- **Rate limiting** globally and, more tightly, on the credential endpoints
- **Input validation** with Zod on every request body and query string
- **SQL injection** is not reachable — all database access goes through Prisma
- **XSS** — Markdown is rendered to React elements, never via `dangerouslySetInnerHTML`
- **Helmet** security headers, and a strict CORS allowlist
- **Secrets** are validated at boot; the server refuses to start on a placeholder secret
  shorter than 16 characters
- **Errors** never include stack traces or internals under `NODE_ENV=production`
- **CodeQL** and Dependabot run on the repository

## What operators must do

- Regenerate both JWT secrets — never ship the `.env.example` values
- Set `CORS_ORIGIN` to your real origins only
- Run behind TLS
- Set `NODE_ENV=production`
- Remove or change the password on the seeded demo account
- Keep dependencies current

## Scope

In scope: authentication, authorisation, data exposure, injection, and anything that lets
one learner read or modify another's data.

Out of scope: rate-limit tuning, missing security headers on the static frontend host,
and issues that require an already-compromised device.
