# HHC Web CMS Architecture Design

## Goal

Build the next HHC web platform around the currently visible `hhc-web` public site plus an admin CMS, using Azure-first microservices that stay reusable for future church systems.

The first release covers:

- Public site at `www.alive.org.tw`: multilingual home, news, weekly bulletins, videos, locations, about/history, legal pages, SEO, sitemap.
- CMS at `admin.alive.org.tw`: content editing, draft/publish workflow, weekly bulletin upload, file metadata management.
- Identity at `account.alive.org.tw`: existing `account-api` remains the single login and OIDC/OAuth2 authority.
- Existing API gateway repo at `C:\Users\IT\projects\api-gateway`: extend it as the route security boundary for JWT validation, rate limiting, CORS, and identity header injection.

Not included in the first release: event registration, member records, pastoral care workflows, groups, donations, notification center, search engine, or LINE bot business workflows. LINE bot reuse is limited to future calls into shared file/content APIs.

## Current State

`hhc-web` is a Next.js 16 / React 19 / TypeScript public site. It currently uses feature-local `types.ts`, `api.ts`, and `mock-data.ts` files for weekly bulletins, news, videos, locations, and history. It is configured as `output: 'export'`, so it behaves as a static export today.

`api-gateway` is an existing Nginx 1.30.3 Alpine reverse proxy deployed to Azure Container Apps. It routes through Dapr service invocation, currently exposes LINE bot and Bible API routes, strips client-supplied identity headers, has rate limits/CORS, and intentionally has no token validation yet.

This design keeps those facts: the frontend contracts evolve from mock data to public API clients, and the existing gateway is extended instead of replacing it.

## Architecture

Use a modular microservice architecture with a small number of Go services. Each service owns its domain schema in PostgreSQL and communicates through HTTP APIs behind the gateway. Services do not cross-query each other's database schemas.

Azure defaults:

- Runtime: Azure Container Apps for Go services and existing Nginx gateway.
- Data: Azure Database for PostgreSQL Flexible Server, with one schema per service.
- Cache: Azure Cache for Redis for public projection cache, rate-limit support where needed, and short-lived file access tokens.
- Files: Azure Blob Storage through a service-owned adapter, not direct Blob URLs embedded in app code.
- Networking: Dapr service invocation remains the internal service call mechanism where it is already used by the gateway.

Primary services:

- `api-gateway`: public/admin API entry, route policy, JWT enforcement, CORS, rate limits, identity header injection.
- `account-api`: existing OIDC/OAuth2 identity provider for login, token issuance, user/role claims, and JWKS/public key publication.
- `public-query-api`: read-optimized public API used by `www`, aggregating only published content.
- `content-api`: CMS-owned content for news, pages, videos, locations, history, and legal pages.
- `bulletin-api`: weekly bulletin issue/version management.
- `file-api`: generic Blob/file facade for weekly PDFs, CMS images, and future LINE bot file reuse.

## Domains And Authentication

Domains:

- `www.alive.org.tw`: public website.
- `admin.alive.org.tw`: CMS application.
- `account.alive.org.tw`: identity/login application.
- `api.alive.org.tw` or existing gateway host routing: API gateway entry for public and admin APIs.
- Test domains use the existing `-test.alive.org.tw` convention from `api-gateway`.

Authentication:

- `account-api` provides OIDC authorization code + PKCE.
- `admin` logs users in through `account-api` and sends bearer access tokens to protected APIs.
- The shared SSO cookie may use `Domain=.alive.org.tw; HttpOnly; Secure; SameSite=Lax` for account SSO continuity.
- API auth must not rely on browser cookies as the primary credential. Protected API calls use `Authorization: Bearer <access_token>`.
- `admin` keeps its own host-scoped session/CSRF protection for browser state.

## API Gateway JWT Boundary

Extend the existing `api-gateway` as the security enforcement point.

Do not call `account-api` for per-request token verification. The gateway must verify JWTs itself from trusted signing keys.

Recommended v1 implementation: keep the current Nginx/Dapr gateway as the edge proxy and add a local JWT verifier inside the `api-gateway` deployment. Nginx may use `auth_request` only against this localhost verifier, never against `account-api`. The local verifier loads issuer metadata and JWKS/public keys from `account-api`, caches keys locally, refreshes them in the background, and validates access tokens without a network call on each request.

If the Nginx runtime is later replaced, the replacement gateway must still provide native local JWT validation, route-level authorization policy, and Dapr-compatible upstream routing. The architectural requirement is local gateway verification, not a remote introspection dependency.

Gateway behavior:

- Public routes skip auth but keep CORS, rate limits, and method limits.
- Protected routes require a bearer JWT and validate it inside the gateway deployment before proxying.
- The verifier validates JWT signature, issuer, audience, expiry, `nbf`, token type, and required scopes/roles.
- JWKS refresh is out-of-band and cached. If fresh keys cannot be fetched, the verifier may continue using cached unexpired keys; if no valid key is available for the token `kid`, it fails closed.
- Gateway rejects failed verification with `401` or `403`.
- Gateway strips incoming `X-User-ID`, `X-Roles`, `X-Permissions`, `X-HHC-User-ID`, `X-HHC-Roles`, `X-HHC-Scopes`, and related identity headers before auth.
- After successful auth, gateway injects sanitized `X-HHC-User-ID`, `X-HHC-Roles`, `X-HHC-Scopes`, and `X-HHC-Token-ID` headers into upstream requests.
- Backend services still validate required roles/scopes from trusted gateway headers as defense-in-depth and must reject protected operations when identity headers are missing.

Required gateway route groups:

- `/api/public/*`: public read APIs for `www`.
- `/api/admin/*`: protected CMS APIs for `admin`.
- `/api/files/*`: public download route for published files and protected upload/admin file routes.
- Existing `/api/line/webhook/*` remains unauthenticated but method-limited to POST.

## CMS Content Model

All CMS-managed public content follows the same lifecycle:

- `draft`: editable and visible only in admin preview.
- `published`: visible to public APIs.
- `unpublished`: hidden from public APIs while retained for history.

Shared content fields:

- Stable ID, slug, locale, title, summary/body, status, published timestamp, created/updated user, created/updated timestamps.
- Public list ordering is explicit where needed and date-based where the current UI expects it.
- Multilingual content stores one record per locale linked by a translation group ID.

CMS modules:

- News: title, summary, date, optional image file, optional external/internal link.
- Pages: about vision sections, history timeline, legal pages.
- Videos: title, YouTube URL, thumbnail URL or file, display order.
- Locations: name, address, map URL, display order.
- Weekly bulletins: issue date plus one file-backed version per locale.

## File API Design

`file-api` is the reusable Blob facade. Consumers never write Azure Blob paths directly.

Core fields:

- `file_id`
- `namespace` such as `weekly`, `cms-image`, `line-bot`
- `owner_type`
- `owner_id`
- `locale`
- `mime_type`
- `size_bytes`
- `checksum`
- `storage_key`
- `visibility` as `public`, `authenticated`, or `private`
- `created_by`
- `created_at`

Core operations:

- Create upload session.
- Complete upload and persist metadata.
- Get file metadata.
- Issue download URL or stream file through gateway.
- Attach/detach file to a domain owner.

Weekly PDFs, CMS images, and future LINE bot files use the same file service. Domain services store `file_id`, not Blob URLs.

## Frontend Applications

`hhc-web` should evolve into a workspace with:

- `apps/www`: public site, preserving current routes and visual behavior.
- `apps/admin`: CMS interface.
- `packages/api-client`: typed TypeScript clients for public and admin APIs.
- `packages/i18n`: locale constants and helpers currently under `src/i18n`.
- `packages/ui`: shared components only when reuse is real.

`www` keeps the current public contracts where practical: `NewsItem`, `WeeklyIssue`, `VideoItem`, `LocationItem`, and `HistoryTimelinePayload`. The implementation moves from mock data to `public-query-api`.

`admin` should be quiet and operational: list/detail/edit screens, draft/publish controls, file upload controls, preview links, and clear validation errors. It should not be a marketing-style site.

## Caching And Publishing

Publishing a CMS item updates PostgreSQL first, then invalidates Redis public projections. `public-query-api` rebuilds cache on next read or through an explicit publish event.

Cache keys include locale and content type. Public content can use CDN caching with short TTLs, while admin APIs are never CDN-cacheable.

Weekly bulletin downloads should be stable by `file_id`. Replacing a weekly file creates a new file record and updates the bulletin version reference.

## Observability And Operations

Each Go service exposes:

- `/healthz` for liveness.
- `/readyz` for database/cache readiness.
- Structured JSON logs with request ID, user ID where available, route, status, and latency.
- OpenTelemetry-compatible traces where practical.

Gateway logs must include auth result, route group, request ID, status, upstream latency, and sanitized subject ID for protected routes.

CI/CD:

- Keep existing Azure DevOps style.
- `api-gateway` pushes to `main` deploy by current pipeline, so gateway changes must be treated as production-impacting.
- `hhc-web` frontend and Go services should have separate pipelines or path filters to avoid deploying unrelated apps.

## Acceptance Criteria

- All current visible `hhc-web` content can be served from public APIs instead of mock data.
- CMS can create, edit, preview, publish, and unpublish news, pages, videos, locations, and weekly bulletins.
- Weekly PDF upload stores files through `file-api` and public download works through stable file routes.
- Admin APIs are inaccessible without a valid token and required role.
- Gateway rejects invalid/expired tokens and strips spoofed identity headers.
- Public pages still support the current three locales, SEO alternates, sitemap, and legal pages.
- The design leaves a clear future path for LINE bot to reuse `file-api` and public/content APIs without adding bot workflows to this release.
