# HHC Auth And Trusted Header Contract

Detailed gateway verifier, route policy, JWKS cache, token validation, failure modes, and implementation phases are defined in `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`.

Detailed account token, refresh, JWKS, browser token handling, and role freshness rules are defined in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

Detailed account invitation, role grant/revoke, suspend, disable, offboarding, and emergency access removal rules are defined in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.

Shared request id, correlation id, trusted header, and common API behavior rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Detailed roles, scopes, service identity, browser token handling, and threat mitigations are defined in `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`.

Detailed role/scope catalog, permission naming, route/action metadata, resource-level authorization, field-level response policy, and policy drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Internal service identity, `/priv/*` caller app-id authorization, `X-Internal-*` handling, and idempotency rules are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

## Gateway Responsibility

`api-gateway` is the only public gate for non-account APIs. It validates bearer access JWTs locally from cached JWKS and injects trusted identity headers to upstream services.

Gateway must not call `account-api` for per-request token verification.

## Token Source

Access tokens are issued by `account-api` under:

```text
https://account.alive.org.tw
```

Expected claims:

- `iss`: `https://account.alive.org.tw`
- `aud`: `hhc-api`
- `sub`: account user id
- `typ`: `access`
- `exp`
- `nbf`
- `iat`
- `jti`
- `sid`
- `client_id`
- `roles`
- `scope`

## Gateway Validation

Gateway validates:

- Signature by `kid` using cached JWKS.
- Issuer.
- Audience.
- Expiry and not-before.
- Token type.
- Required route roles and scopes.

Unknown `kid` triggers one JWKS refresh and then fails closed if still unknown.

## Headers Stripped From Client Requests

Gateway must remove:

- `X-HHC-*`
- `X-User-ID`
- `X-Roles`
- `X-Permissions`
- `X-Forwarded-User`

## Headers Injected By Gateway

Only gateway may inject:

- `X-HHC-User-ID`
- `X-HHC-Roles`
- `X-HHC-Scopes`
- `X-HHC-Token-ID`
- `X-HHC-Session-ID`
- `X-HHC-Request-ID`
- `X-HHC-Auth-Provider`

## Backend Rules

Protected backend routes must reject requests when required trusted headers are missing. Services should not parse browser JWTs themselves for normal protected API traffic; gateway is the trust boundary.

Internal `/priv/*` routes additionally require service identity from Dapr/mTLS/app-id allowlists.

## Route Policy

Public routes:

- No JWT required.
- Method-limited.
- Rate-limited.
- Published data only.

Admin routes:

- JWT required.
- Role/scope required.
- Trusted headers required upstream.

Internal routes:

- `/priv/*` only.
- Not exposed through public gateway.
- Dapr service identity required.
