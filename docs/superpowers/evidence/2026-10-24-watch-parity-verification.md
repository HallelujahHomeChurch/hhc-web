# Member watch-page parity: implementation evidence

Tracking: hhc-web#285. Base: `6d37ad19e1fe85cbc21256d791f0134e91c759c8`. API: [PR 337](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/337). SDK: [PR 158](https://github.com/HallelujahHomeChurch/frontend-platform/pull/158). Implementation was directly authorized after the recorded design decisions. No merge, publication, deployment or production data operation is included.

## Behavior

- Desktop comments use 36px roots / 24px reply avatars, a 16px content gap, 12px author/time and 14px/20px body text. Author, body and actions share the content column. Composer uses one underline and grows with text. Nested branches start collapsed and remain mounted after first load; drafts and loaded pages survive collapsing.
- Selected thumbs fill only the SVG. Comment backgrounds remain transparent and numeric styling stays neutral. The video-like button retains its original neutral pill. Counts still update from the server acknowledgement.
- Compact information uses localized compact views and relative age, expanding to exact views/date. Scheduled times, live viewers, unavailable values and real zero retain distinct meanings.
- Mobile uses a below-player reading panel with its own scroll area, fixed heading and bottom composer. Back returns to the root discussion; Close hides the panel. Drafts/scroll positions are retained and the player instance stays mounted. Short/keyboard editing uses available viewport space. Focus changes to Back/Cancel/Send keep controls stationary until the action commits.
- An explicit threaded server contract supplies exact root totals, optional nonroot descendant totals and bounded preview profiles. Roots may use hasChildren=true when their direct-child count is unavailable; nonroots still require an exact direct count. Missing nonroot totals display “View replies”, never zero. Invalid structural metadata is rejected; the browser never guesses a tree from a partial flat page. Intermediate removed nodes redact identity/body/target while keeping descendants. Existing author-delete / staff-hide-and-restore permissions are preserved.

## Candidate SDK boundary

The Web manifest and lock still identify published SDK 1.1.0. Local verification uses the **built/packed 1.1.4 candidate from platform commit `87a56dc3fd9f74759c618b3f2a60c9cc5ab131b8`** in this worktree's ignored node_modules. The initial external source symlink worked for Vitest/TypeScript but was outside Turbopack's root; the packed candidate was unpacked inside this worktree for the build, with its already-installed dependency linked locally. No shared pnpm package was overwritten. Candidate archive SHA256: `395b0f8a8aacf912efa4122b877cf50addf6754ea5f1ee95e27b4fd1baeed1d3` (local archive identity, not registry integrity).

Normal CI and Docker install from the registry with frozen lockfiles. They cannot use this candidate. After separately approved SDK publication, pin the real exact version, generate the real registry lock entry and rerun normal Web CI. Do not merge this draft with the old SDK, invent package integrity or change CI to mask the dependency.

## Contention and async-state fixes

- One cancellable per-discussion GET queue serializes branch/page/reconciliation reads. Newly opened children load once; the initial revision does not trigger a duplicate fetch. Edits refresh their containing list; reporting does not reload counts. Reply/deletion updates retain authoritative loaded ranges while refreshing ancestors sequentially. This bounds one discussion's concurrent reads, not all tabs or server clients.
- Sort changes abort the active traversal; responses from an obsolete Top reconciliation cannot replace Newest rows/cursors, including transports that ignore AbortSignal. Queued canceled work is checked before fetch.
- Focus leaves the empty composer when the form blurs. Pointer actions defer geometry changes until Back/Cancel/Send clicks finish; keyboard blur releases immediately.
- Async reply completion only retargets the composer if that reply remains selected, so a draft opened in another thread survives a slow POST.
- Typed422 traversal-limit errors preserve already loaded comments and remove both Retry and Load more for that traversal. Explicit refresh/order changes remain available. Ordinary transient503 errors retain retry behavior.

## Local checks after review fixes

- Final `pnpm test:run --fsModuleCachePath=<fresh-task-cache>` passed **187 files /1,574 tests**, plus23 script checks and12 immutable template assets. The32-test comment suite covers duplicate/serialized reads, stale-sort cancellation, focus/Back, async cross-thread send completion, later-page422, optional totals/root fallback, invalid metadata, nested/cyclic/removal privacy and draft retention.
- Candidate TypeScript, lint (three existing warnings), production build and static budgets passed. Current normal-registry CI is independent and remains blocked by unpublished candidate APIs.
- Fresh transforms isolated the three stale-module failures in MemberVideoZone. A remaining integration test matched both the mobile preview and updated body; its assertion now targets the body paragraph and still verifies one update call, draft reconciliation and closed editor. No runtime behavior or assertions were removed to pass checks.
- Historical earlier green runs and concurrent-load failures are superseded by this bounded final local run; they do not establish registry or device acceptance.

## Browser evidence and limits

A synthetic loopback Vite fixture loaded the actual changed Watch/Comments/Information/Interactions components and the installed shared player. Account/API responses used synthetic data only. No member API, real comment or production reaction was written.

Direct rendered DOM measurements at 1470px:

- Root/reply avatars: 36px / 24px.
- Root author/body x=68px; replies author/body x=104px.
- Comment like before/after: background `rgba(0,0,0,0)` both times; count `rgb(96,96,96)` both times; SVG fill `none` → `rgb(15,15,15)`; acknowledged count 3 → 4.

At 390×844, the reading panel began at y=219.375px, exactly the player's bottom, and ended at y=844px. Bottom composer ended at y=844px. Document/panel horizontal overflow checks were false. The player node identity was unchanged. Root and nested branches rendered from separate pages; reply drafting and the Back/Close controls were inspected. The focus/movement issue found there was fixed and covered by a regression; its final real-browser rerun remains unverified.

Screenshot capture timed out through both Ego and the Chrome tab capture interface. Later CDP viewport/evaluate requests also timed out; the task space was closed successfully. No successful screenshot or pixel comparison is claimed. The synthetic HLS fixture never reached a decoded/finite-duration state; playback continuity is not accepted merely from a mounted player/control-state transition.

Remaining acceptance: full 320/375/390/768/1024/1440 light/dark visual matrix, long/removed/error/menu/loading states, 200% text zoom, physical iOS/Android keyboard and safe areas, final focus-transition browser rerun and real media continuity. Current source/DOM/unit checks do not substitute for those receipts. Ego Lite reported an available update; no upgrade was performed.
