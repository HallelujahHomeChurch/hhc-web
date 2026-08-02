# News Images, Weekly Downloads, and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve weekly download feedback, give news editors optional detail/home images with safe fallback, simplify home and all-news list rendering, and show the complete history timeline without pagination.

**Architecture:** Keep `coverAssetId` as the detail image and add one optional `homeCoverAssetId`. The CMS API owns publication grants and exposes the selected home image through the existing public `imageUrl` field; public clients remain presentation-only. Downloads use a native anchor so Next.js never treats an asset as an application route.

**Tech Stack:** Go, PostgreSQL migrations, React, TypeScript, Next.js, Vite, Vitest, Go tests.

## Global Constraints

- Existing news records and detail cover behavior remain compatible.
- Both news images are optional; image-less news may be published.
- Home and all-news list image fallback is `home image -> detail image -> branded placeholder`.
- Home and all-news list items display only image, title, and date.
- Detail pages do not visually repeat the derived summary.
- Public history has no page state or pagination controls.
- No new dependencies.

---

### Task 1: CMS news asset contract

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/content/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/content/service.go`
- Create: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/migrations/sql/019_news_home_cover.sql`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/postgres/content_repository.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/publication/worker.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/httpapi/content_handlers.go`
- Test: matching `*_test.go` files in those packages

**Interfaces:**
- Consumes: existing news cover upload and asset grant APIs.
- Produces: `homeCoverAssetId` on admin content and optional multi-asset publication payloads.

- [ ] Write failing service/repository/worker/handler tests for zero, one, and two news images.
- [ ] Run focused Go tests and confirm failures describe missing home-image behavior.
- [ ] Add migration columns for draft/published home image and its public grant.
- [ ] Extend write/load/revision/delete/publication paths while preserving existing cover fields.
- [ ] Accept upload usage `detail|home` (default `detail`) and validate asset ownership namespace.
- [ ] Publish/revoke all present image grants idempotently; project the home fallback through `/api/home`.
- [ ] Run `go test ./...` and migration tests.

### Task 2: Frontend client and Admin editor

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/frontend-platform/packages/hhc-web-client/src/index.ts`
- Modify: `/Users/rayselfs/Projects/hhc/account/admin-fe/src/lib/cms-api.ts`
- Modify: `/Users/rayselfs/Projects/hhc/account/admin-fe/src/pages/content/ContentEditorPage.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/account/admin-fe/src/preferences/locale-context.tsx`
- Test: corresponding client and editor tests

**Interfaces:**
- Consumes: `homeCoverAssetId` and upload usage from Task 1.
- Produces: two clearly labelled optional image upload controls.

- [ ] Write failing client/editor tests for detail and home image uploads.
- [ ] Extend generated/manual client types without changing unrelated APIs.
- [ ] Present detail image and home image as two sibling upload rows with purpose-specific copy and status.
- [ ] Keep home image optional and explain its automatic detail-image fallback.
- [ ] Run package/admin tests, lint, and builds.

### Task 3: Public weekly and news UX

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/hhc-web/src/components/ui/DownloadButton.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/src/components/home/WeeklyCard.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/src/components/literature-ministry/WeeklyArchive.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/src/components/home/NewsSection.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/src/app/[locale]/news/[slug]/page.tsx`
- Modify: locale message JSON files
- Test: matching component tests

**Interfaces:**
- Consumes: public `imageUrl` already resolved by Task 1.
- Produces: non-navigating downloads and simplified news presentation.

- [ ] Write failing tests proving downloads use native download anchors and expose transient feedback.
- [ ] Implement a native download anchor with button-local `preparing` state and no page navigation.
- [ ] Remove summary from the shared home/all-news list cards and render image, title, and date only.
- [ ] Use an HHC-styled placeholder when `imageUrl` is absent.
- [ ] Render detail images uncropped with `object-fit: contain`; remove visible derived summary while retaining metadata.
- [ ] Run focused and full web tests, lint, and build.

### Task 4: Complete public history timeline

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/src/features/history/api.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/src/app/[locale]/about/page.tsx`
- Test: history API/page tests

**Interfaces:**
- Consumes: existing paginated public history API.
- Produces: one complete timeline payload with no `page` query state.

- [ ] Write a failing test with more than one API page.
- [ ] Fetch subsequent pages until `total` is exhausted, bounded by API page size 100.
- [ ] Remove page parsing, query-specific canonical metadata, and pagination controls.
- [ ] Run focused and full web verification.

### Task 5: Integration and release

- [ ] Review diffs for backward compatibility, grant cleanup, and accessible loading copy.
- [ ] Commit each repository on a `codex/` branch and open PRs.
- [ ] Merge only after CI succeeds.
- [ ] Deploy `hhc-web-api`, frontend platform package, Admin, then hhc-web.
- [ ] Verify live image fallback, image-less news, uncropped detail image, download behavior, and unpaged history.
