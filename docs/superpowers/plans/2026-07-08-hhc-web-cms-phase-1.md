# HHC Web CMS Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable foundation for HHC Web + CMS: `account.alive.org.tw` login/profile/security through standalone `account-fe` plus the existing account system, gateway-owned JWT validation, `www.alive.org.tw/api/*` API routing, reusable asset architecture, public API contracts, and CMS-ready frontend/backend boundaries.

**Architecture:** `api-gateway` is the first public gate. There is no `api.alive.org.tw`; all non-account APIs live under `www.alive.org.tw/api/*`. `admin.alive.org.tw` is the CMS console UI, and `account.alive.org.tw` owns account/OIDC/token/JWKS APIs. Backend services are Go microservices with owned PostgreSQL schemas, Redis for cache/short-lived state, Azure Blob Storage through `asset-api`, and Dapr service invocation behind the gateway.

**Tech Stack:** Next.js 16, React 19, TypeScript, Go, PostgreSQL, Redis, Azure Container Apps, Azure Blob Storage, Azure DevOps, Dapr service invocation, existing `api-gateway` Nginx edge.

**Detailed Architecture:** Use `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md` as the implementation-level source of truth for service boundaries, route policy, database ownership, events, cache, asset grants, and LINE bot weekly bulletin integration.

**HHC Web API:** Use `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md` for the main website backend, CMS core, public projection model, admin write model, and integration boundaries with asset, notification, and audit services.

**HHC Web API PostgreSQL Schema:** Use `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md` for `hhc_web` tables, indexes, constraints, module detail tables, bulletin tables, public projections, outbox rows, seed provenance, and migration rules.

**Public Projection/Cache Invalidation:** Use `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md` for projection versions, Redis keys, ETags, cache headers, negative cache, publish/unpublish invalidation, sitemap refresh, asset grant ordering, and LINE bot latest consistency.

**CMS Workflow:** Use `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md` for draft/save/preview/publish/unpublish, admin UI responsibilities, localization, asset picker, weekly bulletin management, and module-specific publishing rules.

**CMS Localization/Translation:** Use `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md` for source locale, translation status, stale translation warnings, fallback policy, per-locale publish, localized slugs, SEO alternates, and weekly bulletin locale consistency.

**CMS Admin Preview:** Use `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md` for admin-only draft/revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention.

**Structured Content Blocks:** Use `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md` for versioned `bodyJson`, v1 block types, renderer contract, inline link validation, body asset references, schema migrations, and no-raw-HTML rules.

**CMS Versioning/Rollback:** Use `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md` for revision snapshots, restore to draft, rollback publish, draft/published isolation, asset grant ordering, and rollback tests.

**Site Settings/Navigation:** Use `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md` for editable public navigation, footer links, social links, contact display, site SEO defaults, `GET /api/site-layout`, admin site-settings routes, and the split between runtime config, editorial settings, and frontend UI chrome.

**Account Token Contract:** Use `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md` for access token claims, refresh token rotation/revocation, JWKS rotation, admin browser token handling, and gateway-local validation boundaries.

**Account Admin Identity/RBAC Lifecycle:** Use `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md` for admin invitations, account-domain user management APIs, role grant/revoke, suspend/disable/offboarding, account audit events, and the separation of `cms.admin` from `account.admin`.

**Gateway Auth:** Use `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md` for Nginx route policy, local JWT verification, JWKS cache/rotation, trusted headers, failure modes, and gateway test matrix.

**Account FE And Gateway Login:** Use `docs/superpowers/plans/2026-07-09-hhc-account-fe-and-gateway-login.md` for the new `account-fe` project, account host routing, JWT verifier base-image decision, and admin login readiness gate.

**Authorization Policy Governance:** Use `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md` for role/scope catalog, route/action metadata, resource-level authorization, field-level response policy, policy drift checks, and `authz_policy` release evidence.

**Cross-Service Dependency/Query Governance:** Use `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md` for allowed synchronous calls, dependency-chain budgets, cross-service query ownership, read-model duplication rules, and integration adapter boundaries.

**Content Model:** Use `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md` for current route/component mapping, CMS modules, locale policy, SEO, slugs, and public projection compatibility.

**Content Migration/Bootstrap:** Use `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md` for source inventory, seed manifests, asset import, API fixture generation, public parity tests, and rollback when moving current mock/i18n content into CMS.

**Rendering/Delivery:** Use `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md` for the static-export to Next-server cutover, host-aware public/admin UI delivery, server-side public API reads, sitemap/SEO rendering, admin no-store/noindex behavior, and frontend rollback.

**SEO/URL/Discoverability:** Use `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md` for canonical URLs, locale alternates, slug validation, redirects, sitemap ownership, robots/noindex policy, Open Graph, structured data, and route metadata contracts.

**Accessibility/Performance/Media:** Use `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md` for WCAG baseline, CMS accessibility metadata, Core Web Vitals targets, responsive image derivatives, font/script policy, admin accessibility, and rollout gates.

**Frontend/Admin Roadmap:** Use `docs/superpowers/plans/2026-07-08-hhc-web-frontend-admin-component-roadmap.md` for public component migration and admin UI buildout.

**Security/RBAC:** Use `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md` for roles, scopes, route authorization, internal service identity, admin token handling, threat model, and incident defaults.

**Browser Security/HTTP Headers:** Use `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md` for route-class security headers, CORS, CSRF/origin checks, CSP rollout, cookie boundaries, cache headers, and asset download headers.

**Public Third-Party/Analytics/Consent:** Use `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md` for external link validation, provider registry, YouTube/map embed guardrails, analytics default-off behavior, consent categories, provider-scoped CSP, CMS restrictions, and no v1 tag-manager/analytics/consent service.

**Service Blueprint:** Use `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md` for repo layout, env vars, Dapr app ids, CI/CD, migrations, test gates, and service readiness.

**Cloud Runtime/Ops:** Use `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md` for Azure Container Apps topology, public ingress, Dapr, environment separation, data stores, secrets, networking, CI/CD, rollout, rollback, observability, backup, and recovery.

**Cloud Infrastructure/IaC:** Use `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md` for Infrastructure as Code, resource naming/tagging, canonical environment names, Azure DevOps workload identity, runtime managed identities, role assignments, drift checks, and infra release gates.

**Software Supply Chain/Artifact Provenance:** Use `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md` for source-to-production trust chain, private ACR, immutable image digest promotion, SBOM/provenance, scan gates, release manifest artifact fields, and compromised-artifact response.

**Production Go-Live/Cutover:** Use `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md` for DNS, TLS, custom domains, HSTS staging, first admin bootstrap, content seed readiness, traffic switch, rollback, post-launch monitoring, and Front Door/CDN adoption gates.

**Platform Backup/Restore/DR:** Use `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md` for PostgreSQL PITR, Blob soft delete/versioning/PITR decisions, Redis rebuild behavior, outbox/provider side-effect review, restore quarantine, RPO/RTO targets, and DR evidence packets.

**Local Dev/Test Environment:** Use `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md` for local profiles, dev scripts, port registry, local JWKS, Testcontainers/Azurite/fakes, deterministic seeds, CI gates, and staging smoke checks.

**Configuration/Feature Flags/Release Controls:** Use `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md` for typed config, env examples, Key Vault/secret rules, feature flags, kill switches, provider adapters, release controls, config fingerprints, and CI guardrails.

**Abuse Prevention/Rate Limits/Quotas:** Use `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md` for gateway route classes, service-owned quota rules, Redis counter boundaries, asset egress protection, notification abuse prevention, LINE webhook dedupe, future public form protection, and `429`/quota behavior.

**SLO/Observability/Runbooks:** Use `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md` for route-class SLOs, SLIs, page-worthy alerts, dashboards, runbooks, degraded modes, capacity tests, and cost guardrails.

**Production Runbooks/Incident Ops:** Use `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md` and `docs/runbooks/` for platform incident command, service runbooks, SEV lifecycle, evidence capture, operational drills, and promotion gates.

**Background Jobs/Worker Orchestration:** Use `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md` for service-owned workers, scheduled/manual ACA Jobs, job ledgers, leases, checkpoints, future scheduled-publishing rules, backfill controls, and worker release evidence.

**Data Classification/Privacy/Retention:** Use `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md` for data classes, minimization, token/secret handling, retention, deletion/redaction, logging, asset privacy, notification privacy, LINE privacy, and future sensitive-domain launch rules.

**API Standards:** Use `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md` for shared envelope, errors, pagination, idempotency, optimistic concurrency, headers, versioning, and OpenAPI rules.

**API Contract Governance:** Use `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md` for OpenAPI ownership, generated client boundaries, compatibility checks, gateway policy comparison, fixture strategy, and contract review workflow.

**Event Contract Governance:** Use `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md` for CloudEvents-compatible event envelopes, event JSON Schemas, examples, compatibility windows, replay tests, privacy classification, and worker/event release gates.

**Search:** Use `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md` for the post-v1 public/admin search design, projection-derived index rules, CJK tokenization, and `search-api` extraction triggers. Search is not required for this Phase 1 delivery.

**Audit Log:** Use `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md` for append-only audit storage, metadata policy, query authorization, retention, and producer outbox expectations.

**Rollout Matrix:** Use `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md` for deployment order, smoke tests, rollback paths, and completion evidence.

## Global Constraints

- Do not create or use `api.alive.org.tw`.
- `www.alive.org.tw` serves the public website and every non-account API path.
- `admin.alive.org.tw` is CMS console UI only; it calls protected APIs under `www.alive.org.tw/api/admin/*`.
- `account.alive.org.tw` owns account UI, account APIs, OIDC, token, and JWKS endpoints.
- The first implementation slice is standalone `account-fe`, existing `account-api`, and `api-gateway` routing/JWT boundary.
- Treat `account-api` as the existing capability source; verify current routes, claims, refresh/session behavior, and OAuth client support before adding account code.
- `admin.alive.org.tw` must wait for account login/profile/session and gateway protected-route smoke tests; it must not add a separate login flow.
- Account token/OIDC design must remain usable by a future desktop app with its own first-party OAuth client and PKCE flow.
- Account user management, admin invitations, session revocation, role assignment, suspend, disable, and offboarding stay in `account-api`; `hhc-web-api` consumes trusted role/scope headers only.
- Do not call `account-api` for per-request API token verification.
- `api-gateway` verifies bearer JWTs locally from cached JWKS and injects sanitized `X-HHC-*` identity headers.
- `api-gateway` routes and verifies only; it must not compose business data from multiple backend services.
- Backend API services should not have direct public ingress for API traffic.
- Public website reads must not create per-request cross-service fan-out; use `hhc-web-api` projections or a justified read/query service.
- CMS v1 uses draft/publish, not approval workflow.
- Current mock/i18n content moves to CMS through deterministic seed/import manifests and parity tests, not direct hand-edited SQL.
- Full LINE bot business workflows are out of scope for the core website platform, but weekly bulletin download is included as a consumer integration through `hhc-web-api`.
- Azure is the default cloud; avoid Azure-specific business logic in domain services.

---

## Phase Boundary

This Phase 1 plan does not build the full church platform. It first completes the account system through `account.alive.org.tw`, the existing `account-api`, and `api-gateway`; then it establishes protected admin routing, reusable asset handling, CMS contracts, notification/email direction, frontend integration foundations, and the roadmap for LINE bot weekly bulletin download. Later phases can add activity registration, member/pastoral data, groups, donations, full notifications, search, and broader LINE bot workflows.

## Task 0: Complete Account FE And Gateway Login Before Admin

**Repos:**

- `/Users/rayselfs/Projects/hhc/account/account-fe`
- `/Users/rayselfs/Projects/hhc/account/account-api`
- `/Users/rayselfs/Projects/hhc/account/api-gateway`

**Interfaces:**

- `account.alive.org.tw` serves the `account-fe` UI.
- Account API calls use `https://account.alive.org.tw/api/account/v1/*`.
- OIDC discovery and JWKS stay on `https://account.alive.org.tw`.
- `account-fe` owns login/profile/security browser UI.
- `account-api` owns account APIs: login, MFA/setup-required handling, profile, security, linked accounts, devices, user profile, sessions, refresh token rotation/revocation, roles/scopes, OAuth clients, native-app PKCE, and JWKS.
- `account-api` should be checked first, not reimplemented, when a needed account feature appears missing.
- `api-gateway` routes the account host and later validates access tokens for protected non-account APIs using account JWKS.

**Steps:**

- [ ] Confirm `account-api` currently provides the account routes needed for login, MFA/setup-required, profile, security, linked accounts, and devices.
- [ ] Create the standalone `account-fe` project under `/Users/rayselfs/Projects/hhc/account/account-fe`.
- [ ] Remove any accidental account console implementation from `account-api`.
- [ ] Confirm first-admin login handles `mfa_type: "setup_required"` instead of treating it as a failed login.
- [ ] Confirm `account-api` exposes OIDC metadata, token, refresh/revoke, profile, and JWKS endpoints for `account.alive.org.tw`.
- [ ] Confirm the existing `account-api` route and claim names match the docs before changing code.
- [ ] Confirm account OAuth client registration can support both `hhc-admin` and a future desktop app client with PKCE.
- [ ] Configure `api-gateway` to route `account.alive.org.tw` account UI/API/OIDC/JWKS paths and reject unrelated API paths on that host.
- [ ] Record and implement the gateway base decision: keep Nginx for account host routing first; add a local Go JWT verifier sidecar/process before protected admin APIs.
- [ ] Verify login, profile load, refresh/session expiry, logout, and JWKS retrieval through the gateway.
- [ ] Freeze token claims needed by admin: issuer, audience, subject/user id, `jti`, `sid`, roles, scopes, and token type.
- [ ] Do not start `admin.alive.org.tw` implementation until this task passes.

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
- Account login/profile must already work through gateway before admin routes are enabled.
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
  - Public website feature routes such as `/api/home`, `/api/news`, `/api/bulletins`, `/api/pages/*`, `/api/videos`, `/api/locations`, and `/api/sitemap-data` are unauthenticated and read-only.
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
- Create: `docs/api/internal-audit-api.md`
- Modify: `docs/api/account-api.md`

**Interfaces:**

- Public API base path: `https://www.alive.org.tw/api`, using feature-based paths instead of a fixed `/api/public/*` prefix.
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
- [ ] Document `GET /api/site-layout` for shared public header, footer, navigation, social links, contact display, and site SEO defaults.
- [ ] Document admin endpoints for content draft CRUD, publish/unpublish, weekly issue/version management, and asset lifecycle.
- [ ] Document admin preview endpoints for content, bulletins, site settings, draft/published/revision modes, and no-store/noindex behavior.
- [ ] Document structured content `bodyJson` schema, allowed block types, link validation, body asset refs, and render-ready projection shape.
- [ ] Document admin site settings endpoints for read, patch, publish, unpublish, revision list/detail, restore-to-draft, and rollback-publish.
- [ ] Document admin revision list/detail, restore-draft, and rollback-publish endpoints for content and bulletins.
- [ ] Document `asset-api` upload session, completion, metadata, grants, visibility, and download flows.
- [ ] Define service-owned OpenAPI locations and contract governance gates for implemented services.
- [ ] Define `api/events/` ownership and event JSON Schema/example requirements for implemented event producers.
- [ ] Define protected route authorization metadata: required scopes, action ids, resource checks, field-level response policy, and admin UI capability map.
- [ ] Add OpenAPI validation, compatibility, and generated-client compile checks to the implementation roadmap.
- [ ] Add event schema validation, old/current fixture compatibility, replay, and classification-review checks to the implementation roadmap.
- [ ] Add authorization policy drift checks across role bundles, gateway route policy, OpenAPI metadata, service policy, docs, and admin UI capability map.
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
- [ ] Document internal audit API as service-to-service only, not a public browser API.
- [ ] Document account-domain admin invitation, user, role, session revoke, suspend, disable, and unlock routes.
- [ ] Add examples for weekly PDFs, news cover images, LINE group files, and desktop cloud-folder objects.
- [ ] Review current TypeScript feature types and keep response shapes compatible with `NewsItem`, `WeeklyIssue`, `VideoItem`, `LocationItem`, and `HistoryTimelinePayload` where practical.

## Task 3: Convert `hhc-web` To Feature-Based `www.alive.org.tw/api/*` Routes

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/public.ts`
- Create: `src/lib/api/errors.ts`
- Create: `src/components/content/RichContentRenderer.tsx`
- Create: `src/components/content/rich-blocks/*`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/weekly/api.ts`
- Modify: `src/features/videos/api.ts`
- Modify: `src/features/locations/api.ts`
- Modify: `src/features/history/api.ts`
- Modify: `src/mocks/handlers.ts`
- Modify: `next.config.ts`
- Create or modify: `src/middleware.ts` only for UI host/locale redirects if needed.
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
- `getSiteLayout(locale)`

**Steps:**

- [ ] Add an API client that defaults to same-origin `/api` in production.
- [ ] Use `NEXT_PUBLIC_API_BASE_URL` only for local/test overrides; production should not require `api.alive.org.tw`.
- [ ] Keep mock data as fallback only for local development when no API base URL is configured.
- [ ] Update feature `api.ts` files to call the public API client while preserving current exported function names.
- [ ] Add rich content renderer for public body blocks and verify it never uses `dangerouslySetInnerHTML`.
- [ ] Add a site-layout client method and wire header/footer/navigation/social/contact display to the published layout projection.
- [ ] Update MSW handlers to match the documented public API envelope.
- [ ] Update tests to cover API success, API error, empty list, and fallback-to-mock development behavior.
- [ ] Remove `output: 'export'` from `next.config.ts` when CMS/API-backed runtime rendering becomes the production data path.
- [ ] Do not create Next.js API route handlers for platform APIs; `/api/*` remains gateway-owned.
- [ ] Add host-aware UI routing only for public/admin UI, not API auth.
- [ ] Verify with `pnpm test:run`, `pnpm lint`, and `pnpm build`.

## Task 4: Add CMS Admin Console Foundation

**Repo:** `C:\Users\IT\projects\hhc-web`

**Files:**

- Create: `src/app/[locale]/admin/page.tsx`
- Create: `src/app/[locale]/admin/preview/content/[id]/page.tsx`
- Create: `src/app/[locale]/admin/preview/bulletins/[issueId]/page.tsx`
- Create: `src/app/[locale]/admin/preview/site-settings/page.tsx`
- Phase 1 keeps admin inside the current Next app. Splitting to `apps/admin` is a Phase 2 migration after auth and content flows are proven.
- Create: `src/features/admin/auth.ts`
- Create: `src/features/admin/content-client.ts`
- Create: `src/features/admin/components/AdminShell.tsx`
- Create: `src/features/admin/components/ContentList.tsx`
- Create: `src/features/admin/components/BlockEditor.tsx`
- Create: `src/features/admin/components/PublishControls.tsx`
- Create: `src/features/admin/components/AssetUploadField.tsx`
- Create: `src/features/admin/components/PreviewPane.tsx`
- Create: `src/features/admin/components/PreviewWarnings.tsx`
- Create: `src/features/admin/components/SiteSettingsEditor.tsx`

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
- [ ] Add account-management navigation as a link to account-owned UI or account-domain API integration; do not add `hhc-web-api` routes for user/role lifecycle.
- [ ] Add admin API client with token injection and clear handling for `401`, `403`, and validation errors.
- [ ] Add list/detail/edit screens for one representative content type first, preferably News.
- [ ] Add structured block editor controls for paragraph, heading, image, quote, buttonLink, divider, callout, and list.
- [ ] Ensure editor stores HHC block AST rather than editor-library native JSON.
- [ ] Add publish/unpublish controls matching the documented admin API.
- [ ] Add admin-only preview route/pane using `GET /api/admin/preview/*`, with Save Draft prompt for unsaved changes.
- [ ] Add revision history entry points for restore to draft and rollback publish, with role-gated controls.
- [ ] Add asset upload field that uses upload session then complete-upload flow.
- [ ] Add a Settings screen for site navigation, footer links, social links, public contact display, and site SEO defaults.
- [ ] Keep runtime config, secrets, service URLs, OIDC settings, storage provider details, and gateway route policy out of the Settings UI.
- [ ] Add tests for role-gated rendering, failed auth, validation errors, and successful draft publish.

## Task 5: Define Go Service Boundaries

**Repos:**

- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`

**Files per service repo:**

- Create: `cmd/server/main.go`
- Create: `cmd/worker/main.go`
- Create: `cmd/job/main.go`
- Create: `internal/http/routes.go`
- Create: `internal/config/config.go`
- Create: `internal/db/migrations`
- Create: `internal/auth/identity.go`
- Create: `internal/health/health.go`
- Create: `internal/audit/audit.go`
- Create: `internal/jobs/`
- Create: `README.md`
- Create: `azure-pipelines.yml`

**Interfaces:**

- Each protected service receives trusted identity only from gateway-injected `X-HHC-*` headers.
- Each service owns one PostgreSQL schema.
- Services expose `/healthz` and `/readyz`.
- Services return the shared JSON envelope.
- `notification-api` and `audit-log` are internal service-to-service only.

**Steps:**

- [ ] Create service repos or confirm existing repo names before implementation.
- [ ] Scaffold Go services with config, logging, health checks, PostgreSQL connection, Redis connection where needed, and Dapr-compatible HTTP routes.
- [ ] Add migrations for each owned schema.
- [ ] For `hhc-web-api`, implement the hybrid shared-content plus module-detail schema from the PostgreSQL schema design.
- [ ] Implement structured content block validation, body asset reference extraction, schema-version checks, and render-ready projection conversion.
- [ ] Implement third-party provider registry validation for external links, video ids, map links, and future embed blocks; reject arbitrary scripts, iframes, tracking pixels, Blob/SAS URLs, private hosts, and unregistered providers.
- [ ] Add database constraints for locale, status, content type, unique locale slugs, unique bulletin issue dates, and unique bulletin locale versions.
- [ ] Add optimistic concurrency version checks to admin update/publish/unpublish/archive flows.
- [ ] Implement revision snapshot creation for draft save, publish, unpublish, archive, seed, restore, and rollback actions.
- [ ] Implement restore to draft without public projection, sitemap, or public asset grant changes.
- [ ] Implement rollback publish as a new publish action that validates assets, creates required public grants, updates projections, and records audit.
- [ ] Implement `asset-api` first because CMS records depend on `asset_id`.
- [ ] Implement asset namespaces for `cms.weekly.pdf`, `cms.news.cover`, `cms.page.image`, `line.group.file`, and `desktop.cloud-folder.object`.
- [ ] Implement asset visibility and grant primitives for `public`, `authenticated`, `restricted`, and `private`.
- [ ] Implement `hhc-web-api` admin CRUD/publish flows, including modules for news, pages, videos, locations, legal pages, about/history, and weekly bulletins.
- [ ] Implement `hhc-web-api` admin preview render models for content, bulletins, site settings, and revision snapshots.
- [ ] Implement `hhc-web-api` site settings source tables, admin routes, validation, revision snapshots, and `site_layout:{locale}` public projection.
- [ ] Keep public analytics, tag managers, and third-party scripts disabled unless platform config, provider registry, CSP, privacy notice, and consent behavior are all present.
- [ ] Implement publish/unpublish behavior that grants or revokes public asset access.
- [ ] Implement `hhc-web-api` public read projections, projection version pointers, ETags, Redis cache repair, negative cache TTLs, and publish/unpublish invalidation.
- [ ] Implement service-owned worker entry points for publication workflow, projection refresh, audit outbox, asset scan/derivative, notification send/retry, and audit retention/export where applicable.
- [ ] Implement `job_run` ledgers for manual/scheduled/backfill jobs such as publication reconciliation, content seed/import, projection rebuild, upload cleanup, retention sweep, and restore reconciliation.
- [ ] Add lease, idempotency, retry, dead-letter, checkpoint, graceful shutdown, and duplicate-execution tests for each worker/job family.
- [ ] Implement `notification-api` with template registry, send queue/outbox, provider adapter, retry state, and delivery audit.
- [ ] Implement `audit-log` as an append-only internal service for protected content, asset, notification, and permission events.
- [ ] Add service-level tests for missing identity headers, insufficient roles/scopes, object-level authorization, field-level redaction, publish transitions, locale behavior, asset ownership, asset visibility, notification retry, event schema/envelope validation, outbox replay idempotency, and audit event writes.

## Task 6: Add LINE Bot Weekly Bulletin Download Roadmap

**Repo:** `C:\Users\IT\projects\hhc-line-function-bot`

**Files:**

- Modify: `src/types.ts`
- Modify: `src/function-arguments.ts`
- Modify: `src/functions/definitions.ts`
- Modify: `src/functions/modules.ts`
- Create: `src/functions/download-weekly-bulletin.ts`
- Create: `src/clients/hhc-web-api.ts`
- Modify: `src/config.ts`
- Add or modify tests under `src/__tests__`

**Interfaces:**

- Add function name: `download_weekly_bulletin`
- Add env var: `HHC_WEB_API_BASE_URL`, defaulting to `https://www.alive.org.tw/api`
- Bot calls:
  - `GET /api/bulletins/latest?locale=zh-Hant`
  - `GET /api/bulletins/{issueDate}?locale=zh-Hant`
- Bot replies with title, issue date, and the stable public download URL returned by `hhc-web-api`.

**Steps:**

- [ ] Add `download_weekly_bulletin` to `FUNCTION_NAMES`.
- [ ] Add a Zod argument schema with `issueDate`, `dateIntent`, and `locale`.
- [ ] Add function definition, examples, quick reply, and keyword fallback for latest and date-specific weekly bulletin requests.
- [ ] Add an `hhc-web-api` client that fetches published bulletin metadata and does not know about Blob or `asset-api` internals.
- [ ] Add the function module and register it only when the profile enables the function.
- [ ] Add tests for latest command routing, specific-date routing, disabled function behavior, successful API response, not found response, and timeout response.
- [ ] Verify with `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.

## Task 7: Deployment And Verification

**Repos:** `api-gateway`, `hhc-web`, and each Go service repo.

**Steps:**

- [ ] Add Azure DevOps path filters so frontend, gateway, and service deployments do not trigger each other accidentally.
- [ ] Add or verify IaC plan/what-if checks for cloud resources, managed identities, role assignments, tags, public ingress, and drift detection.
- [ ] Verify Azure DevOps deployment identities use workload identity federation or another approved secretless model instead of long-lived service principal secrets.
- [ ] Add private ACR access rules and separate build, deploy, and runtime identities so build can push images, deploy can update ACA revisions, and runtime can only pull approved repositories.
- [ ] Add pipeline gates for secret scan, dependency/license scan, Dockerfile/IaC/config scan, container image vulnerability scan, SBOM/provenance generation, and scoped exception review with expiry.
- [ ] Verify production deployments use immutable image digests, not `latest`, `main`, `staging`, or `prod` tags.
- [ ] Verify staging smoke passes for the exact image digest later promoted to production; do not rebuild between staging approval and production promotion.
- [ ] Verify release manifests include source commit, pipeline run id, image repository/tag/digest, SBOM/provenance artifact reference, scan result, signature status, config fingerprint, compatibility results, approval, and rollback target.
- [ ] Verify worker/job changes include command/version, owner, trigger, runtime pattern, schedule/concurrency/missed-run policy, job ledger evidence, staging run evidence, and worker pause/rollback instructions.
- [ ] Add local dev/test profiles and scripts for frontend-only, web-api, asset, gateway-auth, bot-weekly, and full-platform verification.
- [ ] Add typed config validation, safe env examples, config fingerprints, feature flag registry, and kill-switch registry to production-impacting services.
- [ ] Add environment variables and secrets in Azure Container Apps for OIDC/JWKS, DB, Redis, Blob, notification provider, and service URLs.
- [ ] Add staging/test domains using the existing `-test.alive.org.tw` convention.
- [ ] Document production custom-domain, DNS, TLS certificate, HSTS staging, and no-`api.alive.org.tw` cutover plan before production traffic.
- [ ] Add first-admin bootstrap evidence for account-owned admin creation/invitation, emergency named users, expiry/revocation plan, and account audit evidence.
- [ ] Document and verify production backup/DR settings before production traffic: PostgreSQL PITR retention and redundancy decision, Blob soft delete/container soft delete/versioning or PITR decision, Redis rebuild policy, restore quarantine controls, and accepted RPO/RTO targets.
- [ ] Verify CI runs with generated local JWKS, ephemeral PostgreSQL/Redis, Azurite or fake Blob, fake providers, and deterministic seeds instead of production secrets.
- [ ] Verify fake providers, wildcard CORS, local hosts, and disabled auth defaults cannot run silently in production.
- [ ] Verify application `ENVIRONMENT` values are limited to `local`, `test`, `staging`, and `prod`.
- [ ] Verify resource tags include workload, environment, service, owner, data classification, managedBy, criticality, and backupRequired where applicable.
- [ ] Verify production-routed deployables have runbooks under `docs/runbooks/` and that release evidence links the relevant service runbook plus `docs/runbooks/platform-incident-command.md`.
- [ ] Run at least the gateway route rollback, JWKS rotation, PostgreSQL PITR quarantine, Redis projection rebuild, asset emergency takedown/restore reconciliation, audit append outage, notification provider disable, outbox/provider side-effect review, and LINE bulletin download staging drills before production traffic.
- [ ] Add header snapshot tests for public HTML, admin HTML, public API, admin API, public asset, protected asset, account refresh, and webhook route classes.
- [ ] Verify CORS allow/deny behavior, no credentialed wildcard CORS, admin unsafe-method origin checks, account refresh CSRF/origin checks, host-only account refresh cookie attributes, CSP report/enforce status, and admin/preview/protected `no-store`.
- [ ] Verify third-party governance: provider registry exists, CMS rejects unregistered providers and raw iframe/script input, current YouTube/Facebook/Google Maps values render as safe external links, optional embeds are click-to-load, analytics/tag-manager scripts are absent by default, consent reject keeps non-essential scripts unloaded, and CSP does not use broad wildcard provider rules.
- [ ] Verify representative rate-limit and quota behavior for public reads, admin writes, asset upload sessions, notification sends, LINE webhooks, and provider callbacks.
- [ ] Verify account lifecycle behavior for invite accept, invitation token reuse denial, role downgrade, session revocation, suspend, disable, and `cms.admin` versus `account.admin` separation.
- [ ] Verify authorization policy drift checks pass for account role bundles, gateway route policy, OpenAPI route metadata, service authorization registry, docs, and admin UI capability map.
- [ ] Run gateway verification:
  - public website feature routes such as `www.alive.org.tw/api/home`, `www.alive.org.tw/api/news`, and `www.alive.org.tw/api/bulletins` work without token.
  - `www.alive.org.tw/api/admin/*` missing token returns `401`.
  - invalid token returns `401`.
  - valid token missing role returns `403`.
  - valid publisher/admin token reaches upstream with sanitized `X-HHC-*` headers.
  - client-supplied spoofed identity headers are stripped.
  - `admin.alive.org.tw/api/*` does not expose backend APIs.
  - `account.alive.org.tw` routes account/OIDC/JWKS endpoints only.
  - route-class limits return `429 rate_limited` with `Retry-After` where configured.
- [ ] Run public site verification for all three locales, weekly download, news list, videos, locations, about/history, legal pages, sitemap, and SEO alternates.
- [ ] Run production go-live smoke set before lifting launch freeze: `www` public routes, `www/api/*`, `admin` UI, blocked `admin/api/*`, account OIDC/JWKS, admin login, negative auth, public `/priv/*` block, TLS, DNS resolution, and rollback target.
- [ ] Verify `GET /api/site-layout` returns published navigation, footer links, social links, contact display, and site SEO defaults without secrets, Blob/SAS URLs, internal hosts, admin URLs, or `/priv/*`.
- [ ] Verify structured content rejects raw HTML, unsafe links, unsupported block types, Blob/SAS URLs, and public renderer uses whitelisted components.
- [ ] Verify canonical URLs, sitemap data, noindex policy, slug redirects, and Open Graph metadata use published public projections only.
- [ ] Verify public pages have required accessibility metadata, stable image dimensions, derivative URLs, and representative performance checks.
- [ ] Verify source locale, translation status, stale translation warnings, per-locale publish, no silent public detail fallback, `meta.fallbackLocale` behavior when explicitly allowed, locale-specific slug redirects, and published-locale-only alternates.
- [ ] Verify event-producing services have committed event schemas/examples, old/current fixture validation, replay tests, classification review, and release manifest event compatibility evidence.
- [ ] Verify protected admin APIs reject valid tokens missing required scopes, object id probing, disallowed resource states, and unauthorized sensitive fields.
- [ ] Run CMS verification for draft create, preview, publish, unpublish, weekly PDF upload, news cover image upload, public asset grant/revoke, and file download.
- [ ] Verify preview responses are no-store/noindex, create no public projection/cache/sitemap/public grant, and never expose Blob/SAS URLs.
- [ ] Run CMS revision verification for draft revision, published revision, restore-to-draft no-public-change, rollback-publish public projection update, ETag change, and LINE bot latest consistency for bulletin rollback.
- [ ] Run weekly bulletin locale verification for latest and selected issue: requested locale returns the matching published PDF, missing locale returns clean not-found by default, and LINE bot does not silently send a different-locale PDF.
- [ ] Run notification verification for queued email, retry on provider failure, delivery audit, and no public browser access.
- [ ] Capture backup/DR evidence packet with restore point, measured RPO/RTO, restored-server quarantine proof, lifecycle/legal-hold reconciliation, asset grant verification, Redis rebuild proof, outbox/provider decision, public leakage checks, smoke checks, and promote/abandon/degraded decision.
- [ ] Confirm `api-gateway` deployment is treated as production-impacting because current `main` pipeline deploys to Azure Container Apps.
