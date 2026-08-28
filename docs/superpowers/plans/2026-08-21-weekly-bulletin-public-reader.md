# Weekly Bulletin Online Reader — Public Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish structured weekly bulletins as indexable web pages that reconstruct the PDF layout on desktop/iPad, reflow cleanly on phones, and can be explicitly saved for offline reading.

**Architecture:** `hhc-web-api` serves only immutable published projections. `hhc-web` renders the full document on the server at the canonical UI-locale/content-locale URL, then adds client-side page navigation, zoom, local search, and offline save. The existing native service worker is extended; no PDF renderer, Workbox, search service, or cross-bulletin index is introduced.

**Tech Stack:** Go 1.25, OpenAPI, TypeScript, Next.js 16, React 19, CSS, Cache Storage, IndexedDB, native Service Worker, Vitest, Playwright/browser smoke checks.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

## Global Constraints

- Desktop and iPad render structured content, never PDF pages or screenshots. The initial unedited extraction preserves source page count/component starts; later Admin edits render the published revision's immutable layout manifest and may use explicit continuation pages.
- Mobile uses the same typography/color language in a continuous responsive layout.
- The full meaningful text exists in initial semantic HTML for indexing and no-JavaScript reading.
- URL shape is `/{uiLocale}/literature-ministry/{issueNumber}/read/{contentLocale}`.
- Home resolves one whole edition: `zh-Hant -> zh-Hant`; `zh-Hans`/`en` prefer their edition then fall back wholly to `zh-Hant`; `ja`/`ko -> zh-Hant`. Never mix the PDF and online links from different editions.
- Archive displays all available content editions. Missing/unsupported routes return real 404 responses.
- A content edition has one canonical reader URL whose UI locale equals its content locale (`zh-Hant`, `zh-Hans`, or `en`); other UI-locale wrappers point to it.
- V1 search is only within the open bulletin; offline content is saved only by explicit user action.
- No Workbox, PDF.js, new state library, automatic archive cache, or automatic PDF cache.

---

### Task 1: Expose the immutable public online-bulletin projection

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/onlinebulletins/types.go`
- Modify: `internal/onlinebulletins/repository.go`
- Modify: `internal/postgres/repository.go`
- Create: `internal/httpapi/public_online_bulletin.go`
- Create: `internal/httpapi/public_online_bulletin_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/bulletins/types.go`
- Modify: `internal/bulletins/service.go`
- Modify: `openapi.yaml`

**Interfaces:**
- `GET /api/bulletins/by-number/{issueNumber}/online/{contentLocale}` returns one immutable published structured document plus revision, publication time, `pdfPublished`, nullable `pdfDownloadUrl`, and the revision-owned immutable layout manifest (page instances/boxes/slots/continuations, template version, permanent versioned template/font asset URLs, and SHA-256 checksums). PDF unpublish leaves this route `200` while clearing the PDF action.
- `GET /api/bulletins/online?offset={n}&limit={n}` is the new combined discovery projection: the server unions published PDF and Online editions first, sorts once by issue/date, then paginates issues and returns authoritative `total`. Each locale edition contains canonical title/subtitle plus optional Download and Online Read/revision actions. Existing PDF list/latest/by-number response semantics remain unchanged, avoiding a rollout window that could hide the current PDF card from old clients.
- `PublicOnlineDocument` is a separate closed mapper/DTO containing only renderable components/sentences/spans, stable public anchors, and layout manifest. It never serializes source asset identifiers/checksum, original-text snapshots, parser geometry/evidence, review issues, authorship, extraction metadata, or private state.

- [ ] Write failing service/handler tests for a published `zh-Hant` document, unpublished/missing online editions, Online-live + PDF-unpublished with canonical metadata/no Download, detail route remaining `200`, combined discovery latest/page/total when Online-only issues fall at the first/middle/page boundary, invalid locale, immutable layout manifest/checksums, historical revision reproducibility after a later template release, byte-for-byte compatible existing PDF list/latest/by-number responses, and negative JSON assertions for every internal evidence field.
- [ ] Run focused tests and confirm the public route and projection fields are missing.
- [ ] Query only the published revision pointer and map through `PublicOnlineDocument`; never expose drafts, extraction errors, Incoming snapshots, source evidence, review/authorship data, or private user data.
- [ ] Compute the strong ETag from the complete serialized public representation, including current PDF publication/grant state—not revision alone. Test that PDF unpublish and republish with an old `If-None-Match` return `200`, a new ETag, and the correct nullable URL; only an identical representation returns `304`.
- [ ] Add bounded closed OpenAPI schemas and preserve all existing bulletin fields.
- [ ] Run `go test ./... -race -count=1 -p=1`, `go vet ./...`, migration checks, and commit.

```bash
git add internal openapi.yaml
git commit -m "feat: publish structured weekly bulletins"
```

### Task 2: Publish the updated typed client

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`
- Modify: root `package.json`, all four `packages/*/package.json` manifests, and `pnpm-lock.yaml`

- [ ] Copy the Task 1 OpenAPI contract and regenerate the client.
- [ ] Add `listBulletinDiscovery({ offset, limit })` and `getPublishedOnlineBulletin(issueNumber, contentLocale, options?)`; map authoritative pagination, ETag, and not-found behavior without a second full-document type.
- [ ] Test both methods plus unchanged existing list/latest/by-number calls.
- [ ] Run generated checks, full package tests, lint, build, package packing, and consumer tests.
- [ ] Increment the current root patch version once, set it in the root and all four package manifests, run `pnpm install --lockfile-only` and `pnpm check:packages`, then PR, pass CI, merge, tag, publish all packages, and record the exact version consumed by `hhc-web`.

### Task 3: Permit the exact public route at the gateway

**Repository:** `api-gateway`

**Files:**
- Modify: `conf.d/default.conf`
- Modify: `docs/openapi.yaml`
- Modify: `docs/openapi_test.go`
- Modify: `scripts/test-www-routing.sh`
- Modify: `scripts/test-auth-method-matrix.sh`

- [ ] Add failing route-matrix cases for valid GET/HEAD, invalid locale, malformed issue number, and denied mutation methods.
- [ ] Permit exactly `GET/HEAD /api/bulletins/online` and extend only the existing public bulletin location regex for `/by-number/{number}/online/{zh-Hant|zh-Hans|en}`.
- [ ] Add the same public discovery/detail operations, methods, locale bounds, and responses to the gateway's canonical OpenAPI and contract tests in this PR.
- [ ] Keep the same rate-limit zone and `hhc-web-api` upstream; do not add authentication or a broad `/api/bulletins/` wildcard.
- [ ] Run `./scripts/test-www-routing.sh`, `./scripts/test-auth-method-matrix.sh`, `go test ./...`, `go vet ./...`, Nginx config validation, and commit.

```bash
git add conf.d/default.conf docs/openapi.yaml docs/openapi_test.go scripts
git commit -m "feat: route public online bulletins"
```

### Task 4: Implement whole-edition resolution for Home and Archive

**Repository:** `hhc-web`

**Files:**
- Modify: `package.json`
- Modify: lockfile
- Modify: `src/features/weekly/types.ts`
- Modify: `src/features/weekly/public-api.ts`
- Create: `src/features/weekly/resolve-edition.ts`
- Create: `src/features/weekly/resolve-edition.test.ts`
- Modify: `src/components/home/WeeklyCard.tsx`
- Modify: `src/components/home/WeeklyCard.test.tsx`
- Modify: `src/components/literature-ministry/WeeklyArchive.tsx`
- Modify: corresponding locale message files

- [ ] Update to the exact client version published in Task 2.
- [ ] Remove the hand-written `PublicBulletin`, `PublicIssue`, `Envelope`, and request implementation from `public-api.ts`; keep it only as a thin UI mapper over the released `hhc-web-client`, and retain `types.ts` only for presentation types not generated by OpenAPI.
- [ ] Write the resolution table as failing tests. Explicitly assert: a `zh-Hans`/`en` PDF with no same-locale Online Document keeps that locale's PDF and returns no Online action; an Online-live edition whose PDF is unpublished keeps Online and omits Download; whole-card fallback to `zh-Hant` occurs only when the requested edition is absent; `ja`/`ko` always resolve the Traditional Chinese edition.
- [ ] Consume the server-combined discovery page directly and implement one pure edition resolver returning `{ contentLocale, pdfUrl?, readUrl? }`; both Home actions consume that same object so editions cannot mix. Do not merge independently paginated lists in the browser.
- [ ] Change Home from three edition buttons to one resolved Download and one conditional Online Read action.
- [ ] Keep Archive edition-specific, include Online-only editions from Online discovery, and independently show Online Read and Download only when each action is available for that exact edition.
- [ ] On discovery failure, retry the unchanged legacy PDF endpoint and render PDF-only Home/Archive with Online actions hidden; on discovery success do not require the legacy endpoint, so a legacy PDF-query failure cannot hide healthy Online or Download actions. Test both partial-failure directions and never replace healthy PDF UX with a whole-card error because Online discovery is unavailable.
- [ ] Run focused tests and commit with the reader route work in Tasks 5–7.

### Task 5: Add the canonical server-rendered reader route and metadata

**Repository:** `hhc-web`

**Files:**
- Create: `src/app/[locale]/literature-ministry/[issueNumber]/read/[contentLocale]/page.tsx`
- Create: `src/app/[locale]/literature-ministry/[issueNumber]/read/[contentLocale]/page.test.tsx`
- Create: `src/features/weekly-reader/api.ts`
- Create: `src/features/weekly-reader/metadata.ts`
- Modify: `src/app/sitemap.ts`

- [ ] Write failing tests for five UI locales, three content-locale segments, title/description, published-only fetch, real 404, sitemap entries, and canonical mapping: every UI wrapper for `read/zh-Hant` points to `/zh-Hant/.../read/zh-Hant`, with the equivalent self-locale canonical for future `zh-Hans` and `en` documents.
- [ ] Fetch the public projection in the server component with `revalidate = 60`, following the existing news-detail fetch/error conventions.
- [ ] Render every sentence in initial HTML with headings, lists, paragraphs, scripture semantics, language attributes, page landmarks, and stable sentence IDs.
- [ ] Generate one canonical per content locale by using that content locale as the canonical UI locale; UI-localized duplicates point to it, and hreflang lists only independently published content editions.
- [ ] Add exactly one sitemap URL per published content edition—the canonical URL whose UI locale equals content locale. Keep `ja`/`ko` and other UI wrappers, unpublished editions, and missing editions out of the sitemap.
- [ ] Run route/metadata/sitemap tests.

### Task 6: Reconstruct desktop/iPad pages and responsive mobile flow

**Repository:** `hhc-web`

**Files:**
- Create: `src/components/weekly-reader/WeeklyReader.tsx`
- Create: `src/components/weekly-reader/WeeklyReader.test.tsx`
- Create: `src/components/weekly-reader/BulletinPage.tsx`
- Create: `src/components/weekly-reader/ReaderToolbar.tsx`
- Create: `src/components/weekly-reader/PageNavigator.tsx`
- Create: `src/components/weekly-reader/SectionNavigator.tsx`
- Create: `src/components/weekly-reader/reader.css`
- Reuse: permanent Template V1 font/decorative bundle under `public/assets/weekly/v1/`
- Modify: `src/app/[locale]/layout.tsx`

- [ ] Write failing tests for direct page entry, previous/next, keyboard arrows, thumbnails, fit-page, fit-width, 75–250% zoom bounds, swipe, pinch, pan, mobile continuous order, and mobile jumps to cover/body sections/hymns/Summary/announcements/victories-prayers.
- [ ] Use CSS page aspect ratio and normalized geometry from the revision's immutable layout manifest for desktop/iPad; scale one active page without changing document data, and load only its versioned checksum-pinned template/font assets.
- [ ] Use native CSS media/container queries to switch phones to component flow; do not run a second parsing/layout algorithm in JavaScript.
- [ ] Build mobile section navigation directly from existing component IDs/headings with a native list/select; do not create a second table-of-contents data model.
- [ ] Preserve cover hierarchy, sermon columns/indentation, scripture/emphasis/body font roles, hymn layout, and the retained back-page sections.
- [ ] Load font/decorative URLs only from the revision manifest, verify the bundle was already published by the CMS-foundation prerequisite, and never substitute `next/font` build-generated URLs.
- [ ] Add accessible labels, focus order, reduced-motion handling, minimum touch targets, and non-gesture controls for every gesture action.
- [ ] Keep all text selectable by the browser and never draw text to canvas.

### Task 7: Add local search and explicit public offline save

**Repository:** `hhc-web`

**Files:**
- Create: `src/features/weekly-reader/search.ts`
- Create: `src/features/weekly-reader/search.test.ts`
- Create: `src/features/weekly-reader/offline-store.ts`
- Create: `src/features/weekly-reader/offline-store.test.ts`
- Create: `src/components/weekly-reader/ReaderSearch.tsx`
- Create: `src/components/weekly-reader/OfflineControl.tsx`
- Create: `src/components/weekly-reader/OfflineContentPage.tsx`
- Create: `src/components/weekly-reader/OfflineContentPage.test.tsx`
- Create: `src/components/weekly-reader/ResumeReadingPrompt.tsx`
- Create: `src/app/[locale]/literature-ministry/offline/page.tsx`
- Create: `src/app/[locale]/literature-ministry/offline/reader-shell/page.tsx`
- Create: `src/components/ServiceWorkerRegistration.tsx`
- Modify: `public/sw.js`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: existing Web Push service-worker registration code to reuse the shared registration

- [ ] Test sentence-level Traditional Chinese substring search, result ordering, next/previous result, jump-to-page/sentence, no cross-bulletin search, and offline search from the saved document.
- [ ] Build the in-memory index from the already loaded document with native string normalization; do not add a search dependency or server endpoint.
- [ ] Add a tiny Promise-based IndexedDB wrapper with public-document metadata/content, anonymous reading anchors, and an atomic active-revision pointer; no generic repository abstraction.
- [ ] Extend the existing service worker with an explicit allowlist for shell/font/revision-addressed public reader resources, retain current push/notification handlers, and bypass every request with `Authorization` plus `/api/bulletin-reader/*`.
- [ ] Cache one stable no-content reader shell per UI locale at `/{locale}/literature-ministry/offline/reader-shell`. Handle only the exact reader-route navigation regex network-first; on failure return that locale's shell while preserving the requested URL, then load only its issue/content locale active revision from IndexedDB. Never cache/replay an SSR reader HTML response as another revision, and show explicit unavailable when that edition was not saved.
- [ ] Add browser tests that fully close/reopen the installed app offline and directly navigate to both a saved reader URL (exact revision renders) and an unsaved reader URL (explicit unavailable); include a different saved issue to prove no stale substitution.
- [ ] Register the service worker independently of Web Push support and let Web Push reuse the resulting registration.
- [ ] Save only after the user chooses Save Offline; pin the exact revision, validate the layout manifest and SHA-256 of every required versioned template/font/content resource before marking it available, and remove only that bulletin when requested.
- [ ] Add `/{locale}/literature-ministry/offline` showing issue, content locale, revision, size, update state, and Remove; hide offline actions when required APIs are unsupported.
- [ ] When a newer revision exists, show Update Available; for anonymous readers fully download/validate the new revision then atomically switch the active pointer, retaining the old revision on failure. Private mutation sync/migration is added around this same state machine in the private plan.
- [ ] Save anonymous page/section progress locally and offer `Continue | Start over` when reopening; never upload anonymous progress.
- [ ] Handle quota/storage pressure with an explicit user choice and no automatic deletion; show online/offline/saving/updating/error state and keep PDF downloads outside offline storage.
- [ ] When an unsaved document is requested offline, render an explicit unavailable state and never substitute another issue or stale revision.

### Task 8: Verify, release, and visually accept the public reader

- [ ] Run `pnpm test:run`, `pnpm lint`, `pnpm build`, and the repository Docker build.
- [ ] Render 1731 and 1733 at representative desktop, iPad portrait/landscape, and phone widths; compare page count, component starts, type proportions, columns, indentation, and overflow against the PDFs.
- [ ] Verify no-JavaScript reading, semantic heading order, keyboard-only operation, 200% browser zoom, reduced motion, and screen-reader names.
- [ ] Measure production-like public entry and require p75 LCP at or below 2.5 seconds; page navigation, selection, search, and zoom controls must update from local state without waiting for a network response.
- [ ] Verify manifest/installability, save/read/search/resume/update/rollback/remove offline, storage-pressure handling, and unsupported-storage fallback in installed iOS/iPad Safari PWA and Android Chrome PWA; verify current/previous Chrome, Edge, Safari online, with Firefox install UI best effort only.
- [ ] Release in order: `hhc-web-api`, `frontend-platform`, `api-gateway`, `hhc-web`; require separate PR/CI/merge/release and live smoke evidence for each.
- [ ] Smoke all five UI locales, three content locales, fallback Home cards, Archive links, canonical metadata, sitemap, 404s, PDF download, and online read without private APIs.

```bash
git add src public package.json pnpm-lock.yaml
git commit -m "feat: add online weekly bulletin reader"
```
