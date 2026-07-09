# HHC Account API Contract

Detailed account token, refresh, JWKS, and gateway contract rules live in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

Detailed admin invitation, role assignment, session revocation, suspend, disable, offboarding, and emergency access removal rules live in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.

Account metadata privacy, token/secret handling, minimization, and retention rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Cross-service lifecycle ledger, legal hold, retention worker, privacy request, and restore reconciliation rules live in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

Shared JSON envelope and error rules apply to non-OIDC account JSON APIs where OAuth/OIDC standards do not prescribe the response shape. See `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

## Base

Account APIs are served from:

```text
https://account.alive.org.tw
```

Account APIs do not live under `www.alive.org.tw/api/*`. Non-account APIs stay under `www.alive.org.tw/api/*`.

## Ownership

`account-api` owns:

- login
- OIDC Authorization Code with PKCE
- access token issuance
- refresh token rotation and revocation
- account profile
- roles and scopes
- admin invitations
- account user lifecycle
- session revocation
- suspend, disable, and offboarding
- OIDC metadata
- JWKS
- account security audit events

`api-gateway` validates access JWTs locally from JWKS. It must not call `account-api` for per-request token verification.

## Required Public Endpoints

```text
GET  /.well-known/openid-configuration
GET  /.well-known/jwks.json
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
POST /oauth/logout
GET  /api/account/me
```

## Account Admin Endpoints

Account admin routes live on `https://account.alive.org.tw` and are owned by `account-api`.

```text
GET  /api/account/admin/users
GET  /api/account/admin/users/{userId}
GET  /api/account/admin/invitations
POST /api/account/admin/invitations
POST /api/account/admin/invitations/{invitationId}/resend
POST /api/account/admin/invitations/{invitationId}/revoke
POST /api/account/admin/users/{userId}/roles
DELETE /api/account/admin/users/{userId}/roles/{role}
POST /api/account/admin/users/{userId}/sessions/revoke
POST /api/account/admin/users/{userId}/suspend
POST /api/account/admin/users/{userId}/disable
POST /api/account/admin/users/{userId}/unlock
```

Rules:

- `account:read` is required for read-only account admin views.
- `account:admin` is required for invitations, role changes, session revocation, suspend, disable, and unlock.
- `cms.admin` does not automatically grant `account.admin`.
- `account.admin` does not automatically grant CMS publish permissions.
- These routes are not implemented in `hhc-web-api`.

## Access Token Claims

Access tokens used against `www.alive.org.tw/api/*` must include:

```json
{
  "iss": "https://account.alive.org.tw",
  "aud": "hhc-api",
  "sub": "user_123",
  "typ": "access",
  "exp": 1783500000,
  "nbf": 1783499100,
  "iat": 1783499100,
  "jti": "token_abc",
  "sid": "session_123",
  "client_id": "hhc-admin",
  "roles": ["cms.editor"],
  "scope": "cms:read cms:write assets:write"
}
```

Access tokens should live for 5-15 minutes.

## Refresh Tokens

Refresh tokens are owned by `account-api`.

Rules:

- Prefer opaque random token.
- Store only hashed token server-side.
- Rotate on every refresh.
- Revoke on logout, device revocation, password reset, admin role downgrade, or suspected compromise.
- Reuse of an already-rotated refresh token revokes the token family.
- Do not send refresh tokens to `api-gateway`, `hhc-web-api`, `asset-api`, `notification-api`, or `audit-log`.

## JWKS

JWKS endpoint:

```text
GET /.well-known/jwks.json
```

Requirements:

- Every active signing key has a stable `kid`.
- New keys are published before tokens are signed with them.
- Old public keys remain until all tokens signed with them have expired plus clock skew and gateway JWKS cache TTL.
- Key rotation must not require gateway restart.

## Admin UI Flow

Admin UI at `admin.alive.org.tw` should use Authorization Code with PKCE.

Rules:

- Do not use implicit flow.
- Do not store refresh tokens in `localStorage`.
- Keep access token in memory when possible.
- If browser refresh is needed, use an `HttpOnly`, `Secure`, `SameSite=Lax`, host-only cookie on `account.alive.org.tw`.
- Token refresh endpoints must enforce CORS allowlist and CSRF/origin checks.

## Revocation Semantics

Logout or device revocation:

- `account-api` revokes refresh token family.
- Existing access token expires naturally.
- Gateway is not called per request.

Admin role downgrade:

- `account-api` revokes affected refresh token families.
- New access tokens reflect new roles/scopes.
- Optional emergency access-token `jti` denylist can be used for high-risk cases.

Account suspend or disable:

- `account-api` revokes affected refresh token families.
- New login and refresh are denied while the account state blocks access.
- Existing access tokens expire naturally unless emergency `jti` denylist is used.
- Account state changes emit audit events with actor and reason.

Account deletion or anonymization:

- V1 account admin routes do not expose a normal delete-user endpoint.
- Disable/suspend/offboarding handle access removal.
- Deletion or anonymization is a privacy lifecycle maintenance procedure with lifecycle ledger evidence and audit reason.
- It must preserve referential integrity for audit records, content author ids, role-history evidence, and security records.

## Internal Side Effects

`account-api` may call:

- `notification-api /priv/notifications/*` for verification, reset, invite, or security notices.
- `audit-log /priv/audit/*` for login failure, refresh reuse, token revocation, role changes, and key changes.

These are internal service calls, not public browser calls.
