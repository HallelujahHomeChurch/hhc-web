# HHC Platform API Standards Design

## Purpose

This spec defines the shared HTTP API rules for HHC platform services. It keeps public, admin, and internal APIs consistent without forcing every domain into one deployable service.

It applies to:

- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`
- future `engagement-api`, `event-api`, `member-api`, `group-api`, `pastoral-care-api`, `donation-api`, and `search-api`
- `account-api` for non-OIDC JSON APIs where OAuth/OIDC standards do not prescribe the response shape

Domain-specific contracts still live in `docs/api/*.md`.

OpenAPI ownership, generated client boundaries, compatibility checks, gateway policy comparison, fixture strategy, and contract review workflow are defined in `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

Event envelope, event JSON Schema ownership, compatibility, replay, privacy classification, and future AsyncAPI adoption criteria are defined in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.

Internal service identity, `/priv/*` route authorization, caller app-id allowlists, idempotency, and confused-deputy controls are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Authorization policy, route/action metadata, scope catalog, resource-level authorization, field-level response policy, and policy drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Cross-service query ownership, synchronous call budgets, consumer-owned read models, and gateway no-business-composition rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

Public projection versioning, Redis keys, ETags, cache headers, publish/unpublish invalidation, sitemap refresh, and LINE bot consistency rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.

## Core Decision

Use REST-style JSON APIs with a shared response envelope, stable error codes, explicit idempotency, and service-owned OpenAPI documents.

Rejected alternatives:

- One monolithic OpenAPI for every service: easier to browse, but weakens service ownership and makes independent deploys harder.
- Each service invents its own response format: fast at first, but creates frontend/client/test inconsistency.
- GraphQL for v1: flexible, but unnecessary for the current website/CMS surface and less aligned with gateway route policy and simple cache behavior.

## Hosts And Paths

Host rules:

| Host | Purpose |
| --- | --- |
| `www.alive.org.tw` | public website and every non-account API path |
| `admin.alive.org.tw` | admin UI only |
| `account.alive.org.tw` | account UI/API/OIDC/JWKS |

Rules:

- Do not create or use `api.alive.org.tw`.
- Public and admin feature APIs live under `https://www.alive.org.tw/api/*`.
- Admin APIs use `/api/admin/*`.
- Internal service APIs use `/priv/*` and are not publicly exposed.
- Provider callbacks, when needed, use signed public callback routes under `/api/*` through gateway.
- Gateway route policy must choose one upstream owner per business route. Gateway must not compose response bodies from multiple backend services.

Do not add `/api/v1` by default. Prefer additive evolution. Add a version segment only when a breaking change cannot be avoided.

## Response Envelope

JSON API responses use:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Failures use:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_123"
  },
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed",
    "details": {
      "fields": [
        {
          "path": "locales[0].title",
          "code": "required",
          "message": "title is required"
        }
      ]
    }
  }
}
```

Rules:

- `data` is never omitted.
- `meta` is never omitted.
- `error` is `null` for success.
- `error.code` is stable and machine-readable.
- `error.message` is safe for user display only when the caller context allows it.
- Internal dependency details stay in logs, not API responses.
- Binary download responses do not use the JSON envelope on success. Error responses for binary routes should still use the JSON envelope when possible.

## Meta Fields

Allowed `meta` fields:

| Field | Meaning |
| --- | --- |
| `requestId` | gateway or service request id |
| `correlationId` | multi-service workflow id |
| `locale` | locale used for the response |
| `fallbackLocale` | returned only when fallback happened |
| `pagination` | list pagination metadata |
| `version` | projection or resource version when useful |
| `cache` | cache state such as `hit`, `miss`, or `stale` when useful for diagnostics |
| `deprecation` | deprecation metadata for routes being phased out |

Do not put secrets, raw tokens, internal service URLs, Blob URLs, or provider identifiers in `meta`.

## Error Code Catalog

Use these common error codes unless a domain-specific code is justified.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `bad_request` | 400 | malformed request, invalid query, invalid JSON |
| `unauthenticated` | 401 | missing or invalid access token |
| `forbidden` | 403 | valid identity lacks permission |
| `not_found` | 404 | missing resource or resource not visible to caller |
| `method_not_allowed` | 405 | method not allowed for route |
| `conflict` | 409 | state conflict, duplicate unique value, publish-state conflict |
| `idempotency_conflict` | 409 | same idempotency key used with different payload |
| `precondition_required` | 428 | route requires `If-Match` or version precondition |
| `precondition_failed` | 412 | `If-Match` or version check failed |
| `payload_too_large` | 413 | request/upload exceeds configured limit |
| `unsupported_media_type` | 415 | unsupported content type or upload MIME |
| `validation_failed` | 422 | domain validation failed with field details |
| `rate_limited` | 429 | gateway or service rate limit |
| `dependency_unavailable` | 503 | required dependency unavailable |
| `temporarily_unavailable` | 503 | service is healthy but cannot currently process request |
| `internal_error` | 500 | unexpected server error |

Domain APIs may define more specific `error.code` values, but they should map to the closest common HTTP status and be documented in that service contract.

## Request IDs And Correlation

Headers:

```text
X-HHC-Request-ID: req_123
X-HHC-Correlation-ID: corr_123
traceparent: 00-...
```

Rules:

- Gateway creates `X-HHC-Request-ID` if missing.
- Services propagate request id to downstream calls.
- Multi-step workflows should use a correlation id across service calls and outbox events.
- Logs, audit events, and notification messages should carry request id and correlation id when available.
- Public clients may send request id for support correlation, but gateway may replace invalid values.

## Pagination

Use page pagination for low/medium-volume public and admin lists:

```text
GET /api/news?page=1&pageSize=10
```

Response metadata:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 42,
    "totalPages": 5
  }
}
```

Use cursor pagination for high-volume or append-only streams:

```text
GET /priv/audit/events?from=2026-07-01T00:00:00Z&to=2026-07-31T23:59:59Z&pageSize=100&cursor=abc
```

Response metadata:

```json
{
  "pagination": {
    "pageSize": 100,
    "nextCursor": "def"
  }
}
```

Rules:

- Default `pageSize` is 20 unless the contract says otherwise.
- Max public/admin `pageSize` is 100.
- Max audit/internal stream `pageSize` is 500 unless restricted by service config.
- `page` is one-based.
- Sorting must be documented per endpoint.
- Unbounded list responses are not allowed.

## Filtering And Sorting

Rules:

- Query parameter names use camelCase.
- Filters must be allowlisted per endpoint.
- Sort values use field names with optional `-` prefix for descending, for example `sort=-publishedAt`.
- Unsupported filters or sort fields return `bad_request`.
- Avoid exposing internal column names that are not part of the API contract.

## Dates, Times, And Locales

Date/time rules:

- Use RFC 3339 timestamps with timezone, preferably UTC, for instants.
- Use `YYYY-MM-DD` for date-only church domain values such as bulletin issue date.
- Do not return ambiguous local times without timezone.

Locale rules:

- Supported v1 locales are `zh-Hant`, `zh-Hans`, and `en`.
- Default locale is `zh-Hant`.
- Detail endpoints should not silently fallback unless `meta.fallbackLocale` is present.
- Future locales require frontend locale registry, CMS validation, sitemap/SEO alternates, and admin translation UI support.

## Idempotency

Mutating routes that can create side effects should accept:

```text
Idempotency-Key: caller-generated-key
```

Internal commands may also include `idempotencyKey` in the JSON body when that is easier for outbox workers, but the service must define the canonical key source.

Rules:

- Same idempotency key and same canonical payload returns the original result or an accepted duplicate status.
- Same idempotency key and different canonical payload returns `idempotency_conflict`.
- Idempotency records should expire after a service-defined retention window.
- Internal side-effect commands must be idempotent.
- Publish/unpublish, asset grants, notification send, audit append, and provider callback processing must be retry-safe.

## Optimistic Concurrency

Resources that admins edit should expose a version:

```json
{
  "id": "content_123",
  "version": 7
}
```

Mutating updates should use either:

```text
If-Match: "7"
```

or an explicit body field:

```json
{
  "expectedVersion": 7
}
```

Rules:

- Missing required precondition returns `precondition_required`.
- Version mismatch returns `precondition_failed`.
- Publish/unpublish should check expected state or version.
- Public projection version is separate from draft resource version.

## HTTP Headers

Common request headers:

| Header | Purpose |
| --- | --- |
| `Authorization` | bearer access token for protected public/admin routes |
| `Idempotency-Key` | retry-safe mutation key |
| `If-Match` | optimistic concurrency |
| `X-HHC-Request-ID` | request correlation |
| `X-HHC-Correlation-ID` | workflow correlation |
| `Content-Type` | `application/json` for JSON requests |

Trusted upstream headers from gateway:

- `X-HHC-User-ID`
- `X-HHC-Roles`
- `X-HHC-Scopes`
- `X-HHC-Token-ID`
- `X-HHC-Session-ID`
- `X-HHC-Request-ID`
- `X-HHC-Auth-Provider`

Services must reject protected operations when expected trusted headers are missing.

## Caching

Detailed projection and cache invalidation rules live in `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.

Public reads:

- May use Redis and CDN cache.
- Must include stable invalidation or version-bump behavior.
- Should use `Cache-Control` appropriate to the route.
- Can expose `ETag` for projection responses when useful.

Admin reads and writes:

- Use `Cache-Control: no-store`.
- Must not be CDN-cacheable.

Internal commands:

- Not cacheable.

Asset downloads:

- Public asset downloads can be cacheable after scan-clean and ready.
- Do not expose Blob URLs or SAS URLs.
- Revocation-sensitive routes should use shorter TTLs or authenticated checks.

## Rate Limiting

Gateway owns coarse public rate limits.

Detailed route classes, service-owned quotas, Redis counter usage, abuse metrics, and `429` versus `quota_exceeded` behavior are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

Services may add domain-specific limits for:

- upload sessions
- notification send commands
- provider callbacks
- account login/token endpoints
- audit queries

Rate-limited responses use:

```text
HTTP 429
Retry-After: 60
```

and error code `rate_limited`.

## Versioning And Deprecation

Prefer additive changes:

- add optional fields
- add new endpoints
- add enum values only when old clients can ignore them
- keep old fields until clients migrate

Breaking changes require:

- a new route version or new route name
- migration window
- deprecation notice
- rollout plan and client update plan

Optional response headers for deprecation:

```text
Deprecation: true
Sunset: Wed, 31 Dec 2026 00:00:00 GMT
Link: <https://www.alive.org.tw/docs/api-migration>; rel="deprecation"
```

Do not introduce `/api/v1` just to look conventional.

## OpenAPI

Each service that exposes HTTP routes must publish OpenAPI:

```text
docs/openapi/{service}.openapi.yaml
```

Required:

- shared envelope schemas
- common error schemas
- auth requirements
- request/response examples
- pagination schemas
- idempotency header when used
- known error codes per route

OpenAPI should be used for:

- frontend TypeScript client generation where practical
- contract tests
- API review
- gateway route policy comparison

Detailed generation and compatibility rules follow `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

OpenAPI is for HTTP request/response contracts. Integration events use the event contract governance document's JSON Schema rules; AsyncAPI is introduced only when a broker or multiple independent event consumers make it useful.

## Internal API Rules

Detailed internal-route implementation requirements live in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Internal `/priv/*` routes:

- require Dapr/mTLS/app-id service identity
- use app-id allowlists
- use the same JSON envelope unless a streaming/binary route requires otherwise
- must be idempotent when side effects occur
- must propagate request id and correlation id
- must not be exposed through public gateway

Internal APIs do not trust browser JWT headers. If user context is needed, the calling service passes a sanitized user context as part of the command contract after it has authorized the action.

## Security And Privacy

Never return or log:

- access tokens
- refresh tokens
- authorization headers
- cookies
- provider API keys
- Blob SAS URLs
- raw notification bodies
- raw request bodies containing sensitive data
- sensitive audit metadata unless caller is explicitly authorized

Error responses should avoid confirming whether a hidden/private resource exists. Return `not_found` when visibility rules require it.

## Tests

Every service should test:

- envelope shape for success and failure
- common error code mapping
- validation error field details
- pagination bounds
- idempotency same-payload retry
- idempotency conflict
- optimistic concurrency success/failure where applicable
- request id propagation
- auth header stripping/trusted header requirements
- OpenAPI contract validity

Gateway and integration tests should verify:

- public route works without JWT
- admin route requires JWT
- missing scope maps to `403 forbidden`
- rate limit maps to `429 rate_limited`
- binary asset error responses do not leak Blob/SAS URLs
