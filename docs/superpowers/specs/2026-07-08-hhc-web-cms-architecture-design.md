# HHC Web CMS Architecture Design

## Goal

Build the next HHC web platform around the current public website and a CMS/admin console, using Azure-first Go microservices, PostgreSQL, Redis, and a gateway-first security model.

The first release covers the features visible in `hhc-web` today:

- Public site: multilingual home, news, weekly bulletins, videos, locations, about/history, legal pages, SEO, and sitemap.
- Admin console: content editing, draft/publish workflow, weekly bulletin upload, asset management, and operational CMS screens.
- Identity: existing `account-api` remains the only login, OIDC/OAuth2, token issuing, and JWKS authority.
- Gateway: existing `api-gateway` remains the first public gate for UI and API traffic.

Not included in the first release: event registration, member records, pastoral care workflows, groups, donations, full notification center, search engine, or LINE bot business workflows. The backend is still designed so these can reuse the same identity, asset, notification, and content foundations later.

## Non-Negotiable Domain Model

There is no `api.alive.org.tw`.

Public domains:

- `www.alive.org.tw`: public website and every non-account API path.
- `admin.alive.org.tw`: CMS/admin console UI only.
- `account.alive.org.tw`: account UI plus account-owned APIs, OIDC endpoints, token endpoint, and JWKS.

API paths:

- `https://www.alive.org.tw/api/public/*`: public read APIs.
- `https://www.alive.org.tw/api/admin/*`: protected CMS/admin APIs.
- `https://www.alive.org.tw/api/assets/*`: asset upload, metadata, and download routes.
- `https://www.alive.org.tw/api/line/webhook/*`: LINE webhook routes, unauthenticated by JWT but method-limited and signature-validated by the LINE service.
- `https://account.alive.org.tw/*`: account login, OIDC, token, user profile, and JWKS APIs only.

All public ingress goes through `api-gateway`. Backend services must not expose direct public ingress.

## Current State

`hhc-web` is a Next.js 16 / React 19 / TypeScript public site. Its feature data is currently typed and mocked inside `src/features/*`, with APIs such as `getNews`, `getLatestWeekly`, `getVideos`, `getLocations`, and `getHistoryTimeline`. It is currently configured with `output: 'export'`.

`api-gateway` is an existing Nginx 1.30.3 Alpine reverse proxy deployed to Azure Container Apps. It routes through Dapr service invocation, already knows `www.alive.org.tw`, `admin.alive.org.tw`, and `account.alive.org.tw`, strips client-supplied identity headers, has rate limits/CORS, and currently has no token validation.

The design extends the existing gateway rather than replacing it.

## System Shape

Use a modular microservice architecture with a small set of Go services:

- `api-gateway`: first gate for public ingress, routing, rate limits, CORS, local JWT verification, and trusted identity header injection.
- `account-api`: account domain only; OIDC/OAuth2 login, token issuance, user/account APIs, roles/claims source, and JWKS/public key publication.
- `hhc-web-api`: main website backend/BFF used by `www.alive.org.tw` pages; it serves public read APIs and composes data from domain services.
- `content-api`: CMS-owned content domain for news, pages, videos, locations, history, and legal pages.
- `bulletin-api`: weekly bulletin issue/version domain.
- `asset-api`: generic asset service for files, images, PDFs, thumbnails, private group files, and future app cloud-folder objects.
- `notification-api`: internal notification command service; email is one delivery channel.
- `audit-log`: append-only audit/event record capability, implemented either as a small service or shared module plus dedicated schema in Phase 1.

Azure defaults:

- Runtime: Azure Container Apps for gateway and Go services.
- Data: Azure Database for PostgreSQL Flexible Server.
- Cache: Azure Cache for Redis.
- Object storage: Azure Blob Storage.
- Internal service call: Dapr service invocation where already used.
- Async work: PostgreSQL outbox first; Azure Service Bus can be added when event volume or retry requirements justify it.

Each service owns its PostgreSQL schema. Services do not cross-query each other's schema. Shared data moves through APIs, domain events, or explicit projections.

## Gateway-First Security

`api-gateway` is the first public gate. It handles all non-account API traffic under `www.alive.org.tw/api/*`.

JWT verification must happen inside the gateway deployment. Do not call `account-api` for per-request token verification.

Recommended v1 implementation:

- Keep existing Nginx/Dapr gateway.
- Add a local Go JWT verifier in the same gateway image.
- Nginx calls the verifier only on `127.0.0.1:10001`.
- The verifier fetches OIDC metadata/JWKS from `account.alive.org.tw`, caches keys, refreshes them in the background, and validates tokens locally.

Gateway validation:

- Signature, issuer, audience, expiry, `nbf`, token type, `kid`.
- Required role/scope per route.
- Fail closed if no valid cached key can verify the token.

Gateway route policy:

- `/api/public/*`: no JWT required, method/rate/CORS controlled.
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

`account-api` owns:

- User login and session.
- OIDC authorization code + PKCE.
- Token issuing and refresh.
- JWKS/public key publication.
- User profile and role/claim source of truth.
- Account-domain APIs under `account.alive.org.tw`.

The shared SSO browser cookie can use `Domain=.alive.org.tw; HttpOnly; Secure; SameSite=Lax` for account continuity across subdomains. API authorization still uses bearer access tokens.

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
- `owner_service`: examples `bulletin-api`, `content-api`, `hhc-line-function-bot`, `desktop-sync-api`
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
- `scan_status`: `pending`, `clean`, `blocked`, `failed`
- `processing_status`: `pending`, `ready`, `failed`
- `created_by`
- `created_at`
- `deleted_at`

Access model:

- `public`: published website assets and bulletins; cacheable through gateway/CDN.
- `authenticated`: any valid user can download, useful for future member-only files.
- `restricted`: only listed subjects can access, such as a LINE group, admin role, app client, or specific user.
- `private`: only owning service or creator can access unless explicitly granted.

The asset service should not query every consumer service on download. Instead, consumer services update asset visibility/grants when domain state changes. Example: when a news article is published, `content-api` grants public read for its cover image; when unpublished, it revokes public read.

Examples:

- Weekly bulletin: `bulletin-api` creates issue/version, asks `asset-api` for upload, requires PDF MIME type, stores `asset_id`, grants public read only when version is published.
- News image: `content-api` owns the news article and cover-image relationship, stores `asset_id`, grants public read only when article is published.
- LINE group file: `hhc-line-function-bot` stores group context and asks `asset-api` to create `line.group.file` assets with restricted access to that group or service account.
- Desktop cloud folder: a future desktop sync service owns folder paths and versions; `asset-api` stores object bytes and restricted/private access grants.

Asset workers:

- Scan uploaded files.
- Extract image dimensions and PDF page count.
- Generate thumbnails.
- Normalize image derivatives.
- Mark blocked assets as unavailable before public download.

## Content And CMS Architecture

`content-api` owns CMS content that is not a weekly bulletin:

- News.
- Public pages.
- About/vision/history.
- Videos.
- Locations.
- Legal pages.
- Site settings that belong to public content.

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

`content-api` does not store file bytes. It stores asset references such as `cover_asset_id` or rich-content asset embeds.

Admin preview should read draft content through protected admin APIs. Public pages only read published projections.

## Bulletin Architecture

`bulletin-api` is separate from generic content because weekly bulletins have a stable church workflow:

- Issue date.
- One or more language versions.
- Each version points to one PDF asset.
- Latest issue query.
- History pagination by issue date.
- Replacement history/audit.

`bulletin-api` owns:

- Issue records.
- Locale version records.
- Publish/unpublish state.
- Ordering and latest selection.
- Validation that bulletin assets are clean PDFs.

`asset-api` owns only the PDF object, metadata, scan, visibility, and download policy.

## HHC Web API

`hhc-web-api` is the main website backend. It is the public read model/BFF for `hhc-web` and prevents the website frontend from knowing the internal service split.

It is not the source of truth for CMS content, bulletins, or assets. Those remain owned by `content-api`, `bulletin-api`, and `asset-api`.

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

When content or bulletin publish state changes, the owning service invalidates or refreshes the public projection.

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

Phase 1 can implement audit as a dedicated `audit_events` schema/table written by each service through a shared library. If cross-service querying and retention policy become complex, promote it into an `audit-log` service.

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

The public site keeps current user-facing routes and component contracts where practical. Feature APIs move from mock data to `www.alive.org.tw/api/public/*`.

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

- `content`: content records and draft/publish state.
- `bulletin`: weekly issues and versions.
- `asset`: asset metadata, bindings, grants, processing state.
- `hhc_web`: optional main-site read projections.
- `notification`: templates, send queue, delivery status.
- `audit`: append-only audit events.
- `account`: owned only by account-api.

Services do not cross-query another service's schema. Read models are built by API composition or events.

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

- There is no `api.alive.org.tw` in the architecture.
- Non-account APIs are under `www.alive.org.tw/api/*`.
- `admin.alive.org.tw` is UI console only and calls protected APIs under `www.alive.org.tw`.
- `account.alive.org.tw` owns account APIs, OIDC, token, and JWKS.
- Gateway verifies JWTs locally from cached JWKS and does not call account-api per request.
- Asset service supports public, authenticated, restricted, and private assets.
- Weekly PDFs, news images, LINE group files, and future desktop cloud-folder objects can all use the same `asset-api` without forcing their business logic into `asset-api`.
- Email/notification is modeled as an internal service, not a public route.
- Current visible website features can be served from public APIs and managed through CMS draft/publish flows.
