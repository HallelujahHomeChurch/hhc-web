# Weekly Bulletin Member Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render authorized weekly bulletins as selectable HTML with PDF-like desktop/iPad layout, mobile reflow, a readable trace watermark, and explicit seven-day offline saves.

**Architecture:** Reuse PDF download's exact member entitlement check and Account runtime. The server sends a generic no-content shell; authorized browser requests fetch a closed published DTO and opaque trace receipt. Admin and member views use the same renderer from the existing shared UI package. Native Service Worker caches only shell/code-owned assets; explicit member saves live in account-scoped IndexedDB.

**Tech Stack:** Repository-pinned Go, PostgreSQL, OpenAPI, Next.js, React, shared UI, IndexedDB, native Service Worker, Vitest, browser acceptance.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

**Revision:** 2026-09-30. Filename retained for existing links; this plan no longer implements a public reader.

## Global Constraints

- No reader-specific permission, role, grant, token endpoint, or entitlement setting. Reuse the exact download checker before bulletin lookup.
- Edition identity is `(issueID, series, contentLocale)` everywhere. Current PDF combinations come from `bulletinEditions`; V1 Online template is general `zh-Hant` only.
- Reader URL: `/{uiLocale}/literature-ministry/{issueNumber}/read/{series}/{contentLocale}`. UI locale remains independent.
- All member responses, including errors and receipt/validation responses, are `private, no-store`; unauthorized/unknown is nondisclosing 404, entitlement dependency failure is 503. Gateway authentication may return 401 before the owner check.
- No member body/title in unauthenticated HTML, metadata, JSON-LD, sitemap, CDN caches, or Service Worker Cache Storage. Reader pages are `noindex, nofollow`.
- Paper is HTML, not PDF/canvas/screenshots. Use the shared renderer and immutable manifest/fonts, not a second layout algorithm.
- Keep the existing personalized PDF download job/action. Return edition/action identifiers, never public/SAS PDF URLs.
- Offline saves are explicit, account-bound, and expire 604800 seconds after successful server validation. This receipt is local evidence, never a server credential.
- No Workbox, invisible browser fingerprinting, anti-debugging, screenshot blocking, new state library, or automatic archive/PDF caching.

## Review Focus

- English access does not imply Traditional Chinese access: Task 3 tests fallback against authorized candidates only.
- Seven-day expiry and clock rollback lock content without losing pending notes: Task 6 tests boundaries and recovery.
- An old fetch/save finishing after account switch must not repopulate storage: Task 6 tests two-tab races.
- A faint mark can obscure dense CJK text and highlights: Task 7 requires actual visual approval, not an opacity assertion.
- PDF publication/download must survive Online failures: Tasks 1 and 3 test independent lifecycle and authorized PDF-only fallback.

---

### Task 1: Add the member projection and trace receipt

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/httpapi/member_online_bulletin.go`, `internal/httpapi/member_online_bulletin_test.go`
- Modify: `internal/httpapi/handler.go`, `internal/httpapi/protected_bulletin_handlers.go`
- Modify: `internal/onlinebulletins/types.go`, `internal/onlinebulletins/repository.go`, `internal/postgres/repository.go`
- Create: `internal/onlinebulletins/reader_receipt.go`, `internal/onlinebulletins/reader_receipt_test.go`
- Modify: `internal/bulletinwatermark/receipt.go`, existing privileged trace lookup/erasure tests, `docs/data-governance.yaml`, `openapi.yaml`
- Create: next available forward-only migration for reader receipts; do not edit applied migrations.

**Interfaces:**
- `GET /api/member/bulletins/online?series={series}&locale={locale}&offset={n}&limit={n}&issueNumber={optional}`: authorized same-edition union of PDF/Online publication, sorted/paginated once, with authoritative total. Optional exact issue-number filter resolves direct reader URLs without scanning archive pages.
- `POST /api/member/bulletins/{issueID}/versions/{locale}/online/access?series={series}` with `{revision?, clientRequestId, receiptId?}`: reuse download entitlement plus Online-published check; absent revision selects current. Return one `{document: MemberOnlineDocument, access: {accountId, documentId, series, contentLocale, revision, currentRevision, receiptId, traceCode, validatedAt, offlineValidUntil}}` only after receipt persistence succeeds. No member full-content GET exists. Times are server timestamps; `offlineValidUntil = validatedAt + 604800 seconds`. Trusted identity selects account. This records the existing authorization result, not a new permission or credential.
- Closed `MemberOnlineDocument` includes canonical/publication snapshot metadata, `metadataSyncPending`, IDs, content, manifest, `pdfPublished` and existing PDF action identifiers, never source/evidence/private state. Label pending metadata synchronization rather than silently retitling old paper.
- Terminal owner unavailability uses the existing typed `not_found` error envelope plus `X-HHC-Bulletin-Access: unavailable`, identical for denied/unknown/unpublished editions. Generic/unmarked 404 is not authority to delete local data. Emit the marker from the existing entitlement/Online availability path and document it in OpenAPI; it does not confer access.
- Reuse `clientRequestId` on issuance retries; reuse `receiptId` only for its owner and exact revision. Requested revisions must be retained published revisions of an Online-live document, never drafts. Report newer revisions without silently replacing pinned content.
- Store reader receipts separately from PDF fingerprint evidence, or use a closed channel discriminator with equivalent isolation. Reuse random-code generation, existing `cms:bulletins:investigate` lookup/audit, 365-day retention and erasure coverage. Lookup labels `online_reader` and means issuance only; never pass reader receipts to the PDF fingerprint decoder.

- [ ] Write failing `TestReaderUsesDownloadEntitlement` cases for all five PDF editions, allowed/denied/unavailable results identical to download, check-before-lookup, no new scopes, and staff CMS capability without member access.
- [ ] Test independent Online/PDF publication, series isolation, authoritative pagination, closed DTO exclusions, no-store on successes/errors, and unchanged existing PDF contracts.
- [ ] Test receipt ownership, retry idempotency, no issuance on denial, exact 604800-second expiry, same-revision renewal, historical-published versus draft binding, no visible PII, privileged lookup/audit, retention and erasure. Force receipt storage failure and assert no content response; full-content GET stays absent. Denied/unknown/unpublished share the typed error/marker; unrelated 404 does not.
- [ ] Run focused tests to establish failure, then implement in the existing member mux/checker. Do not create a public projection or PDF shortcut.
- [ ] Extend existing Website private-data export/erasure coverage with reader receipts before rollout; no staff endpoint returns private notes/highlights.
- [ ] Update owner OpenAPI and run repository Go/race/vet/migration/contract tests. Commit `feat: expose authorized online bulletin documents`.

### Task 2: Release contracts and exact member gateway routes

**Repositories:** `frontend-platform`, then `api-gateway` (separate PRs).

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`, generated types, `src/client.ts`, `src/client.test.ts`
- Modify: release-required package manifests/lockfile; discover the current package set instead of assuming four.
- Modify: `api-gateway/conf.d/api/www/30-content.conf`, `docs/openapi.yaml`, `docs/openapi_test.go`, `scripts/test-www-routing.sh`, `scripts/test-auth-method-matrix.sh`

**Interfaces:**
- `listOnlineBulletinDiscovery({series, locale, offset, limit, issueNumber?})`, `openOnlineBulletin({issueId, series, locale, revision?, clientRequestId, receiptId?})` use generated DTOs and existing Bearer callbacks.

- [ ] Write client tests for Bearer forwarding, exact selectors, no-store, cancellation, typed 401/404/503 errors and receipt retries.
- [ ] Regenerate from Task 1, implement only these convenience methods, run generated/test/lint/build/pack/consumer checks, and publish using current repository release policy.
- [ ] Test gateway exact GET/HEAD discovery and POST access routes (deny the removed full-content GET); deny method crossing, spoofed identity, anonymous/session-cookie-only callers, and malformed selectors.
- [ ] Implement in the existing member fragment; owner checks existing download entitlement. Keep `/priv/*` denied publicly, sync canonical OpenAPI, run routing/auth/Go/Nginx checks, commit and release producer before consumer.

### Task 3: Resolve authorized whole editions in Home and Archive

**Repository:** `hhc-web`

**Files:**
- Modify: `src/features/weekly/api.ts`, `src/features/weekly/types.ts`
- Create: `src/features/weekly/resolve-edition.ts`, `src/features/weekly/resolve-edition.test.ts`
- Modify: `src/components/home/WeeklyCard.tsx`, its tests, `src/components/literature-ministry/WeeklyArchive.tsx`, its tests, five locale message files, package/lockfile

**Interface:** `resolveEdition({uiLocale, series, authorizedEditions, publishedEditions})` returns one `{issueId, series, contentLocale, canDownload, readUrl?}` or none. PDF action uses existing authorized DownloadButton/job, not an Online JSON URL.

- [ ] Write failing table tests: zh-Hant preference; zh-Hans/en same-language then zh-Hant; ja/ko zh-Hant; candidates restricted to selected series and authorized editions. Denial is not evidence of absence.
- [ ] Test requested-language PDF without Online does not borrow another language's reader; Online-only keeps Read and omits Download; no authorized candidate produces neither action.
- [ ] Reuse `useBulletinAccess()`/`useBulletinAuthorization()` and generated client. Keep series selection; show one resolved Download and optional Read per selected series on Home, all authorized editions only in Archive.
- [ ] Use authoritative combined pagination. Only transient Online projection failure may fall back to the existing authorized PDF API; no fallback through 401/404 and no anonymous retry.
- [ ] Run focused tests, verify existing DownloadButton behavior unchanged, and commit.

### Task 4: Add the protected shell and shared renderer integration

**Repository:** `hhc-web`

**Files:**
- Create: `src/app/[locale]/literature-ministry/[issueNumber]/read/[series]/[contentLocale]/page.tsx` and test
- Create: `src/features/weekly-reader/api.ts`, `src/features/weekly-reader/api.test.ts`
- Create: `src/components/weekly-reader/WeeklyReader.tsx`, its test, `ReaderToolbar.tsx`, `PageNavigator.tsx`, `SectionNavigator.tsx`, chrome-only `reader.css`
- Modify: `src/app/sitemap.test.ts`, five locale messages
- Reuse: shared `BulletinDocumentRenderer`/paper CSS from CMS Task 3a, AccountControl runtime, code-owned template assets

- [ ] Test no body/title leak in unauthenticated HTML/metadata, noindex/nofollow, no member sitemap entries, generic no-JavaScript message, validated same-origin login return, loading/unavailable/retry states, and account switch during fetch.
- [ ] Resolve issue number to immutable issue ID only through authorized discovery. Reuse existing auth callbacks, never add a refresh timer/session-token route. Call the single idempotent access POST; its response contains both document and durable receipt. No second content fetch or rendering on a failed issuance.
- [ ] Render selectable semantic text with the same component/version as Admin. Only active desktop page participates in focus/reading order; mobile is continuous. Use shared warm UI tokens for chrome, validated light paper, and no separate font/slot CSS.
- [ ] Select the static shared renderer entry matching revision `rendererVersion`/`rendererArtifactSha256` and `layoutValidationHash`; never silently substitute the newest package renderer. Verify content/manifest integrity. Unknown/mismatched versions show update-required; no document-provided executable imports.
- [ ] Test Fit Page/Fit Width, 75–250% zoom, thumbnails, direct page entry, keyboard next/previous, mobile section jumps, source anchors and restoration.
- [ ] Implement spec gesture priority: multi-pointer pinch, zoomed pan before page swipe, movement over 8 CSS px suppresses toggle, native text selection wins, inputs retain arrow keys. Provide non-gesture equivalents.
- [ ] Run focused route/renderer/gesture tests and commit. Fix parity problems in shared code, not divergent consumer overrides.

### Task 5: Add the faint trace overlay and local search

**Repositories:** `frontend-platform` for overlay primitive, then `hhc-web` for integration.

**Files:**
- Create: `packages/ui/src/bulletin-reader/ReaderWatermark.tsx`, test; modify scoped paper CSS/export
- Create: `hhc-web/src/features/weekly-reader/search.ts`, test, `src/components/weekly-reader/ReaderSearch.tsx`
- Modify: `WeeklyReader.tsx` and test; Admin preview uses the released overlay with a synthetic code

**Interfaces:** `ReaderWatermark({traceCode})` overlays paper without layout participation. Search consumes already authorized content and returns ordered sentence anchors only.

- [ ] Test identical geometry with/without overlay, aria-hidden/nonselectable/pointer-transparent behavior, no PII, and no code in copy/note/search text.
- [ ] Implement faint repeated text in desktop paper and mobile content flow, not just a viewport corner. Admin previews a clearly synthetic code. No PDF job, invisible fingerprint, screenshot interception, or anti-removal script.
- [ ] Test CJK substring search, ordering and jumps using native string normalization; no cross-bulletin index/network search.
- [ ] Run tests and capture Task 7's visual matrix. Keep launch disabled until user readability approval; alpha alone is not proof.
- [ ] Release shared UI then consume its exact version in Website/Admin.

### Task 6: Implement explicit account-scoped seven-day offline saves

**Repository:** `hhc-web`

**Files:**
- Create: `src/features/weekly-reader/offline-store.ts`, test, `offline-access.ts`, test
- Create: `src/components/weekly-reader/OfflineControl.tsx`, `OfflineContentPage.tsx`, test, `ResumeReadingPrompt.tsx`
- Create: `src/app/[locale]/literature-ministry/offline/page.tsx`, `offline/reader-shell/page.tsx`
- Modify: `public/sw.js`, existing service-worker registration/Web Push integration, `AccountControl.tsx` and test

**Interfaces:**
- Keys include `accountId + documentId + series + contentLocale + revision`; active pointer and validated receipt are per account/document. Never persist tokens/session secrets.
- `evaluateOfflineAccess({binding, validatedAt, offlineValidUntil, now, lastObservedAt, logoutEpoch})` returns `available | expired | revalidation_required | unavailable`. Store server time/local high-water mark; clock rollback locks until validation, without claiming tamper resistance.
- Explicit save atomically stores content/manifest/hash-verified resources/receipt in IndexedDB. Cache Storage contains only generic shell/code-owned public assets. A disclosed deliberate local replica is distinct from HTTP caching; never cache authenticated responses.

- [ ] Test before/at/after 604800 seconds; no renewal by local read/token refresh/failed requests; rollback; binding; same-revision renewal; denied/unpublished purge; 503/network versus 401; no account/edition substitution.
- [ ] Test two-tab save-versus-logout and reconnect-versus-switch. Use account-scoped locks and an increasing logout epoch; abort requests and recheck epoch before storage commit. Missing required locking/storage hides offline save, not online reading.
- [ ] Implement Save Offline after server validation, staged resource validation, atomic pointer switch and failed-staging cleanup. Show issue, series, language, size, revision, expiry, update and removal. Save no PDF/archive.
- [ ] On open/foreground/reconnect, validate before sync. Network/503 cannot renew but may retain a valid save; 401 pauses sync and offers login while valid same-account saved content remains readable. Any 404 locks that edition immediately. Purge only for the documented owner not_found envelope plus unavailable marker; generic/unmarked 404 keeps data locked and reports deployment drift. Test wrong/missing gateway route cannot erase pending notes. Expiry locks content/writes but retains locked data for revalidation.
- [ ] Check expiry before every reader action and schedule the exact expiry deadline while visible; test a continuously open offline tab crossing the deadline and a suspended tab resuming afterward. No-explicit-save content is not available after authenticated access fails.
- [ ] On explicit logout/account change, remove all previous-account content, receipts, private replicas and pending writes in every tab; preserve no public copy. Warn about unsynced work before explicit removal/logout; learned revocation purges without waiting for confirmation.
- [ ] Extend native SW: network-only for `/api/member/*` and Authorization-bearing requests; exact reader navigation may fall back only to a no-content shell. Load only the bound explicitly saved unexpired revision. Preserve push handlers and registration independent of push permission.
- [ ] Test installed close/reopen offline, saved/unsaved URLs, different saved issue, logout then offline reopen, quota failure, unsupported APIs, and no member Cache Storage data.
- [ ] Offer Update Available; retain old revision on download failure only while access remains valid. Private plan wraps the switch with mapping/replay; rollback never bypasses expiry/revocation.
- [ ] Test old saved revision after app/SW/UI-package upgrade: matching renderer/assets stay available and reproduce the old geometry. If an update is declined, keep old view while valid and pause synchronization; never apply current-revision anchors to old content.
- [ ] Run focused offline/browser tests and commit.

### Task 7: Release and accept the complete member reader

- [ ] Run Website test/lint/build/Docker and shared UI parity checks. Keep entry disabled until private-interactions acceptance also passes.
- [ ] Compare 1731/1733 cover/body/hymn/back at desktop, iPad portrait/landscape/split view and 320/375px phones. Require original initial page count/start pages, no missing/clipped/overlapping text, and Admin/Website parity.
- [ ] Show with/without watermark, all three highlights and active selection, Fit Page/Fit Width, 75/100/200/250% reader zoom and 200% browser zoom. Require worst-overlay body contrast >= 4.5:1 and explicit user approval of actual reading screens. Passing render tests is not visual acceptance.
- [ ] Verify keyboard, screen-reader order/focus, reduced motion, 44px targets, note sheet/software keyboard, bottom-navigation/safe-area avoidance, and combined gestures.
- [ ] Measure shell LCP separately from authorized content readiness; target p75 authorized navigation-to-readable-content <= 2.5 seconds. Local navigation/search/selection does not wait for network.
- [ ] Release API, shared packages, gateway, then Website/Admin with separate PR/CI/merge/release/smoke gates. Use controlled test accounts/content; no unreviewed production mutations.
- [ ] Smoke five UI locales, authorized fallback, uniform deny/unknown, noindex/sitemap, receipt lookup/audit, original personalized PDF download, independent publication, seven-day expiry/revalidation and revocation/logout clearing.
- [ ] Record current/previous Chrome/Edge/Safari, iOS/iPad Safari PWA and Android Chrome PWA evidence. Firefox online is required; installation is capability-dependent. No claim of DRM or instant offline revocation.
