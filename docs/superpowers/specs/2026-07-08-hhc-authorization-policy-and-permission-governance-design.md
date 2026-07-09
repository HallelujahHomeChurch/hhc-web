# HHC Authorization Policy And Permission Governance Design

## Purpose

This spec defines how HHC platform services govern roles, scopes, route policy, resource-level authorization, policy drift checks, and authorization release evidence.

It complements:

- `docs/api/auth-headers.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`

External alignment:

- OWASP Authorization Cheat Sheet: design access control up front, deny by default, least privilege, validate permissions on every request, and prefer attribute/resource checks over broad role assumptions.
- OWASP API Security Top 10 2023 highlights broken object-level authorization and broken object property-level authorization as primary API risks.
- NIST SP 800-207 describes policy decision and policy enforcement as separate logical concerns. HHC applies that model pragmatically without introducing a central policy service in v1.

References:

- OWASP Authorization Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html`
- OWASP API1:2023 Broken Object Level Authorization: `https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/`
- OWASP API3:2023 Broken Object Property Level Authorization: `https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/`
- NIST SP 800-207 Zero Trust Architecture: `https://nvlpubs.nist.gov/nistpubs/specialpublications/NIST.SP.800-207.pdf`

## Core Decision

Use layered, service-owned authorization with shared policy governance.

V1 must not add a standalone `authorization-api`, OPA, Cedar, or a central PDP. Those tools can be useful later, but they add another runtime dependency and do not remove the need for domain services to check resource state.

Authorization ownership:

| Layer | Owner | Responsibility | Must Not Do |
| --- | --- | --- | --- |
| Identity lifecycle | `account-api` | Users, invitations, roles, scopes, sessions, refresh token revocation, JWKS | Authorize CMS resources or asset grants |
| Public ingress PEP | `api-gateway` | JWT verification, route-level auth mode, coarse scopes, trusted headers, `/priv/*` blocking | Compose business data or make resource decisions |
| Domain authorization | owning service | Resource status, ownership, locale, lifecycle state, version, allowed operation | Trust gateway scope as the only check |
| Asset grants | `asset-api` | Byte/object visibility, grants, scan/download policy | Decide whether CMS content should be public |
| Internal calls | callee service | `/priv/*` app-id allowlist, command-specific authorization, idempotency | Trust user headers from browser traffic |
| Admin UI | `hhc-web` | Hide unavailable actions and guide users | Act as the source of authorization truth |

Gateway and services are both policy enforcement points. The effective decision is allow only when every relevant layer allows the request.

## Terminology

`role`:

- Human-assigned bundle in `account-api`, such as `cms.editor`.
- Useful for administration and UI grouping.
- Not enough by itself for service authorization.

`scope`:

- Token capability string, such as `cms:publish`.
- Used by `api-gateway` for route-level checks and by services for capability checks.
- Short-lived and refreshed through access token renewal.

`permission`:

- Service-local action being evaluated, such as `content.publish`, `asset.grant_public_read`, or `audit.read_sensitive`.
- Maps to required scopes plus domain state checks.

`grant`:

- Resource-level authorization record, especially in `asset-api`.
- Examples: public read grant, user read grant, service owner grant, future LINE group grant.

`policy`:

- Versioned rules that map route, actor, service, resource, operation, and data classification to allow/deny.

## Scope Catalog

The following scope names are v1 canonical. New scopes require contract, gateway, account, service, and admin UI review.

| Scope | Owner | Purpose |
| --- | --- | --- |
| `cms:read` | `hhc-web-api` | Read admin CMS data and previews |
| `cms:write` | `hhc-web-api` | Create/update draft CMS data |
| `cms:publish` | `hhc-web-api` | Publish, unpublish, rollback publish, emergency takedown |
| `cms:admin` | `hhc-web-api` | Site settings, destructive CMS operations, elevated CMS maintenance |
| `assets:read` | `asset-api` | Read admin asset metadata |
| `assets:write` | `asset-api` | Upload, complete, attach, update asset metadata |
| `assets:grant` | `asset-api` | Create/revoke resource grants |
| `audit:read` | `audit-log` | Read normal audit metadata through an authorized service |
| `audit:sensitive_read` | `audit-log` | Read sensitive audit metadata |
| `notifications:read` | `notification-api` | Read notification status |
| `notifications:send` | `notification-api` | Trigger approved notification commands or previews |
| `account:read` | `account-api` | Read account/admin-user records on account domain |
| `account:admin` | `account-api` | Manage users, invitations, roles, sessions, suspend, disable |

Rules:

- Use `:` to separate domain and capability.
- Do not create broad scopes such as `admin`, `write`, or `manage`.
- Do not create UI-specific scopes such as `show_publish_button`.
- Do not put resource ids or locale values in scope names.
- Prefer adding resource checks to service policy before adding a new scope.
- Unknown scopes in a token are ignored by services unless explicitly configured; they never grant access by convention.

## Default Role Bundles

`account-api` owns role assignment. The table below is the default v1 mapping. Implementation can store this in account-domain tables or account configuration, but changes must be versioned and audited.

| Role | Default Scopes | Notes |
| --- | --- | --- |
| `cms.viewer` | `cms:read` | Admin read and preview only |
| `cms.editor` | `cms:read cms:write assets:read assets:write` | Draft editing and asset upload/attach |
| `cms.publisher` | `cms:read cms:publish assets:read assets:grant` | Publish/unpublish workflows |
| `cms.admin` | `cms:read cms:write cms:publish cms:admin assets:read assets:write assets:grant audit:read` | Small-team operational admin, not account admin |
| `asset.viewer` | `assets:read` | Asset metadata read |
| `asset.manager` | `assets:read assets:write assets:grant` | Asset management where domain rules allow |
| `audit.viewer` | `audit:read` | Normal audit read |
| `audit.sensitive_reader` | `audit:read audit:sensitive_read` | Sensitive audit read |
| `notification.viewer` | `notifications:read` | Notification status |
| `notification.operator` | `notifications:read notifications:send` | Approved notification previews/tests |
| `account.viewer` | `account:read` | Account-domain read |
| `account.admin` | `account:read account:admin` | Account-domain administration only |

Rules:

- `cms.admin` and `account.admin` are separate even if one person holds both.
- Role bundles are convenience defaults, not hard-coded business logic.
- Services check scopes and resource rules, not only role names.
- A future UI can show role names, but API routes must not authorize solely from display labels.
- Role change must revoke affected refresh token families; access tokens expire naturally unless emergency denylist is used.

## Permission Evaluation Model

Every protected decision follows this order:

1. Normalize request context.
2. Identify route policy.
3. Verify authentication at the appropriate boundary.
4. Check required route scopes.
5. Load only the minimum resource facts needed for the decision.
6. Check domain/resource policy.
7. Check data classification and field-level response policy.
8. Execute the action or return a stable denial.
9. Emit metrics and audit for protected writes or important denials.

Request context includes:

- request id
- correlation id
- route id
- actor type: `anonymous`, `account`, `service`, `line`, `provider`
- actor subject when authenticated
- token id/session id when available
- caller app id for `/priv/*`
- scopes
- roles
- resource type
- resource id
- operation
- locale
- data classification

Do not pass raw access tokens from service to service for authorization decisions. If a callee needs user context, the caller passes a sanitized actor context after authorizing the initiating user action.

## Gateway Route Policy

Gateway policy is the first public enforcement layer.

Gateway must:

- strip untrusted identity headers
- verify access JWT locally from cached JWKS
- check issuer, audience, token type, `kid`, algorithm, signature, `exp`, `nbf`, and route scopes
- inject sanitized `X-HHC-*` trusted headers
- block public `/priv/*` and `/api/priv/*`
- enforce coarse method, body size, CORS, and rate-limit policy
- fail closed on unknown protected route policy

Gateway must not:

- call `account-api` per request
- query domain services to authorize resources
- assume a CMS scope grants asset download access
- allow browser-supplied `X-HHC-*`, `X-Internal-*`, or role-like headers
- expose different authorization behavior for `www.alive.org.tw/api/*` and `admin.alive.org.tw/api/*`; admin host is UI only

Gateway route metadata must have a route id. Example:

```text
route_id=admin.cms.content.publish
surface=admin
path=/api/admin/content/{contentId}/publish
methods=POST
auth=jwt
required_scopes=cms:publish
upstream=hhc-web-api
resource_check=hhc-web-api:content.publish
cache=no-store
```

## Service Domain Authorization

Services enforce resource policy even when gateway already checked scopes.

`hhc-web-api` examples:

| Permission | Required Scope | Resource Check |
| --- | --- | --- |
| `content.read_admin` | `cms:read` | translation belongs to requested locale and caller is admin |
| `content.update_draft` | `cms:write` | resource is draft/editable and version precondition matches |
| `content.preview` | `cms:read` | draft/revision exists and no public side effects are created |
| `content.publish` | `cms:publish` | publishable status, required fields, valid body blocks, asset refs clean or workflow started |
| `content.unpublish` | `cms:publish` | currently published or safely idempotent |
| `content.archive` | `cms:admin` | no active public projection or operation includes emergency takedown |
| `site_settings.publish` | `cms:admin` | link validation, no secret/internal/admin/private URLs |
| `bulletin.publish` | `cms:publish` and `assets:grant` | clean PDF asset, locale version current, grant-before-visible workflow |

`asset-api` examples:

| Permission | Required Scope Or Caller | Resource Check |
| --- | --- | --- |
| `asset.create_upload_session` | `assets:write` or allowed owner service | namespace allows caller and size/content type |
| `asset.complete_upload` | owner service or upload session owner | session active, object exists, checksum/size match |
| `asset.grant_public_read` | `assets:grant` or allowed owner service | scan clean, processing ready, namespace allows public |
| `asset.revoke_grant` | `assets:grant` or owner service | grant belongs to owner resource or emergency deny override |
| `asset.download_public` | public | visibility public, public read grant, clean scan, ready processing, not deleted |
| `asset.download_protected` | JWT plus grant | matching subject/role/service grant, clean scan, ready processing |

`audit-log` examples:

| Permission | Required Scope Or Caller | Resource Check |
| --- | --- | --- |
| `audit.append` | allowed producer app id | action allowlist and metadata policy |
| `audit.read` | `audit:read` via `hhc-web-api` | route range/query limits and metadata redaction |
| `audit.read_sensitive` | `audit:sensitive_read` | sensitive-read category allowlist and audit read event |

## Object-Level Authorization

Every route that accepts a resource id from path, query, or body must check object-level access.

Rules:

- Do not assume UUIDs are secret.
- Do not trust a resource id simply because the actor has a route scope.
- Public reads query only public projections, never source draft tables.
- Admin reads must filter by allowed domain and data class.
- Mutations must load the current resource state and validate status, version, locale, owner service, and lifecycle state.
- Asset downloads must check visibility, grants, scan status, processing status, soft delete, and deny overrides.
- Search results must be built from authorized projections, not filtered after arbitrary search.
- Error behavior must not leak sensitive existence. Use `404` for public/private resource non-visibility and `403` when an authenticated admin is known but lacks an operation capability.

Recommended denial mapping:

| Case | Response |
| --- | --- |
| Public route for non-public resource | `404 not_found` |
| Missing JWT on protected route | `401 unauthorized` |
| Valid JWT missing route scope | `403 forbidden` |
| Valid route scope but resource state disallows action | `409 conflict` or `422 validation_error` when state-specific |
| Valid route scope but object belongs to inaccessible domain/class | `403 forbidden` for admin, `404 not_found` for public |
| Missing trusted headers on protected upstream | `401 unauthorized` or `403 forbidden`, plus security metric |
| Internal caller not allowlisted | `403 caller_not_allowed` |

## Field-Level Authorization

Authorization is not only route and object access. Response fields must match the caller's permission and data classification.

Rules:

- Public responses exclude draft state, internal notes, audit metadata, retention/legal-hold fields, private asset ids, Blob/SAS URLs, and internal service URLs.
- Admin responses return only fields needed by the screen and role.
- Sensitive audit metadata requires `audit:sensitive_read`.
- Future member, pastoral, donation, event registration, and engagement domains must define field-level response policy before production routes.
- OpenAPI schemas should not expose optional sensitive fields and rely on UI hiding. Use separate response DTOs where field visibility differs materially.

## Internal Service Authorization

Internal `/priv/*` authorization uses service identity plus command policy.

Rules:

- Callee checks caller app id against a route-specific allowlist.
- Callee checks command-specific owner or namespace rules.
- Caller must already authorize the initiating user action before calling an internal service.
- If user context is needed for audit or downstream policy, pass a sanitized actor context in the command body or approved internal headers.
- Callee must not trust browser `Authorization` headers or `X-HHC-*` headers on `/priv/*`.
- Side-effecting internal commands require idempotency keys.

Example actor context:

```json
{
  "actorType": "account",
  "actorId": "user_123",
  "sessionId": "session_123",
  "tokenId": "token_abc",
  "scopes": ["cms:publish", "assets:grant"],
  "requestId": "req_123"
}
```

Only include fields the callee needs for policy, audit, or metadata. Do not include email, display name, raw token, cookies, or full user profile.

## Admin UI Authorization

Admin UI behavior is advisory only.

Rules:

- UI can hide buttons based on roles/scopes to reduce mistakes.
- UI must handle `401`, `403`, `409`, and `422` from backend as normal outcomes.
- UI must not infer account-admin permission from CMS-admin permission.
- UI must not show controls for routes that are disabled by feature flag or kill switch.
- UI must not send privileged requests only because a button was visible.
- Admin preview links remain protected and no-store/noindex.

## Policy Source Of Truth

V1 policy should be explicit but lightweight.

Required artifacts:

| Artifact | Owner | Purpose |
| --- | --- | --- |
| Account role bundle registry | `account-api` | Which scopes each role issues into access tokens |
| Gateway route policy | `api-gateway` | Public ingress auth mode, required scopes, upstream, CORS, rate limits |
| Service authorization registry | each service | Permission names, required scopes, resource checks |
| OpenAPI route metadata | each API service | Contract-visible auth/surface/cache/idempotency expectations |
| Human docs | `docs/api/*.md` and specs | Reviewable behavior summary |
| Admin UI capability map | `hhc-web` | Which screens/actions to render for known scopes |

Recommended Go layout:

```text
internal/authz/context.go
internal/authz/policy.go
internal/authz/decision.go
internal/authz/policy_test.go
internal/http/route_policy.go
```

Recommended OpenAPI extensions:

```yaml
x-hhc-route-surface: admin
x-hhc-gateway-auth: jwt
x-hhc-required-scopes:
  - cms:publish
x-hhc-authz-action: content.publish
x-hhc-resource-check: hhc-web-api:content.publish
x-hhc-data-classification: internal
```

Do not make OpenAPI the only runtime policy source. Runtime services need compiled, tested authorization checks.

## Drift Control

Authorization drift is a production risk.

CI must compare:

- `account-api` role bundles vs canonical scope catalog
- gateway route policy vs OpenAPI route metadata
- service authorization registry vs OpenAPI `x-hhc-authz-action`
- docs/api auth notes vs OpenAPI metadata
- admin UI capability map vs route scopes
- release manifest route/auth changes vs deployed gateway policy

Failure examples:

| Drift | Required Result |
| --- | --- |
| OpenAPI says route is admin but gateway marks public | block merge/deploy |
| Gateway requires `cms:read` but service requires `cms:publish` for write | block unless route split or metadata fixed |
| Account role grants unknown scope | block account release |
| Service policy references scope not in catalog | block service release |
| UI shows publish button but no route/action exists | block UI release or mark feature hidden |
| Route exists in gateway but not OpenAPI/docs | block production route deployment |

## Release Governance

Authorization changes are production-impacting.

Add release class `authz_policy` for:

- adding, removing, or renaming scopes
- changing role-to-scope bundles
- loosening gateway route requirements
- changing service resource authorization
- changing asset grant semantics
- changing sensitive field visibility
- adding admin screens that call protected operations
- changing emergency denylist behavior

Release evidence:

- policy diff
- affected routes/actions
- role bundle diff
- generated token fixture changes
- gateway policy comparison
- service authorization test output
- object-level authorization test output
- field-level redaction test output
- audit/metrics behavior for important denials
- rollback or roll-forward plan

Tightening access can still be breaking for admins and integrations. Treat it as `authz_policy`, even when it improves security.

## Testing Requirements

Unit tests:

- scope parser rejects malformed values
- role bundle expansion is deterministic
- policy registry has no duplicate action ids
- unknown action denies
- missing scope denies
- unknown scope does not grant access
- resource status checks deny draft/private/deleted/infected/scan-failed resources
- field-level redaction removes sensitive fields

Contract tests:

- OpenAPI route auth metadata matches docs/api summaries
- gateway route policy matches OpenAPI route metadata
- generated clients preserve `401`, `403`, `409`, and `422` handling
- admin UI capability map uses known scopes only

Integration tests:

- client-supplied trusted headers are stripped
- protected upstream rejects missing trusted headers
- valid token missing scope returns `403`
- role downgrade revokes refresh token family and new access token loses scope
- old access token expires naturally within configured lifetime
- emergency denylist blocks affected `jti` when enabled
- public object id probing returns `404` for non-public content/assets
- admin object id probing cannot access disallowed resource classes
- asset public download requires visibility, grant, clean scan, and ready processing
- internal caller not in route allowlist receives `caller_not_allowed`
- notification/audit/internal command cannot be called from public ingress

Smoke tests:

- `www.alive.org.tw/api/home` works without JWT
- `www.alive.org.tw/api/admin/content` returns `401` without JWT
- valid `cms:read` token can read admin list
- valid `cms:read` token cannot publish
- valid `cms:publish` token cannot manage account users
- public `/priv/*` is blocked before upstream
- `account.alive.org.tw` account admin route requires `account:admin`

## Observability And Audit

Metrics:

- `authz_decision_total{service,action,decision,reason}`
- `authz_denied_total{service,action,reason}`
- `gateway_authz_denied_total{route_id,reason}`
- `service_authz_missing_trusted_header_total{service,route}`
- `asset_grant_denied_total{namespace,reason}`
- `sensitive_field_redacted_total{service,field_class}`

Logs:

- Include request id, route id, action, decision, reason, actor type, resource type, and resource id hash where needed.
- Do not log raw tokens, cookies, email, phone, LINE ids, Blob/SAS URLs, or sensitive content.
- Avoid logging full authorization context when it includes personal data.

Audit:

- Protected writes are audited on success and important denial.
- Sensitive audit reads are audited.
- Role and scope changes are account-domain audit events.
- Public probing denials are metrics-first; audit only when rate, severity, or admin relevance justifies it.

## Future External PDP Trigger

Consider OPA, Cedar, or another policy engine only when one or more are true:

- Many services duplicate complex ABAC policy.
- Future member/group/pastoral domains need delegated permissions or hierarchical relationships.
- Policy owners need reviewable non-code policy changes.
- Audit requires explainable policy decisions beyond route/scope/resource checks.
- Multiple frontend/backoffice apps need the same dynamic authorization model.

Even then:

- `account-api` still owns identity and role assignment.
- Domain services still own resource facts.
- The external PDP must not cross-query service databases.
- Services must fail closed if the PDP is required and unavailable.
- Static route and service allowlist checks remain in gateway/services.

## Anti-Patterns

Do not:

- trust gateway scope as sufficient for object access
- authorize only in frontend UI
- put email/display name/profile fields in access tokens for authorization convenience
- add `admin` or `superuser` as a magic bypass in service code
- use one shared `cms.admin` check for every operation forever
- let `account.admin` imply CMS publish
- let `cms.admin` imply account administration
- expose `/priv/*` through public gateway for convenience
- use route path prefixes as the only policy source
- log raw denied request bodies to debug authorization
- solve v1 policy drift by adding a central authorization service before service-local checks are correct

## Acceptance Criteria

- Roles, scopes, permissions, grants, and policies have distinct meanings.
- `account-api` owns role assignment and token claims; feature services do not query account tables per request.
- `api-gateway` performs local JWT and route-level scope checks without per-request account introspection.
- Backend services enforce domain/resource authorization for protected operations.
- Public reads and search cannot expose draft, private, restricted, deleted, infected, scan-failed, stale, or unauthorized data.
- Asset downloads require visibility, grants, scan status, processing status, and lifecycle checks.
- Internal `/priv/*` routes use route-specific caller allowlists and command policy.
- OpenAPI, gateway policy, service policy, docs, role bundles, and UI capability maps have drift checks.
- Authorization changes are release class `authz_policy` with policy diff, tests, and rollback or roll-forward evidence.
- Important denials and protected writes have metrics/audit behavior without leaking sensitive data.
