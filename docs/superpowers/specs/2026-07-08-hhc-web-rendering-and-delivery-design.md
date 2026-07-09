# HHC Web Rendering And Delivery Design

## Purpose

This spec defines how `hhc-web` should be delivered once public website content moves from local mock/i18n data into `hhc-web-api`, CMS projections, and `asset-api`.

Public projection versioning, Redis keys, ETags, cache headers, publish/unpublish invalidation, sitemap refresh, and LINE bot consistency rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.

Canonical URLs, locale alternates, slug governance, redirects, sitemap ownership, robots/noindex policy, Open Graph, structured data, and route metadata contracts are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

Accessibility baseline, Core Web Vitals targets, image/media delivery, font/script policy, and admin keyboard-flow rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

Frontend runtime config, public/server-only config separation, API data path flags, and release rollback controls are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.

Site settings, header navigation, footer links, social links, public contact display, site SEO defaults, and `GET /api/site-layout` are defined in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

CMS admin preview, draft rendering, revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

Structured content block schema, render-ready body blocks, rich content renderer whitelist, inline link validation, and no-raw-HTML rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Browser security header profiles, CORS, CSRF, CSP, cookie boundaries, and cache header rules are defined in `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`.

Public third-party links, embeds, analytics, consent, provider registry, CMS URL validation, and provider-scoped CSP expansion rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.

The key decision is when and how to move from the current static export build to a runtime Next.js server without creating a second API surface or over-splitting the frontend.

## Current State

Current `hhc-web` behavior:

- Next.js 16, React 19, App Router, TypeScript.
- `next.config.ts` uses `output: 'export'`.
- `next.config.ts` sets `images.unoptimized = true`.
- Locale routes are generated with `generateStaticParams`.
- `[locale]` layout sets `dynamicParams = false`.
- `sitemap.ts`, `robots.ts`, and `opengraph-image.tsx` are `force-static`.
- Public page data comes from frontend i18n JSON and `src/features/*/mock-data.ts`.
- There is no middleware today.
- There are no Next.js API route handlers today.

This works for a static public site, but it will not be enough once published CMS content, dynamic sitemap data, admin UI, preview, and runtime API parity become required.

## Decision

Use one `hhc-web` Next.js server deployment for v1 public UI and admin UI.

Remove `output: 'export'` when runtime CMS/API-backed rendering becomes the production data path.

Keep all backend APIs outside the Next.js app. `hhc-web` must not become a BFF or API proxy. All non-account APIs stay under `www.alive.org.tw/api/*` and are served by `api-gateway` routing to backend services.

## Rejected Alternatives

### Keep Static Export Permanently

Pros:

- Simple hosting.
- No server runtime for the frontend.
- Easy rollback to static files.

Cons:

- CMS content changes require rebuild or client-only fetching.
- Client-only fetching weakens SEO for content pages.
- Dynamic sitemap and published content alternates become awkward.
- Admin preview and host-aware behavior become harder.

Use static export only while the site still depends on mock/static content.

### Split Public And Admin Into Two Frontend Apps In V1

Pros:

- Strong isolation between public and admin UI.
- Smaller deployable per surface.
- Different release cadence possible.

Cons:

- Duplicates design system, i18n, API client, auth state handling, build config, and deployment pipeline too early.
- Adds operational cost before there is a separate admin team or scale requirement.

Do not split in v1. Split later if admin UI gets a separate team, release cadence, security boundary, or significantly different runtime needs.

### Add Next.js API Routes As A BFF

Pros:

- Convenient server-side API composition.
- Can hide backend details from browser code.

Cons:

- Creates another public API surface.
- Competes with `api-gateway` and `hhc-web-api`.
- Makes auth, audit, rate limiting, OpenAPI, and route ownership less clear.

Do not create Next.js API route handlers for platform APIs in v1.

## Target Delivery Shape

```text
internet
  |
  v
api-gateway
  |-- Host: www.alive.org.tw
  |     |-- /api/*        -> backend services through Dapr
  |     |-- everything else -> hhc-web Next.js server
  |
  |-- Host: admin.alive.org.tw
  |     |-- /api/*        -> reject or redirect; no backend APIs here
  |     |-- everything else -> hhc-web Next.js server admin UI
  |
  |-- Host: account.alive.org.tw
        |-- account/OIDC/token/JWKS routes -> account-api/account UI
```

`api-gateway` remains the only external ingress for UI and API traffic.

`hhc-web` can have internal ingress from the gateway, but it should not be directly public.

## Host Responsibilities

### `www.alive.org.tw`

Owns:

- public website UI
- public locale routes
- SEO metadata
- public sitemap/robots
- non-account API paths under `/api/*`, routed by gateway

The website can server-render public pages by reading published public APIs.

### `admin.alive.org.tw`

Owns:

- admin console UI only
- account login redirects
- admin shell and editor pages

It does not own:

- `/api/*`
- account token issuance
- backend route handlers

Admin API calls always target:

```text
https://www.alive.org.tw/api/admin/*
```

### `account.alive.org.tw`

Owns:

- login UI
- OIDC metadata
- authorization endpoint
- token endpoint
- refresh token rotation/revocation
- JWKS
- account profile APIs

`hhc-web` must not mint, refresh, or introspect tokens.

## Gateway Vs Next Middleware

### Gateway Owns Security Boundaries

`api-gateway` owns:

- host routing
- `/api/*` routing
- blocking `/priv/*` and `/api/priv/*`
- JWT validation for protected API paths
- trusted identity header injection
- stripping client-supplied identity headers
- rate limits
- CORS
- admin host `/api/*` rejection

### Next Middleware Owns UI Navigation Only

If added, `hhc-web` middleware should own only:

- locale redirects such as `/` to `/zh-Hant`
- admin host redirects such as `/` to `/zh-Hant/admin`
- rejecting impossible UI paths
- adding UI-only headers

Next middleware must not:

- validate API bearer tokens
- call `account-api`
- proxy `/api/*`
- add trusted backend identity headers
- decide backend service authorization

## Routing Model

Recommended v1 UI routes:

```text
www.alive.org.tw/{locale}
www.alive.org.tw/{locale}/about
www.alive.org.tw/{locale}/literature-ministry
www.alive.org.tw/{locale}/privacy-policy
www.alive.org.tw/{locale}/terms-of-use
www.alive.org.tw/{locale}/news/{slug}          # when news detail is enabled
www.alive.org.tw/{locale}/pages/{slug}         # optional generic pages

admin.alive.org.tw/{locale}/admin
admin.alive.org.tw/{locale}/admin/news
admin.alive.org.tw/{locale}/admin/pages
admin.alive.org.tw/{locale}/admin/bulletins
admin.alive.org.tw/{locale}/admin/assets
admin.alive.org.tw/{locale}/admin/audit
admin.alive.org.tw/{locale}/admin/settings
```

Keep v1 locales:

- `zh-Hant`
- `zh-Hans`
- `en`

Do not add `ja` until the frontend locale registry, CMS validation, sitemap alternates, and admin translation UI are ready.

## Rendering Modes

### Public Static Shell

Use for:

- layout chrome
- brand assets
- generic UI text
- robots when policy is static
- default Open Graph image if not content-specific

These can remain mostly static and i18n-driven. Header and footer components can be part of the shell, but their navigation, footer links, social links, contact display, and site SEO defaults should come from the published site-layout projection once CMS-backed rendering is enabled.

### Public Server Rendering

Use for:

- home page CMS sections
- news lists and details
- weekly latest/archive
- video list
- location list
- history timeline
- legal pages
- shared site layout from `GET /api/site-layout`
- SEO metadata derived from CMS
- sitemap data once CMS-owned routes exist

Server rendering should read published public API responses. It must not read CMS draft tables or internal service URLs directly from the browser.

### Public Revalidated Rendering

Use short revalidation for published public content if the runtime supports it.

Recommended starting policy:

| Surface | Revalidation |
| --- | --- |
| home | 60-300 seconds |
| news list | 60-300 seconds |
| news detail | 300 seconds |
| weekly latest | 60 seconds |
| weekly archive | 300 seconds |
| videos | 300 seconds |
| locations | 300-900 seconds |
| legal pages | 300-900 seconds |
| sitemap | 300 seconds |

`hhc-web-api` remains the source of truth through public projections and Redis. Next.js cache is only an edge/UI optimization.

### Admin Client Rendering

Use client-side authenticated calls for most admin screens.

Reasons:

- Account access tokens live in the browser auth flow.
- Admin API calls need bearer tokens.
- Admin data should not be cached publicly.
- Editors need interactive draft/save/publish state.

The server can render the admin shell, but protected content should load through admin API clients after token state is available.

## Data Fetching Rules

Browser public calls:

```text
/api/home
/api/news
/api/bulletins/latest
```

Browser admin calls:

```text
https://www.alive.org.tw/api/admin/*
```

Server-side public calls:

Start with the same public API contract:

```text
https://www.alive.org.tw/api/*
```

An optional internal server-only base URL can be added later for performance:

```text
HHC_WEB_SERVER_API_BASE_URL=http://api-gateway.internal/api
```

If added, it must return the same contract as the public gateway path and must not expose draft-only data. Do not let server-side fetching become a private bypass around public projection rules.

## API Client Configuration

Frontend variables:

```text
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_PUBLIC_BASE_URL=https://www.alive.org.tw
NEXT_PUBLIC_ADMIN_BASE_URL=https://admin.alive.org.tw
NEXT_PUBLIC_ACCOUNT_BASE_URL=https://account.alive.org.tw
```

Server-only variables:

```text
HHC_WEB_SERVER_API_BASE_URL=https://www.alive.org.tw/api
HHC_WEB_DATA_MODE=mock|api
HHC_WEB_PUBLIC_REVALIDATE_SECONDS=300
HHC_WEB_WEEKLY_REVALIDATE_SECONDS=60
```

Production browser default:

- use same-origin `/api` for public website reads from `www.alive.org.tw`
- use absolute `https://www.alive.org.tw/api/admin` for admin UI on `admin.alive.org.tw`

Local development can use `NEXT_PUBLIC_API_BASE_URL` to point to a local or staging API.

Do not configure production to use `api.alive.org.tw`.

## Static Export Cutover

Keep `output: 'export'` only while all production-rendered content can be built from local files.

Remove `output: 'export'` when any of these becomes production-critical:

- public page content is fetched from `hhc-web-api` at request time
- `generateMetadata` reads CMS public APIs
- sitemap reads `GET /api/sitemap-data`
- admin console is served by the same app
- preview routes require runtime request handling
- route-level rollback uses runtime data mode flags

Cutover steps:

1. Add API client and fixtures while keeping current static build.
2. Add server runtime config and ACA deployment for `hhc-web`.
3. Remove `output: 'export'` in a controlled branch.
4. Keep static mock fallback through `HHC_WEB_DATA_MODE=mock`.
5. Verify public routes in all locales on the Next server.
6. Switch staging gateway host routes to the Next server.
7. Switch production traffic after parity.

Rollback:

- route gateway traffic back to previous static deployment or previous ACA revision
- set `HHC_WEB_DATA_MODE=mock` if the server is healthy but API data is bad
- keep CMS data and asset grants untouched unless content publish state caused the issue

## SEO And Metadata

Public pages should generate metadata from public projections.

Rules:

- Metadata must never expose draft content.
- Metadata summaries derived from CMS body content must use validated structured blocks, not raw HTML.
- Canonical URLs use `www.alive.org.tw`.
- Admin pages should use `noindex`.
- Public locale alternates are generated only for supported locales.
- Missing translated public content should use explicit fallback rules from `hhc-web-api`, not ad hoc frontend guesses.
- Per-content Open Graph images use `asset-api` public gateway URLs.
- Legal pages keep stable slugs.

Sitemap behavior:

- Current static route registry can remain while only fixed routes exist.
- Once CMS news/detail/generic pages exist, `sitemap.ts` should read `GET /api/sitemap-data`.
- Sitemap should include only published and indexable content.
- Sitemap should exclude admin routes, draft preview routes, protected assets, and `/api/*`.

Robots behavior:

- Public `www.alive.org.tw` can allow public content.
- Admin host should return disallow/noindex behavior through headers or a host-specific robots response.

## Asset Delivery

Public CMS images and PDFs use `asset-api` gateway URLs:

```text
https://www.alive.org.tw/api/assets/public/{assetId}
```

Rules:

- Do not expose Blob URLs or SAS URLs.
- Do not proxy assets through Next.js API routes.
- Keep `images.unoptimized = true` until an explicit image optimization policy is designed.
- If Next image optimization is enabled later, it must fetch from gateway asset URLs and must not cache private/protected assets as public images.
- Protected/admin assets should use direct authenticated browser requests to `www.alive.org.tw/api/assets/protected/*` or admin asset APIs, not public image optimization.

## Admin Token Handling

Admin UI behavior:

- Redirect unauthenticated users to `account.alive.org.tw` Authorization Code with PKCE.
- Keep access tokens short-lived.
- Keep access token in memory or a hardened browser auth state as defined by the account token contract.
- Do not store refresh tokens in localStorage.
- Do not issue tokens from `hhc-web`.
- Do not refresh tokens through `hhc-web` API routes.
- All admin API calls go through gateway to `www.alive.org.tw/api/admin/*`.

Admin cache behavior:

- `Cache-Control: no-store` for admin HTML/data responses.
- No service worker caching for admin API responses unless a separate offline admin design exists.
- Clear sensitive client state on logout.

## Preview

CMS preview should use admin APIs, not public projections.

Recommended v1:

- Admin UI calls `GET /api/admin/preview/*` with bearer token.
- Preview renders inside admin UI or an authenticated route under `admin.alive.org.tw/{locale}/admin/preview/*`.
- Preview and public body rendering use the same structured block component whitelist where practical.
- Public website routes never show draft preview data.
- Preview responses are `no-store`.
- Preview routes are `noindex` and excluded from sitemap.
- Public preview tokens and anonymous draft-share links are out of scope for v1.

Do not add public preview tokens in v1. Add them later only if there is a real editorial sharing workflow with expiry, revocation, audit, and leak-response design.

## Caching And Failure Behavior

### Public Page Cache

Use layered caching:

1. `hhc-web-api` public projection cache in Redis.
2. Gateway response caching only for explicitly cacheable public GETs if configured.
3. Next.js revalidation/cache for public UI rendering.
4. Browser cache for static assets.

### API Failure

Public pages should handle API failure explicitly:

- show a stable empty state for optional sections
- return `notFound` for missing required content such as legal pages after API confirms `404`
- use stale data only if the API/client layer has a deliberate stale policy
- do not silently mix stale mock data into production API responses unless rollback mode is enabled

### Admin Failure

Admin screens should show:

- `401` login required
- `403` forbidden
- validation errors next to fields
- retry state for transient `5xx`
- unsaved change warning for editor state

## Security Headers

Public host:

- standard CSP allowing required fonts/images/scripts
- no direct Blob/SAS domains unless explicitly approved
- frame policy appropriate for public site
- HSTS once HTTPS is stable

Admin host:

- stricter CSP
- `X-Robots-Tag: noindex`
- `Cache-Control: no-store`
- no embedding unless explicitly needed
- restrict connect-src to `www.alive.org.tw/api/*` and `account.alive.org.tw`

## Deployment Model

`hhc-web` should deploy as an Azure Container Apps service behind `api-gateway`.

Recommended runtime:

- Node runtime image for Next server.
- Internal ingress only.
- Health route for process readiness.
- Gateway routes public/admin UI hosts to the service.
- No external direct frontend service URL in production.

Required health checks:

- process health
- ability to load locale messages
- optional public API dependency check reported separately so a content API outage does not make the UI process look dead unless policy requires it

## Frontend Module Migration

Preserve existing feature API function names during migration:

- `getNews`
- `getLatestWeekly`
- `getWeekly`
- `getWeeklyIssues`
- `getWeeklyIssuePage`
- `getVideos`
- `getLocations`
- `getHistoryTimeline`

Each adapter should support:

- fixture-backed tests
- mock mode for local/test
- API mode for staging/prod
- public envelope parsing
- typed mapping into current component props

Do not rewrite presentation components before the data source switch unless a component cannot represent the new published projection.

## Testing Matrix

Required tests:

- `next build` with server runtime config.
- public route render tests for all locales.
- adapter tests for API envelope to current feature model mappings.
- rich content renderer tests for every v1 structured block type.
- no public renderer uses `dangerouslySetInnerHTML` for CMS content.
- sitemap generation test with published CMS route fixture.
- metadata tests for canonical, alternates, title, description, and Open Graph image.
- admin host route test: UI renders, `/api/*` rejected by gateway.
- public host route test: `/api/*` routed to backend service, non-API routes routed to `hhc-web`.
- no production config references `api.alive.org.tw`.
- no public render exposes Blob URLs, SAS URLs, draft IDs, or private asset IDs.
- admin pages use `no-store` and `noindex`.

Smoke tests:

```text
GET https://www.alive.org.tw/zh-Hant
GET https://www.alive.org.tw/zh-Hant/literature-ministry
GET https://www.alive.org.tw/sitemap.xml
GET https://admin.alive.org.tw/zh-Hant/admin
GET https://admin.alive.org.tw/api/anything
GET https://www.alive.org.tw/api/bulletins/latest?locale=zh-Hant
```

Expected:

- public pages render
- sitemap includes published public routes only
- admin UI loads but does not expose data without login
- admin host API path is rejected
- public API path routes to backend

## Split Triggers

Split admin into a separate frontend app only when at least one is true:

- separate admin team or release cadence
- separate security review/deployment approval path
- admin bundle size materially affects public performance
- admin requires a different framework/runtime
- admin needs isolated downtime/rollback behavior

Add a dedicated frontend BFF only when at least one is true:

- multiple backend calls must be composed with user-specific authorization that cannot reasonably live in a domain service
- frontend needs server-side session protection that account/gateway cannot provide
- there is a clear owner for BFF route contracts, audit, and security

The BFF must still follow `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`: it cannot become gateway-style business aggregation, cannot bypass domain authorization, and must prefer provider-owned APIs or explicit read models over public request fan-out.

Until then, keep `hhc-web` as UI and `hhc-web-api` as domain backend.

## Rollout Checklist

- [ ] Keep current static export until API-backed render path is tested.
- [ ] Add public API fixtures and adapter tests.
- [ ] Add server runtime config.
- [ ] Add host-aware UI routing/middleware if needed.
- [ ] Remove `output: 'export'` at API-backed production cutover.
- [ ] Verify `www.alive.org.tw/api/*` still routes to backend services, not Next route handlers.
- [ ] Verify `admin.alive.org.tw/api/*` is rejected.
- [ ] Verify public pages render in `zh-Hant`, `zh-Hans`, and `en`.
- [ ] Verify sitemap/SEO use published public data only.
- [ ] Verify admin pages are noindex/no-store.
- [ ] Keep rollback to previous frontend deployment or `HHC_WEB_DATA_MODE=mock`.
