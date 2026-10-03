# Weekly Reader Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved Goodnotes-like reader shell, desktop/tablet paper gestures and navigation, while preserving mobile ebook reading.

**Architecture:** Keep the existing member/session, renderer, private-state and offline boundaries. Extract only workspace tabs and paper viewport responsibilities from WeeklyReader; use the installed shared UI primitives. Active-document navigation retains canonical routes and remounts authorization rather than keeping multiple private documents mounted.

**Tech Stack:** React 19, TypeScript, Next.js, shared UI/React Aria, Lucide, Vitest/Testing Library, browser Pointer/Wheel APIs.

**Spec:** `docs/superpowers/specs/2026-10-03-reader-workspace.md`

## Global Constraints

- Existing isolated worktree; no main commits, merge, deployment or production mutation.
- Mobile <=767px remains ebook reflow; desktop/iPad retains paper pages.
- Remove fit-width mode and both fit buttons; initial paper fit is computed, not a user mode.
- Default vertical; horizontal is desktop/tablet only. Relative paper zoom 1–4x.
- Existing immutable renderer, fonts, source pages and API contracts remain unchanged.
- All five control locales; no private content in tab storage; preserve authorization and unsaved notes.
- Shared Button/IconButton, existing tokens/icons, 44px hit targets and reduced-motion support.

## Review Focus

1. Switching accounts or opening stale tabs must not expose another account's content; test account-isolated storage and activation through the access boundary in Task 1.
2. Unmount during debounced progress and rejecting a dirty-note confirmation must not lose position/draft; test both in Tasks 1 and 3.
3. Pinch followed by one remaining finger must not flip pages or leave a captured pointer/listener; test cancellation, release and mobile bypass in Task 3.
4. One sentence split across source pages must preserve annotation offsets and page mapping under continuous mode; test in Task 2.
5. Font loading, sidebar opening and orientation changes must not reset page or write false initial progress; test in Tasks 2 and 3, then browser-check in Task 4.

## Task 1: Persistent reader chrome and document tabs

**Files:**
- Create `src/features/weekly-reader/workspace.ts` and `workspace.test.ts`.
- Create `src/components/weekly-reader/ReaderTabs.tsx` and `ReaderTabs.test.tsx`.
- Modify `WeeklyReader.tsx`, `ReaderToolbar.tsx`, `OfflineControl.tsx`, `reader.css` in the same component directory.
- Modify `src/i18n/locales/{zh-Hant,zh-Hans,en,ja,ko}.json`.
- Extend `src/components/weekly-reader/WeeklyReader.test.tsx` and `OfflineReaderShell.test.tsx`.

**Interfaces:**
- Consumes existing ReaderSelector, account/session authorization and canonical routes.
- Produces `ReaderTab = {issueNumber: number; series: BulletinSeries; contentLocale: BulletinLocale}` and pure `tabKey(tab): string`, `tabHref(locale, tab): string`, `closeTab(tabs, activeKey, closingKey): {tabs: ReaderTab[]; active: ReaderTab | null}`.
- A navigation guard owned by ReaderDocument resolves dirty notes and flushes progress before invoking the route navigation callback. No note text enters workspace storage.

- [ ] Write tests: two opened issues remain tabs; duplicate edition opens once; alternate contentLocale is distinct; close inactive retains active; close active picks neighbor; last close navigates Home; malformed session data is ignored; account switch cannot reuse tabs. Test native keyboard focus and accessible close controls.
- [ ] Run `corepack pnpm exec vitest run src/features/weekly-reader/workspace.test.ts src/components/weekly-reader/ReaderTabs.test.tsx`; expect failures for missing behavior before implementation.
- [ ] Implement account-scoped identifier-only session state and canonical-link tabs; current authorized title may label the active tab, inactive tabs use issue/edition labels. Reuse authorization on activation, including unavailable states. Use two compact rows with shared UI controls; page/search/note/offline tools remain visible, removing overflow chrome. Do not add an archive API.
- [ ] Extend integration tests for dirty-note cancellation on Home/tab/close, progress flush on allowed navigation, and tools remaining available on mobile. Run the above tests plus WeeklyReader/OfflineReaderShell/OfflineControl suites; expect all pass.
- [ ] Commit only Task 1 files after verification.

## Task 2: Continuous paper and horizontal navigation

**Files:**
- Create `src/components/weekly-reader/PaperViewport.tsx` and `PaperViewport.test.tsx`.
- Modify `WeeklyReader.tsx`, `PageNavigator.tsx`, `reader.css`.
- Modify `src/features/weekly-reader/navigation.ts` and `navigation.test.ts`.
- Extend `WeeklyReader.test.tsx`, `RangeHighlights.test.tsx`, `NoteIndicators.test.tsx`.

**Interfaces:**
- Produces `ReadingDirection = 'vertical' | 'horizontal'` and `PaperViewport` callbacks for explicit page requests versus observed scroll position. Observing scroll does not call the explicit-navigation callback or scroll itself.
- Consumes canonical document pages, active page, sentence state, watermark trace, shared paper root and restoration-complete flag. Preserves paperRef as the selection/annotation surface.
- Computes page geometry per page; no assumption that all pages share width/height. Per-page body centering stays local to that page.

- [ ] Write failing tests: vertical renders pages in source order; horizontal displays only requested page; boundaries remove correct arrows; direction switch retains source page; observers do not overwrite unresolved resume; split sentence highlights retain both page fragments.
- [ ] Run targeted navigation/viewport/annotation tests; expect specified assertions to fail before implementation.
- [ ] Extract paper rendering; stack pages with a narrow gap in vertical mode. Keep mobile renderer unchanged. Use settled viewport observation for active page and existing progress pipeline, excluding thumbnails. Explicit page/search/anchor navigation scrolls the intended page into view.
- [ ] Add horizontal hover/focus arrows, reduced-motion fade, touch-visible toolbar prev/next, and appropriate page keyboard handling. Keep markup page count fixed; no re-pagination or rasterization.
- [ ] Run targeted tests plus WeeklyReader suite; expect all pass. Check resume and dirty-note protection before committing Task 2.

## Task 3: Content-only zoom and gesture arbitration

**Files:**
- Create `src/features/weekly-reader/usePaperGestures.ts` and `usePaperGestures.test.tsx`.
- Modify `navigation.ts`, `navigation.test.ts`, `PaperViewport.tsx`, `WeeklyReader.tsx`, `ReaderToolbar.tsx`, `reader.css` and control locales.
- Extend `WeeklyReader.test.tsx`.

**Interfaces:**
- Replace ReaderZoom fit modes with numeric relative zoom. Produce `fittedPageScale(page, viewport): number` and `clampPaperZoom(value): number` (1–4x).
- Gesture hook attaches non-passive wheel/touch listeners only to the paper viewport when not mobile; receives eligibility, zoom and page callbacks. It owns pointer cleanup, not private state.
- Zoom keeps the gesture focal point fixed via compensated paper scroll offsets; layout changes notify annotation overlays through their existing layout keys.

- [ ] Write failing tests: clamp 0.5=>1, 8=>4; default scale fits both axes; modifier wheel changes paper scale but ordinary wheel scrolls; disabled/mobile listeners never prevent default; pinch focal anchor is preserved; pointercancel/unmount clears gesture state; pinch-to-single-finger does not swipe; selection/editor blocks flipping; keyboard zoom ignores editable controls.
- [ ] Run hook/navigation tests; expect assertion failures before implementation.
- [ ] Implement scoped listeners and focal zoom, keyboard +/- and shared UI zoom buttons. Remove fit controls, width-fit branch and obsolete message keys, updating tests of deliberately removed behavior. Leave mobile native pinch available.
- [ ] Validate touch arbitration against text selection: do not disable all native gestures globally. Add WebKit gesture handling only if browser evidence requires it; record limits without claiming physical-device acceptance.
- [ ] Run hook, navigation, WeeklyReader, range selection and note suites; expect all pass. Commit Task 3.

## Task 4: Integration verification and local demo

**Files:**
- Update this plan with exact verification results and unresolved acceptance gates.
- Local ignored admin-fe preview adapter only if needed to exercise canonical navigation with issue 1739/1740; inspect its local instructions first. Do not replace production behavior with preview-only state.

**Interfaces:** Consumes Tasks 1–3 through production WeeklyReader and real sample fixtures.

- [ ] Run `corepack pnpm test:run`, `corepack pnpm lint`, `corepack pnpm build`; expected exit 0, with any pre-existing warning recorded explicitly. Run repository Docker build if the configured private dependency credentials are available; report separately if blocked.
- [ ] Browser-check desktop, iPad-sized and mobile together: tabs switching 1739/1740, persistent tools, page/anchor restoration, both desktop directions, edge arrows, zoom then selection/highlight/note, dirty-note refusal, mobile ebook/native gesture bypass and no horizontal page overflow.
- [ ] Confirm source counts remain 1739=12 and 1740=16; check first/last page watermarks and annotation positions. Measure toolbar height and ensure tabs/tools do not wrap into a third permanent row on mobile.
- [ ] One batched visual correction pass, then one confirmation round. Record physical iOS/Android and Mac trackpad verification separately when unavailable.
- [ ] Obtain one fresh-context review of this round's entire diff using executing-plans; fix important findings with reproducing tests and rerun full checks.
- [ ] Keep worktree and local demo available; stop before merge/release. Report tested local behavior, not production delivery.

## Preparation status

- 2026-10-03: confirmed existing linked worktree on `review/weekly-reader-20260930`.
- Read hhc-web AGENTS/README and traced authorization, reader rendering, offline entry and progress lifecycles.
- Existing untracked `.impeccable/` is preserved. No implementation files changed during planning.
- Shared UI primitives already exist; no frontend-platform contract change is planned.
- Plan reviewed against the approved desktop/tablet/mobile split and subsequently approved for implementation.

## Execution evidence — 2026-10-04

Implementation for Tasks 1–3 is complete locally. Task 1 was committed as `634d5d2`; Tasks 2–3 share paper geometry and are delivered together to keep the intermediate state coherent. The original step checkboxes above are the planned sequence, not a claim that every manual acceptance scenario has been exercised.

- Added account-scoped identifier-only tabs, shared controls, continuous/horizontal paper views, numeric zoom and scoped gestures. Mobile keeps ebook reflow and native browser gestures. No renderer assets, fonts or API contracts changed.
- Red/green regressions cover paper rendering, gesture focal compensation and resize, split-page note indicators, and flushing the visible position before Home/visibility changes. A fresh-context review found stale anchors, pending-scroll progress loss and resize resets; all three received fixes and regression tests.
- `corepack pnpm test:run`: 111 files, 631 tests passed (exit 0).
- `corepack pnpm exec tsc --noEmit`: exit 0.
- `corepack pnpm lint`: exit 0; one existing warning in `LegalRequiredNavigation.tsx:17` (internal navigation), no errors.
- `corepack pnpm build`: exit 0 after the review fixes.
- Standard Docker build was attempted using the configured npm secret. It fails during frozen dependency installation because the existing local `file:../frontend-platform/artifacts/hallelujahhomechurch-account-client-1.0.32.tgz` dependency is outside the Docker context. This is an unresolved pre-merge packaging gate, not a successful container build; dependency/release configuration was not changed in this UI round.
- Local production reader with simulated API fixtures: 1739 has 12 source pages; 1740 has 16 pages and 16 watermarks in continuous mode. Canonical tab switching restores the selected document's page/view. Horizontal view has one page and working hover navigation.
- Browser modifier-wheel and emulated two-touch pinch changed paper zoom without changing `visualViewport.scale`; a selected range's saved highlight remained aligned within 2 px at 299% zoom. Mobile emulation at 390 px has no paper zoom controls or document horizontal overflow. Chrome measures 104 px desktop and 100 px mobile, in two permanent rows.
- Final preview returned to 100% relative zoom and vertical continuous reading, with both sample tabs available. Screenshots: `/tmp/hhc-reader-workspace-final.png`, `/tmp/hhc-reader-workspace-mobile.png`, `/tmp/hhc-reader-workspace-ipad.png`.

Outstanding acceptance gates: physical iOS/Android and Mac trackpad behavior, real member authorization/offline lifecycle, complete manual note editing/dirty-note scenarios, and hosted CI/container/release smoke. Emulated touch and local fixture state do not satisfy those gates. No merge, push, deployment or production mutation was performed; preserve this worktree for follow-up.
