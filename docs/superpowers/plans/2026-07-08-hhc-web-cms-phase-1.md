# HHC Web CMS Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable foundation for HHC Web + CMS: gateway-owned JWT validation, public API contracts, and CMS-ready frontend/backend boundaries.

**Architecture:** Keep `api-gateway` as the public edge and make it verify JWTs locally from cached JWKS/public keys. Keep `hhc-web` focused on TypeScript frontend applications and API clients. Implement Go microservices as separate service repos or separate deployable units, each owning its PostgreSQL schema and using Redis only for cache/short-lived state.

**Tech Stack:** Next.js 16, React 19, TypeScript, Go, PostgreSQL, Redis, Azure Container Apps, Azure Blob Storage, Azure DevOps, Dapr service invocation, existing `api-gateway` Nginx edge.

## Global Constraints

- Do not call `account-api` for per-request API token verification.
- `account-api` remains the OIDC/OAuth2 issuer and publishes JWKS/public keys.
- `api-gateway` verifies bearer JWTs locally and injects sanitized `X-HHC-*` identity headers.
- Public site domain is `www.alive.org.tw`; CMS domain is `admin.alive.org.tw`; identity domain is `account.alive.org.tw`.
- CMS v1 uses draft/publish, not approval workflow.
- LINE bot workflows are out of scope, but `file-api` and public/content APIs must remain reusable by LINE bot later.
- Azure is the default cloud; avoid Azure-specific business logic in domain services.

---

## Phase Boundary

This Phase 1 plan does not build the full church platform. It establishes the reusable security, file, content, and frontend contract foundation. Later phases can add activity registration, member/pastoral data, groups, donations, notifications, and LINE bot workflows.

## Task 1: Extend `api-gateway` With Local JWT Verification

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
- Modify: `README.md`

**Interfaces:**

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

- [ ] Add a Go module to `api-gateway` for the verifier.
- [ ] Implement config loading with strict startup validation for issuer, audience, JWKS URL, cache TTL, and max stale duration.
- [ ] Implement JWKS fetch/cache with background refresh and fail-closed behavior when no matching valid `kid` is available.
- [ ] Implement JWT verification for signature, issuer, audience, expiry, `nbf`, token type, roles, and scopes.
- [ ] Add verifier unit tests covering valid token, expired token, wrong audience, wrong issuer, missing role, missing scope, stale JWKS fallback, and unknown `kid`.
- [ ] Add `conf.d/common/auth.conf` with localhost `auth_request` wiring and response-header capture from the verifier.
- [ ] Add `conf.d/api/hhc.conf` route groups:
  - `/api/public/*` unauthenticated, read-only.
  - `/api/admin/*` authenticated, requires CMS role/scope.
  - `/api/files/*` split public download and protected upload/admin routes.
- [ ] Update proxy header sanitation to strip all client-supplied `X-HHC-*`, `X-User-ID`, `X-Roles`, and `X-Permissions` before auth.
- [ ] Inject only verifier-produced `X-HHC-*` headers to upstream services.
- [ ] Update Docker image to copy the verifier binary and use `docker-entrypoint.sh` to start the verifier on `127.0.0.1:10001`, then run `nginx -g "daemon off;"` in the foreground.
- [ ] Update README with the new security model and make it explicit that gateway validation is local and does not call `account-api` per request.
- [ ] Verify with `go test ./...`, `nginx -t`, local Docker build, and curl tests for public, missing-token, invalid-token, wrong-role, and valid-token requests.

## Task 2: Define Public And Admin API Contracts

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `docs/api/public-api.md`
- Create: `docs/api/admin-api.md`
- Create: `docs/api/file-api.md`
- Create: `docs/api/auth-headers.md`

**Interfaces:**

- Public API base path: `/api/public`
- Admin API base path: `/api/admin`
- File API base path: `/api/files`
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

- [ ] Document public endpoints for home, news, bulletins, videos, locations, pages, sitemap data, and file download metadata.
- [ ] Document admin endpoints for content draft CRUD, publish/unpublish, weekly issue/version management, and file upload lifecycle.
- [ ] Document `file-api` upload session and completion flow; domain services store `file_id`, not Blob URLs.
- [ ] Document trusted gateway headers:
  - `X-HHC-User-ID`
  - `X-HHC-Roles`
  - `X-HHC-Scopes`
  - `X-HHC-Token-ID`
- [ ] Document that backend services must reject protected operations when trusted identity headers are missing.
- [ ] Add contract examples for `zh-Hant`, `zh-Hans`, and `en`.
- [ ] Review the current TypeScript feature types and keep response shapes compatible with `NewsItem`, `WeeklyIssue`, `VideoItem`, `LocationItem`, and `HistoryTimelinePayload` where practical.

## Task 3: Convert `hhc-web` To API-Backed Public Data

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

- [ ] Add an API client that reads `NEXT_PUBLIC_API_BASE_URL` for browser/client calls and `API_BASE_URL` for server calls.
- [ ] Keep mock data as fallback only for local development when no API base URL is configured.
- [ ] Update feature `api.ts` files to call the public API client while preserving current exported function names.
- [ ] Update MSW handlers to match the documented public API envelope.
- [ ] Update tests to cover API success, API error, empty list, and fallback-to-mock development behavior.
- [ ] Remove `output: 'export'` from `next.config.ts` once runtime API fetching is required.
- [ ] Verify with `pnpm test:run`, `pnpm lint`, and `pnpm build`.

## Task 4: Add CMS Admin App Foundation

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `src/app/[locale]/admin/page.tsx`
- Phase 1 keeps admin inside the current Next app. Splitting to `apps/admin` is a Phase 2 migration after auth and content flows are proven.
- Create: `src/features/admin/auth.ts`
- Create: `src/features/admin/content-client.ts`
- Create: `src/features/admin/components/AdminShell.tsx`
- Create: `src/features/admin/components/ContentList.tsx`
- Create: `src/features/admin/components/PublishControls.tsx`
- Create: `src/features/admin/components/FileUploadField.tsx`

**Interfaces:**

- Admin client sends bearer tokens from the admin session to `/api/admin/*`.
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

- [ ] Build an operational admin shell with navigation for News, Pages, Weekly Bulletins, Videos, Locations, and Files.
- [ ] Add OIDC login redirect integration points, but do not implement account-api internals in this repo.
- [ ] Add admin API client with token injection and clear handling for `401`, `403`, and validation errors.
- [ ] Add list/detail/edit screens for one representative content type first, preferably News.
- [ ] Add publish/unpublish controls matching the documented admin API.
- [ ] Add file upload field that uses upload session then complete-upload flow.
- [ ] Add tests for role-gated rendering, failed auth, validation errors, and successful draft publish.

## Task 5: Define Go Service Repo Boundaries

**Repos:**

- `content-api`
- `bulletin-api`
- `file-api`
- `public-query-api`

**Files per service repo:**

- Create: `cmd/server/main.go`
- Create: `internal/http/routes.go`
- Create: `internal/config/config.go`
- Create: `internal/db/migrations`
- Create: `internal/auth/identity.go`
- Create: `internal/health/health.go`
- Create: `README.md`
- Create: `azure-pipelines.yml`

**Interfaces:**

- Each protected service receives trusted identity only from gateway-injected `X-HHC-*` headers.
- Each service owns one PostgreSQL schema.
- Services expose `/healthz` and `/readyz`.
- Services return the shared JSON envelope.

**Steps:**

- [ ] Create service repos or confirm existing repo names before implementation.
- [ ] Scaffold Go services with config, logging, health checks, PostgreSQL connection, Redis connection where needed, and Dapr-compatible HTTP routes.
- [ ] Add migrations for each owned schema.
- [ ] Implement `file-api` first because bulletin and content records depend on `file_id`.
- [ ] Implement `content-api` and `bulletin-api` admin CRUD/publish flows.
- [ ] Implement `public-query-api` read projections and Redis cache invalidation.
- [ ] Add service-level tests for missing identity headers, insufficient roles/scopes, publish transitions, locale behavior, and file ownership.

## Task 6: Deployment And Verification

**Repos:** `api-gateway`, `hhc-web`, and each Go service repo.

**Steps:**

- [ ] Add Azure DevOps path filters so frontend, gateway, and service deployments do not trigger each other accidentally.
- [ ] Add environment variables and secrets in Azure Container Apps for OIDC/JWKS, DB, Redis, Blob, and service URLs.
- [ ] Add staging/test domains using the existing `-test.alive.org.tw` convention.
- [ ] Run gateway verification:
  - missing token returns `401`
  - invalid token returns `401`
  - valid token missing role returns `403`
  - valid publisher/admin token reaches upstream with sanitized `X-HHC-*` headers
  - client-supplied spoofed identity headers are stripped
- [ ] Run public site verification for all three locales, weekly download, news list, videos, locations, about/history, legal pages, sitemap, and SEO alternates.
- [ ] Run CMS verification for draft create, preview, publish, unpublish, weekly PDF upload, and file download.
- [ ] Confirm `api-gateway` deployment is treated as production-impacting because current `main` pipeline deploys to Azure Container Apps.
