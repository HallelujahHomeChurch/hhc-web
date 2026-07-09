# HHC Web API Design

## Purpose

`hhc-web-api` is the backend for the main website and CMS. It serves public website reads, admin CMS workflows, public projections, weekly bulletin publishing, and orchestration with reusable platform services.

It replaces the need for a separate `public-query-api`, `cms-api`, or `bulletin-api` in v1. Those names describe responsibilities inside `hhc-web-api`, not separate deployable services yet.

Shared envelope, error, pagination, idempotency, optimistic concurrency, locale, cache, and OpenAPI rules follow `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Public projection versioning, Redis keys, ETags, cache headers, publish/unpublish invalidation, sitemap refresh, and LINE bot consistency rules follow `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.

Publication workflow consistency, grant-before-visible publish, stale side-effect cancellation, emergency takedown, and reconciliation rules follow `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

Canonical URLs, sitemap data, locale alternates, slug redirects, and public route metadata follow `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

Accessibility/media metadata in public projections follows `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

Site settings, navigation, footer links, social links, contact display, public layout projection, and runtime-config separation follow `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

OpenAPI ownership, generated client boundaries, contract compatibility gates, and consumer fixture strategy follow `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

Cross-service dependency-chain budgets, query ownership, consumer-owned read models, and anti-corruption adapter rules follow `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

CMS editorial workflow, admin console behavior, preview, publish/unpublish, localization, asset picker, and module-specific admin rules follow `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`.

CMS admin preview, draft rendering, revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention follow `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

Structured content block schema, renderer contract, inline link validation, body asset references, schema versioning, and no-raw-HTML rules follow `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Public/admin search ownership, index source rules, CJK tokenization, result safety, and `search-api` extraction triggers follow `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

CMS revision snapshots, restore to draft, rollback publish, and draft/published isolation follow `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

PostgreSQL schema, table ownership, indexes, constraints, projection storage, outbox rows, seed provenance, and migration rules follow `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`.

Content migration and bootstrap rules for current mock data, i18n editorial copy, public assets, seed manifests, public API fixtures, parity tests, and rollback follow `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`.

## Core Decision

Use one `hhc-web-api` service for v1 website content and CMS workflows.

Rejected alternatives:

- Separate `public-query-api`: adds another deployable and contract before there is a separate owner or scaling need. Public reads can be a module and cache policy inside `hhc-web-api`.
- Separate `cms-api`: mostly the same bounded context as the website content source in v1, so splitting it would create coupling without reducing complexity.
- Separate `bulletin-api`: weekly bulletins are a CMS content type plus PDF asset workflow. They do not need an independent service until the bulletin lifecycle becomes a separate product or ownership boundary.

The service can still be modular internally so future extraction is straightforward.

`hhc-web-api` is not a general platform aggregator. It may compose website-owned projections and narrowly scoped provider reads for its own admin screens, but future domains must use provider-owned APIs, consumer-owned read models, or justified dedicated query/search services instead of adding arbitrary synchronous fan-out behind website routes.

## Ownership Boundary

`hhc-web-api` owns:

- Public website content source records.
- CMS draft, publish, unpublish, archive, and preview workflows.
- Admin preview render models for draft, published, and revision previews.
- Structured content block validation and render-ready body projection.
- CMS revision snapshots, restore to draft, and rollback publish workflows.
- Public website read APIs under `www.alive.org.tw/api/*`.
- Admin APIs under `www.alive.org.tw/api/admin/*`.
- Weekly bulletin issue/version metadata.
- Public projections used by the website, sitemap, and LINE bot bulletin download.
- Site-wide editable public layout settings such as navigation, footer links, social links, and contact display.
- Post-v1 public search over published projections and admin CMS search over protected CMS source records.
- SEO metadata and route slugs for CMS-owned pages.
- Domain validation before asking `asset-api` for public grants.
- Outbox events for projection, asset grant, notification, and audit side effects.
- Deterministic seed/import manifests for bootstrapping current `hhc-web` visible content into CMS source records.

It does not own:

- Login, token issue, refresh token rotation, account profile, or JWKS.
- File bytes, virus scan, derivatives, storage paths, or generic file grants.
- Email provider delivery, notification suppression, provider webhooks, or message retries.
- Append-only audit storage.
- LINE conversation state or LINE group file metadata.
- Future member, group, pastoral care, donation, or event-registration domains.

## Route Placement

All non-account public and admin API routes are under `www.alive.org.tw`:

```text
https://www.alive.org.tw/api/*
https://www.alive.org.tw/api/admin/*
```

There is no `api.alive.org.tw`.

`admin.alive.org.tw` is UI only. The admin UI calls protected APIs under `www.alive.org.tw/api/admin/*`.

`account.alive.org.tw` owns account and token APIs. `hhc-web-api` does not validate access tokens by calling `account-api`; it receives trusted identity headers from `api-gateway`.

## Internal Modules

Suggested Go package boundaries:

```text
cmd/hhc-web-api/
internal/http/public/
internal/http/admin/
internal/authz/
internal/content/
internal/bulletins/
internal/site/
internal/preview/
internal/projections/
internal/search/
internal/assets/
internal/notifications/
internal/audit/
internal/outbox/
internal/cache/
internal/db/
internal/config/
internal/seed/
```

Module responsibilities:

| Module | Responsibility |
| --- | --- |
| `http/public` | Public read route handlers, response envelopes, locale parsing |
| `http/admin` | Admin route handlers, request validation, command orchestration |
| `authz` | Trusted header parsing, role/scope checks, route authorization |
| `content` | CMS source model for news, pages, videos, locations, history, legal, home sections |
| `content/blocks` | HHC block AST validation, body asset extraction, render-model conversion |
| `bulletins` | Weekly issue/version lifecycle and PDF publish rules |
| `site` | Site settings, navigation, shared layout projection, external link validation |
| `preview` | Admin-only draft/revision render models, preview warnings, no-store/noindex behavior |
| `projections` | Public read model generation, versioning, sitemap data |
| `search` | Post-v1 public search documents from projections, admin CMS search documents, CJK tokenization, stale-result protection |
| `assets` | Client adapter to `asset-api`; no direct Blob access |
| `notifications` | Client adapter to `notification-api`; no provider logic |
| `audit` | Audit client and event payload builders |
| `outbox` | Reliable side-effect dispatch |
| `cache` | Redis keys, TTL, invalidation, stale behavior |
| `seed` | Idempotent content/bootstrap imports, source checksums, public fixture generation |

Keep module APIs domain-shaped. Do not let route handlers directly manipulate SQL rows for another module.

## Public Read Model

Public routes must read published projections, not draft CMS rows.

Read path:

1. Parse route, locale, pagination, and request id.
2. Check Redis for a projection key.
3. If missing, read `public_projection` from PostgreSQL.
4. Store in Redis with a short TTL and projection version.
5. Return public response envelope.

Public responses must never include:

- draft content
- unpublished content
- archived content
- deleted content
- private asset ids without public grants
- Blob URLs or SAS URLs
- internal workflow state
- admin-only metadata

## Public Projection Keys

Suggested Redis key format:

```text
{env}:hhc-web-api:public:{locale}:{projection}:{version-or-resource}
```

Examples:

```text
prod:hhc-web-api:public:zh-Hant:home:v42
prod:hhc-web-api:public:zh-Hant:bulletins:latest
prod:hhc-web-api:public:zh-Hant:bulletins:2026-07-12
prod:hhc-web-api:public:zh-Hant:news:sample-news
prod:hhc-web-api:public:zh-Hant:sitemap:v42
```

Projection payloads are canonical JSON built by `hhc-web-api`. Redis is a cache, not the source of truth.

## Admin Write Model

Admin writes mutate source tables, then enqueue side effects.

Write path:

1. `api-gateway` validates JWT locally and injects trusted `X-HHC-*` identity headers.
2. `hhc-web-api` verifies required role/scope for the route.
3. Handler validates request body and domain invariants.
4. Domain module updates source tables inside a PostgreSQL transaction.
5. The same transaction writes required outbox events.
6. Outbox workers perform side effects:
   - refresh public projections
   - create/revoke asset grants
   - emit audit events
   - request notification sends when needed
   - invalidate Redis keys

Do not call `asset-api`, `notification-api`, or `audit-log` inside the user-facing write transaction. The transaction should commit local source state and outbox intent only.

Publication workflows that need remote side effects before public visibility use `publication_workflow` plus outbox. The user-facing request may return `202 Accepted`; public APIs continue reading the previous projection until the workflow reaches `public_visible`.

## Publish Flow

Content publish without required public assets:

1. Check `cms:publish`.
2. Validate localized content, slugs, SEO metadata, and required fields.
3. Validate referenced assets are attached and eligible for public visibility.
4. Update source status to `published`.
5. Build or enqueue projection refresh.
6. Enqueue asset public grant commands.
7. Enqueue audit event.
8. Enqueue notification only for explicitly configured publish alerts.
9. Invalidate or version-bump public cache keys.

Content publish with required public assets:

1. Check `cms:publish`.
2. Validate localized content, slugs, SEO metadata, required fields, and required asset eligibility.
3. Create a publication workflow in `waiting_asset_grant`.
4. Enqueue versioned public asset grant commands.
5. Return `202 Accepted` unless the workflow completes inside the request budget.
6. Worker confirms grants, re-checks source version, updates source status to `published`, and creates public projections.
7. Worker cancels or compensates stale grants if a newer unpublish/rollback wins.

Unpublish reverses public exposure:

1. Check `cms:publish`.
2. Update source status to `unpublished`.
3. Remove or refresh public projections.
4. Revoke asset public grants only when no other published content still references the asset.
5. Emit audit event.
6. Invalidate affected public cache keys.

## Weekly Bulletin Flow

Weekly bulletin is a first-class CMS module inside `hhc-web-api`.

Admin flow:

1. Create bulletin issue by `issueDate`.
2. Upload PDF through `asset-api` using namespace `cms.weekly.pdf`.
3. Attach returned `assetId` to a localized bulletin version.
4. Publish after scan status is clean and processing status is ready.
5. `hhc-web-api` creates public projection and asks `asset-api` for a public read grant.
6. Public bulletin APIs return stable gateway download URLs.

Consumer flow:

- Website calls `GET /api/bulletins/latest` or archive routes.
- LINE bot calls the same public routes.
- LINE bot does not receive `asset-api` credentials for public bulletin download.

## Asset Integration

`hhc-web-api` uses `asset-api` for:

- upload session creation for admin uploads
- asset attachment validation
- public read grant create/revoke
- stable public URL resolution
- metadata lookup such as MIME type, size, scan status, and processing status

`hhc-web-api` stores asset references, not file bytes.

For public responses, return:

```json
{
  "assetId": "asset_123",
  "url": "https://www.alive.org.tw/api/assets/public/asset_123",
  "mimeType": "application/pdf",
  "sizeBytes": 1234567
}
```

Do not return Blob URLs, SAS URLs, storage account names, or internal asset service routes.

## Notification Integration

`hhc-web-api` calls `notification-api` only through internal `/priv/notifications/*` routes for approved workflows.

V1 examples:

- admin invite or role-change notice if owned by account/admin workflow
- publish summary notification if explicitly enabled
- future contact form acknowledgement

`hhc-web-api` owns the business decision that a notification should be sent. `notification-api` owns rendering, provider delivery, retries, suppression, and provider callback state.

## Audit Integration

Every protected write, permission denial, asset grant change request, publish/unpublish action, and important validation failure should produce an audit event.

`hhc-web-api` writes audit intent into its local outbox and the worker calls `audit-log`.

Audit metadata follows `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`. Do not include raw request bodies, tokens, provider secrets, or sensitive narrative text.

## Auth And Authorization

`api-gateway` verifies access JWTs locally from cached JWKS and injects trusted headers.

Account token claims, refresh token behavior, JWKS rotation, and browser token handling follow `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

`hhc-web-api` must:

- reject protected routes when trusted identity headers are missing
- enforce roles/scopes for every admin route
- treat public routes as anonymous but published-only
- not call `account-api` for per-request token validation
- not trust browser-provided user, role, or scope headers
- include request id and correlation id in logs and downstream internal calls

`hhc-web-api` may use account user ids from trusted headers as `createdBy`, `updatedBy`, and `publishedBy`.

## API Path Rules

Paths do not need a fixed `/api/public/` prefix. Use feature-shaped public paths:

```text
GET /api/home
GET /api/site-layout
GET /api/news
GET /api/news/{slug}
GET /api/pages/{slug}
GET /api/videos
GET /api/locations
GET /api/history
GET /api/legal/{slug}
GET /api/bulletins/latest
GET /api/bulletins/{issueDate}
GET /api/sitemap-data
```

Protected admin paths use `/api/admin/*`:

```text
GET /api/admin/content
POST /api/admin/content
POST /api/admin/content/{id}/publish
POST /api/admin/content/{id}/unpublish
GET /api/admin/site-settings
PATCH /api/admin/site-settings
POST /api/admin/site-settings/publish
GET /api/admin/preview/content/{id}
GET /api/admin/preview/bulletins/{issueId}
GET /api/admin/preview/site-settings
GET /api/admin/bulletins
POST /api/admin/bulletins
POST /api/admin/bulletins/{issueId}/versions
POST /api/admin/bulletins/{issueId}/publish
```

Internal-only service routes, if added later, must use `/priv/*` and must not be publicly exposed by the gateway.

## PostgreSQL Ownership

`hhc-web-api` owns schema `hhc_web`.

It must not query:

- `asset` schema owned by `asset-api`
- `notification` schema owned by `notification-api`
- `audit` schema owned by `audit-log`
- `account` schema owned by `account-api`

Cross-service reads use APIs, not shared tables. This keeps services independently deployable and prevents hidden coupling.

## Redis Use

Use Redis only for public read cache and short-lived operational cache.

Do not store:

- draft source data as the only copy
- authorization decisions that must survive role changes
- audit events
- notification state
- asset grant truth

Cache invalidation is driven by projection version changes and publish/unpublish outbox events.

## Error Handling

Public routes:

- Return `404` for missing or unpublished resources.
- Return `400` for invalid locale, pagination, or date format.
- Return `503` only when projection storage is unavailable and no cached value is usable.

Admin routes:

- Return `401` when trusted identity is missing.
- Return `403` when role/scope is insufficient.
- Return `409` for publish-state or version conflicts.
- Return `422` for domain validation failures.
- Return `503` when required local dependencies are unavailable.

Do not expose internal service errors directly. Map them to stable API error codes and log internal detail with request id.

## Observability

Metrics:

- public route latency and status
- admin route latency and status
- projection cache hit/miss
- projection refresh duration
- site layout projection refresh duration
- preview render latency and warning count
- outbox backlog age and count
- asset grant command failures
- audit event failures
- notification command failures

Trace propagation:

- Use `X-Request-Id` for client-visible request tracking.
- Use `X-Correlation-Id` for multi-service workflows.
- Pass both to `asset-api`, `notification-api`, and `audit-log`.

## Testing

Unit tests:

- locale validation
- slug validation
- structured content block schema validation
- body asset reference extraction
- role/scope checks
- projection builders
- bulletin publish validation
- site settings link validation
- preview mode/resource authorization
- asset eligibility checks
- cache key generation

Contract tests:

- public API response envelopes
- admin API auth failures
- admin preview response contract
- asset-api client commands
- notification-api client commands
- audit-log client commands

Integration tests:

- projection-only publish creates projection, audit outbox, and cache invalidation
- required-asset publish does not create a public projection until public grant is active
- required-asset publish can return `202 Accepted` and later become public through workflow completion
- stale publish workflow after unpublish is cancelled and does not re-expose content
- unpublish removes projection and revokes unused grants
- restore to draft changes admin source without changing public projection
- rollback publish creates a new public projection version and required asset grants
- latest bulletin returns newest published issue only
- site settings publish creates site layout projection and refreshes affected metadata projections
- preview draft/revision creates no public projection, public Redis key, sitemap entry, ETag pointer, or public asset grant
- structured body blocks publish into render-ready safe projection payloads
- LINE bot can consume public bulletin API without internal credentials

End-to-end smoke tests:

- public website home loads from `www.alive.org.tw/api/home`
- admin can create draft and publish content
- published content appears publicly
- unpublished content disappears publicly
- stable asset URL downloads through gateway route
- draft preview is visible in admin and remains hidden from public routes

## Extraction Triggers

Do not extract a new service just because a module grows files. Extract only when a real boundary appears.

Possible future extractions:

| Candidate | Extract when |
| --- | --- |
| `cms-api` | CMS becomes a product used by multiple frontends or owned by a separate team |
| `public-query-api` | public read traffic, cache topology, or release cadence becomes materially different from CMS writes |
| `bulletin-api` | bulletin workflow gets independent owners, approvals, subscriptions, or external integrations beyond simple publish/download |
| `search-api` | cross-service indexing or external search engine operation is needed |
| `engagement-api` | contact forms, newsletter consent, and inquiry workflows outgrow simple CMS forms |

Until then, keep modules inside `hhc-web-api` and preserve clear interfaces.
