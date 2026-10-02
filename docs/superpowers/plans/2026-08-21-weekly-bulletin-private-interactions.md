# Weekly Bulletin Private Interactions and Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authorized members select sentences, apply fluorescent highlights, copy, write private notes and resume reading, including within a valid seven-day offline save.

**Architecture:** `hhc-web-api` owns account-isolated private state. Every browser state/mutation request reuses download's exact edition entitlement check; no separate reader permission. A compact IndexedDB replica/queue syncs only after successful reauthorization. Extend the existing Website DSR integration rather than resurrecting the old direct hard-delete callback design.

**Tech Stack:** Repository-pinned Go, PostgreSQL, OpenAPI, React/shared UI, IndexedDB, native Service Worker, Vitest, existing Account auth/DSR contracts.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

**Revised:** 2026-09-30.

## Global Constraints

- Identity is account + document (which uniquely includes issue, series, content locale); never a bare issue+locale.
- Reuse download authorization and `useBulletinAuthorization()`/existing Account runtime. No reader entitlement, extra membership approval, token endpoint or refresh loop.
- Private data is invisible to ordinary Admin CMS/trace lookup. Authorized subject DSR export/erasure is a separate audited lifecycle, not a browsing feature.
- Toolbar is exactly `[ yellow red blue ] Clear Copy Note`; three colors are one unseparated group. Clicking a selected sentence unselects it. Non-contiguous multi-selection is supported.
- Color atomically replaces all selected colors; Clear removes highlights only. Color/Clear/Copy retain selection; successful note save clears it, Cancel retains it. Mixed colors show no active swatch.
- Copy requires authorized reading or a valid explicit offline save; there is no anonymous reading/copy path.
- Explicit logout/account switch clears the prior account's local content, receipts, private data and pending writes. Expiry alone locks and retains data pending revalidation; learned denial purges that edition.
- Reading expiry is 604800 seconds. Mutation replay supports 90 days with 91-day terminal-result retention only AFTER current authorization; these windows never extend offline reading.
- No CRDT, WebSocket, background-sync dependency, rich-text notes, public notes or separate auth system.

## Review Focus

- Two editions share issue/language: Task 1 proves series and account isolation for every key/mapping.
- Swiping, native text selection and clicking overlap: Task 4 verifies gesture priority and keyboard exclusions.
- A note saved offline must visibly persist instead of waiting for an impossible server acknowledgement: Task 5 tests durable local save and failure.
- A revision changes while offline writes wait: Task 6 rebases before replay and preserves IDs/conflicts.
- DSR completion cannot falsely claim newly added reader data was covered: Task 7 requires explicit dataset coverage before finalization.

---

### Task 1: Store private state and publication mappings

**Repository:** `hhc-web-api`

**Files:**
- Create: next available `internal/migrations/sql/NNN_bulletin_reader_private_data.sql` after CMS/receipt migrations; allocate NNN from current main, never reuse 027.
- Create: `internal/bulletinreader/types.go`, `service.go`, `service_test.go`, `repository.go`
- Modify: `internal/postgres/repository.go`, repository integration tests, migration tests

**Interfaces:**
- Highlight unique `(user_id, online_document_id, sentence_id)`, color `yellow | red | blue`, version/timestamps.
- Note has account/document, plain text, ordered anchors, quote snapshot, version and inactive-anchor metadata.
- Progress stores page/component/sentence/revision per account/document.
- ReaderMigrationState stores applied published revision and unresolved conflicts per account/document.
- ProcessedMutation binds account/mutation ID to terminal result + canonical payload fingerprint, expires after 91 days; unseen operations older than 90 days require explicit recovery, not silent ID replacement.
- CMS publication mappings are retained published-to-published checkpoints. Draft saves never consume a checkpoint or a client transition limit.

- [ ] Write failing atomic multi-sentence recolor/Clear tests, notes unaffected, multiple notes, optimistic note-version conflicts, progress upsert and account/series isolation.
- [ ] Test unique/FK/color/length constraints, dedupe expiry index, no cross-database Account FK, edition lifecycle guards, and forward-only migration order.
- [ ] Implement services taking trusted user ID explicitly; never trust JSON account fields.
- [ ] Implement idempotent cloud migration: unchanged/moved retains IDs; split expands anchors; compatible merge combines; different colors create a stable user conflict; removed keeps inactive private quote. Repeated reads neither duplicate effects nor regress revision.
- [ ] Run focused failing then passing service/repository/migration tests and commit.

### Task 2: Add existing-member-authorized state and mutation APIs

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/httpapi/bulletin_reader_handlers.go`, test
- Modify: `internal/httpapi/handler.go`, `openapi.yaml`

**Interfaces:**
- Base: `/api/member/bulletins/{issueID}/versions/{locale}/online/reader` with required `series` query.
- `GET /state?series={series}&fromRevision={revision?}` reuses the download checker BEFORE data lookup, migrates that account's cloud state transactionally, and returns applied/current revision and optional bounded direct mapping/conflicts.
- `POST /mutations?series={series}`: ordered batch `{mutationId, createdAt, documentRevision, kind, baseVersion?, payload}`. Account comes from trusted gateway context.
- `resolveHighlightMigrationConflict {conflictId, chosenColor, currentRevision}` is a closed mutation variant using a new ID; successful resolution atomically updates color/conflict/migration state.
- `revision_changed` is nonterminal and does not consume the ID; after mapping, that ID can submit the corrected payload. Terminal IDs are bound to canonical payload fingerprints and reject different-payload reuse.
- Missing/corrupt mapping is `mapping_history_unavailable`, not an arbitrary checkpoint-count error. All responses use private/no-store and current download entitlement.

- [ ] Test identical download/state/write entitlement decisions, no CMS scope requirement or new reader permission, deny-before-lookup, series/cross-user rejection, duplicates, atomic failure, and no-store errors.
- [ ] Test 33+ draft saves and 40 published transitions, repeated cloud split/merge/remove migration, owned/current conflict resolution and missing-history behavior.
- [ ] Implement on the current trusted member mux with `requireBulletinEntitlement`; validate publication, revision and sentence ownership before writes.
- [ ] Bound batches to 100 actions, note text to 10000 Unicode code points, anchors to 500 per action/note, request bodies to 1 MiB. Reject oversized inputs with typed errors and no partial action-group writes; reflect limits in OpenAPI.
- [ ] Store terminal results for 91 days, prune in bounded batches, test replay before expiry. Client creation time is not a trusted server clock or authorization signal.
- [ ] Run Go/race/vet/contract/migration checks and commit.

### Task 3: Release typed client and protected gateway operations

**Repositories:** `frontend-platform`, `api-gateway`

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`, generated types, `src/client.ts`, test, current release manifests/lockfile
- Modify: `api-gateway/conf.d/api/www/30-content.conf`, canonical OpenAPI/test, routing/auth-matrix scripts

**Interfaces:** `getReaderState({issueId, series, locale, fromRevision?})`, `applyReaderMutations({issueId, series, locale, mutations})` use generated types and existing auth callbacks.

- [ ] Test Bearer/no-store/selector forwarding, conflict unions and replay decoding, then generate/release the client with current package checks.
- [ ] Test gateway exact GET/HEAD state and POST mutations, deny crossed methods/anonymous/session-cookie-only callers, strip forged identity and deny public `/priv/*`.
- [ ] Add exact routes to current member fragment, reuse JWT policy and owner entitlement enforcement. Do not add legacy `/api/account/v1/session/access-token`, change auth callers, or put locations in `default.conf`.
- [ ] Sync canonical OpenAPI, run gateway route/auth/Go/Nginx checks, commit and release separately.

### Task 4: Implement selection, toolbar and copy

**Repository:** `hhc-web`

**Files:**
- Create: `src/features/weekly-reader/selection.ts`, test, `copy.ts`, test
- Create: `src/components/weekly-reader/SelectionToolbar.tsx`, test
- Modify: `WeeklyReader.tsx`, chrome-only `reader.css`, five locale files
- Reuse: shared renderer sentence hooks and current AccountControl authorization callbacks

- [ ] Test select/unselect, ordered non-contiguous set, mixed colors, zero-selection toolbar absence, desktop page-change clearing, mobile cross-component selection, action retention and note cancellation.
- [ ] Implement selection as stable IDs in document order. Keep semantic spans/layout in shared renderer; do not create a second SentenceLayer that reflows the paper.
- [ ] Render exact order and fluorescent colors with accessible names, pressed/mixed state and >=44px targets. On narrow phones use two rows while keeping the three colors together, above existing bottom navigation/safe area; reserve visible content space.
- [ ] Test toolbar, note sheet and software keyboard at 320/375px and 200% zoom; sheet makes toolbar inert/hidden and restores invoking focus on close.
- [ ] Test swipe/drag/pinch versus click, native text selection precedence, 8px movement threshold, Enter/Space toggle, Escape clear, and no arrow capture in editable fields.
- [ ] Copy only during authorized/valid-offline reading, in document order with blank lines between components and suffix `— 第 {issueNumber} 期《{title}》`; no URL, trace code or private note text.
- [ ] On reauthentication preserve only same-account transient position/selection/action; recheck download authorization, resolve revision changes, then ask before a write. A new account clears the previous state. Reuse auth runtime rather than new hooks/token refresh logic.
- [ ] Run focused tests and commit.

### Task 5: Add private highlight, note and progress UI

**Repository:** `hhc-web`

**Files:**
- Create: `src/features/weekly-reader/private-state.ts`, test
- Create: `src/components/weekly-reader/NoteEditor.tsx`, `NotesPanel.tsx`, `ReaderPrivateState.tsx`
- Modify: `SelectionToolbar.tsx`, `WeeklyReader.tsx`, `ResumeReadingPrompt.tsx`

- [ ] Test atomic mixed-color replacement, Clear preserves notes, multiple notes, inactive quotes, note conflicts, success/cancel selection, debounced progress and auth failures.
- [ ] Fetch state after current authorization. A transient private-state failure need not block an already authorized document; confirmed owner entitlement denial invokes the common content purge; generic/unmarked 404 locks without deletion.
- [ ] Optimistically update highlights/progress with rejection rollback. Online notes finish on server acknowledgement. Within a valid explicit offline save, finish after durable IndexedDB enqueue, show Waiting for connection, and clear selection; local-storage failure keeps the editor/text/selection intact.
- [ ] Use a side panel only when at least 640px remains for the page; otherwise use a sheet, including narrow iPad. Mobile uses accessible bottom sheet; preserve viewport/selection and focus.
- [ ] Use plain-text existing controls, explicit Save/Cancel, length counter, current-bulletin My Notes and jump links, and Cloud/Local/Manual merge for version conflicts.
- [ ] Save progress on settled navigation/visibility change, never every pan frame. Offer Continue/Start over; reset uses the normal idempotent mutation.
- [ ] Run focused UI tests and commit.

### Task 6: Synchronize the account-bound offline replica

**Repository:** `hhc-web`

**Files:**
- Modify: `src/features/weekly-reader/offline-store.ts`, test, `offline-access.ts`, test
- Create: `src/features/weekly-reader/sync.ts`, test, `src/components/weekly-reader/SyncStatus.tsx`
- Modify: `ReaderPrivateState.tsx`, `AccountControl.tsx` and tests, `public/sw.js`

**Interfaces:** Reuse member-plan access evaluation/receipt, account lock/logout epoch and active pointer. Local private state and pending writes use the same account/document binding, not a new authorization store.

- [ ] Test offline durable enqueue, replay ordering/idempotency, highlight last-successful-write wins, note/delete conflicts, sync interruption, expiry/revalidation, revocation purge and two-tab logout-vs-sync.
- [ ] Queue one mutation per final action. Coalesce unsent progress only; optionally replace unsent highlight groups only for exactly identical anchor sets. Never split atomic groups or coalesce notes.
- [ ] Sync on start/reconnect/foreground only after current same-account download authorization. Use account-scoped locks and epoch checks; no dependence on Background Sync.
- [ ] Before replay on revision change, fetch direct mapping via state, rebase pending anchors, resolve ambiguous/differing-color merges and note conflicts, replay the same IDs, stage complete new content/state, then atomically switch pointers.
- [ ] If the user declines a revision update, display the pinned local replica while access is valid and show synchronization paused. Never attach current-revision state to the old renderer/document; resume only through the accepted mapping/update sequence.
- [ ] If mapping/replay/download fails, retain the old working revision only while access is valid. Expiry locks; confirmed denial clears. Never use old-revision rollback to bypass access policy.
- [ ] Conflict color resolution uses a new ID, shows source colors plus red/yellow/blue choice, and waits for acknowledgement before migration completes.
- [ ] Logout/account switch broadcasts a new epoch, aborts tabs and clears content/receipt/private/pending stores under lock; stale completions cannot write back. SW remains network-only for member APIs and all Authorization requests.
- [ ] 401 pauses sync and offers login; 503/network failure cannot renew the seven-day window; 404 immediately locks and pauses; only the member-plan typed owner unavailability envelope/marker permits purge, while generic route errors retain locked data for retry. Preserve locked pending writes on expiry alone.
- [ ] Mutations older than 90 days show Action required and retain IDs; no automatic resend/drop/renumber. Manual recovery is offered only after reauthorization. Status is Synced/Waiting for connection/Syncing/Action required.
- [ ] Run focused offline/sync/browser tests and commit.

### Task 7: Extend existing Website DSR coverage

**Repositories:** `hhc-web-api`, then `account-api`.

**Files:**
- Modify: `hhc-web-api/internal/httpapi/bulletin_watermark_dsr.go`, its existing DSR tests, owner repositories, `openapi.yaml`, `docs/data-governance.yaml`
- Modify: `account-api/internal/services/dsr_worker.go`, worker/export/scope tests, `internal/services/dsr_scope.go`, `internal/repository/dsr_finalize.go` and tests as required by the existing coverage contract
- Reuse: `account-api/internal/engagementclient` Website adapter and `HHCWebAPIURL`; no new generic erasure client or direct hard-delete sequence

**Interfaces:** Extend the current Website owner execution with explicit datasets for highlights, notes/anchors, progress, migration conflicts, processed mutation results and reader receipts. Preserve existing watermark datasets and stable DSR operation/idempotency identity. A scoped subject export is delivered only through current private DSR mechanisms, not CMS or trace lookup.

- [ ] Write owner export/restrict/erase tests proving every new dataset is included, correct subject scope, redaction of other accounts, deterministic pagination, idempotent zero-row completion and no raw content in logs.
- [ ] Test Account plan/preview/coverage includes reader datasets and does not accept old watermark-only evidence as full coverage. Interrupted execution, unavailable owner or a missing route must keep final account deletion blocked.
- [ ] Extend the existing Website adapter/contract rather than adding a second deletion coordinator. Restrict writes during DSR as existing owner policy requires, and prevent late in-flight mutations from recreating erased rows.
- [ ] Extend operator-visible coverage labels through existing generic owner evidence; ordinary CMS/trace APIs still cannot browse/export private annotations.
- [ ] Run both repositories' DSR/contract/Go tests plus controlled retry/failure smoke. Release owner support before Account coverage requires it; enable reader data writes only after both sides pass.

### Task 8: Final acceptance and launch

- [ ] Release owner schema/state/DSR first, then Account coverage, shared contracts, gateway and Website. Separate PR/CI/merge/release/smoke evidence per repository; preserve current PDF functionality.
- [ ] Verify signed-out content/copy unavailable, same-account login return, exact download/reader authorization parity and no new permissions to configure.
- [ ] Verify bulk colors/Clear/notes, shared renderer parity, actual watermark readability approval, keyboard/gesture/mobile sheet/bottom-nav behavior.
- [ ] With two accounts and two series verify no content, trace receipt, private state, cache or recovery leakage.
- [ ] Save 1739 explicitly, restart offline within seven days, search/copy/highlight/note/progress, reconnect and converge without duplicate writes. Test exact expiry, rollback clock, denied entitlement, Online unpublish, 503, logout and account switch.
- [ ] Publish controlled edit/split/merge/remove revisions while pending offline writes exist. Verify conflict resolution, same-ID rebasing, atomic pointer switch and failure rollback subject to access validity.
- [ ] Verify DSR private export/restrict/erase covers new datasets; missing/failed coverage prevents finalization and retry remains idempotent. Use controlled test data, not destructive production acceptance.
- [ ] Require current/previous Chrome/Edge/Safari and actual iOS/iPad/Android PWA evidence, plus user approval of watermark reading screens, before enabling the member Online entry.

## Local implementation checkpoint — 2026-10-02

**Status:** local implementation and final review fix pass complete; **not merge-ready or launch-approved**. Foundation Tasks 1–10, member Tasks 1–6 and private Tasks 1–7 have local completion evidence. Foundation Task 11, member Task 7 and private Task 8 retain their external acceptance/release gates. Unchecked acceptance items above must not be read as production evidence.

The user explicitly requested all implementation before merge. No feature-to-main merge, push, release, production data/infrastructure change, or feature-flag enablement was performed during this continuation. Keep all eight unmerged worktrees.

### Repository handoff

All branches are `review/weekly-reader-20260930`, under `.worktrees/weekly-reader-review-20260930/`. Each contains its fetched `origin/main` at the recorded base. These are verified snapshots, not a promise that the remote will never advance.

| Repository | Implementation head | Integrated main | Local evidence |
| --- | --- | --- | --- |
| hhc-web | `5ccf3e7` | `bbe97a5` | 560 Vitest tests / 102 files, 8 Node tests, 11 template assets, lint, typecheck, production build |
| hhc-web-api | `6d8940b` | `5f1cd09` | Full race suite with owned PostgreSQL, vet, OpenAPI validation; actual 1739/1740 extraction and Linux composition |
| frontend-platform | `ad29249` | `16d97d1` | Five-package tests/builds; latest client regression 57 tests; packed-consumer integration |
| admin-fe | `7b4e5ce` | `f7752f1` | 823 tests / 85 files with two workers, lint, build |
| asset-api | `432c5d5` | `ded08b5` | Full race suite with owned asset_test PostgreSQL, vet, release/what-if checks |
| api-gateway | `100ad57` | `67d6e16` | Race suite, vet, static policy checks, owned-image WWW runtime and template proxy checks |
| account-api | `dda510f` | `8a696aa` | Full race suite with owned PostgreSQL/Redis, vet, OpenAPI validation |
| audit-log | `5eb03a1` | `24adb8a` | Race suite, vet, regenerated event catalog; PostgreSQL integration was not configured |

Web verification: `pnpm test:run`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`. One existing upstream legal-navigation ESLint warning remains (zero errors). Admin's unconstrained run timed out in unrelated App cases; the complete two-worker rerun passed without skipping tests or increasing timeouts. OpenAPI validation is valid with existing-style warnings (Website 15; Account 43), not warning-free. Remote required CI has not been rerun on these local heads.

Local logs: `/tmp/weekly-web-final-handoff.log`, `/tmp/weekly-admin-main-final.log`, `/tmp/weekly-admin-main-build.log`, `/tmp/weekly-api-final-race.log`, `/tmp/weekly-api-final-openapi.log`, `/tmp/weekly-account-task7-final.log`, `/tmp/weekly-asset-main-test.log`, `/tmp/weekly-gateway-main-runtime.log`, `/tmp/weekly-audit-main-test.log`. These are local evidence, not release artifacts.

### Final review and fixes

One independent fresh-context reviewer reviewed all eight feature ranges. No Critical finding was confirmed; two Important findings were accepted and fixed in one TDD fix pass:

1. Stable device time behind server time wrongly locked freshly authorized reading. A local observation baseline now detects actual rollback; the local deadline is bounded by both seven local days and the server expiry. Reusing a receipt cannot extend it. Online action, offline commit/renewal and exact expiry regressions passed RED → GREEN.
2. Member `429` throttling wrongly locked a valid offline save. It now retains the original window and pending operations, without renewing expiry or automatic retry loops. Renewal and mutation-sync regressions passed RED → GREEN.

The executor regraded the reviewer's touch uncertainty after reproducing it in Chromium native-touch emulation: swiping on the paper generated `pointercancel`, whereas the reader margin generated `pointerup`. Reader pan/pinch arbitration now reaches nested paper clipping containers. Horizontal swipe produced page 2 → 3 with `pointerup`; vertical scrolling and native zoom remain browser-owned. A separate regression proved native pinch-zoom panning must not change pages, RED → GREEN. This does not certify physical iPad/Safari behavior.

The same expiry fix pass also reproduced manual Retry replaying an already acknowledged expired receipt indefinitely. Retire the validation request ID only after successful acceptance; unknown responses still retain their original ID. An idempotent-server regression passed RED → GREEN.

The note gutter was also bounded to the rendered paper rather than the full reader viewport after visual inspection showed a distant marker. Marker targets remain 44px and do not alter the immutable renderer artifact. Final full Web suite: 560/560. **Deferred minors: none from the final review.**

### Controlled visual evidence and known tradeoffs

- Actual originals: 1739 (12 source pages) and 1740 (16 source pages); latest extraction/composition outputs are the private `*-v15-linux.json` files, not raster PDF pages.
- HTML output after the source-page correction: 12 / 16 pages, with exactly one cover per issue and zero measured overflow. All extracted sentence IDs, complete concatenated span text, source references and per-page fragment membership are preserved. Six retained component kinds: cover, body section, hymn lyrics, back summary, announcements, victories/prayers. Roster, attendance and offering tables are excluded.
- Cover ends at the full-width weekly verse. Title/subtitle, Welcome and Worship each share a row; Work uses one line per point and native justification. Contact/address, QR codes/captions and scan invitation are omitted only from Online composition. Neither cover nor body/lyrics may generate continuation pages.
- Source page identity and count are mandatory. Independent columns, reclaimed paragraph whitespace and bounded typography retain source pages; an unfit document blocks review/publication rather than truncating text or adding pages. Future PDFs are protected by these gates, not a promise that arbitrary content always fits. Final desktop fidelity remains subject to user approval.
- Desktop: fit-width wheel scrolling reached 500px; next-page navigation changed page 3 → 4 and reset inner scroll to zero. No horizontal document overflow at 1365px.
- Tablet emulation: 820px paper layout and native-touch page turn verified in Chromium. Physical touch, native text selection and Safari arbitration still require acceptance.
- Mobile: 375px and 320px reflow without horizontal document overflow. At 320px, selection toolbar stays within the viewport, the yellow/red/blue targets each measure 44px, and actions retain the specified order. Real software-keyboard, 200% browser zoom and installed-device acceptance remain held.
- Local preview `http://127.0.0.1:5182/?issue=1739` (or `1740`) uses explicitly mocked member identity/receipt and a read-only private-write endpoint. Expected retry/waiting messages after progress writes are fixture limitations, not successful persisted-member acceptance.
- Screenshots inspected locally: `/tmp/weekly-v13-desktop-body.png`, `/tmp/weekly-v13-ipad-body.png`, `/tmp/weekly-v13-mobile375.png`, `/tmp/weekly-v13-mobile320-selected.png`. Watermark opacity still needs the user's reading approval with all three highlight colors.

#### Cover correction verification — 2026-10-02

- Unreleased renderer digest: `2f7d70d9a17579f6a15d7dc8f3eff88b2f4943abd50c595f7c78341bd2b093f9`; rebuilt the isolated Linux renderer and refreshed the local UI tarball in Web/Admin. No released renderer was overwritten (`origin/main` has no V1 artifact).
- New compact-cover and oversized-cover regressions observed RED, then GREEN. Full pinned Linux geometry suite: 34/34, including the 10-question / 5-song cover and existing body/lyrics/back composition. Source IDs, full span text and source evidence preserved for both real issues; zero measured overflow.
- Shared five-package suites: 252 tests; lint/build passed. Web: 560 tests, lint (one existing LegalRequiredNavigation warning), typecheck/build passed. Admin: 823 tests, lint/build passed.
- Artifact immutability/bundle, package-contract and two corpus tests passed. Stock `pnpm test:consumers` initially failed with `ERR_PNPM_INVALID_SELECTOR`: the pre-existing artifacts directory also contains a root `hhc-frontend-platform-1.0.32.tgz`, which that script incorrectly treats as a scoped shared package. Left that unrelated artifact and script unchanged; the identical consumer harness, staged with exactly the five scoped package tarballs, passed both Vite and Next builds (`/tmp/weekly-cover-clean-consumer.log`).
- Inspected actual shared-component output at `/tmp/weekly-cover-visual.kURpqL/{1739,1740}-paper.png` and `1740-mobile.png`. Both paper covers fit one page; both 390px mobile compositions have no horizontal overflow. These are rendered HTML/components with the pinned fonts, not PDF images or design mockups. They omit the host reader controls and watermark; this does not replace physical-device or watermark acceptance.
- The live local preview loaded the new 14/21-page documents. Interactive-browser screenshots timed out in Ego and Chrome; no new hosted desktop/iPad screenshot acceptance is claimed. Impeccable's baseline scan returned no findings; its plugin path became unavailable before the final scan, so the final review used native geometry and inspected component screenshots instead.
- Scope remains local-only. No merge, push, publication or production change.

### Source-page correction verification — 2026-10-02

- Removed the automatic page/fragment splitting path. Staggered columns now flow independently; source gaps are bounded and body boxes use measured content rather than retaining oversized source allocations. Typography retries are bounded to four 5% steps, with a 12pt floor for reductions (already smaller source text is not reduced). Any unresolved overflow fails closed.
- Backend validation requires saved page count to equal source count; composition additionally preserves exact page identities/dimensions and each page's slot fragments. Explicitly bounded presentation changes are permitted without allowing text, font roles, sentence IDs or provenance to change. This also fixes the prior cover-composition verifier mismatch. OpenAPI and its client snapshot were aligned.
- Unreleased renderer: `ba4018d92d95719a43bb2c255c3debe3e96be9df3bab631166180b6bb2269bea`. Pinned Linux native suite: 34/34. Actual Go-to-Node composition, server serialization and validation passed for both private originals (12/16 pages) and an oversized component edit is rejected. Shared suites: 252 tests; lint/build/package contracts and artifact/bundle/corpus checks passed. API full Go/race suite and vet passed; database-dependent tests without explicit database configuration remain skipped, not new database acceptance.
- Web: 560 tests plus 8 tooling tests, lint/build passed (existing LegalRequiredNavigation warning). Admin: 823 tests, lint/build passed. No reader interaction code or mobile reflow code changed. Inspected component screenshots for the cover, dense body and hymn columns at `/tmp/weekly-cover-visual.kURpqL/`; these are actual HTML with legal fonts, not PDF images. No new hosted-browser, physical-device, installed-PWA or watermark acceptance is claimed.
- Packed consumer checks passed for both Vite and Next using clean staging with exactly five scoped tarballs; the unrelated root-tarball issue remains untouched. CI source pin now references shared commit `ec33b91`; release digest matches the candidate, but the permanent registry image variable must only be configured after the separately authorized shared release.
- Local preview now serves v15 at `http://127.0.0.1:5182/?issue=1740` (or `1739`). Fixture identity/receipt and private-write limitations remain as described above. No merge, push, publication or deployment.

### Final rulings on acceptance boundaries

1. Physical gesture uncertainty was partly promoted to an implementation finding and fixed with native Chromium reproduction plus regression. Actual iPad/iOS/Android remain held; cost if wrong is platform-specific gesture failure, so the launch flag stays off.
2. Faint watermark readability cannot be established by opacity/geometry assertions. Require human approval; cost if wrong is impaired reading. No acceptance substituted.
3. Complete original-layout fidelity and physical accessibility remain user/device gates. Measured no-overflow and sentence preservation do not prove visual fidelity. The user clarified that all feedback and acceptance so far concern desktop only; mobile has not been user-tested.
4. Installed PWA termination/restart and platform storage lifecycle remain held. Earlier controlled Next/SW offline reload, root fallback, cross-tab removal and zero private API-cache evidence are local-only; cost if wrong is unreliable installed offline behavior.
5. Production identity, managed identity/configuration, permanent asset bytes, package registry resolution, remote CI, release/deployed revision and live smoke remain unauthorized and unverified. Cost if wrong is a broken or insecure rollout; local success never bypasses these gates.
6. OCR, additional content languages, historical Letter/mixed-paper formats and arbitrary blank-page composition remain explicit non-goals. Unsupported documents fail for manual handling, not fabricated output.
7. Keep the working branches and their execution ledgers because merge/release/device acceptance is unfinished. Do not delete or repurpose unmerged worktrees.

### Next authorized delivery gate

Before any merge, obtain visual/device acceptance and separate authorization for remote delivery. Publish the approved shared package version first and resolve registry dependencies/lockfiles in consumers; current four-package `file:` tarballs are **local integration inputs only**. The unreleased candidate is now 1.0.32 because upstream already released the older candidates; verify availability again before publishing. Operations client remains unchanged at registry 1.0.26.

Sequence permanent template assets and Asset extraction identity/configuration before enabling extraction; deploy Website owner schema/state/DSR before Account's mandatory reader-v1 coverage; then resolve shared contracts, gateway and frontend consumers. Use each repository's PR/required CI/merge/release/health/smoke workflow. Reader private writes and Online entry remain disabled until full DSR coverage and the held acceptance matrix pass. Existing PDF publishing/download must remain independent throughout.
