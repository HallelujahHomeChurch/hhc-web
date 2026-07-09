# HHC API Gateway Authentication Design

This spec defines how `api-gateway` becomes the first authentication and routing gate for all non-account APIs under `www.alive.org.tw/api/*`.

Account token, refresh, JWKS, and browser token-handling rules are defined in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

Internal service identity, `/priv/*` blocking, caller app-id allowlists, and `X-Internal-*` handling are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Authorization policy, role/scope catalog, route/action metadata, resource-level checks, field-level response policy, and authorization drift gates are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Gateway route config, CORS, rate limits, feature-safe rollout, and emergency admin API kill-switch rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.

Gateway abuse route classes, method/body limits, route-level `429` behavior, WAF adoption criteria, and service quota boundaries are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

Browser security header profiles, CORS allowlists, CSRF/origin checks, CSP rollout, cookie boundaries, and route-class cache headers are defined in `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`.

## Purpose

The current `api-gateway` repo is an Nginx 1.30.3 Alpine gateway that routes to services through Dapr service invocation. It currently has no token validation. This design extends the existing gateway instead of replacing it with a different gateway product.

The gateway must validate access JWTs locally and must not call `account-api` for per-request verification.

## Core Decision

Use Nginx route policy plus a local Go JWT verifier.

Recommended v1 shape:

```text
client
  -> api-gateway Nginx
  -> internal auth_request to local jwt-verifier
  -> Dapr service invocation
  -> upstream service
```

The verifier can run as:

- a second container in the same Azure Container Apps revision, listening on `127.0.0.1:10001`, preferred when ACA multi-container operation is available; or
- a Go binary in the same gateway image, started with Nginx by a small entrypoint, acceptable for the first implementation.

In both cases, the verifier is part of the `api-gateway` deployment boundary.

## Non-Negotiables

- No `api.alive.org.tw`.
- `www.alive.org.tw/api/*` is the only non-account public API host/path.
- `admin.alive.org.tw` serves admin UI only; it does not expose backend APIs.
- `account.alive.org.tw` owns login, account APIs, token, OIDC metadata, and JWKS.
- Gateway does not introspect tokens per request.
- Gateway only fetches OIDC metadata/JWKS for key discovery and refresh.
- Public ingress blocks `/priv/*` and `/api/priv/*`.
- Client-supplied identity headers are stripped before upstream routing.

## Responsibilities

### Nginx

Nginx owns:

- host routing
- path routing
- method restrictions
- CORS headers
- rate limits
- body size limits
- `auth_request` calls to verifier
- stripping untrusted headers
- injecting verifier-produced trusted headers
- Dapr proxy target selection

### Go JWT Verifier

Verifier owns:

- OIDC metadata/JWKS fetch
- JWKS cache and refresh
- JWT parsing and signature verification
- issuer/audience/type/time validation
- route-required role/scope evaluation
- optional emergency `jti` denylist check
- auth result headers
- auth metrics and logs

### Upstream Services

Upstream services own:

- domain authorization beyond coarse gateway checks
- object-level authorization, resource state checks, and field-level response policy
- rejecting protected operations without trusted headers
- service identity checks for `/priv/*`
- audit events for protected actions

Services should not parse browser JWTs for normal protected API routes. The trust boundary is gateway-injected headers plus service-side defense checks.

## Route Classes

| Class | Examples | Gateway Auth | Upstream Rule |
| --- | --- | --- | --- |
| Public read | `/api/home`, `/api/site-layout`, `/api/news*`, `/api/bulletins*`, `/api/sitemap-data`, `/api/assets/public/*` | no JWT | published/public resources only |
| Protected user | `/api/assets/protected/*` | valid JWT | asset grant/visibility check |
| Admin CMS | `/api/admin/*` | valid JWT + CMS scope | trusted headers required |
| Admin asset | `/api/assets/admin/*` | valid JWT + asset scope | trusted headers required |
| LINE webhook | `/api/line/webhook/*` | no JWT, POST only | LINE signature validation in bot |
| Account host | `account.alive.org.tw/*` | account-owned | route only to account service |
| Internal | `/priv/*`, `/api/priv/*` | blocked publicly | Dapr/mTLS/app-id only |

## Nginx Auth Request Pattern

Protected locations call an internal verifier endpoint:

```nginx
location /api/admin/ {
    auth_request /_auth/jwt;
    auth_request_set $hhc_user_id $upstream_http_x_hhc_user_id;
    auth_request_set $hhc_roles $upstream_http_x_hhc_roles;
    auth_request_set $hhc_scopes $upstream_http_x_hhc_scopes;
    auth_request_set $hhc_token_id $upstream_http_x_hhc_token_id;

    proxy_set_header X-HHC-User-ID $hhc_user_id;
    proxy_set_header X-HHC-Roles $hhc_roles;
    proxy_set_header X-HHC-Scopes $hhc_scopes;
    proxy_set_header X-HHC-Token-ID $hhc_token_id;
    proxy_set_header X-HHC-Request-ID $request_id;
    proxy_set_header X-HHC-Auth-Provider account-api;

    proxy_pass $hhc_web_api_base$uri$is_args$args;
}
```

The internal auth endpoint passes route requirements:

```nginx
location = /_auth/jwt {
    internal;
    proxy_pass http://127.0.0.1:10001/verify;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Authorization $http_authorization;
    proxy_set_header X-HHC-Required-Roles $hhc_required_roles;
    proxy_set_header X-HHC-Required-Scopes $hhc_required_scopes;
    proxy_set_header X-HHC-Route-ID $hhc_route_id;
    proxy_set_header X-HHC-Request-ID $request_id;
}
```

Exact Nginx syntax may differ in implementation, but the behavior must match this contract.

## Route Policy Source

Route policy should be explicit in gateway config, not inferred from upstream services.

For each protected route define:

- route id
- path matcher
- allowed methods
- auth mode
- required roles
- required scopes
- upstream app id
- body size limit
- rate limit zone
- CORS policy

Example policy:

```text
route_id=admin.cms
path=/api/admin/*
methods=GET,POST,PUT,PATCH,DELETE
auth=jwt
required_scopes=cms:read
write_scopes=cms:write,cms:publish
upstream=hhc-web-api
```

V1 can encode this in Nginx locations and variables. Later, generate Nginx config from a route policy file if duplication grows.

## Token Contract

Access token required claims:

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

Supported signing algorithms:

- Prefer `RS256` or `ES256`.
- Do not allow `none`.
- Do not accept unexpected algorithms even if the key exists.

The verifier must reject:

- missing token
- malformed token
- wrong issuer
- wrong audience
- wrong token type
- expired token
- token before `nbf`
- unknown `kid` after refresh
- unsupported algorithm
- missing required role/scope

Clock skew:

- allow at most 60 seconds for `nbf`/`exp`
- keep gateway and account clocks synchronized

## JWKS Cache And Rotation

Startup:

- Fetch OIDC metadata and JWKS.
- Protected routes fail closed until initial keys are available.
- Public routes continue to work.

Refresh:

- Background refresh every 5-15 minutes.
- Cache keys by `kid`.
- Retain old keys until max stale window if refresh fails.
- Max stale key use: 24 hours.

Unknown `kid`:

1. Trigger one immediate JWKS refresh.
2. Retry verification against refreshed cache.
3. If still unknown, return `401`.

Key rotation requirement for `account-api`:

- Publish new key in JWKS before issuing tokens signed by it.
- Keep old public key in JWKS until all access tokens signed by it have expired plus skew.
- Rotate signing keys without requiring gateway restart.

No per-request token introspection is allowed.

## Refresh Token And Logout Model

`account-api` owns refresh token rotation and revocation.

Gateway behavior:

- Validates only access tokens.
- Does not store refresh tokens.
- Does not call account logout/session APIs per request.
- Allows existing access tokens to expire naturally after logout.

Access token lifetime:

- 5-15 minutes.

Emergency admin incident option:

- Redis denylist keyed by `jti`.
- Use only for high-risk admin incidents.
- Denylist TTL should be no longer than max access token lifetime plus skew.
- Normal logout should not require denylist.

## Trusted Header Contract

Gateway strips these from all client requests:

- `X-HHC-*`
- `X-User-ID`
- `X-Roles`
- `X-Permissions`
- `X-Forwarded-User`

Verifier can return these to Nginx:

- `X-HHC-User-ID`
- `X-HHC-Roles`
- `X-HHC-Scopes`
- `X-HHC-Token-ID`
- `X-HHC-Session-ID`
- `X-HHC-Auth-Provider`

Nginx adds:

- `X-HHC-Request-ID`

Rules:

- Only gateway can inject `X-HHC-*` headers.
- Upstreams must reject protected route requests missing required trusted headers.
- Upstreams should not trust `X-Forwarded-*` identity-like headers for authorization.
- Internal `/priv/*` calls use Dapr/mTLS/app-id, not browser JWT headers.

## CORS And CSRF

Public read APIs:

- allow configured public origins only
- restrict methods to needed verbs
- no credentials unless required

Admin APIs:

- allowed origin should be `https://admin.alive.org.tw` and test equivalent
- use `Authorization: Bearer <access_token>`
- do not rely on cookies for API authorization

CSRF:

- Bearer-token admin APIs are not automatically CSRF-prone like cookie-auth APIs.
- If future admin APIs use cookies, require CSRF tokens and SameSite policy.
- Account login/session cookies remain account-domain responsibility.

## Rate Limits And Body Limits

Suggested defaults:

| Route Class | Rate Limit | Body Limit |
| --- | --- | --- |
| Public read | normal API limit | small |
| Admin CMS | stricter per user/IP | moderate |
| Admin asset upload session | stricter per user/IP | small metadata only |
| Asset upload bytes | enforced by upload target and asset namespace |
| LINE webhook | route-specific rate and body limit | LINE message max |
| Account routes | account service policy | account service policy |

`/api/line/webhook/*` must be POST-only and route-limited even though it has no JWT.

## Failure Modes

| Failure | Behavior |
| --- | --- |
| Verifier process down | protected routes return `503` or fail closed; public routes still work |
| Empty JWKS cache | protected routes return `503`/`401` until keys load |
| JWKS refresh fails with valid stale key | continue until max stale, log/metric alert |
| JWKS refresh fails with no usable key | protected routes fail closed |
| Unknown `kid` after refresh | `401` |
| Missing token on protected route | `401` |
| Valid token missing scope | `403` |
| Client sends `X-HHC-*` | strip before auth/upstream |
| Public `/priv/*` | blocked before upstream |
| Admin host calls `/api/*` | reject backend API route |
| Account host non-account API | reject or route only account-owned paths |

## Environment Variables

Gateway/verifier:

```text
OIDC_ISSUER=https://account.alive.org.tw
OIDC_AUDIENCE=hhc-api
OIDC_METADATA_URL=https://account.alive.org.tw/.well-known/openid-configuration
JWKS_URL=https://account.alive.org.tw/.well-known/jwks.json
JWKS_CACHE_TTL=15m
JWKS_MAX_STALE=24h
JWT_CLOCK_SKEW=60s
JWT_VERIFIER_ADDR=127.0.0.1:10001
JTI_DENYLIST_ENABLED=false
REDIS_URL=
```

Route upstream app ids:

```text
HHC_WEB_API_APP_ID=hhc-web-api
ASSET_API_APP_ID=asset-api
LINE_BOT_APP_ID=hhc-line-function-bot
ACCOUNT_API_APP_ID=account-api
```

Test environment app ids keep the existing gateway pattern of appending `-test` from host mapping.

## Observability

Metrics:

- `gateway.auth.requests`
- `gateway.auth.allowed`
- `gateway.auth.denied`
- `gateway.auth.forbidden`
- `gateway.auth.jwks_refresh.success`
- `gateway.auth.jwks_refresh.failure`
- `gateway.auth.unknown_kid`
- `gateway.auth.cache_age_seconds`
- `gateway.route.blocked_priv`
- `gateway.route.upstream_errors`

Logs should include:

- request id
- route id
- auth mode
- decision
- status code
- user id hash when available
- token id hash when available
- denial reason category

Logs must not include:

- raw JWT
- refresh token
- full Authorization header
- private user profile data

## Implementation Phases

### Phase A: Header Sanitation And Route Guards

- Strip all client identity headers, including `X-HHC-*`.
- Block `/priv/*` and `/api/priv/*`.
- Keep public routes working.
- Ensure `admin.alive.org.tw/api/*` does not expose backend APIs.

### Phase B: Local Verifier

- Add Go verifier with JWKS cache.
- Add `/verify` endpoint.
- Validate claims and route roles/scopes.
- Return trusted headers only after successful verification.

### Phase C: Protected Routes

- Apply `auth_request` to `/api/admin/*`, `/api/assets/admin/*`, and `/api/assets/protected/*`.
- Keep public website routes unauthenticated.
- Keep LINE webhook no-JWT but POST/rate/body limited.

### Phase D: Operations

- Add metrics/logging.
- Add JWKS refresh alerts.
- Add staging smoke tests.
- Document emergency `jti` denylist procedure if enabled.

## Test Matrix

Verifier unit tests:

- valid token
- expired token
- token not yet valid
- wrong issuer
- wrong audience
- wrong `typ`
- unsupported algorithm
- unknown `kid` refresh success
- unknown `kid` refresh failure
- missing role
- missing scope
- `jti` denylisted when denylist enabled

Gateway integration tests:

- public route works without token
- protected route missing token returns `401`
- invalid token returns `401`
- valid token missing role/scope returns `403`
- valid token reaches upstream with sanitized `X-HHC-*`
- client-supplied `X-HHC-*` is stripped
- public `/priv/*` and `/api/priv/*` are blocked
- `admin.alive.org.tw/api/*` is rejected
- `account.alive.org.tw` routes only account/OIDC/JWKS paths
- LINE webhook accepts POST and rejects unsupported methods

Operational tests:

- JWKS refresh failure alert triggers.
- Gateway restart loads keys before protected traffic succeeds.
- Key rotation works without gateway restart.
- Verifier crash fails protected routes closed.

## Acceptance Criteria

- Gateway validates access JWTs locally from JWKS.
- Gateway does not call `account-api` for per-request verification.
- Refresh token revocation remains in `account-api`.
- Short-lived access tokens expire naturally after logout.
- Protected upstreams receive only sanitized trusted headers.
- Public `/priv/*` and `/api/priv/*` cannot reach upstreams.
- Public website and LINE webhook routes remain usable without account JWT.
- Admin APIs require role/scope.
- JWKS rotation works without gateway restart.
