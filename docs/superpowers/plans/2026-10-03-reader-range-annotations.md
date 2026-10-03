# Reader Range Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver native text selection and a reliable Goodnotes-like private annotation lifecycle without replacing browser selection gestures.

**Architecture:** Preserve semantic sentence IDs and add Unicode scalar ranges. Extend the existing member reader contract/storage and offline pipeline; keep selection presentation in the reader host so annotation changes do not unnecessarily alter the immutable paper renderer.

**Tech Stack:** TypeScript, React, DOM Selection/Range, existing Vitest tooling; Go, PostgreSQL, canonical OpenAPI.

**Spec:** `../specs/2026-10-03-reader-range-annotations.md`

## Global Constraints

- Worktree root: `/Users/rayselfs/Projects/hhc/website/.worktrees/weekly-reader-review-20260930`; continue existing `review/weekly-reader-20260930` branches, preserve prior unmerged implementation.
- No merge, release, production writes or gate activation. No new UI/selection dependency.
- Anchors use `[start,end)` Unicode scalar offsets, at most 500 unique sentence anchors.
- Yellow/red/blue, clear, copy, note; partial clear never deletes notes.
- Existing whole-sentence data and mutation IDs remain valid. No silent range widening or revision guessing.
- Authorization, offline identity/expiry/fences, five UI locales, watermark and source-page parity remain mandatory.

## Review Focus

- DOM UTF-16 offsets crossing emoji/inline fonts must become correct scalar offsets (Task 1).
- Selected paper fragments must not include unmounted pages or hidden duplicate thumbnails (Task 1).
- Toolbar pointer/focus races and late responses must not lose selection or clear a newer selection (Task 2/4).
- Retried/offline partial edits must not widen after a source revision changes (Task 3/4).
- Dirty notes must survive dismissal, authentication refresh and responsive panel changes (Task 4).

### Task 1: Canonical native-selection boundary

**Files:** Create `src/features/weekly-reader/text-range.ts`, `text-range.test.ts`.
**Interfaces:** `ReaderTextRange = {sentenceId:string; start:number; end:number}`; `readTextSelection(root: HTMLElement, selection: Selection | null, sentences: readonly ReaderSentence[]): ReaderTextRange[]`; `rangeQuote(ranges, sentences): string`.

- [x] Write tests for nested fonts + emoji, reverse selection, split fragments, root boundaries, collapsed/foreign/inert selection, duplicates and semantic gaps, invalid offsets and exact quote.
- [x] Run `node node_modules/vitest/vitest.mjs run src/features/weekly-reader/text-range.test.ts`; observe missing behavior fail.
- [x] Implement the native Range adapter and canonical range validation; do not wire partial ranges to a sentence-only API.
- [x] Run the targeted test and `node node_modules/vitest/vitest.mjs run`; both must pass.
- [x] Commit this independently testable boundary.

### Task 2: Fix transient-selection lifecycle

**Files:** Modify `src/components/weekly-reader/WeeklyReader.tsx`, `SelectionToolbar.tsx`, `WeeklyReader.test.tsx`.
**Interfaces:** Reuse current private mutation outcomes `applied | queued`; dismissal only changes transient UI. This fix must also apply once Task 4 replaces the selection model.

- [x] Add integration tests for outside pointer/click dismissal, toolbar preservation, successful highlight dismissal, failed highlight preservation, newer selection during an in-flight action, and note editor exclusion.
- [x] Run `node node_modules/vitest/vitest.mjs run src/components/weekly-reader/WeeklyReader.test.tsx`; observe the missing lifecycle fail.
- [x] Add a scoped document event listener with cleanup; ignore toolbar and note interactions. Clear only the selection belonging to a successfully acknowledged/durably queued action. Preserve failed retry context.
- [x] Run full web tests and lint. Commit.

### Task 3: Range persistence and producer contract

**Files (hhc-web-api):** `internal/bulletinreader/{types,service,migration}.go`, new `ranges.go` and tests; `internal/postgres/bulletin_reader_state.go`, reader integration/DSR tests; next unused additive migration under `internal/migrations/sql`; `openapi.yaml`, `openapi_test.go`.
**Files (frontend-platform):** generated `packages/hhc-web-client/src/generated.ts` and contract tests through existing generation command.
**Interfaces:** Payload `ranges?: ReaderTextRange[]` must match `sentenceIds`; highlight `segments?: {start:number;end:number;color:yellow|red|blue}[]`; note `ranges?: (ReaderTextRange & {quote:string})[]`. Missing optional properties preserve legacy behavior. Enforce offsets against trusted published text, bound segments and mutation size.

- [x] Add Go table tests: overlapping recolor, partial clear/split, adjacent merge, old full-sentence fallback, malformed/duplicate/foreign ranges, emoji, version/idempotency and caller-state immutability.
- [x] Run `go test ./internal/bulletinreader`; observe failures before implementing interval updates and note quoting.
- [x] Add revision tests: identical text preserves offsets, changed/split/merged ambiguous text retains inactive private quote and requires reanchor; never silently expands.
- [x] Implement additive JSON persistence, round-trip/DSR tests, OpenAPI schemas and regenerated client. No migration applied to production.
- [x] Run `go test -race ./...`, `go vet ./...`, available PostgreSQL integration tests, shared package tests/lint/build/contract checks. Record unavailable database checks separately. Commit each repository.

### Task 4: Native selection, range rendering and offline lifecycle

**Files (hhc-web):** `WeeklyReader.tsx`, `SelectionToolbar.tsx`, `reader.css`, `NoteEditor.tsx`, `ReaderPrivateState.tsx`, `features/weekly-reader/{private-state,copy,return-state,sync,mutation-recovery}.ts` (locate existing recovery owner before edit), their tests; five reader message dictionaries.
**Interfaces:** Consume Task 1 ranges and Task 3 generated contract. Store a stable range snapshot before focus changes; quote comes from canonical text, never raw DOM or screen coordinates.

- [x] Add tests proving a native partial selection sends exact ranges and ordinary sentence clicks no longer select. Cover keyboard, toolbar focus, partial copy, mixed colors, tap existing annotation, cancel and dirty-note confirmation.
- [x] Observe tests fail; wire native `selectionchange` to the host and remove whole-sentence activation callbacks. Reuse existing note/sync/retry controls. Render persisted ranges with host-side DOM Range rectangle overlays, without modifying text nodes or paper geometry. One rendering path avoids maintaining CSS Custom Highlights plus a fallback.
- [x] Desktop toolbar follows selection bounds; touch toolbar docks with safe-area spacing. Scroll/zoom refresh coordinates; Escape/outside click clears transient state; page navigation does not steal active native gestures.
- [x] Extend optimistic/offline interval updates and account/revision-bound return validation. Block sentence-only automatic remapping of pending partial ranges; retain them in explicit recovery.
- [x] Run full web tests/lint/build and shared packed-consumer checks. Commit only when both cloud and durable-queue semantics are covered.

### Task 5: Truthful writable local interaction preview

**Files:** Move reusable preview handler to a tracked local-only test utility in `hhc-web`; wire `admin-fe/.superpowers/weekly-member-preview/vite.config.ts` locally. Do not ship fake auth/mutations in production.
**Interfaces:** Existing fixture access format plus in-memory per-document private state using the same local mutation reducer. Original mutation IDs deduplicate; changed payload reuse fails. Label reset-on-restart and simulated persistence.

- [x] Test apply/read/retry/reset and isolated document state; include forced failure so retry is observable.
- [x] Replace intentional 503 only in loopback preview; retain no-store and explicit simulation notice. Never forward fixture mutations to real services.
- [x] Browser-check select → color → dismiss → reopen → partial clear → copy → note → failure/retry. Real Go persistence is not inferred from this preview.

### Task 6: Responsive acceptance and handoff

**Files:** Reader CSS/components, shared renderer only where prior requested desktop/mobile layout changes require it; existing template verification scripts and release-evidence notes.
**Interfaces:** Desktop/iPad wide keep source-page membership; narrow mobile reflows as an ebook. Preserve reading anchor across responsive mode changes.

- [x] Test desktop body headings without shadow, symmetric readable margins, mobile padding and progressive disclosure of contributor metadata; preserve content and legal fonts.
- [x] Inspect desktop and mobile together, fix in one batch and confirm once. Verify both 1739 and 1740; no new overflow/extra paper pages.
- [ ] Record physical Safari/Android/PWA tests as pending unless actually run. Verify keyboard focus, 44px controls, viewport/keyboard collision, sync failure and note draft safety.
- [ ] Run repository-required tests/lint/build/contract and packed-consumer checks; obtain one fresh whole-change code review and fix important findings with regression tests.
- [ ] Hand off commits, plan status, verification and device gaps. Stop before merge/release.

## Execution decisions

- User explicitly requested planning and starting implementation in one turn; proceed inline rather than adding another approval round for the already agreed direction.
- Tasks 1/2 can land locally before the new mutation contract; do not activate partial selection until Tasks 3/4 are complete. Existing preview remains honestly read-only until Task 5.

## Implementation checkpoint — 2026-10-03

- Tasks 1–2 implemented in `f797461` and `c978c41`; native range integration subsequently replaces the old sentence activation path. UTF-16/scalar, focus, outside dismissal, failure preservation, late acknowledgement and dirty-note navigation have regression coverage.
- Task 3 implemented: API `1c5e1ec`, shared contract `208999f`. `go test -race ./...` passed against an isolated PostgreSQL 17 database (including migration, round-trip and private export); `go vet ./...` passed. Client tests/lint/build, package contracts and packed Vite/Next consumers passed. No production migration or release.
- Task 4 implemented pending final review/device acceptance: native range snapshots, partial recolor/clear/copy/notes, old full-sentence compatibility, non-layout-changing overlays, range-bound return state and conservative revision recovery. Manual recovery now requires native reselection for partial ranges rather than silently widening them.
- Task 5 loopback simulation implemented and HTTP checked for failure/retry, deduplication, exact range persistence and read-back. It is in-memory only, clearly labelled, and separate from real Go persistence tests. Browser lifecycle acceptance is pending.
- Task 6 started: desktop body title shadow removed; body column translation centers existing content without changing line widths/page membership; mobile gains inner reading margins and visually quieter contributor metadata. Metadata disclosure/omission, narrow-tablet breakpoint choice and visual acceptance remain pending rather than hiding selectable text without validating range continuity.
- Browser TaskSpace 60 is `agentDelegatedToUser`. Requested Return to agent; do not work around ownership. Physical iOS/Android/PWA acceptance is also pending. Keep the production feature gate disabled and stop before merge.
- Independent review found three Important issues (no Critical): inactive partial-source collision during migration; stale selection when a native gesture leaves the reader; silent truncation of non-anchor text. All three reproduced with regression tests and were fixed in one pass. Partial-source conflicts additionally show exact colored snippets and require explicit confirmation before replacing the complete merged target. This is not a second-review approval.
- Post-review web verification: 597 tests pass, lint has zero errors and one existing legal-navigation warning, production build passes. Go race suite with PostgreSQL and vet pass again. Numerical fixture check: 1739 remains 12 pages / 1740 remains 16 pages; body translation preserves widths/vertical positions. This is not visual acceptance.
- Admin final verification: all 823 tests / 85 files pass with `--maxWorkers=1`; lint and production build pass. Earlier concurrent/isolated failures are recorded in the ledger, not ignored. Final code checkpoints: web `0d00434`, API `e3f1395`, shared client `208999f`. The renderer digest remains `ba4018d92d95719a43bb2c255c3debe3e96be9df3bab631166180b6bb2269bea`.

### Browser checkpoint after user returned TaskSpace 60

- Reloaded the existing preview successfully. Desktop cover/body screenshots obtained; partial native DOM selection of two characters exposed the expected toolbar. Clicking red stored the exact range and dismissed the toolbar.
- 390px mobile reflow measured 20px inner padding and no horizontal overflow; screenshot captured the docked three-color/clear/copy/note toolbar. Note cancellation prompted before discard, declining retained the draft, and keyboard save succeeded. Read-back confirmed quote `欣賞`, scalar range `[0,2)`, and the red highlight persisted. This remains loopback simulation, not cloud/member acceptance.
- At 820px the DOM switched to paper mode without horizontal overflow; 1739 still reported 12 pages and 1740 16. Native-device acceptance remains pending.
- Further browser automation became unreliable after viewport emulation: captureScreenshot timed out, viewport dimensions changed between calls, and clicks reported an unrelated `<main>`/dialog intercepting pointer events. Both wrapper and direct screenshot attempts failed. Do not attribute this to application CSS without further evidence, and do not mark pointer/touch or tablet visual acceptance complete. Restore emulation and hand the same TaskSpace back for browser recovery; no new space or alternate browser workaround.
- No implementation changes in this verification pass. Mobile metadata disclosure and narrow-tablet refinement remain open.

### Resumed browser and responsive checkpoint — 2026-10-03

- Normal browser input recovered in the same TaskSpace. Real mouse drag selected six contributor characters; yellow save, tapping the saved mark, and clearing passed without deleting the existing note. Copy of the two-character welcome selection reported success. A forced 503 retained the action and selection; explicit retry persisted exactly `[0,2)` in blue, with no duplicated highlight.
- Mobile production metadata now defaults to collapsed behind a five-locale control. This is a presentation-only document projection: canonical text, saved sentence IDs, offline bytes and the immutable renderer are unchanged. Searching/jumping to a collapsed credit automatically reveals it. The regression covers collapse/expand, unchanged source content, and search navigation.
- Below 768px use ebook reflow; at 768px and above retain paper-page membership, independently of pointer type. Narrow tablet split views therefore use ebook layout. Do not claim physical tablet acceptance from this breakpoint test.
- Bounded screenshots inspected: desktop body (`/tmp/reader-resumed-desktop.png`), 820px tablet cover (`/tmp/reader-tablet-final.png`), and 390px body for both issues (`/tmp/reader-1739-mobile-body.png`, `/tmp/reader-1740-mobile-body.png`). Both issues have no horizontal overflow; paper counts remain 12 and 16. Desktop emulation with `mobile:false` avoids the earlier unstable mobile-device override; these are responsive desktop-browser checks, not iOS/Android gesture evidence.
- Full web suite: 598 tests / 106 files passed. Lint: zero errors, existing legal-navigation warning only. Production build passed. API/shared/Admin were not changed in this checkpoint; their earlier recorded checks still apply. CI/container-release validation and physical Safari/Android/PWA, software-keyboard collision and human watermark acceptance remain release gates. No merge, release or feature-gate activation.

## Compact reader checkpoint — 2026-10-03

### Browser-comment refinement

- Supersedes paper contributor fitting below: hide the first body page's production band (lecture date, issue summary, contributor fields, labels and separator rule). Translate that page's existing body upward into the vacated space; retain font sizes, widths, fragments and page membership. Mobile's existing collapsed-details behavior is unchanged. Cover masthead text shadow removed in the host stylesheet.
- Regression observed failing before implementation, then passing: metadata omission, same-page translation, unchanged next page/width/text, and cleanup restoration. Full web suite 604 tests / 107 files passed; build passed; lint zero errors / one existing legal-navigation warning. Logs `/tmp/reader-header-{tests,build,lint}.log`.
- Browser screenshots checked for 1739 and 1740 first body pages and the shadow-free cover. Source slot membership matches the fixture exactly for 1739 first body page and 1740 first/second body pages. Source counts remain 12/16; no re-pagination. No release/merge or physical-device claim.

- Approved follow-up implemented: single-row 56px desktop / 52px mobile chrome; page/search/more panels replace permanent stacked controls. Annotation actions remain contextual. Offline controls and search stay mounted when panels close so operations and result position are retained.
- Paper-only contributor fields and semantic framed headings fit a single line inside their existing source boxes. Contributor names align with their fixed labels. No canonical text, source fragments, page membership or immutable renderer changes; this is host presentation fitting, not proof of perfect PDF extraction.
- Mobile page navigation targets the first scalar fragment of the requested source page, including sentence continuations. Scroll progress resolves visible fragments; source page and printed-body page numbers are distinguished. Paper/ebook switching preserves the current source page.
- One independent compact-reader review found two Important issues: search reset on panel closure and page-input blur prematurely dismissing mobile navigation. Both reproduced RED and fixed with regression tests; no Critical findings. No second review requested.
- Final web verification: 603 tests / 107 files passed (`pnpm test:run --maxWorkers=2`); production build passed; lint zero errors with the existing LegalRequiredNavigation warning. `git diff --check` passed. Logs: `/tmp/reader-chrome-final-{tests,build,lint}.log`.
- Browser TaskSpace 60: desktop 1458px toolbar 56px with aligned single-line credits; framed body headings inspected; responsive mobile 320px toolbar 52px without horizontal overflow. Source-page jump exercised. Screenshots `/tmp/reader-compact-desktop-final.png`, `/tmp/reader-compact-body6.png`, `/tmp/reader-compact-mobile-final.png`. These are desktop-browser responsive checks, not physical iOS/Android acceptance. Existing extraction imperfections are not declared resolved.
- Local preview uses simulated member data only. No merge, release, production writes or feature-gate activation. Physical Safari/Android/PWA and human visual acceptance remain pending.
