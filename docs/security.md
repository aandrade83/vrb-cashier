# VRB Cashier — Security Rules

These rules are mandatory and must be followed in every file, route, component, and database operation across the entire project. No exceptions.

---

## 1. Encryption — IDs and Identifiers

- All primary keys in every database table must be UUID v4. Never use sequential integers (1, 2, 3) as IDs.
- UUIDs exposed in URLs, API responses, or client-facing code must be encrypted or tokenized before leaving the server. Never expose raw database IDs to the client.
- User IDs from Clerk must never be embedded in client-visible URLs in plain text. Always reference the authenticated session on the server side.
- Foreign key references that reach the client must be represented as encrypted tokens, not raw UUIDs.
- Transaction IDs shown to the Player in the UI must be a formatted reference code (e.g. TXN-XXXXXX), not the internal UUID.

---

## 2. Encryption — Payment and Card Data

- NEVER store a full card number (PAN) in the database under any circumstances.
- NEVER store CVV / CVC / CVC2 — not encrypted, not hashed, not in any form. CVV must never persist anywhere: database, logs, cache, memory, or environment variables.
- NEVER store card expiration dates in plain text. If storage is required, encrypt with AES-256-GCM using a key stored exclusively in environment variables.
- If card payments are integrated, use Stripe Elements or equivalent. Card data must never touch VRB's servers.
- Card input forms must have `autocomplete="off"` and must never be embedded inside untrusted iframes.
- Only store the last 4 digits of a card number for display purposes, nothing else.

---

## 3. Encryption — Sensitive Personal Data (PII)

- Government-issued ID numbers (passport, national ID) must be encrypted with AES-256-GCM before being stored in the database. The encryption key must live in an environment variable only.
- Bank account numbers must be encrypted with AES-256-GCM before storage. Only display the last 4 digits in any UI.
- Crypto wallet addresses, while technically public, must be stored as sensitive data associated to the authenticated user.
- Passwords must be hashed with bcrypt (minimum cost factor 12) or argon2id. Never store passwords in plain text, MD5, or SHA-1.
- Email addresses and phone numbers must never be logged or included in error messages.

---

## 4. Encryption — Data in Transit and at Rest

- All communication between client and server must use HTTPS. Never disable Vercel's HTTP-to-HTTPS redirect.
- Implement HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- Never send sensitive data (amounts, account numbers, user IDs) as URL query parameters. Use POST body only.
- Verify that Neon PostgreSQL encryption at rest is enabled in the Neon dashboard.
- Implement column-level encryption for: bank account numbers, government IDs, and any card-related fields.
- Database backups must be encrypted. Verify this is active in the Neon dashboard.
- Encryption keys must be rotated every 90 days for financial data columns.

---

## 5. Environment Variables

- NEVER hardcode API keys, database URLs, secrets, or credentials anywhere in the codebase.
- `.env.local`, `.env.production`, and any `.env.*` files must be in `.gitignore` from the first commit. Verify before every push.
- Variables prefixed with `NEXT_PUBLIC_` are visible to the client. NEVER put secrets, private API keys, database URLs, or encryption keys in `NEXT_PUBLIC_` variables.
- In Vercel, use the Environment Variables panel. Separate variables by environment: Development, Preview, Production.
- If a secret is accidentally committed to the repository, rotate it immediately — do not just delete the file.
- Use `git-secrets` or `truffleHog` in CI to detect accidental secret commits.

Required environment variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=
ENCRYPTION_KEY=           # AES-256 key for column-level encryption, 32 bytes hex
RESEND_API_KEY=
```

---

## 6. Authentication and Role Authorization

- Roles are: `admin`, `clerk`, `player`. They are stored in Clerk `publicMetadata` server-side only.
- Role assignment must always happen server-side via the Clerk Backend API. Never trust a role sent from the client.
- The middleware must verify the user's role on every request to a protected route, without exception.
- Public signup (`/sign-up`) is for Players only. The webhook at `/api/webhooks/clerk` must automatically assign `role: "player"` to any new user without an existing role.
- Admin and Clerk users are created exclusively by an existing Admin via the Clerk Backend API with the role pre-assigned. There is no self-registration for these roles.
- A user with no assigned role must be redirected to an error page, never to a dashboard.
- All three roles share the same `/sign-in` page. The middleware redirects each role to its respective dashboard after login.

Role route protection:
```
/admin/*       → role must be "admin"
/clerk-role/*  → role must be "clerk"
/player/*      → role must be "player"
```

---

## 7. Session Security

- Admin and Clerk sessions must have a maximum duration of 8 hours. Configure this in the Clerk Dashboard.
- Player sessions may last up to 24 hours with an active refresh token.
- Implement automatic session timeout on inactivity: 30 minutes for Admin/Clerk, 60 minutes for Player.
- JWTs from Clerk must not be stored in `localStorage`. Use HttpOnly cookies with `SameSite=Strict`.
- Do not implement "Remember me" for Admin or Clerk accounts.
- When a user's role changes or their account is deactivated, invalidate all active sessions immediately via the Clerk Backend API.

---

## 8. MFA (Multi-Factor Authentication)

- MFA is REQUIRED for the Admin role. Set this as mandatory in the Clerk Dashboard.
- MFA is STRONGLY RECOMMENDED for Clerk users and must be offered during onboarding.
- MFA is optional for Player users but must be available as a setting.
- Allowed MFA methods: TOTP (Google Authenticator, Authy). Do not use SMS as a sole MFA factor due to SIM-swap vulnerabilities.

---

## 9. API Route Security

- Every API route that reads or mutates data must verify: (1) user is authenticated, (2) user has the correct role, (3) the resource being accessed belongs to the requesting user (for Player-owned data).
- API routes must never return internal error details to the client. Return generic error messages and log the full detail server-side.
- Implement CSRF protection on all mutation endpoints (POST, PUT, PATCH, DELETE).
- Implement rate limiting:
  - Login endpoint: max 5 failed attempts per 10 minutes per IP.
  - Transaction submission: max 10 transactions per minute per Player.
  - Admin user creation: max 20 per hour.
- Validate `Content-Type` on incoming requests. Reject unexpected content types.
- The Clerk webhook endpoint at `/api/webhooks/clerk` must verify the `svix` signature before processing any event.
- Never expose stack traces, database errors, or internal paths in API responses.

---

## 10. Input Validation

- ALL user input must be validated with Zod on the server before any processing or database operation. Client-side validation is secondary and for UX only.
- Free-text fields must have a maximum length defined and enforced on both client and server.
- Never use string concatenation to build SQL queries. Use Drizzle ORM for all database operations.
- Sanitize all inputs that will be rendered as HTML. Use `DOMPurify` if `dangerouslySetInnerHTML` is ever used.
- Payment method field definitions (stored as JSONB) must be validated against a strict schema before being saved by Admin.

---

## 11. HTTP Security Headers

Configure the following in `next.config.js` for all routes:

```js
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.com; connect-src 'self' https://api.clerk.com;" },
];
```

---

## 12. Transaction Security

- Every transaction ID must be generated server-side. Never accept a transaction ID from the client.
- Implement idempotency keys to prevent duplicate transactions. If the same form is submitted twice, the second request must be rejected with a 409 Conflict.
- Transaction amounts can only be set at creation time by the system, and only modified by Admin. Clerk can change status only.
- A transaction with status `completed` or `rejected` is immutable. No updates are allowed on it.
- Transaction amounts must use `DECIMAL(12,2)` in the database. Never use JavaScript `float` or PostgreSQL `float` for monetary values.
- Every status change on a transaction must create a record in `transaction_updates` with: `clerkId`, `previousStatus`, `newStatus`, `note`, `timestamp`.

---

## 13. Clerk Lock System

- Acquiring a transaction lock must be an atomic database operation using `INSERT ... ON CONFLICT` to prevent race conditions.
- A lock expires automatically after 30 minutes. Use `expiresAt` timestamp and check it on every lock acquisition.
- If a lock exists and `expiresAt` is in the future and belongs to a different Clerk, the transaction must be shown as "Being processed by [name]" and no edit UI should be rendered.
- A Clerk may not hold more than 5 active locks simultaneously.
- Every lock acquisition and release must be logged with: `clerkId`, `transactionId`, `action`, `timestamp`.

---

## 14. Logging and Audit Trail

Events that MUST be logged (append-only, server-side):

- Login success and failure (include: IP, user-agent, timestamp, userId or attempted email)
- User creation, role change, and deactivation
- Payment method creation, update, activation, and deactivation
- Transaction creation (include: type, amount, methodId, playerId)
- Every transaction status change (include: clerkId, previousStatus, newStatus, timestamp)
- Lock acquisition and release
- Email sent to Player (include: transactionId, status, timestamp)
- Access to reports (include: userId, role, filters used, timestamp)
- All 4xx and 5xx API errors (include: route, userId if authenticated, error message)

Logging rules:
- Logs must NEVER contain: passwords, CVV, full card numbers, session tokens, or API keys.
- Logs are write-only from the application. They must not be modifiable or deletable through the app.
- Financial transaction logs must be retained for a minimum of 2 years.
- Authentication logs must be retained for a minimum of 1 year.

---

## 15. Email Notifications

- Notification emails to Players must not include full financial data. Direct the Player to log in to the platform to see details.
- Never include authentication tokens, passwords, or card data in email subject or body.
- Use Resend with SPF, DKIM, and DMARC configured on the sending domain.
- Security emails (password change confirmation, suspicious login alert) do not have an unsubscribe option.
- The `emailSent` flag in `transaction_updates` must be set to `true` after a successful send. Failed sends must be retried and logged.

---

## 16. GitHub and CI/CD

- The repository must be PRIVATE at all times.
- Enable branch protection on `main` and `develop`: require at least 1 Pull Request approval before merging.
- Enable Dependabot for automatic dependency vulnerability alerts.
- Enable GitHub Secret Scanning to detect accidentally committed credentials.
- Add `husky` pre-commit hooks to block commits that contain `.env` files or detectable secrets.
- Run `npm audit` in CI. Block deploys to production if any HIGH or CRITICAL vulnerabilities are unresolved.
- Never merge directly to `main`. All changes go through a PR from `develop`.

---

## 17. Pre-Deploy Checklist (Production)

Before every merge to `main`, verify:

- [ ] AES-256 encryption implemented on all sensitive columns
- [ ] CVV is not stored or logged anywhere
- [ ] No `.env` files in the repository
- [ ] All production secrets set in Vercel Environment Variables
- [ ] MFA enforced for Admin in Clerk Dashboard
- [ ] Role verification present in middleware and all API routes
- [ ] `npm audit` shows no HIGH or CRITICAL issues
- [ ] All HTTP security headers configured in `next.config.js`
- [ ] Rate limiting active on login and transaction endpoints
- [ ] Clerk webhook signature verification implemented
- [ ] Audit log writing verified for all critical events
- [ ] HTTPS redirect active in Vercel
- [ ] No `console.log` statements printing sensitive data in production code
