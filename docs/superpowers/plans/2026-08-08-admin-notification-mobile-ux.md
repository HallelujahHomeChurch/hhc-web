# Admin Notification Mobile UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add searchable notification campaigns, responsive mobile actions, an in-header mobile search overlay, and explicit home/URL/dismiss push click behavior.

**Architecture:** Extend the shared React Aria search primitive with an opt-in mobile overlay. Keep Admin route/query state in the frontend, implement campaign search and click validation in engagement-api, pass the contract through hhc-web-api, and make the public service worker execute the resulting click behavior.

**Tech Stack:** React 19, React Aria Components, TypeScript 6, Vite 8, Vitest 4, Go 1.25, PostgreSQL, Next.js 16 service worker assets.

## Global Constraints

- Preserve HHC light/dark semantic tokens and existing product density.
- Mobile icon controls are 44 x 44 px with accessible names and no layout shift.
- Dialog confirmation actions retain text labels.
- `actionUrl` accepts only same-origin relative paths and is required only for `clickBehavior=url`.
- All changes use focused branches, PR CI, squash merge, and production release workflows.
- Apply TDD: every behavior change starts with a failing focused test.

---

### Task 1: Shared Header Overlay Search

**Files:**
- Modify: `frontend-platform/packages/ui/src/controls.tsx`
- Modify: `frontend-platform/packages/ui/src/styles.css`
- Test: `frontend-platform/packages/ui/src/primitives.test.tsx`
- Modify: `frontend-platform/packages/ui/package.json`

**Interfaces:**
- Produces: `ExpandableSearchFieldProps.mobileBehavior?: 'inline' | 'header-overlay'`.
- Produces: `.hhc-expandable-search--header-overlay` with mobile absolute positioning.

- [ ] Add a failing component test asserting the overlay class, input focus, Escape collapse, and focus restoration.
- [ ] Run the focused UI test and confirm it fails because `mobileBehavior` is unsupported.
- [ ] Add the opt-in class and mobile CSS anchored between the viewport edge and avatar.
- [ ] Add reduced-motion coverage and keep inline behavior unchanged.
- [ ] Run UI tests, lint, and build.
- [ ] Bump shared packages to `0.6.0`, commit `feat: add mobile header search overlay`, push, open PR, and publish after CI.

### Task 2: Campaign Search Contract

**Files:**
- Create: `engagement-api/internal/migrations/sql/010_campaign_search_indexes.sql`
- Modify: `engagement-api/internal/migrations/migrations_test.go`
- Modify: `engagement-api/internal/campaigns/store.go`
- Modify: `engagement-api/internal/campaigns/store_test.go`
- Modify: `engagement-api/internal/httpapi/handler.go`
- Modify: `engagement-api/internal/httpapi/handler_test.go`

**Interfaces:**
- Changes: `Store.List(ctx, page, perPage, query string) (Page, error)`.
- Consumes: `GET /priv/campaigns?q=<query>&page=<n>&perPage=<n>`.

- [ ] Add failing migration and store tests for `pg_trgm`, CJK substring search, translated content search, deterministic paging, and matching total count.
- [ ] Add failing handler test proving `q` reaches the store.
- [ ] Run focused Go tests and verify expected failures.
- [ ] Add the migration and parameterized search predicate; trim and cap query length at 120 characters.
- [ ] Pass `q` through the HTTP handler and test fake.
- [ ] Run `go test ./...` and `go test -race ./... -count=1 -p=1`.
- [ ] Commit `feat: add campaign search`, push, and open PR.

### Task 3: Push Click Behavior Contract

**Files:**
- Modify: `engagement-api/internal/campaigns/store.go`
- Modify: `engagement-api/internal/campaigns/store_test.go`
- Modify: `engagement-api/internal/campaigns/worker_test.go`
- Modify: `engagement-api/internal/deliveryclient/client.go`
- Modify: `engagement-api/internal/deliveryclient/client_test.go`

**Interfaces:**
- Produces: `ClickBehavior` values `home`, `url`, and `dismiss`.
- Extends: `Translation.ClickBehavior string \`json:"clickBehavior,omitempty"\``.
- Produces push payload keys `clickBehavior` and `actionUrl`.

- [ ] Add failing validation tests for valid modes, URL-required behavior, URL rejection for home/dismiss, and legacy normalization.
- [ ] Add failing delivery payload tests for all three modes and locale fallback.
- [ ] Run focused tests and verify expected failures.
- [ ] Implement normalization and validation without changing email behavior.
- [ ] Include normalized behavior in web-push delivery payloads.
- [ ] Run all engagement-api tests and amend the campaign search commit only if it has not been pushed; otherwise create `feat: add push click behavior`.

### Task 4: Proxy/OpenAPI Contract

**Files:**
- Modify: `hhc-web-api/openapi.yaml`
- Modify: `hhc-web-api/internal/httpapi/handler_test.go`

**Interfaces:**
- Documents: campaign list `q` query and translation `clickBehavior` enum.
- Preserves: the existing transparent query-string proxy.

- [ ] Add a failing proxy test for forwarding `q`, page, and perPage together.
- [ ] Update OpenAPI schemas and query parameters.
- [ ] Run `go test ./...`.
- [ ] Commit `docs: extend campaign notification contract`, push, and open PR.

### Task 5: Admin Search and Conditional Click Fields

**Files:**
- Modify: `admin-fe/src/components/AppLayout.tsx`
- Modify: `admin-fe/src/pages/CampaignPages.tsx`
- Modify: `admin-fe/src/pages/CampaignSchedulePages.tsx`
- Modify: `admin-fe/src/lib/cms-api.ts`
- Modify: `admin-fe/src/lib/mock-cms-api.ts`
- Modify: `admin-fe/src/preferences/locale-context.tsx`
- Test: `admin-fe/src/App.test.tsx`
- Test: `admin-fe/src/lib/campaign-contract.test.ts`

**Interfaces:**
- Consumes: shared `mobileBehavior="header-overlay"`.
- Consumes: campaign `q` query and localized `clickBehavior`.

- [ ] Add failing tests that `/campaigns` and `/campaign-schedules` show the header search and preserve `q` in the URL.
- [ ] Add failing API test that campaign search sends encoded `q` and resets pagination.
- [ ] Add failing form tests for home/url/dismiss conditional fields and payload cleanup.
- [ ] Implement route support, request cancellation/latest-response handling, server campaign search, and bounded local schedule filtering.
- [ ] Add localized click behavior Select; show required URL only for `url`, preserving unsent draft input when switching modes.
- [ ] Update mocks and three-language labels.
- [ ] Run focused tests.

### Task 6: Admin Responsive Action System

**Files:**
- Modify: `admin-fe/src/index.css`
- Modify: `admin-fe/src/pages/CampaignPages.tsx`
- Modify: `admin-fe/src/pages/CampaignSchedulePages.tsx`
- Modify: `admin-fe/src/pages/content/ContentEditorPage.tsx`
- Modify: `admin-fe/src/pages/BulletinDetailPage.tsx`
- Modify: `admin-fe/src/pages/CmsPage.tsx`
- Modify: `admin-fe/src/pages/content/ContentModulePage.tsx`
- Modify: `admin-fe/src/pages/AccessPage.tsx`
- Modify: `admin-fe/src/pages/OAuthClientsPage.tsx`
- Test: affected page/component tests

**Interfaces:**
- Produces CSS convention `.mobile-icon-action` and child `.mobile-action-label`.

- [ ] Add failing tests asserting accessible names remain present when visual labels are responsive.
- [ ] Add Lucide icons and responsive label spans to list/editor toolbar actions.
- [ ] Keep modal footer labels and filter labels unchanged.
- [ ] Add 44 px square mobile styling, 8 px gaps, stable spinner sizing, and desktop label restoration.
- [ ] Verify 375 px headers do not overflow and 1440 px retains icon-plus-text actions.
- [ ] Update admin to shared package `0.6.0`; run tests, lint, and build.
- [ ] Commit `feat: refine mobile admin actions`, push, and open PR.

### Task 7: Service Worker Dismiss Behavior

**Files:**
- Modify: `hhc-web/public/sw.js`
- Test: `hhc-web/src/lib/service-worker.test.ts`

**Interfaces:**
- Consumes payload `clickBehavior` and `actionUrl`.
- Behavior: `dismiss` closes only; `url` opens normalized path; `home` opens `/`.

- [ ] Add failing tests for dismiss-only no-focus/no-navigation, home default, URL navigation, and external URL rejection.
- [ ] Implement behavior normalization and early return for dismiss.
- [ ] Run `pnpm test:run`, lint, and build.
- [ ] Commit `feat: support dismiss-only notifications`, push, and open PR.

### Task 8: Visual and Release Verification

**Files:**
- No production file changes expected.

- [ ] Run all repository test/lint/build commands.
- [ ] Start Admin mock mode and capture 375, 768, 1024, and 1440 px screenshots in light and dark modes.
- [ ] Verify search overlays hamburger/brand, stays inside viewport, leaves avatar stable, closes on Escape/outside click, and restores focus.
- [ ] Verify list/create/edit pages use icons only on mobile and retain text on desktop; Dialog buttons retain text everywhere.
- [ ] Verify click mode field visibility and three-language labels.
- [ ] Wait for PR CI, squash merge in dependency order: frontend-platform, engagement-api, hhc-web-api, admin-fe, hhc-web.
- [ ] Confirm production release workflows and gateway health checks succeed.

