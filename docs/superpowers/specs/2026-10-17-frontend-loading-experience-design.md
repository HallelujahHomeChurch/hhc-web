# Frontend loading experience design

Date: 2026-10-17 (Asia/Taipei)
Status: Approved by the user; inline implementation authorized on 2026-10-17.
Source baseline: hhc-web origin/main `009d37c8238fc50024982f9dc396812bd7fb4ef0`.

## Intent and decisions

Members should recognize the page they requested while its data is loading, without a text-only card, a blank section, a false empty/error state, or losing their draft or scroll position. Preserve HHC's existing visual identity and responsive layouts.

The user requested these three groups together: member videos, weekly bulletins (including the homepage card), and small groups. The proposed additional scope is subtle pending feedback for public-site navigation. Retain the current global first-load screen in this implementation; its broader rendering changes are deferred for the reasons below. This document and the accompanying implementation plan are drafts for review, not authorization to deploy.

## Investigation of first load and public navigation

### Evidence

- `InitialLoadingBoundary.tsx` overlays its already-rendered children until hydration and `navigation.ready`. It is not an authorization boundary.
- The producer `frontend-platform/packages/account-client/src/navigation-presentation.ts` initializes browser presentation with `ready: true`, even with missing/invalid local hints. Hints are display-only. Consequently, the current full-screen wait must not be described as waiting for an Account/Operations API response.
- The locale layout wraps all page children in `Suspense fallback={null}` around `AnalyticsBoundary`, which uses `useSearchParams`. Public pages also await server content/site layout. Removing only the branded screen does not establish that meaningful content becomes visible earlier.
- `AnalyticsBoundary` deliberately withholds excluded destinations when GA has already started and reloads the document. Query/fragment exclusions and consent guards are product/privacy behavior, not disposable loading code.
- No route-level `loading.tsx` exists at this baseline. Page-level SiteHeaderServer/SiteFooterServer placement means a naive route fallback could remove/recreate navigation chrome rather than preserve it.
- Existing LanguageSwitcher already records a pending state, disables repeat selection, and performs its deliberate document navigation.

Browser evidence: `../evidence/2026-10-17-loading-experience/browser-probe.json`. Real Chromium, existing signed-in session, 600 ms configured latency, 192,000 bytes/s download, HTTP cache disabled, service worker bypassed in the agent's page. No cookies/storage were cleared, no member mutations were submitted.

| Observation | Result | Interpretation |
| --- | --- | --- |
| Hard entry to public About | First paint ~1,540 ms; mask present ~1,477–4,133 ms; main/header recorded at ~4,133 ms | Real full-page waiting under this condition; not proof of a slow authentication API |
| About → News header link | Old About content retained ~1.9 s; header remained; no navigation-specific indicator in current implementation | Add lightweight link pending feedback |
| News navigation layout shift | Raw observed shift entry ~0.030 | Diagnostic sample only; not a field CLS percentile or isolated attribution |

These are bounded diagnostic samples, not population performance benchmarks. Anonymous/cold-session, device/Safari and all navigation destinations were not measured. The live News dataset did not expose pagination in the recorded DOM; pagination requires a fixture during implementation.

### Scope decision

**Include public navigation feedback.** Use installed Next.js `useLinkStatus` as a descendant of existing internal Next Links. Keep the current page/chrome interactive while waiting, show a reserved-space hint only after 150 ms, and let Next own completion, cancellation and latest-click behavior. Cover header/footer internal navigation, homepage/news internal links, public pagination and internal site Button links. External links, downloads, modified/new-tab clicks and LanguageSwitcher retain their existing behavior. The hint is decorative and preserves native Next route-completion announcements and existing link accessible names; it does not add a live region inside every anchor. No global router event bus or fabricated progress percentage.

**Defer global first-load replacement.** Do not remove/retime InitialLoadingBoundary or restructure AnalyticsBoundary/locale Suspense as a side effect of the three content groups. A follow-up must first demonstrate meaningful public SSR visibility with slow/disabled JavaScript and independently preserve consent, excluded-route/query/fragment reload barriers, anonymous and account-switch gates, legal redirects, statements and no-JS behavior. The observed first-load wait is recorded as unresolved; this scope does not promise a faster first paint or less JavaScript.

Do not add a global `loading.tsx` or move all headers into a shared layout in this change. Inline pending feedback addresses the demonstrated public transition gap without a route/SEO/privacy rewrite.

## Common behavior

1. Skeleton geometry follows the finished content: same containers, breakpoints, image aspect ratios, gaps and text hierarchy. It is not a set of fake records and must not show fabricated titles, counts, permissions or dates.
2. Initial unknown data uses skeletons. Ready-empty, denied/unavailable and error are distinct outcomes. Error/retry and sign-in prompts stay functional; an aborted request must not settle a newer request or another account's state.
3. Ready content in the same valid account/resource scope remains mounted during background refresh. Search/filter/page changes are foreground replacement: preserve surrounding controls and show a local skeleton, not stale items labeled as the new result. Pagination appends loading feedback below existing items. Account change, sign-out or permission loss clears/hides private data immediately, using existing authorization fences.
4. Reuse the pinned UI package Skeleton and existing tokens. No package upgrade, dependency, backend contract, persistence cache or new service. Local feature-specific skeleton compositions share only primitive styling and status conventions.
5. Neutral low-contrast placeholders use the existing 1.4 s shimmer, with a 150 ms animation delay. There is no minimum loading duration: ready data renders immediately. Reduced-motion disables shimmer/transitions and retains static placeholders. Light/dark/forced-colors must remain distinguishable.
6. One polite screen-reader status per independently loading region; decorative placeholders are aria-hidden, have no links/buttons/tab stops, and are not announced per block. Mark the updating content region aria-busy and clear it when settled; keep the status announcement outside the busy/decorative subtree. Repeated polling must not continually announce loading. Do not move keyboard focus to a skeleton or remount a composer.
7. Reserve enough space for the expected visible content, without pretending to know the total result count. Short/empty results can still shrink the region: zero total CLS is not guaranteed. No arbitrary request timeout or retry policy is introduced.

## Group A: Member video experience

### Library, search and upcoming discovery

- Replace the authorization-checking text card with the same list/search skeleton used during first data fetch. Preserve the page padding/header geometry across the handoff.
- Library: six thumbnail/title/date placeholders, with only the first three visible below 640 px. Reuse current 1/2/3-column breakpoints (640/1024 px) and 16:9 thumbnails. Search uses its existing horizontal-desktop/stacked-mobile result layout.
- Cover the transition among authorization, VOD, active live and initial upcoming discovery; VOD readiness alone must not remove the skeleton while initial upcoming discovery still prevents VOD display. Distinguish initial discovery from complete pagination: ready scheduled cards with a next cursor are not still in first-load state. Never reorder VOD above an unknown upcoming segment.
- Allow already-known live or scheduled cards to appear, using placeholders only for unresolved regions. Do not gate the whole grid on all ongoing polling requests. Existing live → upcoming → VOD ordering, search/keyset pagination and stable watch URLs remain.
- Upcoming pagination and VOD load-more retain rendered cards and add only tail feedback. An upcoming error keeps its retry visible and must not cause an unlabelled permanent blank region.
- Retain fixed cover aspect ratios and existing authenticated/private cover access and fallback images. Do not fetch covers earlier merely to animate them.

### Watch shell, metrics and interactions

- First watch resolution shows the 16:9 player slot, title/metadata/action placeholders and three recommendation placeholders in the current desktop/sidebar or mobile layout. No duplicate player or started media request is created by a skeleton.
- Once a player/recording is ready, only unresolved subregions remain placeholders. Playback preparation/buffering/recovery continues using player-specific status, not a page skeleton.
- Split metrics loading from genuine unavailable and not_started. Unknown metrics show an inline numeric placeholder; actual zero is displayed as zero, not unknown. Polling keeps the last valid metrics/summary, with existing recovery behavior on failure.
- Interaction-summary loading reserves the comment header/mobile trigger footprint without inventing a zero count. Comments load three avatar/text rows; an expanded reply initially loads two smaller rows. Ordering/explicit refresh may show an updating hint while keeping the composer and its draft mounted. Load-more keeps existing comments and adds a tail indicator.
- Preserve reaction intent reconciliation, reply targeting, cursor-expiry recovery, edit/report/delete, the persistent mobile sheet, focus return and all uncertain-write safeguards.

## Group B: Weekly bulletins

- BulletinAccessGate accepts a page-provided loading fallback for checking only. The route owns the single main/banner; the gate renders section/div so its non-loading prompts cannot create a nested main. It must not mount protected content or fetch an archive before access is available. Anonymous sign-in and unavailable prompts retain current semantics.
- Literature landing keeps its public heading/banner and stable content shell while checking, with generic bulletin placeholders. Real edition/series controls and private metadata appear only after authorization; placeholder button shapes are decorative.
- Latest issue: one appropriately sized card with issue/title/subtitle/action placeholders. Archive: six desktop rows, first three visible below the existing 860 px stacked-row breakpoint. Both requests settle independently.
- Keep archive heading, mode controls and authorized series controls stable during foreground page/series changes. Do not display a prior series/page as if it were the requested result. Mode-only switches that do not need data must not restart a skeleton.
- Homepage: reserve the weekly/news layout during unresolved access without using cached permission hints as authorization. While access is unknown, render a generic fixed-footprint slot in the existing weekly position; on denial remove it once, on approval replace it with the authorized card. Preserve the current desktop columns, mobile order and 350 px card minimum where applicable. An anonymous transition may necessarily collapse the reserved slot; record this rather than retaining permanent empty space.
- Per-series latest data and ready cards stay usable during same-scope background refresh. Download progress/readiness, PDF fallback, language selection, entitlement checks, reader rendering/offline state and immutable bulletin versions are unaffected.

## Group C: Small groups

- Replace generic gate/root/member/first-folder bars with corresponding root-list, directory or member-detail skeleton compositions. No private name/email or action capability is inferred during checking.
- Directory has five placeholder rows with the existing responsive table columns. A skeleton row spans the currently authorized column count; never render nonexistent action links. Table header, breadcrumbs/search/known unit shell and pagination remain stable during same-unit foreground loading.
- Distinguish pending members from successful empty members. No noMembers/noResults message while loading. The currently loaded unit's child rows may remain; member rows use placeholders while the requested page/search is pending. On permission loss existing dialogs, candidate results and stale data must still clear.
- Root list uses four row placeholders; member detail uses heading, affiliation and existing form-section shapes. Refresh remains local and preserves allowed form input unless existing permission/account logic invalidates it.
- Notification history uses three local history-row placeholders on first load and retains current history during refresh. Sending, audience preview and mutation pending/uncertain states remain button/form states.

## Proposed local files and boundaries

Shared in hhc-web: `src/components/ui/ContentLoading.tsx`, `ContentLoading.module.css` exporting LoadingBlock({className?}) and LoadingStatus({label}) for decorative placeholder sizing and a single status primitive; `src/components/ui/NavigationPendingIndicator.tsx` and module CSS for native Link pending feedback. Keep feature geometry in its owning feature; no generic schema-driven skeleton renderer.

Feature compositions: `features/member-videos/VideoLoading.tsx`; `components/literature-ministry/WeeklyLoading.tsx`; `features/organizations/OrganizationLoading.tsx`, with their existing or small adjacent CSS modules. `AccountControl.tsx` changes only BulletinAccessGate's loading-fallback contract; its runtime/auth implementation is unchanged.

No changes to frontend-platform, Account/API/Gateway, migrations, production configuration, analytics consent logic or reader lifecycle are required.

## Acceptance and delivery

- Deferred-promise tests distinguish checking/loading, ready-zero/empty, denied/unavailable/error, refresh and append for every group; cover request races and account/permission loss.
- Test pending Link behavior with the installed Next hook contract, fast completion, cancellation and external links; do not add a timer-based global navigation state.
- Browser verification uses production builds and synthetic fixtures for private data. Inspect 320/390/768/1024/1440 px, light/dark and reduced-motion; slow successful, rejected and out-of-order requests. No horizontal page overflow, skeleton-driven focus movement or lost draft.
- Compare region bounds before/after typical populated results, and report raw shifts separately from any real field CLS. Public navigation should show pending feedback after 150 ms during a held transition; cache-fast completion must not wait for the hint.
- Run repository tests, lint, build, static budgets, release policy and required CI/image checks. Independent final review before merge. Merge/release/live smoke require explicit authorization at the delivery stage; document approval alone does not authorize deployment.

## References

- NN/g: https://www.nngroup.com/articles/skeleton-screens/
- Google: https://web.dev/articles/optimize-cls
- WAI-ARIA: https://www.w3.org/TR/wai-aria-1.2/#aria-busy
- Reduced motion: https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions
- Installed Next 16.3.8 docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`, `03-file-conventions/loading.md`, and `01-getting-started/04-linking-and-navigating.md`.
