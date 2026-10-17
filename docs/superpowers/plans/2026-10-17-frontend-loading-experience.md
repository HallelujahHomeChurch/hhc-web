# Frontend Loading Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in this chat. Steps use checkbox (`- [x]`) syntax for tracking. Implementation starts after user review of the specification and plan; preserve the previously selected inline execution method.

**Goal:** Replace disruptive loading cards/blank regions in videos, weekly bulletins and small groups with accurate responsive skeletons, and add native pending feedback to public navigation.

**Architecture:** Keep authentication and data ownership in existing components. Reuse the installed Skeleton primitive for decoration, compose shapes within each feature, and keep one localized status per loading region. Use Next's Link pending hook for transition feedback; retain the existing global bootstrap/analytics behavior.

**Tech Stack:** TypeScript, React 19, installed Next 16.3.8 App Router, CSS modules/existing tokens, pinned HHC UI, Vitest/Testing Library, ego-browser.

**Spec:** [Frontend loading experience design](../specs/2026-10-17-frontend-loading-experience-design.md)

**Status:** Approved by the user; inline sequential implementation in progress. Baseline `009d37c8238fc50024982f9dc396812bd7fb4ef0`. Review updated origin/main before execution; preserve unrelated changes.

## Global Constraints

- Preserve HHC's existing visual identity and responsive layouts.
- No package upgrade, dependency, backend contract, persistence cache or new service.
- Neutral low-contrast placeholders use the existing 1.4 s shimmer, with a 150 ms animation delay.
- There is no minimum loading duration: ready data renders immediately.
- Account change, sign-out or permission loss clears/hides private data immediately, using existing authorization fences.
- One polite screen-reader status per independently loading region; decorative placeholders are aria-hidden, have no links/buttons/tab stops, and are not announced per block.
- Retain the current global first-load screen in this implementation.
- No changes to analytics consent logic or reader lifecycle; no global loading.tsx/layout rewrite.
- Public pending feedback begins after 150 ms in reserved space; cache-fast completion does not wait for it.
- Grouping, locales, reply semantics and uncertain-write safeguards remain unchanged.

## Review Focus

1. Same component, different account/permission: old titles, covers, names, drafts and stale responses cannot survive into an unauthorized scope. Tests: Tasks 2–5.
2. Requests settle out of order or one fails: no false zero/empty/unavailable state, no blank upcoming gap, and no endless placeholder after a surfaced error. Tests: Tasks 2–5.
3. Long lists and explicit refresh: loaded pages, focus, scroll and comment draft remain intact; foreground results cannot masquerade as another search/page. Tests: Tasks 2–5.
4. Fast/cache and reduced-motion: no imposed delay, no per-block announcements, no tab stops or moving layout from a navigation hint. Tests: Tasks 1, 6, 7.
5. Native navigation exceptions: modified/external/new-tab clicks, rapid next-link clicks, consent-excluded navigation, Back/Forward and failures retain native behavior. Tests: Tasks 6–7; global privacy guards are unchanged.

## File map

| Unit | Files | Responsibility |
| --- | --- | --- |
| Loading primitives | New `src/components/ui/ContentLoading.tsx`, `.module.css`, `.test.tsx` | Decorative block and single localized status; existing UI Skeleton motion |
| Video geometry | New `src/features/member-videos/VideoLoading.tsx`, `.test.tsx`; existing zone/comments CSS | Library/search/watch/comment shapes |
| Video state | `MemberVideoZone.tsx`, `UpcomingBroadcasts.tsx`, `VideoInteractions.tsx`, `VideoInformation.tsx`, `VideoComments.tsx` and owning tests | Initial/refresh/append/error distinctions |
| Weekly geometry/state | New `src/components/literature-ministry/WeeklyLoading.tsx`, `.module.css`, `.test.tsx`; `WeeklyArchive.tsx`, `home/WeeklyCard.tsx`, `layout/AccountControl.tsx`, literature route and owning tests | Gate fallback, independent latest/archive, homepage slot |
| Organization geometry/state | New `src/features/organizations/OrganizationLoading.tsx`, `.test.tsx`; `organizations.css`, gate/roots/unit/member/history dialog and tests | Scope-correct rows/forms and no false empty table |
| Navigation feedback | New `src/components/ui/NavigationPendingIndicator.tsx`, `.module.css`, `.test.tsx`; SiteHeader, SiteFooter, NewsSection, PageNavigation, site Button and tests | Native Link descendant indicator |
| Acceptance evidence | `docs/superpowers/evidence/2026-10-17-loading-experience/` | Synthetic screenshots, bounded measurements, final verification |

## Execution preflight (before Task 1)

- [x] After design/plan approval, use `superpowers:using-git-worktrees` to create/reuse a task-owned isolated worktree on a branch from current origin/main. Read repository README/AGENTS and installed Next docs. Copy only these reviewed planning/evidence files into that branch if needed; do not repurpose or clean the current dirty checkout.
- [x] Install with the repository-pinned `corepack pnpm install --frozen-lockfile`, passing registry credentials securely. Inspect the latest-main diff against the recorded baseline before changing product code.

### Task 1: Establish accessible local loading primitives

**Files:** Create `src/components/ui/ContentLoading.tsx`, `ContentLoading.module.css`, `ContentLoading.test.tsx`.

**Interfaces:**
- Consumes pinned `@hallelujahhomechurch/ui` Skeleton and existing tokens.
- Exports `LoadingBlock({className}: {className?: string})` and `LoadingStatus({label}: {label: string})`.
- LoadingBlock is decorative and nonfocusable; override the existing primitive's 44 px minimum for text-line classes. LoadingStatus renders one sr-only polite status, placed by consumers outside their aria-busy/decorative region. Do not make a schema/variant framework.

- [x] Add failing assertions: blocks are absent from the accessibility tree, contain no focusable control; one LoadingStatus exposes the passed locale label; text-line sizing can be below 44 px.
- [x] Run `corepack pnpm exec vitest run src/components/ui/ContentLoading.test.tsx`; confirm the missing primitive fails the intended assertions.
- [x] Implement the two primitives, 150 ms animation delay and reduced-motion static state using existing styles. Do not delay data rendering in JavaScript.
- [x] Run the test; inspect CSS rules for reduced-motion and forced-colors (browser verification belongs to Task 7).
- [x] Commit only these files: `feat(ui): add content loading primitives`.

### Task 2: Unify video authorization, library and watch loading

**Files:** Create `VideoLoading.tsx`, `VideoLoading.test.tsx`; modify `MemberVideoZone.tsx`, `MemberVideoZone.module.css`, `UpcomingBroadcasts.tsx`; extend `MemberVideoZone.test.tsx`, `UpcomingBroadcasts.test.tsx`.

**Interfaces:**
- Uses Task 1 exports.
- Exports `VideoListSkeleton({label, search=false}: {label:string; search?:boolean})` and `VideoWatchSkeleton({label}: {label:string})` from VideoLoading.
- Extend local upcoming page state to `{ids:string[]; complete:boolean; initialState:'loading'|'ready'|'error'}`. `complete` keeps its existing all-pages meaning; initialState distinguishes first discovery from ready scheduled pages with more cursors.
- Keep the existing API methods/ordering/cursors; do not wait for all polling to finish before rendering known cards.

- [x] Add deferred tests: checking→authorized skeleton handoff, query layout, watch shell before resolver, VOD-before-upcoming, live-before-VOD, initial upcoming rejection/retry, scheduled pages with a cursor and complete=false, and out-of-order query/account responses.
- [x] Assert an initial unknown upcoming segment retains its placeholder; once scheduled cards and their next-page affordance are ready, no infinite initial skeleton remains just because complete=false. VOD must still respect existing all-scheduled-before-VOD rules.
- [x] Run `corepack pnpm exec vitest run src/features/member-videos/MemberVideoZone.test.tsx src/features/member-videos/UpcomingBroadcasts.test.tsx src/features/member-videos/VideoLoading.test.tsx`; confirm expected regressions.
- [x] Implement six library placeholders (first three below 640 px), existing search geometry, 16:9 watch placeholder and three recommendations. Reuse status strings and existing breakpoints. Change only visual/state handoff; leave playback exchange, telemetry and private-cover loading intact.
- [x] Re-run tests plus `useBroadcastWatch.test.tsx`, `video-library.test.ts` and `RecordingCover.test.tsx`; verify invalid search, denied and error never look like indefinite loading.
- [x] Commit `feat(video): preserve library and watch layout during loading`.

### Task 3: Correct metrics, interaction and comment loading

**Files:** Modify `VideoInteractions.tsx`, `VideoInformation.tsx`, `VideoComments.tsx`, their module CSS/tests, `video-labels.ts`, and VideoLoading exports.

**Interfaces:**
- `VideoInformation` adds optional `loadingMetrics?:boolean` (default false for existing callers).
- VideoInteractions tracks first metrics settlement separately from metrics=null; keep the last valid value during polling failure. Use existing summary/disabled/error state to distinguish interaction-summary loading without a new API or fake count.
- Add `VideoCommentsSkeleton({label,replies=false}: {label:string;replies?:boolean})`: three root rows or two reply rows. Add the required `loading` label to existing `videoLabels` for all five locales if an equivalent label is not already available.

- [x] Add deferred assertions: pending metrics does not show unavailable or zero; first failure shows unavailable; real zero renders zero; later polling failure retains last valid metrics; summary loading has a noninteractive comment-trigger footprint.
- [x] Add comment assertions: initial root/reply loading rows, correct error/empty transition, append retains items, sort/refresh retains the composer draft and mobile close/reopen state, request cancellation cannot overwrite a new video, and uncertain mutation intent survives refresh.
- [x] Run `corepack pnpm exec vitest run src/features/member-videos/VideoInteractions.test.tsx src/features/member-videos/VideoInformation.test.tsx src/features/member-videos/VideoComments.test.tsx`; confirm new assertions fail for current behavior.
- [x] Implement numeric/interaction placeholders and comments loading at existing state boundaries. Keep the player, composer and mobile discussion instance mounted. Keep initial endpoint requests independently settleable where needed; preserve 30 s polling, cancellation and reaction-version checks.
- [x] Run the same tests plus VideoLoading tests; test pending→error→retry→ready-zero explicitly.
- [x] Commit `fix(video): distinguish pending statistics and comments from empty states`.

### Task 4: Align literature and homepage bulletin loading

**Files:** Create WeeklyLoading files listed above. Modify `WeeklyArchive.tsx`, `home/WeeklyCard.tsx`, `layout/AccountControl.tsx`, `app/[locale]/literature-ministry/page.tsx`; extend `WeeklyArchive.test.tsx`, `home/WeeklyCard.test.tsx`, `AccountControl.test.tsx`, literature `page.test.ts` and WeeklyLoading tests.

**Interfaces:**
- `BulletinAccessGate` adds `loadingFallback?:ReactNode`, used only while checking. The literature route owns its single main/banner; gate output must use section/div rather than create a nested main. Anonymous/unavailable semantics remain.
- WeeklyLoading exports `WeeklyLatestSkeleton({label})`, `WeeklyArchiveSkeleton({label})`, `WeeklyLandingSkeleton({label})` and `HomeWeeklySkeleton({label})`, all label:string. Landing composes existing latest/archive shapes.
- Home WeeklyCard reads existing auth/access state to distinguish checking from denial; navigation presentation hints never authorize content.

- [x] Add tests: access checking fallback does not mount child/fetch; anonymous/unavailable behavior remains; no nested main; latest ready while archive pending and vice versa; empty/error replace only their region; fast mode-only switch does not restart loading.
- [x] Add tests: homepage checking reserves the slot, denial removes it, approval replaces it; account switch does not show old metadata or fetch unauthorized editions; delayed old-series/archive response does not replace a new result.
- [x] Run `corepack pnpm exec vitest run src/components/literature-ministry/WeeklyArchive.test.tsx src/components/home/WeeklyCard.test.tsx src/components/layout/AccountControl.test.tsx 'src/app/[locale]/literature-ministry/page.test.ts'`; verify expected failures.
- [x] Implement one latest card and six archive rows (first three below 860 px), stable controls, the 350 px home card footprint and page-provided gate fallback. Preserve no-access homepage behavior after checking; no permanent blank slot for anonymous users.
- [x] Run the tests plus new WeeklyLoading tests, `resolve-edition.test.ts`/existing edition-related tests located with rg, and DownloadButton tests. Do not touch reader stores/renderers or grants/download requests.
- [x] Commit `feat(weekly): stabilize archive and homepage loading layouts`.

### Task 5: Align small-group skeletons and table/history states

**Files:** Create OrganizationLoading files. Modify `OrganizationsGate.tsx`, `OrganizationRootsPage.tsx`, `OrganizationUnitPage.tsx`, `OrganizationMemberPage.tsx`, `OrganizationNotificationDialog.tsx`, `organizations.css` and their tests.

**Interfaces:**
- OrganizationLoading exports `OrganizationRootsSkeleton({label})`, `OrganizationMemberSkeleton({label})`, `OrganizationDirectorySkeleton({label})`, `OrganizationRowsSkeleton({columns}: {columns:number})` and `OrganizationHistorySkeleton({label})`.
- Row composition uses existing authorized table column count; it does not infer hidden capabilities. Gate chooses a generic directory/root footprint without fetching protected data.

- [x] Add pending/denied/error tests for gate, roots, member and first folder. Add empty-unit search/page-refresh tests proving no noMembers/noResults while members are null/loading.
- [x] Add tests that existing child rows and controls remain, five member placeholders use correct colSpan, successful empty results then show the message, and late previous-unit data is ignored. Include permission revocation while a dialog/search is open and same-scope refresh preserving permitted input.
- [x] Add notification-history tests: first load has three placeholder rows, refresh retains history, errors stop loading, and send/preview pending guards remain unchanged.
- [x] Run `corepack pnpm exec vitest run src/features/organizations`; confirm new assertions fail for current behavior.
- [x] Implement four root rows, member-section shapes, five directory rows, three history rows; replace generic bars and fix pending-before-empty branches without changing actions/authorization/mutation contracts.
- [x] Run organization tests; assert existing permission-loss dialog-clear regressions from #228 still pass.
- [x] Commit `fix(organizations): preserve directory shape and distinguish loading from empty`.

### Task 6: Add scoped native public-navigation feedback

**Files:** Create `NavigationPendingIndicator.tsx`, `.module.css`, `.test.tsx`; modify `layout/SiteHeader.tsx`, `SiteFooter.tsx`, `home/NewsSection.tsx`, `ui/PageNavigation.tsx`, `ui/Button.tsx` and focused tests. Reuse `site.loading` labels; avoid changing accessible names of existing links.

**Interfaces:**
- `NavigationPendingIndicator()` is a client descendant of a Next Link and consumes `useLinkStatus()` from `next/link`.
- Use a tiny absolute/reserved marker without shifting anchor contents; all marker output is decorative aria-hidden. Preserve native Next route-completion announcements. Do not add per-link live announcements or hidden words that alter link accessible names; data-region status remains owned by Task 1 consumers.
- Site Button includes the indicator only for root-relative internal hrefs and target other than _blank. Native anchor behavior remains; no interception of external/download/modified clicks.

- [x] Mock only Next's useLinkStatus in unit tests: pending=false hides the marker; pending=true applies the 150 ms delayed CSS state; reset/cancellation removes it. Preserve link names, hrefs, tab order and focus.
- [x] Add integration assertions for header/footer/news/pagination/internal Button coverage and exclusion of external/new-tab buttons. Keep language switcher's existing one-shot document-navigation behavior.
- [x] Run `corepack pnpm exec vitest run src/components/ui/NavigationPendingIndicator.test.tsx src/components/layout/SiteHeader.test.tsx src/components/layout/SiteFooter.test.tsx src/components/home/NewsSection.test.tsx src/components/ui/PageNavigation.test.tsx src/components/ui/Button.test.tsx` (create focused tests where absent).
- [x] Implement the native hook indicator and add it within existing Links. Do not force prefetch=false, add an event bus, change the global mask/Suspense/privacy boundary, or invent a percentage.
- [x] Re-run focused tests and existing LanguageSwitcher/analytics/route tests. Browser Task 7 verifies real Next completion, rapid click cancellation and warm prefetch, rather than treating a mocked hook as end-to-end proof.
- [x] Commit `feat(navigation): show pending feedback on internal site links`.

### Task 7: Verify the whole change and hand off for review

**Files:** Evidence directory, spec/plan progress only; product fixes only if an acceptance check exposes a specific defect.

**Interfaces:** Consumes all feature exports and real Next navigation; produces reproducible verification results and a reviewable branch/PR, not an automatic production release.

- [ ] Resolve and review any latest-main integration since execution preflight before final checks; rerun checks on the final reviewed head.
- [ ] Confirm `corepack pnpm install --frozen-lockfile` on the final dependency state, then `corepack pnpm test:run`, `corepack pnpm lint`, `corepack pnpm build`, `corepack pnpm perf:static`, `./scripts/test-release-policy.sh`. Expect all commands exit 0; document existing warnings honestly.
- [ ] Use a production-build synthetic fixture to hold/reject/reorder each data request without real member writes. Inspect 320/390/768/1024/1440 px, light/dark, reduced-motion, long titles, empty and 12+ results. Validate action columns and no document horizontal overflow; a deliberate table scroll container may remain.
- [ ] Measure region bounds/scroll/focus/draft through authorization handoff, partial upcoming discovery, archive paging, small-group filtering and reply expansion. Confirm loaded content is retained only within the same valid scope. Record a bounded screenshot batch, fix exposed issues together, and one confirmation batch.
- [ ] On a production build hold a public Next transition for 2 s: verify the link marker appears after 150 ms with no layout change, old page remains usable, completion/Back/Forward clears it, rapid A→B click leaves only the active transition pending, and a warm/cache-fast transition is immediate. Pagination must use a fixture because the recorded live dataset did not expose controls.
- [ ] Run Impeccable detector once over changed UI targets; preserve baseline warnings separately. Request one independent whole-branch review and address verified findings. No subagent implementation or extra consultant is implied by this plan.
- [ ] Update evidence with commands/results and actual limits; open a focused hhc-web PR and require all CI/image checks. Ask for the authorized integration/release stage after review if it has not already been explicitly approved for this change. Never infer it from the previous video release.
- [ ] If later authorized, merge only the reviewed current head after successful CI, let CI/CD publish, verify revision/digest/health and relevant routes, then remove only the clean temporary task worktree and included local branch. Keep it on failure or outstanding work.

## Explicitly deferred first-load investigation follow-up

Evidence is already recorded; do not repeat all probes during these tasks. A separate proposal may replace the global first-load screen only after proving meaningful public SSR, slow/disabled-JS behavior and the analytics excluded-destination/consent barrier. Removing a screen without resolving a blank Suspense fallback is not an accepted fix. No dependency on that future proposal blocks these three groups or native public pending hints.

## Plan self-review

- Every feature requirement maps to Tasks 1–6; responsive/real-browser/security regressions map to Task 7 and the owning state tests.
- Public pending feedback is the sole proposed scope expansion. Global first-load replacement is explicitly excluded with evidence and follow-up acceptance conditions.
- No backend/shared-package release or existing bulletin renderer/cache migration is required.
- Scope/account fencing, initial scheduled discovery versus complete pagination, stale metric polling, persistent mobile drafts, valid anonymous homepage collapse, and native click cancellation are explicit review targets.
