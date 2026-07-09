# HHC Internal Service Identity And Private Route Design

This spec defines how backend services call each other through `/priv/*`, how service identity is established, and how each service authorizes internal commands.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`

## Core Decision

Use `/priv/*` for service-to-service APIs only.

Public traffic must never reach `/priv/*` or `/api/priv/*`. The public `api-gateway` blocks those paths before upstream selection.

Internal calls use Dapr service invocation with mTLS where available and stable app ids. That transport identity is necessary but not sufficient. Each callee service must still enforce:

- caller app-id allowlist
- route-specific permissions
- domain ownership rules
- idempotency for side effects
- request and correlation propagation
- audit/log/metric events for denied internal calls

This keeps Dapr from becoming an unrestricted internal network. Dapr proves who is calling; the callee still decides whether that caller may perform the command.

## Identity Domains

The platform has separate identity domains.

| Identity Domain | Source | Used For | Trusted By |
| --- | --- | --- | --- |
| Browser user identity | `api-gateway` validates access JWT from `account-api` JWKS | Public/admin API authorization | Public/admin upstream handlers |
| Internal service identity | Dapr/mTLS/app-id invocation metadata | `/priv/*` authorization | Internal route middleware |
| Provider identity | Provider signature verification | LINE and notification provider webhooks | Webhook handlers |
| Actor context | Sanitized command payload metadata | Audit trail and delegated business checks | Callee only after caller is allowed |

Do not forward raw browser access JWTs between services by default.

When a service needs to tell another service which user initiated an operation, pass a sanitized actor context in the command body, such as:

```json
{
  "actor": {
    "type": "user",
    "userId": "usr_123",
    "roles": ["cms_editor"],
    "scopes": ["cms:write"],
    "sessionId": "sess_123"
  }
}
```

The caller service remains responsible for verifying that the user was allowed to request the operation. The callee still verifies that the caller service is allowed to use that command and that the target resource belongs to an approved namespace or owner.

## Caller App ID

Every deployable service has one stable app id.

| App ID | Service |
| --- | --- |
| `api-gateway` | Public gateway |
| `hhc-web` | Next.js public/admin frontend |
| `hhc-web-api` | Main website backend and CMS core |
| `account-api` | Account, OIDC, token, JWKS |
| `asset-api` | Asset metadata, grants, blob policy |
| `notification-api` | Notification templates, providers, delivery state |
| `audit-log` | Append-only audit service |
| `hhc-line-function-bot` | LINE bot |

Internal handlers should normalize caller identity into an internal request context:

```text
internal.caller_app_id
internal.request_id
internal.correlation_id
internal.trace_id
```

The normalized caller app id must come from trusted Dapr/service-invocation metadata or equivalent internal runtime metadata. It must not be accepted from public client headers.

`X-Internal-Caller-App-Id` may be used as an internal normalized header between trusted local middleware layers, but public ingress must strip or reject all `X-Internal-*` headers before routing.

## Public Gateway Rules

The gateway is the first and only public API gate for platform APIs under `www.alive.org.tw/api/*`.

Gateway rules:

- Block `/priv/*`.
- Block `/api/priv/*`.
- Strip incoming `X-HHC-*`.
- Strip incoming `X-Internal-*`.
- Normalize request id and trace headers.
- Validate browser access JWT locally for protected public/admin routes.
- Never call `account-api` for per-request JWT validation.
- Never inject a service identity that would let browser traffic reach internal command routes.

`api-gateway` can call an internal route only when that route explicitly allowlists `api-gateway`. The main v1 case is writing security events to `audit-log`.

## Internal Route Classes

Internal route groups should be explicit and narrow.

| Callee | Route Group | Allowed Callers | Purpose |
| --- | --- | --- | --- |
| `asset-api` | `/priv/assets/*` | `hhc-web-api`, `hhc-line-function-bot`, future approved owner services | Upload sessions, grants, private metadata, public URL resolution |
| `notification-api` | `/priv/notifications/*` | `account-api`, `hhc-web-api`, future event/engagement services | Send, preview, status lookup |
| `audit-log` | `/priv/audit/*` | `account-api`, `hhc-web-api`, `asset-api`, `notification-api`, `api-gateway` for security events | Append audit events and authorized audit queries |
| `hhc-web-api` | `/priv/*` | none in v1 unless a route-specific contract is added | Reserved for future internal website-domain commands |

Do not create broad service-level trust such as "all internal apps can call asset-api." Allow callers per route group and, when needed, per action.

## Route Authorization Model

Every internal route should define an authorization matrix.

```text
route_group
allowed_callers
allowed_actions
required_idempotency
allowed_resource_namespaces
audit_event_type
```

Example for asset upload sessions:

| Field | Value |
| --- | --- |
| Route | `POST /priv/assets/upload-sessions` |
| Allowed callers | `hhc-web-api`, `hhc-line-function-bot` |
| Caller action | `asset.upload_session.create` |
| Required idempotency | yes |
| Namespaces for `hhc-web-api` | `cms.weekly.pdf`, `cms.news.cover`, `cms.page.image` |
| Namespaces for `hhc-line-function-bot` | `line.group.file` |
| Audit | `asset.upload_session.created` |

This prevents a confused deputy problem. For example, even though `hhc-line-function-bot` may store LINE group files, it cannot write CMS weekly bulletin assets unless that namespace is explicitly allowed.

## Confused Deputy Controls

Internal service identity must not become a way to launder permissions.

Rules:

- A caller may pass actor context only after it has authorized the original user or provider action.
- A callee must not treat actor context as proof of authorization.
- A callee must validate caller app id before reading or mutating resources.
- A callee must validate resource ownership, namespace, visibility, template, or provider constraints for the requested action.
- A callee must write denied internal calls to security logs and metrics.
- High-risk commands should emit audit events even when the command fails after authorization.

Examples:

| Scenario | Required Control |
| --- | --- |
| `hhc-web-api` asks `asset-api` for a public URL | `asset-api` confirms caller may use the asset namespace and asset visibility allows a public URL |
| `hhc-line-function-bot` stores a group file | `asset-api` only allows `line.group.file`, not CMS namespaces |
| `account-api` sends password reset email | `notification-api` only allows approved account templates for `account-api` |
| `api-gateway` writes blocked `/priv/*` attempt | `audit-log` accepts security event append but not arbitrary audit query |

## Asset Public URL Flow

Public URLs for assets are gateway URLs, not raw Blob URLs.

```text
https://www.alive.org.tw/api/assets/public/{assetId}
```

Normal public website flow:

1. Admin uploads file through `hhc-web-api`.
2. `hhc-web-api` calls `asset-api /priv/assets/*` to create upload session, complete upload, and attach grants/visibility.
3. `hhc-web-api` stores `assetId` on the content record.
4. Public read APIs return the public asset URL only when the content and asset are publishable.
5. Browser downloads through `www.alive.org.tw/api/assets/public/{assetId}`.

Service-owned private file flow:

1. Owner service calls `asset-api /priv/assets/upload-sessions`.
2. Owner service stores the domain relationship, such as LINE group id or future desktop folder path.
3. Owner service asks `asset-api` for a download URL only when its own domain authorization allows access.
4. `asset-api` enforces grants, visibility, scan state, and download policy.

`asset-api` owns bytes and access mechanics. Consumer services own business meaning and publish decisions.

## Notification Flow

`notification-api` is internal-only for send/preview/status commands.

Allowed examples:

- `account-api` sends verification, reset, invite, and security notices.
- `hhc-web-api` sends CMS workflow notices if needed.
- future event services send approved engagement templates.

`notification-api` must enforce:

- caller app-id allowlist
- template namespace allowlist by caller
- channel restrictions
- recipient validation
- suppression/rate-limit policy
- idempotency key for send commands

Provider callbacks are public-ingress exceptions only when signature verified:

```text
POST /api/notifications/provider-webhooks/{provider}
```

Those callbacks are not `/priv/*`.

## Audit Flow

`audit-log` is append-only for most producers.

Allowed producer examples:

- `api-gateway`: blocked private route attempts, JWT failures, route authorization denials
- `account-api`: login failure, refresh reuse, token revocation, role changes
- `hhc-web-api`: CMS publish/unpublish, role-sensitive reads, admin writes
- `asset-api`: grant changes, delete/restore, scan failure
- `notification-api`: template send and provider failure metadata

Querying audit events is more sensitive than appending them.

Rules:

- `POST /priv/audit/events` can be allowed to producers.
- `GET /priv/audit/events` should be limited to `hhc-web-api` after it verifies the admin has `audit:read`, or to explicit incident tooling.
- `api-gateway` may append security events but should not receive audit query permissions by default.

## Header Policy

Public ingress strips or rejects:

- `X-HHC-*`
- `X-Internal-*`
- identity-like `X-Forwarded-*` values for authorization decisions
- raw provider signature headers on routes where they are not expected

Internal clients propagate:

- `X-HHC-Request-ID`
- `X-HHC-Correlation-ID`
- W3C `traceparent` and `tracestate` where available
- `Idempotency-Key` for side-effecting commands

Internal caller app id should be derived by middleware from trusted invocation metadata. If a header representation is used after derivation, it must be overwritten by trusted middleware, not accepted from caller input.

## Idempotency

All side-effecting `/priv/*` commands require idempotency.

Recommended key format:

```text
{callerAppId}:{operation}:{stableBusinessKey}:{attemptOrVersion}
```

Examples:

```text
hhc-web-api:asset-grant:bulletin_2026_07_12:1
account-api:notification-send:password-reset-token_abc:1
api-gateway:audit-blocked-route:req_123:1
```

Callee behavior:

- Same key and same payload returns the original result.
- Same key and different payload returns `409 idempotency_conflict`.
- Completed commands keep idempotency records long enough to cover retries.
- Failed transient attempts can be retried with the same key.

## Local Development

Local development should preserve fail-closed behavior by default.

Recommended flags:

```text
INTERNAL_AUTH_ENABLED=true
LOCAL_INTERNAL_AUTH_PROFILE=dev
LOCAL_ALLOWED_CALLER_APP_IDS=hhc-web-api,account-api,asset-api,notification-api,audit-log,hhc-line-function-bot
```

Rules:

- Do not make internal auth optional in shared staging or production.
- If local header-based simulation is used, enable it only under a local profile.
- Local simulation headers must be rejected outside local development.
- Tests should exercise both allowed and denied caller ids.

## Failure Modes

| Failure | Behavior |
| --- | --- |
| Public request to `/priv/*` | Gateway blocks before upstream |
| Client supplies `X-Internal-Caller-App-Id` | Gateway strips/rejects |
| Missing internal caller identity | Callee returns `401 internal_auth_required` |
| Unknown caller app id | Callee returns `403 internal_caller_forbidden` |
| Known caller, wrong route/action | Callee returns `403 internal_action_forbidden` |
| Known caller, wrong namespace/resource owner | Callee returns `403 resource_forbidden` or `404 not_found` when existence must be hidden |
| Missing idempotency key on side-effecting route | Callee returns `400 idempotency_key_required` |
| Duplicate idempotency key with different payload | Callee returns `409 idempotency_conflict` |
| Dapr invocation unavailable | Caller retries according to command retry policy or outbox |

## Observability

Every internal route should log:

- request id
- correlation id
- route group
- caller app id
- action
- resource type and resource id when safe
- outcome
- latency

Do not log:

- access tokens
- refresh tokens
- authorization headers
- cookies
- Blob SAS URLs
- provider secrets
- raw notification body when it may contain private data

Metrics:

- internal calls by caller/callee/route/outcome
- denied internal calls by reason
- idempotency conflicts
- Dapr invocation failures
- retry and dead-letter counts

## Implementation Pattern In Go

Each service should use middleware before route handlers:

```text
extract request id
derive trusted caller app id from internal runtime metadata
reject missing/unknown caller app id
match route group and action
check caller/action/namespace allowlist
check idempotency when required
attach internal identity to request context
invoke handler
emit logs/metrics/audit when needed
```

Route handlers should not manually parse transport headers for authorization. They should consume the normalized identity from context.

Suggested package shape:

```text
internal/http/middleware/internalidentity
internal/security/internalacl
internal/idempotency
internal/observability
```

Shared code may be copied into a small internal Go module only after two or more services have the same middleware behavior. Avoid prematurely creating a platform library that freezes bad assumptions.

## Tests

Gateway tests:

- public `/priv/*` is blocked
- public `/api/priv/*` is blocked
- spoofed `X-Internal-*` is stripped or rejected
- protected routes still validate browser JWT locally

Service tests:

- missing internal caller identity returns `401`
- disallowed app id returns `403`
- allowed app id but wrong action returns `403`
- allowed app id but wrong namespace returns `403`
- allowed app id and valid command succeeds
- duplicate idempotency key with same payload returns previous result
- duplicate idempotency key with different payload returns `409`
- request id and trace context propagate to logs

Staging smoke tests:

- Dapr app ids match deployment config
- mTLS/service invocation is enabled where available
- backend API services have no public ingress except approved webhook routes
- `api-gateway` cannot call unapproved `/priv/*` routes
- `hhc-line-function-bot` can call only the asset namespaces it owns

## Rollout Order

1. Add gateway block/strip tests for `/priv/*`, `/api/priv/*`, `X-HHC-*`, and `X-Internal-*`.
2. Add internal identity middleware to `asset-api`, `notification-api`, and `audit-log`.
3. Implement route-specific ACL maps in each service.
4. Add idempotency middleware for side-effecting internal commands.
5. Add audit/log/metric events for denied internal calls.
6. Configure Dapr app ids and internal-only ingress in Azure Container Apps.
7. Add staging smoke tests for allowed and denied service calls.
8. Only then implement higher-level features that depend on `/priv/*`, such as LINE group file storage.

## Non-Goals

- Do not create a public `api.alive.org.tw`.
- Do not call `account-api` from `api-gateway` for per-request JWT validation.
- Do not expose `notification-api` send routes publicly.
- Do not expose raw Blob URLs as the stable public asset contract.
- Do not use one global internal admin token shared by all services.
- Do not treat "inside the VNet/container environment" as authorization.
