# Weekly Bulletin Online Reader — Public Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish structured weekly bulletins as indexable web pages that reconstruct the PDF layout on desktop/iPad, reflow cleanly on phones, and can be explicitly saved for offline reading.

**Architecture:** `hhc-web-api` serves only immutable published projections. `hhc-web` renders the full document on the server at the canonical UI-locale/content-locale URL, then adds client-side page navigation, zoom, local search, and offline save. The existing native service worker is extended; no PDF renderer, Workbox, search service, or cross-bulletin index is introduced.

**Tech Stack:** Go 1.25, OpenAPI, TypeScript, Next.js 16, React 19, CSS, Cache Storage, IndexedDB, native Service Worker, Vitest, Playwright/browser smoke checks.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

## Global Constraints

- Desktop and iPad render structured content, never PDF pages or screenshots, with the original page count and component start pages.
- Mobile uses the same typography/color language in a continuous responsive layout.
- The full meaningful text exists in initial semantic HTML for indexing and no-JavaScript reading.
- URL shape is `/{uiLocale}/literature-ministry/{issueNumber}/read/{contentLocale}`.
- Home resolves one whole edition: `zh-Hant -> zh-Hant`; `zh-Hans`/`en` prefer their edition then fall back wholly to `zh-Hant`; `ja`/`ko -> zh-Hant`. Never mix the PDF and online links from different editions.
- Archive displays all available content editions. Missing/unsupported routes return real 404 responses.
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
- `GET /api/bulletins/by-number/{issueNumber}/online/{contentLocale}` returns one immutable published structured document plus revision, publication time, and matching PDF URL.
- Existing list/latest/by-number responses add only `onlineAvailable` and `onlineReadLocale` per edition; old consumers remain compatible.

- [ ] Write failing service/handler tests for a published `zh-Hant` document, unpublished/missing editions, invalid locale, immutable revision headers, and list compatibility.
- [ ] Run focused tests and confirm the public route and projection fields are missing.
- [ ] Query only the published revision pointer; never expose drafts, extraction errors, Incoming snapshots, review issues, or private user data.
- [ ] Send strong ETag for the immutable revision and `Cache-Control` compatible with the website's 60-second revalidation.
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
- Modify: package version files changed by the patch-version command

- [ ] Copy the Task 1 OpenAPI contract and regenerate the client.
- [ ] Add `getPublishedOnlineBulletin(issueNumber, contentLocale, options?)` and map ETag/not-found behavior without a second document type.
- [ ] Test the new method plus backward compatibility of existing list/latest/by-number calls.
- [ ] Run generated checks, full package tests, lint, build, package packing, and consumer tests.
- [ ] Patch-version, PR, pass CI, merge, publish, and record the version consumed by `hhc-web`.

### Task 3: Permit the exact public route at the gateway

**Repository:** `api-gateway`

**Files:**
- Modify: `conf.d/default.conf`
- Modify: `scripts/test-www-routing.sh`
- Modify: `scripts/test-auth-method-matrix.sh`

- [ ] Add failing route-matrix cases for valid GET/HEAD, invalid locale, malformed issue number, and denied mutation methods.
- [ ] Extend only the existing public bulletin location regex for `/by-number/{number}/online/{zh-Hant|zh-Hans|en}`.
- [ ] Keep the same rate-limit zone and `hhc-web-api` upstream; do not add authentication or a broad `/api/bulletins/` wildcard.
- [ ] Run `./scripts/test-www-routing.sh`, `./scripts/test-auth-method-matrix.sh`, `go test ./...`, `go vet ./...`, Nginx config validation, and commit.

```bash
git add conf.d/default.conf scripts
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
- [ ] Write the resolution table as failing tests, including `zh-Hans`/`en` missing-online, missing-PDF, and whole-card fallback to `zh-Hant`; assert `ja`/`ko` always use the Traditional Chinese edition.
- [ ] Implement one pure resolver returning `{ contentLocale, pdfUrl, readUrl? }`; both Home buttons consume that same object so editions cannot mix.
- [ ] Change Home from three edition buttons to one resolved Download and one conditional Online Read action.
- [ ] Keep Archive edition-specific and show Online Read beside Download only when that exact edition is published online.
- [ ] Run focused tests and commit with the reader route work in Tasks 5–7.

### Task 5: Add the canonical server-rendered reader route and metadata

**Repository:** `hhc-web`

**Files:**
- Create: `src/app/[locale]/literature-ministry/[issueNumber]/read/[contentLocale]/page.tsx`
- Create: `src/app/[locale]/literature-ministry/[issueNumber]/read/[contentLocale]/page.test.tsx`
- Create: `src/features/weekly-reader/api.ts`
- Create: `src/features/weekly-reader/metadata.ts`
- Modify: `src/app/sitemap.ts`

- [ ] Write failing tests for five UI locales, three content-locale segments, canonical URL, title/description, published-only fetch, real 404, and sitemap entries.
- [ ] Fetch the public projection in the server component with `revalidate = 60`, following the existing news-detail fetch/error conventions.
- [ ] Render every sentence in initial HTML with headings, lists, paragraphs, scripture semantics, language attributes, page landmarks, and stable sentence IDs.
- [ ] Generate canonical only for the exact requested UI/content pair; do not create hreflang links for editions that do not exist.
- [ ] Add published online-reader URLs to the dynamic sitemap and keep unpublished/missing editions absent.
- [ ] Run route/metadata/sitemap tests.

### Task 6: Reconstruct desktop/iPad pages and responsive mobile flow

**Repository:** `hhc-web`

**Files:**
- Create: `src/components/weekly-reader/WeeklyReader.tsx`
- Create: `src/components/weekly-reader/WeeklyReader.test.tsx`
- Create: `src/components/weekly-reader/BulletinPage.tsx`
- Create: `src/components/weekly-reader/ReaderToolbar.tsx`
- Create: `src/components/weekly-reader/PageNavigator.tsx`
- Create: `src/components/weekly-reader/reader.css`
- Add: legal self-hosted font files under `src/app/fonts/weekly/`
- Modify: `src/app/[locale]/layout.tsx`

- [ ] Write failing tests for direct page entry, previous/next, keyboard arrows, thumbnails, fit-page, fit-width, 75–250% zoom bounds, swipe, pinch, pan, and mobile continuous order.
- [ ] Use CSS page aspect ratio and normalized geometry from the document for desktop/iPad; scale one active page without changing document data.
- [ ] Use native CSS media/container queries to switch phones to component flow; do not run a second parsing/layout algorithm in JavaScript.
- [ ] Preserve cover hierarchy, sermon columns/indentation, scripture/emphasis/body font roles, hymn layout, and the retained back-page sections.
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
- Create: `src/components/ServiceWorkerRegistration.tsx`
- Modify: `public/sw.js`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: existing Web Push service-worker registration code to reuse the shared registration

- [ ] Test sentence-level Traditional Chinese substring search, result ordering, next/previous result, no cross-bulletin search, and offline search from the saved document.
- [ ] Build the in-memory index from the already loaded document with native string normalization; do not add a search dependency or server endpoint.
- [ ] Add a tiny Promise-based IndexedDB wrapper with separate public-document metadata and content stores; no generic repository abstraction.
- [ ] Extend the existing service worker to cache the application shell/font assets and serve explicitly saved document responses/assets; retain current push/notification handlers.
- [ ] Register the service worker independently of Web Push support and let Web Push reuse the resulting registration.
- [ ] Save only after the user chooses Save Offline; verify all required entries before marking the document available and remove only that bulletin when requested.
- [ ] Show online/offline/saving/error state and keep PDF downloads outside offline storage.

### Task 8: Verify, release, and visually accept the public reader

- [ ] Run `pnpm test:run`, `pnpm lint`, `pnpm build`, and the repository Docker build.
- [ ] Render 1731 and 1733 at representative desktop, iPad portrait/landscape, and phone widths; compare page count, component starts, type proportions, columns, indentation, and overflow against the PDFs.
- [ ] Verify no-JavaScript reading, semantic heading order, keyboard-only operation, 200% browser zoom, reduced motion, and screen-reader names.
- [ ] Verify save/read/search/remove offline in installed iOS/iPad Safari PWA and Android Chrome PWA; verify current/previous Chrome, Edge, Safari online, with Firefox install UI best effort only.
- [ ] Release in order: `hhc-web-api`, `frontend-platform`, `api-gateway`, `hhc-web`; require separate PR/CI/merge/release and live smoke evidence for each.
- [ ] Smoke all five UI locales, three content locales, fallback Home cards, Archive links, canonical metadata, sitemap, 404s, PDF download, and online read without private APIs.

```bash
git add src public package.json pnpm-lock.yaml
git commit -m "feat: add online weekly bulletin reader"
```
