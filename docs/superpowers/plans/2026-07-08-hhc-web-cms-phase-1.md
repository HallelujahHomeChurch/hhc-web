# HHC Web CMS Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable foundation for HHC Web + CMS: gateway-owned JWT validation, `www.alive.org.tw/api/*` API routing, reusable asset architecture, public API contracts, and CMS-ready frontend/backend boundaries.

**Architecture:** `api-gateway` is the first public gate. There is no `api.alive.org.tw`; all non-account APIs live under `www.alive.org.tw/api/*`. `admin.alive.org.tw` is the CMS console UI, and `account.alive.org.tw` owns account/OIDC/token/JWKS APIs. Backend services are Go microservices with owned PostgreSQL schemas, Redis for cache/short-lived state, Azure Blob Storage through `asset-api`, and Dapr service invocation behind the gateway.

**Tech Stack:** Next.js 16, React 19, TypeScript, Go, PostgreSQL, Redis, Azure Container Apps, Azure Blob Storage, Azure DevOps, Dapr service invocation, existing `api-gateway` Nginx edge.

## Global Constraints

- Do not create or use `api.alive.org.tw`.
- `www.alive.org.tw` serves the public website and every non-account API path.
- `admin.alive.org.tw` is CMS console UI only; it calls protected APIs under `www.alive.org.tw/api/admin/*`.
- `account.alive.org.tw` owns account UI, account APIs, OIDC, token, and JWKS endpoints.
- Do not call `account-api` for per-request API token verification.
- `api-gateway` verifies bearer JWTs locally from cached JWKS and injects sanitized `X-HHC-*` identity headers.
- CMS v1 uses draft/publish, not approval workflow.
- LINE bot workflows are out of scope, but `asset-api` and public/content APIs must remain reusable by LINE bot later.
- Azure is the default cloud; avoid Azure-specific business logic in domain services.

---

## Phase Boundary

This Phase 1 plan does not build the full church platform. It establishes gateway security, API routing, reusable asset handling, content/bulletin contracts, notification/email direction, and frontend integration foundations. Later phases can add activity registration, member/pastoral data, groups, donations, full notifications, search, and LINE bot workflows.

## Task 1: Extend `api-gateway` With Local JWT Verification And Domain Routing

**Repo:** `C:\Users\IT\projects\api-gateway`

**Files:**

- Create: `cmd/jwt-verifier/main.go`
- Create: `internal/auth/config.go`
- Create: `internal/auth/jwks.go`
- Create: `internal/auth/verifier.go`
- Create: `internal/auth/verifier_test.go`
- Create: `conf.d/common/auth.conf`
- Create: `conf.d/api/hhc.conf`
- Create: `docker-entrypoint.sh`
- Create: `go.mod`
- Create: `go.sum`
- Modify: `Dockerfile`
- Modify: `nginx.conf`
- Modify: `conf.d/common/proxy.conf`
- Modify: `conf.d/common/fqdn.conf`
- Modify: `conf.d/map.conf`
- Modify: `README.md`

**Interfaces:**

- Gateway accepts public traffic for `www.alive.org.tw`, `admin.alive.org.tw`, and `account.alive.org.tw`.
- Non-account API routes are only under `www.alive.org.tw/api/*`.
- Account/OIDC routes remain only under `account.alive.org.tw`.
- Local verifier listens only on `127.0.0.1:10001`.
- Nginx protected locations call `GET /verify` on the local verifier.
- Verifier input comes from `Authorization: Bearer <jwt>` and route-policy headers set by Nginx:
  - `X-HHC-Required-Roles`
  - `X-HHC-Required-Scopes`
- Verifier success returns `204` with:
  - `X-HHC-User-ID`
  - `X-HHC-Roles`
  - `X-HHC-Scopes`
  - `X-HHC-Token-ID`
- Verifier auth failure returns `401`; authorization failure returns `403`.
- Required env vars:
  - `OIDC_ISSUER=https://account.alive.org.tw`
  - `OIDC_AUDIENCE=hhc-api`
  - `JWKS_URL=https://account.alive.org.tw/.well-known/jwks.json`
  - `JWKS_CACHE_TTL=15m`
  - `JWKS_MAX_STALE=24h`

**Steps:**

- [ ] Add a Go module to `api-gateway` for the local verifier.
- [ ] Implement config loading with strict startup validation for issuer, audience, JWKS URL, cache TTL, and max stale duration.
- [ ] Implement JWKS fetch/cache with background refresh and fail-closed behavior when no matching valid `kid` is available.
- [ ] Implement JWT verification for signature, issuer, audience, expiry, `nbf`, token type, roles, and scopes.
- [ ] Add verifier unit tests covering valid token, expired token, wrong audience, wrong issuer, missing role, missing scope, stale JWKS fallback, and unknown `kid`.
- [ ] Add `conf.d/common/auth.conf` with localhost `auth_request` wiring and response-header capture from the verifier.
- [ ] Add `conf.d/api/hhc.conf` route groups on `www.alive.org.tw`:
  - `/api/public/*` unauthenticated, read-only.
  - `/api/admin/*` authenticated, requires CMS role/scope.
  - `/api/assets/public/*` unauthenticated, public published assets only.
  - `/api/assets/protected/*` authenticated.
  - `/api/assets/admin/*` authenticated, requires CMS asset role/scope.
  - `/api/line/webhook/*` unauthenticated by JWT, POST only, rate-limited.
- [ ] Route `admin.alive.org.tw` to the admin console UI only; do not expose API paths from that host.
- [ ] Route `account.alive.org.tw` only to account UI/API/OIDC/JWKS upstreams.
- [ ] Update proxy header sanitation to strip all client-supplied `X-HHC-*`, `X-User-ID`, `X-Roles`, and `X-Permissions` before auth.
- [ ] Inject only verifier-produced `X-HHC-*` headers to upstream services.
- [ ] Update Docker image to copy the verifier binary and use `docker-entrypoint.sh` to start the verifier on `127.0.0.1:10001`, then run `nginx -g "daemon off;"` in the foreground.
- [ ] Update README with the new domain model and make it explicit that gateway validation is local and does not call `account-api` per request.
- [ ] Verify with `go test ./...`, `nginx -t`, local Docker build, and curl tests for public, missing-token, invalid-token, wrong-role, valid-token, admin-host API rejection, and account-host OIDC/JWKS routing.

## Task 2: Define Public, Admin, Asset, And Internal API Contracts

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `docs/api/public-api.md`
- Create: `docs/api/admin-api.md`
- Create: `docs/api/asset-api.md`
- Create: `docs/api/auth-headers.md`
- Create: `docs/api/internal-notification-api.md`

**Interfaces:**

- Public API base path: `https://www.alive.org.tw/api/public`
- Admin API base path: `https://www.alive.org.tw/api/admin`
- Asset API base path: `https://www.alive.org.tw/api/assets`
- Account API base path: `https://account.alive.org.tw`
- Shared JSON envelope:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

- Error envelope:

```json
{
  "data": null,
  "meta": {},
  "error": {
    "code": "forbidden",
    "message": "Forbidden"
  }
}
```

**Steps:**

- [ ] Document public endpoints for home, news, bulletins, videos, locations, pages, sitemap data, and public asset references.
- [ ] Document admin endpoints for content draft CRUD, publish/unpublish, weekly issue/version management, and asset lifecycle.
- [ ] Document `asset-api` upload session, completion, metadata, grants, visibility, and download flows.
- [ ] Document asset visibility values:
  - `public`
  - `authenticated`
  - `restricted`
  - `private`
- [ ] Document trusted gateway headers:
  - `X-HHC-User-ID`
  - `X-HHC-Roles`
  - `X-HHC-Scopes`
  - `X-HHC-Token-ID`
  - `X-HHC-Request-ID`
- [ ] Document that backend services must reject protected operations when trusted identity headers are missing.
- [ ] Document internal notification/email API as service-to-service only, not a public browser API.
- [ ] Add examples for weekly PDFs, news cover images, LINE group files, and desktop cloud-folder objects.
- [ ] Review current TypeScript feature types and keep response shapes compatible with `NewsItem`, `WeeklyIssue`, `VideoItem`, `LocationItem`, and `HistoryTimelinePayload` where practical.

## Task 3: Convert `hhc-web` To `www.alive.org.tw/api/public/*`

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/public.ts`
- Create: `src/lib/api/errors.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/weekly/api.ts`
- Modify: `src/features/videos/api.ts`
- Modify: `src/features/locations/api.ts`
- Modify: `src/features/history/api.ts`
- Modify: `src/mocks/handlers.ts`
- Modify: existing feature API tests.

**Interfaces:**

- `createApiClient({baseUrl, fetcher})`
- `getPublicHome(locale)`
- `getPublicNews(locale, limit)`
- `getLatestBulletin(locale)`
- `getBulletinPage({locale, page, pageSize})`
- `getPublicVideos(locale)`
- `getPublicLocations(locale)`
- `getPublicPage(slug, locale)`

**Steps:**

- [ ] Add an API client that defaults to same-origin `/api/public` in production.
- [ ] Use `NEXT_PUBLIC_API_BASE_URL` only for local/test overrides; production should not require `api.alive.org.tw`.
- [ ] Keep mock data as fallback only for local development when no API base URL is configured.
- [ ] Update feature `api.ts` files to call the public API client while preserving current exported function names.
- [ ] Update MSW handlers to match the documented public API envelope.
- [ ] Update tests to cover API success, API error, empty list, and fallback-to-mock development behavior.
- [ ] Remove `output: 'export'` from `next.config.ts` once runtime API fetching is required.
- [ ] Verify with `pnpm test:run`, `pnpm lint`, and `pnpm build`.

## Task 4: Add CMS Admin Console Foundation

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `src/app/[locale]/admin/page.tsx`
- Phase 1 keeps admin inside the current Next app. Splitting to `apps/admin` is a Phase 2 migration after auth and content flows are proven.
- Create: `src/features/admin/auth.ts`
- Create: `src/features/admin/content-client.ts`
- Create: `src/features/admin/components/AdminShell.tsx`
- Create: `src/features/admin/components/ContentList.tsx`
- Create: `src/features/admin/components/PublishControls.tsx`
- Create: `src/features/admin/components/AssetUploadField.tsx`

**Interfaces:**

- Admin console is served from `admin.alive.org.tw`.
- Admin API calls go to `https://www.alive.org.tw/api/admin/*`.
- Asset admin calls go to `https://www.alive.org.tw/api/assets/admin/*`.
- Admin client sends bearer tokens from the admin session.
- CMS roles:
  - `cms.viewer`
  - `cms.editor`
  - `cms.publisher`
  - `cms.admin`
- Draft/publish states:
  - `draft`
  - `published`
  - `unpublished`

**Steps:**

- [ ] Build an operational admin shell with navigation for News, Pages, Weekly Bulletins, Videos, Locations, Assets, and Settings.
- [ ] Add OIDC login redirect integration points, but do not implement account-api internals in this repo.
- [ ] Add admin API client with token injection and clear handling for `401`, `403`, and validation errors.
- [ ] Add list/detail/edit screens for one representative content type first, preferably News.
- [ ] Add publish/unpublish controls matching the documented admin API.
- [ ] Add asset upload field that uses upload session then complete-upload flow.
- [ ] Add tests for role-gated rendering, failed auth, validation errors, and successful draft publish.

## Task 5: Define Go Service Boundaries

**Repos:**

- `content-api`
- `bulletin-api`
- `asset-api`
- `public-query-api`
- `notification-api`

**Files per service repo:**

- Create: `cmd/server/main.go`
- Create: `internal/http/routes.go`
- Create: `internal/config/config.go`
- Create: `internal/db/migrations`
- Create: `internal/auth/identity.go`
- Create: `internal/health/health.go`
- Create: `internal/audit/audit.go`
- Create: `README.md`
- Create: `azure-pipelines.yml`

**Interfaces:**

- Each protected service receives trusted identity only from gateway-injected `X-HHC-*` headers.
- Each service owns one PostgreSQL schema.
- Services expose `/healthz` and `/readyz`.
- Services return the shared JSON envelope.
- `notification-api` is internal service-to-service only.

**Steps:**

- [ ] Create service repos or confirm existing repo names before implementation.
- [ ] Scaffold Go services with config, logging, health checks, PostgreSQL connection, Redis connection where needed, and Dapr-compatible HTTP routes.
- [ ] Add migrations for each owned schema.
- [ ] Implement `asset-api` first because bulletin and content records depend on `asset_id`.
- [ ] Implement asset namespaces for `cms.weekly.pdf`, `cms.news.cover`, `cms.page.image`, `line.group.file`, and `desktop.cloud-folder.object`.
- [ ] Implement asset visibility and grant primitives for `public`, `authenticated`, `restricted`, and `private`.
- [ ] Implement `content-api` and `bulletin-api` admin CRUD/publish flows.
- [ ] Implement publish/unpublish behavior that grants or revokes public asset access.
- [ ] Implement `public-query-api` read projections and Redis cache invalidation.
- [ ] Implement `notification-api` with template registry, send queue/outbox, provider adapter, retry state, and delivery audit.
- [ ] Add service-level tests for missing identity headers, insufficient roles/scopes, publish transitions, locale behavior, asset ownership, asset visibility, and notification retry.

## Task 6: Deployment And Verification

**Repos:** `api-gateway`, `hhc-web`, and each Go service repo.

**Steps:**

- [ ] Add Azure DevOps path filters so frontend, gateway, and service deployments do not trigger each other accidentally.
- [ ] Add environment variables and secrets in Azure Container Apps for OIDC/JWKS, DB, Redis, Blob, notification provider, and service URLs.
- [ ] Add staging/test domains using the existing `-test.alive.org.tw` convention.
- [ ] Run gateway verification:
  - `www.alive.org.tw/api/public/*` works without token.
  - `www.alive.org.tw/api/admin/*` missing token returns `401`.
  - invalid token returns `401`.
  - valid token missing role returns `403`.
  - valid publisher/admin token reaches upstream with sanitized `X-HHC-*` headers.
  - client-supplied spoofed identity headers are stripped.
  - `admin.alive.org.tw/api/*` does not expose backend APIs.
  - `account.alive.org.tw` routes account/OIDC/JWKS endpoints only.
- [ ] Run public site verification for all three locales, weekly download, news list, videos, locations, about/history, legal pages, sitemap, and SEO alternates.
- [ ] Run CMS verification for draft create, preview, publish, unpublish, weekly PDF upload, news cover image upload, public asset grant/revoke, and file download.
- [ ] Run notification verification for queued email, retry on provider failure, delivery audit, and no public browser access.
- [ ] Confirm `api-gateway` deployment is treated as production-impacting because current `main` pipeline deploys to Azure Container Apps.
