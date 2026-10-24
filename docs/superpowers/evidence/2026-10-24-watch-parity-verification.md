# Member watch-page parity: implementation evidence

Tracking: hhc-web#285. Base: `6d37ad19e1fe85cbc21256d791f0134e91c759c8`. API: [PR 337](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/337). SDK: [PR 158](https://github.com/HallelujahHomeChurch/frontend-platform/pull/158). Implementation was directly authorized after the recorded design decisions. No merge, publication, deployment or production data operation is included.

## Behavior

- Desktop comments use 36px roots / 24px reply avatars, a 16px content gap, 12px author/time and 14px/20px body text. Author, body and actions share the content column. Composer uses one underline and grows with text. Nested branches start collapsed and remain mounted after first load; drafts and loaded pages survive collapsing.
- Selected thumbs fill only the SVG. Comment backgrounds remain transparent and numeric styling stays neutral. The video-like button retains its original neutral pill. Counts still update from the server acknowledgement.
- Compact information uses localized compact views and relative age, expanding to exact views/date. Scheduled times, live viewers, unavailable values and real zero retain distinct meanings.
- Mobile uses a below-player reading panel with its own scroll area, fixed heading and bottom composer. Back returns to the root discussion; Close hides the panel. Drafts/scroll positions are retained and the player instance stays mounted. Short/keyboard editing uses available viewport space. Focus changes to Back/Cancel/Send keep controls stationary until the action commits.
- An explicit threaded server contract supplies direct-child/descendant counts and bounded preview profiles. Invalid/missing structural metadata is rejected; the browser never guesses a tree from a partial flat page. Intermediate removed nodes redact identity/body/target while keeping descendants. Existing author-delete / staff-hide-and-restore permissions are preserved.

## Candidate SDK boundary

The Web manifest and lock still identify published SDK 1.1.0. Local verification uses the **built/packed 1.1.4 candidate from platform commit `63267ff007d5b5e2aebaef7606107f5f8a41031c`** in this worktree's ignored node_modules. The initial external source symlink worked for Vitest/TypeScript but was outside Turbopack's root; the packed candidate was unpacked inside this worktree for the build, with its already-installed dependency linked locally. No shared pnpm package was overwritten.

Normal CI and Docker install from the registry with frozen lockfiles. They cannot use this candidate. After separately approved SDK publication, pin the real exact version, generate the real registry lock entry and rerun normal Web CI. Do not merge this draft with the old SDK, invent package integrity or change CI to mask the dependency.

## Local checks

- A complete pre-final-focus-adjustment run passed **187 files / 1558 tests**, plus 23 script tests and 12 immutable template assets. Four added removal/branch regressions and the final active-sort regression are included in the subsequent 21-test comment suite, which passed.
- Candidate TypeScript, lint (three existing warnings), production build and static budgets passed. Final full-suite/build status is recorded in the PR before closeout.
- Switching the candidate location left stale Vitest filesystem module transforms: mocked SDK calls and class identities failed in unrelated suites. A fresh `--fsModuleCachePath` made the three affected suites pass (133 tests) and then the whole 1558-test run pass. No mocks, policies or unrelated code were weakened.
- A later full rerun under concurrent local load had timing failures in unrelated organization/reader tests. These remain test-environment evidence until a final bounded rerun or CI result proves otherwise; they are not attributed to the layout change without evidence.

## Browser evidence and limits

A synthetic loopback Vite fixture loaded the actual changed Watch/Comments/Information/Interactions components and the installed shared player. Account/API responses used synthetic data only. No member API, real comment or production reaction was written.

Direct rendered DOM measurements at 1470px:

- Root/reply avatars: 36px / 24px.
- Root author/body x=68px; replies author/body x=104px.
- Comment like before/after: background `rgba(0,0,0,0)` both times; count `rgb(96,96,96)` both times; SVG fill `none` → `rgb(15,15,15)`; acknowledged count 3 → 4.

At 390×844, the reading panel began at y=219.375px, exactly the player's bottom, and ended at y=844px. Bottom composer ended at y=844px. Document/panel horizontal overflow checks were false. The player node identity was unchanged. Root and nested branches rendered from separate pages; reply drafting and the Back/Close controls were inspected. The focus/movement issue found there was fixed and covered by a regression; its final real-browser rerun remains unverified.

Screenshot capture timed out through both Ego and the Chrome tab capture interface. Later CDP viewport/evaluate requests also timed out; the task space was closed successfully. No successful screenshot or pixel comparison is claimed. The synthetic HLS fixture never reached a decoded/finite-duration state; playback continuity is not accepted merely from a mounted player/control-state transition.

Remaining acceptance: full 320/375/390/768/1024/1440 light/dark visual matrix, long/removed/error/menu/loading states, 200% text zoom, physical iOS/Android keyboard and safe areas, final focus-transition browser rerun and real media continuity. Current source/DOM/unit checks do not substitute for those receipts. Ego Lite reported an available update; no upgrade was performed.
