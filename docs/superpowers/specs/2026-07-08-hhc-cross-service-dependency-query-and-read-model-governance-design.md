# HHC Cross-Service Dependency, Query, And Read Model Governance Design

## Purpose

This spec defines how HHC services depend on each other without becoming a distributed monolith. It covers synchronous calls, asynchronous side effects, cross-service queries, read models, projection ownership, anti-corruption adapters, and dependency tests.

It exists because the platform intentionally starts with a pragmatic service set:

- `api-gateway`
- `account-api`
- `hhc-web`
- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`
- `hhc-line-function-bot`

Future services such as `engagement-api`, `event-api`, `member-api`, `group-api`, `pastoral-care-api`, `donation-api`, and `search-api` should be added only when their split trigger is met. When they are added, the platform needs repeatable rules for query composition and data duplication.

This complements:

- `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`

External alignment:

- Microsoft Azure Architecture Center data considerations for microservices: service-owned data, no direct cross-service table access, source-of-truth ownership, and event-driven materialized views.
- Microsoft Azure Materialized View pattern: precomputed query views are disposable and rebuildable from source data.
- Microsoft Azure Anti-Corruption Layer pattern: services should translate external/service-specific models at the boundary.
- Microsoft microservice communication guidance: minimize synchronous chains and prefer asynchronous integration for cross-service work.

## Core Decision

Use service-owned data plus explicitly owned read models.

Rules:

- A service is the source of truth for its own schema and domain facts.
- Services must not query another service's PostgreSQL schema, Redis keys, Blob paths, or private tables directly.
- The gateway routes and verifies. It does not compose business data.
- `hhc-web-api` is the website product backend and CMS core. It is not a general-purpose platform aggregator.
- Cross-service public reads should use published projections or consumer-owned read models when eventual consistency is acceptable.
- Synchronous service calls are allowed only for immediate decisions or command acceptance that cannot be safely deferred.
- Side effects use outbox workers and idempotent `/priv/*` commands.
- Every duplicated cross-service datum must have a declared source of truth, schema version, provenance, staleness policy, rebuild path, and deletion/redaction rule.

## Integration Styles

| Style | Use When | Avoid When | HHC Examples |
| --- | --- | --- | --- |
| Local service query | Data belongs to the same bounded context | Data belongs to another service | `hhc-web-api` reads CMS source and public projections |
| Public API read | Consumer needs public website data | Consumer needs drafts, private data, or admin state | `hhc-line-function-bot` reads latest bulletin through `/api/bulletins/latest` |
| Internal synchronous command | Caller needs immediate accept/reject from owning service | Result can be eventually consistent | `hhc-web-api` asks `asset-api` to create an upload session |
| Outbox side effect | Work can finish after request commit | Caller must know result before returning | audit append, notification send, public asset grant workflow |
| Consumer-owned read model | One product surface needs fast cross-domain display | Strong consistency or hidden data is required | future home projection showing event availability summary |
| Provider-owned query API | Query is native to provider domain and reused by multiple consumers | Query shape is only for one screen in another product | `audit-log` query API, future `asset-api` asset manager search |
| Dedicated query/search service | Cross-service indexing, external engine, or independent query scaling is justified | V1 website-only search is enough | future `search-api` after extraction triggers |

## Synchronous Call Rules

Synchronous calls are allowed when all are true:

1. The caller cannot complete its command without an immediate decision from the callee.
2. The callee owns the decision.
3. The call has a bounded timeout.
4. The caller handles `dependency_unavailable` without corrupting local state.
5. The route has an idempotency strategy if it can create side effects.
6. The dependency appears in the service dependency register and release manifest.

Allowed v1 synchronous calls:

| Caller | Callee | Route Class | Reason |
| --- | --- | --- | --- |
| `hhc-web-api` | `asset-api` | `/priv/assets/upload-sessions` | asset upload target must be issued by asset owner |
| `hhc-web-api` | `asset-api` | `/priv/assets/{assetId}/public-url` | projection needs stable public gateway URL |
| `hhc-web-api` worker | `asset-api` | `/priv/assets/{assetId}/grants` | grant-before-visible publication workflow |
| `account-api` | `notification-api` | `/priv/notifications/send` | account email is accepted as an internal notification command |
| `hhc-web-api` worker | `notification-api` | `/priv/notifications/send` | optional publish/contact notification |
| service outbox worker | `audit-log` | `/priv/audit/events` | durable audit append |
| `hhc-web-api` | `audit-log` | `/priv/audit/query` | admin audit screen after `hhc-web-api` verifies user scope |

Disallowed patterns:

- Gateway calls multiple services to build one response.
- Browser calls `/priv/*` or receives internal service URLs.
- A public request enters service A, then service A calls service B, then service B calls service C before responding.
- Service A reaches into service B database to avoid an API.
- A shared Go package exports domain models that multiple services persist directly.
- A service synchronously sends email, appends audit, refreshes search, and grants assets in one request transaction.

## Dependency Chain Budget

Default budgets:

| Request Class | Allowed Runtime Shape |
| --- | --- |
| Public content read | gateway -> one backend -> local PostgreSQL/Redis only |
| Public asset download | gateway -> `asset-api` -> Blob/metadata/grant check |
| Admin read | gateway -> one backend -> local PostgreSQL/Redis; optional one provider query when the screen is explicitly provider-owned |
| Admin write | gateway -> owning backend -> local transaction; outbox for side effects |
| Internal worker command | worker -> one callee service; retry and idempotency required |
| Provider webhook | gateway -> owning backend; signature verification before state change |

Exceptions require design review. The review must document:

- why a read model cannot satisfy the use case
- consistency requirement
- timeout budget
- fallback behavior
- circuit breaker behavior
- operational alert
- contract compatibility test

## Query Ownership

### Local Query

Use local query when all data belongs to one bounded context.

Examples:

- `hhc-web-api` public content and CMS admin lists.
- `asset-api` asset metadata, grants, download eligibility, and asset manager search.
- `audit-log` audit event query.
- `notification-api` notification delivery status.

### Product Backend Composition

Use product backend composition when a single product surface needs a small amount of data from one provider and the provider owns access control.

Rules:

- Composition belongs in the product backend, not gateway.
- The product backend authorizes the user action before calling provider APIs.
- The provider still authorizes the caller app id and route permission.
- The product backend returns its own response model, not the provider's internal model.
- Provider data must not be cached unless the provider contract allows it.

V1 example:

- `hhc-web-api` may expose an admin audit screen by querying `audit-log` after checking `audit:read`.
- `hhc-web-api` must not join audit rows with `hhc_web` tables in SQL. It can decorate results with local resource labels only after the audit query returns.

### Consumer-Owned Read Model

Use a consumer-owned read model when the same UI repeatedly needs cross-domain data and eventual consistency is acceptable.

Rules:

- The read model belongs to the consumer service that serves the screen.
- The consumer subscribes to provider events or receives provider projection snapshots.
- Provider events must follow the event contract, schema, compatibility, replay, and classification rules in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.
- The read model stores the minimum public or authorized subset needed for the query.
- It stores source service, source id, source version, event id, schema version, and last seen timestamp.
- It is rebuildable from provider APIs, provider export, or replayable events.
- It must not become a second source of truth for commands.

Future examples:

- If homepage needs event capacity badges, `event-api` should publish a public-safe `event_public_summary.updated` event or expose a small summary API. `hhc-web-api` can project only fields needed for the home/event page.
- If search spans pages, bulletins, events, and sermons, `search-api` owns an index of public-safe search documents emitted by owning services.
- If member-only dashboard needs household, group, and event registration summaries, create a dedicated member product backend or member read model after privacy and scope rules are defined.

### Dedicated Query Service

Create a dedicated query or search service only when at least one trigger is true:

- queries span multiple source services and cannot be owned by one product backend
- query volume or latency needs independent scaling
- an external engine such as OpenSearch becomes necessary
- multiple consumers need the same cross-domain query contract
- reporting/export retention differs from source services
- operational ownership is clearer as a separate service

Do not create `query-api`, `public-query-api`, or GraphQL in v1 just to make data fetching convenient. `hhc-web-api` remains the public website backend for website data.

## Read Model Data Contract

Every read model table or index that copies data from another service must include:

```text
source_service
source_resource_type
source_resource_id
source_version
source_event_id
source_schema_version
projection_version
visibility
data_classification
last_seen_at
deleted_at
redacted_at
rebuild_batch_id
payload_json
```

Rules:

- `payload_json` contains query-ready data only.
- Store public-safe URLs, not Blob URLs or SAS URLs.
- Store asset ids and stable gateway URLs only when grants are active or the response can tolerate pending state.
- Store no refresh tokens, access tokens, upload URLs, provider secrets, raw notification bodies, payment provider payloads, pastoral narrative notes, or hidden member data.
- Redaction and deletion events from source services must remove or blank copied fields according to data classification rules.
- If a source service retracts public visibility, the read model must stop serving the copied data before optional cleanup completes.

## Data Freshness Classes

| Class | Max Staleness | Use Case | Required Behavior |
| --- | --- | --- | --- |
| Immediate | request transaction | admin writes, payment checkout, asset upload session | use owning service command |
| Near-real-time | seconds to 1 minute | latest bulletin, homepage published content, event availability badge | outbox event or projection refresh with alert on lag |
| Short stale OK | minutes | public lists, search snippets, sitemap cache | versioned projection, ETag, rebuild path |
| Long stale OK | hours/days | analytics/reporting exports | batch job with source timestamp |
| Never duplicate | none | secrets, refresh tokens, raw payment data, pastoral notes | query owner only with strict authorization |

## Anti-Corruption Adapters

Each cross-service client must be isolated behind a local adapter package.

Go layout:

```text
internal/integrations/assetapi/
internal/integrations/notificationapi/
internal/integrations/auditlog/
internal/integrations/accountapi/
```

Adapter rules:

- Generated OpenAPI client types stay inside the adapter boundary.
- Domain packages use local interfaces and local DTOs.
- Provider error codes are mapped to local domain errors.
- Provider retry policy is centralized in the adapter.
- Request id, correlation id, idempotency key, and caller app id are propagated by the adapter.
- Provider-specific fields do not leak into public/admin response models unless explicitly part of the contract.

This protects service internals from provider contract churn and keeps service boundaries explicit.

## Current Service Dependency Register

| Service | Depends On | Mode | Notes |
| --- | --- | --- | --- |
| `api-gateway` | `account-api` JWKS | cached pull | startup/refresh only; no token introspection per request |
| `api-gateway` | backend services | route only | no business data composition |
| `hhc-web` | `hhc-web-api` public/admin APIs | HTTPS through gateway | no Next API routes for platform APIs |
| `hhc-web` | `account-api` browser/OIDC routes | HTTPS through gateway/account host | account domain owns auth UI/API |
| `hhc-web-api` | `asset-api` | synchronous command and worker command | upload sessions, public URLs, grants |
| `hhc-web-api` | `notification-api` | outbox worker command | optional contact/publish notifications |
| `hhc-web-api` | `audit-log` | outbox append; protected query when needed | admin scope checked before query |
| `asset-api` | Azure Blob Storage | provider adapter | bytes only; no business meaning |
| `asset-api` | `audit-log` | outbox append | security and lifecycle events |
| `notification-api` | email provider | provider adapter | v1 email first |
| `notification-api` | `audit-log` | outbox append | delivery lifecycle audit |
| `account-api` | `notification-api` | internal command | verification/reset/invite email |
| `account-api` | `audit-log` | outbox append | admin identity lifecycle |
| `hhc-line-function-bot` | `hhc-web-api` | public HTTPS read | weekly bulletin download |
| `hhc-line-function-bot` | `asset-api` | internal command for future LINE file storage | only for LINE-owned file namespaces |

Every new dependency must update this register or a service-local equivalent, plus OpenAPI/client and release manifest evidence.

The service catalog is the higher-level owner of the finite v1 deployable set, reusable capability boundaries, allowed caller matrix, and service admission/extraction gates. This dependency register is the runtime call-level view.

## Route And Data Flow Examples

### Public Home Page

```text
browser -> www.alive.org.tw -> api-gateway -> hhc-web-api -> Redis/PostgreSQL public projections
```

No cross-service calls should occur in the request path. If home needs asset URLs, they should already be in the active public projection after grant-before-visible publish.

### Weekly Bulletin From LINE Bot

```text
LINE user -> hhc-line-function-bot -> GET /api/bulletins/latest -> hhc-web-api public projection
```

The response includes a stable `downloadUrl` under `www.alive.org.tw/api/assets/public/{assetId}`. The bot does not call Blob or construct asset URLs.

### Bulletin Publish With Required PDF

```text
admin -> gateway -> hhc-web-api
hhc-web-api transaction -> publication workflow + outbox
worker -> asset-api grant
worker -> hhc-web-api source recheck
worker -> public projection update
worker -> audit-log append
```

The public latest bulletin does not move until the PDF grant is active.

### Admin Audit Screen

```text
admin -> gateway -> hhc-web-api -> audit-log query
```

`hhc-web-api` checks `audit:read`, calls `audit-log` through `/priv/audit/*`, maps the result to an admin response, and applies `Cache-Control: no-store`.

### Future Event Registration

```text
public event content -> hhc-web-api projection
registration command -> event-api
confirmation email -> notification-api through event-api outbox
audit append -> audit-log through event-api outbox
```

The event public content and the registration state remain separate. If the event page needs capacity state, `event-api` owns the source and either serves a small public-safe availability endpoint or publishes a summary event consumed by `hhc-web-api` projection.

### Future Cross-Service Search

```text
source services -> public-safe search document events -> search-api index -> GET /api/search
```

`search-api` never indexes drafts or private records by reading service databases. Source services emit public-safe documents or searchable snapshots.

## Failure And Degraded Behavior

| Failure | Required Behavior |
| --- | --- |
| Provider service down during admin write side effect | commit local source only if side effect is outbox-backed; worker retries |
| Provider service down during required immediate command | return `dependency_unavailable`; do not partially commit local state |
| Consumer read model lagging | expose lag metric; serve previous safe projection if allowed; alert when beyond freshness class |
| Provider event duplicated | consumer dedupes by event id and source version |
| Provider event arrives out of order | ignore stale source version; request reconciliation if gap detected |
| Read model rebuild fails | keep previous safe version; dead-letter rebuild job; alert |
| Source record redacted/deleted | remove copied sensitive fields before serving query again |
| Gateway route accidentally exposes `/priv/*` | gateway blocks by prefix; staging smoke and route policy comparison must fail |

## Testing Requirements

Static checks:

- No service migration references another service schema.
- No service uses another service Redis key prefix.
- No public/admin OpenAPI route exposes `/priv/*`, internal service URLs, Blob URLs, or SAS URLs.
- No gateway policy maps `/priv/*` or `/api/priv/*` to an upstream.
- Service dependency register is updated when a new internal client package is added.

Contract tests:

- Provider OpenAPI compatibility check.
- Generated or handwritten client compile check.
- Adapter error mapping tests.
- Idempotency tests for side-effect commands.
- Event schema compatibility tests when read models consume provider events.

Integration tests:

- Public home/news/bulletin reads do not call other services at request time.
- Admin publish uses outbox for audit, notification, and grants.
- `asset-api` outage during required PDF grant keeps latest bulletin on previous published projection.
- `audit-log` outage retries audit append without losing the business write.
- Read model ignores stale or duplicate provider events.
- Source deletion/redaction removes copied read model data.

Fault tests:

- Callee timeout maps to `dependency_unavailable` or queued retry according to integration style.
- Circuit breaker opens after configured failures.
- Retry policy does not retry non-idempotent commands.
- Correlation id is visible across caller log, outbox row, callee log, and audit event.

## Observability

Each service with outbound dependencies must emit:

- dependency latency by callee and route group
- dependency error count by code
- circuit breaker state
- outbox pending/retry/dead-letter count by destination
- read model lag by source service and projection type
- read model rebuild count and failure count
- stale projection served count

Dashboards should show the dependency graph for production-impacting services:

```text
api-gateway
  -> hhc-web-api
  -> asset-api
  -> account-api
hhc-web-api
  -> asset-api
  -> notification-api
  -> audit-log
account-api
  -> notification-api
  -> audit-log
asset-api
  -> audit-log
notification-api
  -> audit-log
```

## Review Checklist For A New Dependency

Before adding any cross-service dependency:

1. Identify the source of truth.
2. Decide whether the use case needs immediate consistency or can be eventual.
3. Choose integration style from the matrix.
4. Define timeout, retry, idempotency, and fallback.
5. Define authorization: user scope, caller app id, route ACL, and confused-deputy controls.
6. Define payload classification and fields copied into any read model.
7. Define OpenAPI/event schema and compatibility gate.
8. Define tests for provider down, duplicate event, stale event, and unauthorized caller.
9. Update dependency register, release manifest, runbook, and dashboard.

## What Not To Build In V1

Do not build these as shortcuts:

- `public-query-api`
- generic `query-api`
- platform GraphQL gateway
- shared cross-service database views
- direct SQL joins across service schemas
- central service registry that runtime requests must call to decide dependencies
- gateway business-data aggregation
- cross-service shared domain model package
- data lake/reporting store for operational website reads

These can be revisited only when a concrete post-v1 use case meets the dedicated query/search service triggers.

## Acceptance Criteria

- Each service owns its schema and does not cross-query another schema.
- Gateway is not a business data composer.
- Public website reads use `hhc-web-api` projections or service-owned public APIs, not synchronous fan-out.
- Side effects use outbox and idempotent internal commands.
- Cross-service duplicated data has source, version, classification, staleness, rebuild, and deletion rules.
- Consumer-owned read models are explicitly allowed only for product-owned queries with eventual consistency.
- Dedicated query/search services require documented triggers.
- Every new dependency updates the dependency register and release evidence.
- Adapter packages isolate generated/provider models from service domain models.
