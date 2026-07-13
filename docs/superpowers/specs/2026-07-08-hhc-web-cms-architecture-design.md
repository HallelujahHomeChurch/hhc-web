# HHC Web CMS Architecture Design

## Goal

Build the next HHC web platform around the current public website and a CMS/admin console, using Azure-first Go microservices, PostgreSQL, Redis, and a gateway-first security model.

Implementation-level companion documents:

- `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`
- `docs/runbooks/`
- `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-platform-roadmap.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-frontend-admin-component-roadmap.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`
- `docs/api/*.md`

The first release covers the features visible in `hhc-web` today:

- Public site: multilingual home, news, weekly bulletins, videos, locations, about/history, legal pages, SEO, and sitemap.
- Admin console: content editing, draft/publish workflow, weekly bulletin upload, asset management, and operational CMS screens.
- Identity: existing `account-api` remains the only OIDC/OAuth2, token issuing, refresh/session, role/scope, and JWKS authority; standalone `account-fe` owns the browser login/profile/security UI.
- Gateway: existing `api-gateway` remains the first public gate for UI and API traffic.

Not included in the first release: event registration, member records, pastoral care workflows, groups, donations, full notification center, search engine, or LINE bot business workflows. The backend is still designed so these can reuse the same identity, asset, notification, and content foundations later. The finite v1 service catalog, explicit non-services, caller allowlists, and service admission gates are documented in `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`. Post-v1 split triggers and recommended service boundaries are documented in `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`.

## Non-Negotiable Domain Model

There is no `api.alive.org.tw`.

Public domains:

- `www.alive.org.tw`: public website and every non-account API path.
- `admin.alive.org.tw`: CMS/admin console UI only.
- `account.alive.org.tw`: `account-fe` UI plus account-api-owned APIs, OIDC endpoints, token endpoint, and JWKS.

API paths:

- `https://www.alive.org.tw/api/*`: non-account APIs, using feature-based paths instead of a fixed `/api/public/*` prefix.
- `https://www.alive.org.tw/api/admin/*`: protected CMS/admin APIs.
- `https://www.alive.org.tw/api/assets/*`: asset upload, metadata, and download routes.
- `https://www.alive.org.tw/api/line/webhook/*`: LINE webhook routes, unauthenticated by JWT but method-limited and signature-validated by the LINE service.
- `https://account.alive.org.tw/*`: account login, OIDC, token, user profile, and JWKS APIs only.

All public ingress goes through `api-gateway`. Backend services must not expose direct public ingress.

## Current State

`hhc-web` is a Next.js 16 / React 19 / TypeScript public site. Its feature data is currently typed and mocked inside `src/features/*`, with APIs such as `getNews`, `getLatestWeekly`, `getVideos`, `getLocations`, and `getHistoryTimeline`. It is currently configured with `output: 'export'`. The production CMS-backed cutover should move it to a Next.js server behind `api-gateway` as defined in `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`.

`api-gateway` is an existing Nginx 1.30.3 Alpine reverse proxy deployed to Azure Container Apps. It routes through Dapr service invocation, already knows `www.alive.org.tw`, `admin.alive.org.tw`, and `account.alive.org.tw`, strips client-supplied identity headers, has rate limits/CORS, and currently has no token validation.

The design extends the existing gateway rather than replacing it.

## System Shape

Use a modular microservice architecture with a small set of Go services:

- `api-gateway`: first gate for public ingress, routing, rate limits, CORS, local JWT verification, and trusted identity header injection.
- `account-fe`: account-domain browser login/profile/security console.
- `account-api`: account domain only; OIDC/OAuth2 login, token issuance, user/account APIs, roles/claims source, and JWKS/public key publication.
- `hhc-web-api`: main website backend and API facade for v1; it owns website content modules, admin writes, public read APIs, and projections.
- `asset-api`: generic asset service for files, images, PDFs, thumbnails, private group files, and future app cloud-folder objects.
- `notification-api`: internal notification command service; email is one delivery channel.
- `audit-log`: append-only audit/event record service for protected content, asset, notification, and permission events.

Azure defaults:

- Runtime: Azure Container Apps for gateway and Go services.
- Data: Azure Database for PostgreSQL Flexible Server.
- Cache: Azure Cache for Redis.
- Object storage: Azure Blob Storage.
- Internal service call: Dapr service invocation where already used.
- Async work: PostgreSQL outbox first; Azure Service Bus can be added when event volume or retry requirements justify it.

Each service owns its PostgreSQL schema. Services do not cross-query each other's schema. Shared data moves through APIs, domain events, or explicit projections. Do not introduce a standalone `cms-api` in v1 unless CMS ownership, deployment cadence, or scaling becomes clearly independent from the main website backend.

## Gateway-First Security

`api-gateway` is the first public gate. It handles all non-account API traffic under `www.alive.org.tw/api/*`.

JWT verification must happen inside the gateway deployment. Do not call `account-api` for per-request token verification.

Recommended v1 implementation:

- Keep existing Nginx/Dapr gateway.
- Add a local Go JWT verifier in the `api-gateway` deployment boundary, preferably as an ACA sidecar/container and acceptable as a same-image binary if multi-container is unavailable.
- Nginx calls the verifier only on `127.0.0.1:10001`.
- The verifier fetches OIDC metadata/JWKS from `account.alive.org.tw`, caches keys, refreshes them in the background, and validates tokens locally.

Gateway validation:

- Signature, issuer, audience, expiry, `nbf`, token type, `kid`.
- Required role/scope per route.
- Fail closed if no valid cached key can verify the token.

Gateway route policy:

- Public website feature routes such as `/api/home`, `/api/news`, `/api/bulletins`, `/api/pages/*`, `/api/videos`, `/api/locations`, and `/api/sitemap-data`: no JWT required, method/rate/CORS controlled.
- `/api/admin/*`: bearer JWT required, CMS role/scope required.
- `/api/assets/public/*`: no JWT for public published assets, cacheable.
- `/api/assets/protected/*`: bearer JWT required.
- `/api/assets/admin/*`: bearer JWT plus CMS asset role/scope.
- `/api/line/webhook/*`: no JWT, POST only, rate-limited; LINE signature validated in `hhc-line-function-bot`.

Header policy:

- Strip all client-supplied `X-HHC-*`, `X-User-ID`, `X-Roles`, and `X-Permissions`.
- Inject only gateway-produced trusted headers:
  - `X-HHC-User-ID`
  - `X-HHC-Roles`
  - `X-HHC-Scopes`
  - `X-HHC-Token-ID`
  - `X-HHC-Request-ID`

Backend services must treat missing trusted identity headers on protected routes as unauthorized, even if the route was supposed to be protected by gateway. This keeps defense-in-depth.

## Account Domain

`account-fe` owns the browser login/profile/security console.

`account-api` owns:

- User login and session APIs.
- OIDC authorization code + PKCE.
- Token issuing and refresh.
- JWKS/public key publication.
- User profile and role/claim source of truth.
- Account-domain APIs under `account.alive.org.tw`.

Account SSO continuity should use redirects to `account.alive.org.tw`, where the account-domain session or refresh cookie is available. Sensitive account cookies, including refresh tokens, should be host-only on `account.alive.org.tw`; do not use a domain-wide `.alive.org.tw` refresh cookie. API authorization still uses bearer access tokens.

Admin console logs in through account OIDC and calls `https://www.alive.org.tw/api/admin/*` with bearer tokens.

## Asset Architecture

Use `asset-api`, not a narrow `file-api`.

Reasoning:

- Weekly PDFs, news images, page images, LINE group files, and desktop cloud-folder objects all share storage concerns: upload session, object key, MIME type, size, checksum, scan status, retention, visibility, download policy, and audit.
- They do not share business meaning. A weekly PDF version, a news cover image, a LINE group attachment, and a desktop folder object are different domain relationships.
- Therefore `asset-api` owns the binary asset and access primitives; consumer services own the semantic relationship.

`asset-api` owns:

- Blob storage adapter.
- Upload sessions.
- Asset metadata.
- Checksums and content type.
- Size limits by namespace.
- Public/private/restricted visibility.
- Download URL or streaming decisions.
- Virus scan and processing status.
- Thumbnail/derivative references.
- Retention and soft-delete primitives.
- Generic access grants.

Consumer services own:

- Why the asset exists.
- Which domain object uses it.
- Whether the domain object is published.
- Domain-specific validation such as "weekly bulletin PDF must be PDF" or "news cover image must be image".
- Domain-specific UI labels and ordering.

Core asset fields:

- `asset_id`
- `namespace`: examples `cms.weekly.pdf`, `cms.news.cover`, `cms.page.image`, `line.group.file`, `desktop.cloud-folder.object`
- `owner_service`: examples `hhc-web-api`, `hhc-line-function-bot`, `desktop-sync-api`
- `owner_type`
- `owner_id`
- `purpose`: examples `cover`, `attachment`, `pdf`, `thumbnail`, `folder-object`
- `locale`
- `mime_type`
- `size_bytes`
- `checksum_sha256`
- `storage_container`
- `storage_key`
- `visibility`: `public`, `authenticated`, `restricted`, `private`
- `scan_status`: `pending`, `clean`, `infected`, `failed`, `skipped`
- `processing_status`: `pending`, `ready`, `failed`, `not_required`
- `created_by`
- `created_at`
- `deleted_at`

Access model:

- `public`: published website assets and bulletins; cacheable through gateway/CDN.
- `authenticated`: any valid user can download, useful for future member-only files.
- `restricted`: only listed subjects can access, such as a LINE group, admin role, app client, or specific user.
- `private`: only owning service or creator can access unless explicitly granted.

The asset service should not query every consumer service on download. Instead, consumer services update asset visibility/grants when domain state changes. Example: when a news article is published, `hhc-web-api` grants public read for its cover image; when unpublished, it revokes public read.

Examples:

- Weekly bulletin: the bulletin module inside `hhc-web-api` creates issue/version, asks `asset-api` for upload, requires PDF MIME type, stores `asset_id`, and grants public read only when the version is published.
- News image: the news module inside `hhc-web-api` owns the article and cover-image relationship, stores `asset_id`, and grants public read only when the article is published.
- LINE group file: `hhc-line-function-bot` stores group context and asks `asset-api` to create `line.group.file` assets with restricted access to that group or service account.
- Desktop cloud folder: a future desktop sync service owns folder paths and versions; `asset-api` stores object bytes and restricted/private access grants.

Asset workers:

- Scan uploaded files.
- Extract image dimensions and PDF page count.
- Generate thumbnails.
- Normalize image derivatives.
- Mark infected or scan-failed assets as unavailable before public download.

## CMS Modules In HHC Web API

`hhc-web-api` owns CMS-managed website data in v1:

- News.
- Public pages.
- About/vision/history.
- Videos.
- Locations.
- Legal pages.
- Site settings that belong to public content.
- Weekly bulletin issues and language versions.

All CMS content follows:

- `draft`: editable and previewable in admin only.
- `published`: visible through public APIs.
- `unpublished`: hidden from public APIs but retained.

Shared fields:

- Stable ID.
- Translation group ID.
- Locale.
- Slug.
- Title.
- Summary/body structured content.
- Status.
- Published timestamp.
- Created/updated user.
- Created/updated timestamp.

`hhc-web-api` does not store file bytes. It stores asset references such as `cover_asset_id`, `pdf_asset_id`, or rich-content asset embeds.

Admin preview should read draft content through protected admin APIs. Public pages only read published projections.

Bulletins are a module inside `hhc-web-api` in the first release, not a separate microservice.

Reasoning:

- Bulletins are managed by the same CMS/admin console.
- They use the same roles, audit model, draft/publish concept, asset integration, and PostgreSQL dependency.
- Splitting now would add deployment, API, auth, and cache invalidation overhead without a separate owner or scaling need.

The bulletin module owns:

- Issue date.
- One or more language versions.
- Each version points to one PDF asset.
- Latest issue query.
- History pagination by issue date.
- Replacement history/audit.
- Publish/unpublish state.
- Validation that bulletin assets are clean PDFs.

Extract bulletins into a separate `bulletin-api` only if they later gain an independent team/owner, substantially different lifecycle, heavy traffic/write scaling, external consumers, or deployment cadence that would make a separate service worth the operational cost.

`asset-api` still owns only the PDF object, metadata, scan, visibility, and download policy.

## HHC Web API

`hhc-web-api` is the main website backend. It is both the CMS source of truth for current website content and the public read API facade for `hhc-web`.

It is not the source of truth for file bytes or notification delivery. Those remain owned by `asset-api` and `notification-api`.

It serves:

- Home payload.
- News lists.
- Latest bulletin.
- Bulletin archive pages.
- Videos.
- Locations.
- About/history payload.
- Legal page payload.
- Sitemap data.

It only returns published content and public asset references. It can cache Redis projections by locale and content type.

When CMS publish state changes, `hhc-web-api` invalidates or refreshes the public projection and updates any required asset grants.

## LINE Bot Weekly Bulletin Integration

Weekly bulletin download can be reused by `hhc-line-function-bot` through the same public API used by the website. The bot should call `hhc-web-api`, not `asset-api` or Azure Blob directly.

Recommended flow:

- User asks LINE bot for the latest bulletin or a specific issue.
- Bot calls `GET https://www.alive.org.tw/api/bulletins/latest?locale=zh-Hant` or `GET https://www.alive.org.tw/api/bulletins/{issueDate}?locale=zh-Hant`.
- `hhc-web-api` returns published bulletin metadata and a stable download URL such as `https://www.alive.org.tw/api/assets/public/{assetId}`.
- Bot replies with title, issue date, and the download link.

This keeps weekly bulletin business rules in `hhc-web-api`, file access in `asset-api`, and LINE-specific interaction logic in `hhc-line-function-bot`. If private/member-only bulletins are introduced later, the bot should use internal service identity or protected asset URLs instead of public routes.

## Notification And Email

Use `notification-api` as an internal capability service. It is not a public API.

Reasoning:

- Email will be needed by account verification, admin invites, CMS publish notices, future contact forms, event registration, reminders, and possibly LINE or desktop-app alerts.
- Each domain should not directly integrate with SendGrid, Azure Communication Services, Gmail SMTP, or another provider.
- Centralizing notification gives consistent templates, retry, audit, rate limiting, suppression, and provider swapping.

`notification-api` owns:

- Template catalog.
- Email rendering.
- Provider adapter.
- Send queue.
- Retry/backoff.
- Delivery status.
- Suppression/bounce handling.
- Audit trail.

Calling model:

- Internal services call notification commands through internal service identity, not public users.
- Account verification/reset flows can call restricted templates such as `account.verify-email`.
- CMS can call templates such as `cms.publish-summary` or `admin.invite`.
- Future event registration can call confirmation/reminder templates.

Implementation:

- Phase 1 can start with a PostgreSQL outbox table and a worker.
- Add Azure Service Bus when message volume, delayed delivery, or retry isolation requires it.
- Do not expose `notification-api` directly under public API routes except a highly restricted admin test/preview route if needed.

## Audit And Events

CMS and protected operations need auditability.

Minimum audit events:

- Login subject from token.
- Content create/update/publish/unpublish.
- Bulletin issue/version changes.
- Asset upload, grant, revoke, delete.
- Admin permission failures.
- Notification send commands and delivery results.

Phase 1 uses `audit-log` as a dedicated internal service with an append-only PostgreSQL schema. Services emit audit events through internal service identity and retry through their outbox when the audit service is temporarily unavailable.

For async integration, prefer an outbox pattern:

- Service writes domain data and event in the same PostgreSQL transaction.
- Worker publishes or processes the event after commit.
- Consumers update projections, grants, notifications, or cache invalidation.

## Frontend Applications

Phase 1 keeps `hhc-web` in the current Next.js app while introducing API clients.

Later workspace target:

- `apps/www`: public site.
- `apps/admin`: CMS/admin console.
- `packages/api-client`: typed public/admin API clients.
- `packages/i18n`: locale constants and helpers.
- `packages/ui`: shared UI only where real reuse exists.

The public site keeps current user-facing routes and component contracts where practical. Feature APIs move from mock data to feature-based routes under `www.alive.org.tw/api/*`.

The admin console lives at `admin.alive.org.tw` and calls `www.alive.org.tw/api/admin/*` with bearer tokens.

## Caching

Redis is used for:

- Public page/query projections.
- Hot home/news/bulletin payloads by locale.
- Short-lived upload/download tokens when needed.
- Gateway or service-side rate-limit support where appropriate.
- Background job coordination if a lightweight lock is needed.

Cache keys must include environment, locale, content type, and version where needed.

Admin APIs are not CDN-cacheable. Public API responses may have short CDN TTLs when backed by publish invalidation.

## Data Ownership

PostgreSQL schema ownership:

- `hhc_web`: content records, weekly issues/versions, draft/publish state, and public read projections.
- `asset`: asset metadata, bindings, grants, processing state.
- `notification`: templates, send queue, delivery status.
- `audit`: append-only audit events.
- `account`: owned only by account-api.

Services do not cross-query another service's schema. Read models are built by an owning service through provider APIs, anti-corruption adapters, or events, with source/version/freshness/rebuild rules as defined in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

## Operational Boundaries

Every service exposes:

- `/healthz`
- `/readyz`
- Structured JSON logs.
- Request ID propagation from gateway.
- Metrics for latency, status, cache hit/miss, and dependency errors.

Gateway logs include:

- Host.
- Route group.
- Auth result.
- User subject for protected requests.
- Upstream service.
- Status.
- Latency.
- Request ID.

Deployment:

- `api-gateway` main branch deployment is production-impacting.
- Frontend, gateway, account, and backend services should have path-filtered pipelines.
- No backend service should be reachable publicly except through gateway.

## Acceptance Criteria

- `api.alive.org.tw` is not used as a route, config target, or deployment host; mentions are limited to explicit prohibition.
- Non-account APIs are under `www.alive.org.tw/api/*`.
- `admin.alive.org.tw` is UI console only and calls protected APIs under `www.alive.org.tw`.
- `account.alive.org.tw` owns account APIs, OIDC, token, and JWKS.
- Gateway verifies JWTs locally from cached JWKS and does not call account-api per request.
- Asset service supports public, authenticated, restricted, and private assets.
- Weekly PDFs, news images, LINE group files, and future desktop cloud-folder objects can all use the same `asset-api` without forcing their business logic into `asset-api`.
- Email/notification is modeled as an internal service, not a public route.
- Current visible website features can be served from public APIs and managed through CMS draft/publish flows.
- Production-routed services have concrete runbooks, incident command linkage, and staging drill evidence before production traffic.
- Browser-facing routes have explicit HTTP security header, CORS, CSRF, CSP, cookie, and cache profiles before production traffic.
- Multilingual CMS behavior has source locale, translation status, stale translation handling, explicit fallback policy, per-locale publish, SEO alternate, slug redirect, and weekly bulletin locale consistency rules before production traffic.
