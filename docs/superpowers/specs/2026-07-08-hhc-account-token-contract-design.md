# HHC Account Token Contract Design

## Purpose

This spec defines the contract between `account-api`, `api-gateway`, admin UI, and backend services for login, access JWTs, refresh tokens, JWKS, and trusted identity headers.

Data minimization, token/secret handling, account metadata retention, and privacy rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Admin invitation, role assignment, role downgrade, account suspend/disable/offboarding, and emergency access removal rules are defined in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.

Role/scope catalog, role bundle governance, authorization drift checks, and `authz_policy` release gates are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Browser security headers, account refresh cookie constraints, CORS, CSRF, CSP, and host boundary rules are defined in `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`.

It exists to keep the boundary clear:

- `account-api` owns authentication, token issuance, refresh token rotation/revocation, user profile, roles/scopes, OIDC metadata, signing keys, and JWKS.
- `api-gateway` owns per-request access JWT verification for non-account APIs.
- Backend services trust only sanitized gateway headers for browser-origin API requests.

`api-gateway` must not call `account-api` for per-request token verification.

## Core Decision

Use short-lived asymmetric access JWTs plus account-owned refresh token rotation.

Access token:

- JWT.
- Signed by `account-api`.
- Verified locally by `api-gateway` from cached JWKS.
- Valid for 5-15 minutes.
- Expires naturally after logout or role changes unless an emergency denylist is used.

Refresh token:

- Owned only by `account-api`.
- Prefer opaque random token, stored hashed server-side.
- Rotated on every refresh.
- Revoked on logout, device revocation, role downgrade, password reset, or suspected compromise.
- Never sent to `api-gateway` or backend services.

Rejected alternatives:

- Gateway token introspection on every request: simpler revocation semantics, but couples all traffic to `account-api` availability and latency.
- Backend services verifying browser JWTs independently: duplicates security logic and makes claim/rotation changes harder.
- Long-lived access tokens: easier frontend behavior, but weakens logout, role change, and stolen-token response.

## Domains

Account APIs live under:

```text
https://account.alive.org.tw
```

Non-account public and admin APIs live under:

```text
https://www.alive.org.tw/api/*
```

`admin.alive.org.tw` is the admin UI host only. It calls `www.alive.org.tw/api/admin/*` with an account-issued bearer access token.

There is no `api.alive.org.tw`.

## OIDC And Token Endpoints

`account-api` must expose:

```text
GET  /.well-known/openid-configuration
GET  /.well-known/jwks.json
GET  /oauth/authorize
POST /oauth/token
POST /oauth/revoke
POST /oauth/logout
GET  /api/account/me
```

`/.well-known/openid-configuration` must include:

- `issuer`
- `authorization_endpoint`
- `token_endpoint`
- `revocation_endpoint`
- `jwks_uri`
- `response_types_supported`
- `grant_types_supported`
- `code_challenge_methods_supported`
- `scopes_supported`
- `claims_supported`
- `id_token_signing_alg_values_supported`

Admin UI should use Authorization Code with PKCE. Do not use implicit flow.

## Access Token Claims

Required access JWT claims:

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

Rules:

- `iss` must be exactly `https://account.alive.org.tw`.
- `aud` for non-account APIs must be `hhc-api`.
- `sub` is the stable account user id.
- `typ` must be `access`.
- `jti` must be unique per access token.
- `sid` identifies the login session or refresh-token family.
- `roles` is an array of role strings.
- `scope` is a space-separated OAuth scope string.
- Do not put email, display name, phone, or profile fields into API access tokens unless a route truly needs them. Services can query an owning domain later when needed.

Optional claims:

- `email_verified` for account UI decisions.
- `amr` for authentication method references.
- `acr` for assurance level if stronger admin login policies are added.

## Signing Algorithms

Supported:

- `RS256`, preferred for broad library support.
- `ES256`, acceptable if both account and gateway libraries handle rotation reliably.

Forbidden:

- `none`
- symmetric algorithms such as `HS256` for public gateway verification
- any algorithm not explicitly configured in gateway

Every JWT header must include `kid`.

## JWKS Contract

JWKS endpoint:

```text
GET https://account.alive.org.tw/.well-known/jwks.json
```

Each signing key must include:

- `kid`
- `kty`
- `use`: `sig`
- `alg`
- public key material such as `n`/`e` for RSA or `crv`/`x`/`y` for EC

HTTP headers:

```text
Cache-Control: public, max-age=300
```

Gateway may use its configured `JWKS_CACHE_TTL` if the header is missing, but `account-api` should still publish cache headers.

## Key Rotation

Rotation sequence:

1. Generate new signing key.
2. Publish new public key in JWKS.
3. Wait at least one gateway JWKS refresh interval.
4. Start issuing access tokens signed by the new key.
5. Keep old public key in JWKS until all old access tokens are expired plus clock skew and JWKS cache TTL.
6. Remove old key only after monitoring confirms no valid access token should still use it.

Rollback rule:

- Keep the previous signing key available until the new gateway/account deployment is stable.

Unknown `kid` behavior:

- Gateway triggers one immediate JWKS refresh.
- If the key is still unknown, gateway returns `401`.
- Gateway does not call token introspection.

## Refresh Token Model

Refresh tokens should be opaque random values.

Storage:

- Store only a hash of the refresh token.
- Store token family/session id.
- Store client id, user id, issued time, expiry, last used time, and revoked time.
- Record device/user-agent metadata carefully; avoid storing excessive personal data.

Rotation:

1. Client calls `/oauth/token` with refresh grant.
2. `account-api` verifies token hash and active session.
3. `account-api` revokes the used refresh token.
4. `account-api` issues a new refresh token and a new access token.
5. Reuse of a revoked refresh token revokes the whole token family and emits a security audit event.

Revocation:

- Logout revokes the active refresh token or token family.
- Device logout revokes that device/session family.
- Password reset and admin role downgrade revoke all affected refresh token families.
- Existing access tokens expire naturally.

## Browser Token Handling

Admin UI:

- Use Authorization Code with PKCE.
- Keep access token in memory when possible.
- Never store refresh token in `localStorage`.
- Prefer host-only, `HttpOnly`, `Secure`, `SameSite=Lax` refresh cookie on `account.alive.org.tw` if browser refresh is needed.
- Refresh endpoint must enforce CORS allowlist and CSRF/origin checks.

Acceptable CORS origins for account token refresh:

```text
https://admin.alive.org.tw
```

Same-origin account UI flows on `account.alive.org.tw` do not require CORS. Public website routes on `www.alive.org.tw` should not receive refresh cookies in v1.

Do not allow wildcard CORS with credentials.

`api-gateway` and backend services never receive refresh cookies as part of normal API authorization.

## Role And Scope Freshness

Roles/scopes in access JWTs represent the account state at token issue time.

When roles/scopes change:

- New access tokens must contain new roles/scopes.
- Existing access tokens expire naturally in 5-15 minutes.
- `account-api` should revoke affected refresh token families when admin privileges are removed.
- For high-risk incidents, use the emergency access-token denylist.

This avoids per-request account introspection while keeping privilege drift bounded.

Account lifecycle state such as invitation, role grant/revoke, suspend, disable, and offboarding is account-domain state. Feature services must not query account tables to refresh roles during a request.

## Emergency Access Token Denylist

Normal logout should not require denylisting access tokens.

For high-risk admin incidents:

- Denylist by `jti`.
- TTL is max access token lifetime plus clock skew.
- Gateway verifier checks the denylist locally or through gateway-owned Redis.
- `account-api` may publish a denylist command through an internal administrative path or an operations procedure.
- Gateway still must not call `account-api` during normal request verification.

## Gateway Validation

Gateway must validate:

- JWT structure.
- `alg` is explicitly allowed.
- `kid` exists in cached JWKS after refresh.
- signature.
- issuer.
- audience.
- `typ=access`.
- `exp`, `nbf`, `iat` with max 60 seconds skew.
- required route roles/scopes.
- optional emergency `jti` denylist.

Gateway must reject:

- missing bearer token on protected route.
- malformed token.
- ID token used as API access token.
- refresh token used as API access token.
- wrong issuer.
- wrong audience.
- unsupported algorithm.
- unknown `kid`.
- expired token.
- token before `nbf`.
- missing required scope or role.

## Trusted Header Mapping

Gateway maps validated claims to sanitized upstream headers:

| Header | Source claim | Format |
| --- | --- | --- |
| `X-HHC-User-ID` | `sub` | single string |
| `X-HHC-Roles` | `roles` | comma-separated, sorted |
| `X-HHC-Scopes` | `scope` | space-separated or comma-separated after gateway normalization |
| `X-HHC-Token-ID` | `jti` | single string |
| `X-HHC-Session-ID` | `sid` | single string, optional in v1 |
| `X-HHC-Request-ID` | gateway request id | single string |
| `X-HHC-Auth-Provider` | static | `account-api` |

Gateway must strip all client-supplied `X-HHC-*` headers before auth and upstream routing.

Backend services must reject protected routes when expected trusted headers are missing. Backend services should not parse browser JWTs for normal protected traffic.

## Account API Side Effects

`account-api` should call internal services for side effects:

- `notification-api` for account verification, password reset, admin invite, and security notices.
- `audit-log` for login failures, refresh-token reuse, logout, role/scope changes, token-family revocation, and signing-key changes.

These calls use `/priv/*` and Dapr/mTLS/app-id, not public browser JWTs.

## Failure Modes

JWKS unavailable:

- Gateway uses cached keys until `JWKS_MAX_STALE`.
- If no usable key exists, protected routes fail closed.
- Public routes continue to work.

Account login down:

- New login and refresh fail.
- Already-issued access tokens continue to work until expiration if gateway has valid keys.

Refresh token reuse:

- Revoke token family.
- Emit critical audit event.
- Send security notification if enabled.

Role downgrade:

- Revoke refresh token families.
- Existing access token expires naturally.
- Optional emergency denylist for high-risk admin cases.

Clock drift:

- Gateway allows at most 60 seconds skew.
- Account and gateway deployments must use synchronized time.

## Observability

Account metrics:

- token issue success/failure
- refresh success/failure
- refresh reuse detected
- revocation count
- JWKS request count
- signing key age
- login success/failure

Gateway metrics:

- JWT validation success/failure by reason
- JWKS refresh success/failure
- unknown `kid`
- denylist hit
- missing scope/role

Never log raw access tokens, refresh tokens, authorization codes, or cookies.

## Tests

Account contract tests:

- OIDC metadata contains issuer, token endpoint, revocation endpoint, and JWKS URI.
- JWKS contains current signing key with `kid`.
- Access token contains required claims.
- Access token uses allowed algorithm.
- Refresh token rotates on use.
- Reused refresh token revokes token family.
- Revoked refresh token cannot mint access token.

Gateway contract tests:

- Valid token reaches protected test route with sanitized `X-HHC-*` headers.
- Wrong issuer returns `401`.
- Wrong audience returns `401`.
- Expired token returns `401`.
- Token before `nbf` returns `401`.
- ID token used as access token returns `401`.
- Unknown `kid` triggers refresh and then either validates or returns `401`.
- Missing scope returns `403`.
- Client-supplied `X-HHC-*` headers are stripped.

Operational tests:

- Key rotation works without gateway restart.
- Account rollback keeps JWKS backward compatible.
- Account outage does not break already-issued access tokens while gateway has usable JWKS.
- Role downgrade revokes refresh token family and new access tokens reflect reduced scope.
- Account suspend and disable revoke refresh token families and prevent new access tokens.
