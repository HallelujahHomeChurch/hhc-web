# Member watch-page parity: implementation evidence

Tracking: hhc-web#285. Base: `6d37ad19e1fe85cbc21256d791f0134e91c759c8`. API: [PR 337](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/337). SDK: [PR 158](https://github.com/HallelujahHomeChurch/frontend-platform/pull/158). Implementation was authorized after the recorded design decisions. The user later authorized coordinated production release after the pool/lock regression review. Final release receipts are recorded in the PR; no production comment/reaction writes are used for verification.

## Behavior

- Desktop comments use 36px roots / 24px reply avatars, a 16px content gap, 12px author/time and 14px/20px body text. Author, body and actions share the content column. Composer uses one underline and grows with text. Nested branches start collapsed and remain mounted after first load; drafts and loaded pages survive collapsing.
- Selected thumbs fill only the SVG. Comment backgrounds remain transparent and numeric styling stays neutral. The video-like button retains its original neutral pill. Counts still update from the server acknowledgement.
- Compact information uses localized compact views and relative age, expanding to exact views/date. Scheduled times, live viewers, unavailable values and real zero retain distinct meanings.
- Mobile uses a below-player reading panel with its own scroll area, fixed heading and bottom composer. Back returns to the root discussion; Close hides the panel. Drafts/scroll positions are retained and the player instance stays mounted. Short/keyboard editing uses available viewport space. Focus changes to Back/Cancel/Send keep controls stationary until the action commits.
- An explicit threaded server contract supplies exact root totals, optional nonroot descendant totals and bounded preview profiles. Roots may use hasChildren=true when their direct-child count is unavailable; nonroots still require an exact direct count. Missing nonroot totals display “View replies”, never zero. Invalid structural metadata is rejected; the browser never guesses a tree from a partial flat page. Intermediate removed nodes redact identity/body/target while keeping descendants. Existing author-delete / staff-hide-and-restore permissions are preserved.

## Published SDK integration

API PR337 is released at `9e66956` / healthy revision `hhc-web-api--0000263`; migration and production smoke passed. SDK PR158 was merged at `81b57840560f3a521e96b4424345958a796a72a7`, tagged `v1.1.4`, and published through successful [Release packages40103487201](https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/40103487201).

The Website now pins actual registry `@hallelujahhomechurch/hhc-web-client` **1.1.4** in the manifest, real registry lockfile and exact-version test. Installed dependencies resolve to the pnpm registry package; the task-owned candidate was removed. Registry integrity: `sha512-ITz/7yFXJXQnm3u1+umLtZMmkGyUg8f8PQiPBuaoUhi6WazRk850Y6rmAfTXmpM+8m3nBWfu8P/9TiiW3ZY6QQ==`.

Earlier candidate-only checks and registry build failures are historical. They were not waived or treated as green; the final frozen registry install and full Web/image CI validate the published dependency. API and SDK release workflows are both fully successful before the Website merge gate.

## Contention and async-state fixes

- One cancellable per-discussion GET queue serializes branch/page/reconciliation reads. Newly opened children load once; the initial revision does not trigger a duplicate fetch. Edits refresh their containing list; reporting does not reload counts. Reply/deletion updates retain authoritative loaded ranges while refreshing ancestors sequentially. This bounds one discussion's concurrent reads, not all tabs or server clients.
- Sort changes abort the active traversal; responses from an obsolete Top reconciliation cannot replace Newest rows/cursors, including transports that ignore AbortSignal. Queued canceled work is checked before fetch.
- Focus leaves the empty composer when the form blurs. Pointer actions defer geometry changes until Back/Cancel/Send clicks finish; keyboard blur releases immediately.
- Async reply completion only retargets the composer if that reply remains selected, so a draft opened in another thread survives a slow POST.
- Typed422 traversal-limit errors preserve already loaded comments and remove both Retry and Load more for that traversal. Explicit refresh/order changes remain available. Ordinary transient503 errors retain retry behavior.

## Local checks after review fixes

- Final `pnpm test:run --fsModuleCachePath=<fresh-task-cache>` passed **187 files /1,574 tests**, plus23 script checks and12 immutable template assets. The32-test comment suite covers duplicate/serialized reads, stale-sort cancellation, focus/Back, async cross-thread send completion, later-page422, optional totals/root fallback, invalid metadata, nested/cyclic/removal privacy and draft retention.
- Published SDK1.1.4 TypeScript, lint (three existing warnings), production build and static budgets passed. The final registry checks below supersede the pre-publication dependency block; ordinary Web/image CI remains required.
- Fresh transforms isolated the three stale-module failures in MemberVideoZone. A remaining integration test matched both the mobile preview and updated body; its assertion now targets the body paragraph and still verifies one update call, draft reconciliation and closed editor. No runtime behavior or assertions were removed to pass checks.
- Historical earlier green runs and concurrent-load failures are superseded by this bounded final local run; they do not establish registry or device acceptance.

## Browser evidence and limits

A synthetic loopback Vite fixture loaded the actual changed Watch/Comments/Information/Interactions components and the installed shared player. Account/API responses used synthetic data only. No member API, real comment or production reaction was written.

Direct rendered DOM measurements at 1470px:

- Root/reply avatars: 36px / 24px.
- Root author/body x=68px; replies author/body x=104px.
- Comment like before/after: background `rgba(0,0,0,0)` both times; count `rgb(96,96,96)` both times; SVG fill `none` → `rgb(15,15,15)`; acknowledged count 3 → 4.

At 390×844, the reading panel began at y=219.375px, exactly the player's bottom, and ended at y=844px. Bottom composer ended at y=844px. Document/panel horizontal overflow checks were false. The player node identity was unchanged. Root and nested branches rendered from separate pages; reply drafting and the Back/Close controls were inspected. The focus/movement issue found there was fixed and covered by a regression. The final local browser rerun below verifies focus/Back after the fix.

Screenshot capture timed out through both Ego and the Chrome tab capture interface. Later CDP viewport/evaluate requests also timed out; the task space was closed successfully. No successful screenshot or pixel comparison is claimed. The synthetic HLS fixture never reached a decoded/finite-duration state; playback continuity is not accepted merely from a mounted player/control-state transition.

Final local Ego task51 rerun at390×844 (source8a94420, candidate87a56dc) passed: empty-input focus expands to0px; blur to a comment button restores219.375px without a synthetic resize. A native pointer Back click preserves the draft and video node; reopening restores the visible draft. No horizontal overflow. Screenshot capture again timed out. Task51 and its loopback preview were closed; no Ego update was installed. This synthetic HLS still reports0:00, so no decoded playback acceptance is implied.

Remaining acceptance: full 320/375/390/768/1024/1440 light/dark visual matrix, long/removed/error/menu/loading states, 200% text zoom, physical iOS/Android keyboard and safe areas, and real media continuity. Current source/DOM/unit checks do not substitute for those receipts. Ego Lite reported an available update; no upgrade was performed.

## Lower-distraction watermark (authorized during release)

The Website member-video zone overrides only the shared watermark visual style: opacity10%→6%, shadow0 1px2px black→0 1px1px black40%. The published player, code, count, layout, media authorization and fullscreen container remain unchanged. The same zone contains VOD/live playback and library previews. No SDK tag is modified for this site-specific style.

A synthetic native WebM fixture rendered the actual RecordingWatermark component before/after. Desktop:960×540, six marks,30.72px font in both samples. Mobile:341.328×192, four marks,13.7143px in both. Computed opacity changes0.10→0.06 and shadow matches the new style. Screenshot capture still timed out; these are rendered DOM/style measurements. Production baseline before the Web release had a decoded854×480 video, readyState4, finite duration, six marks and opacity0.10; the viewer was paused and closed after checking. Final registry CI and deployed visual-style readback are separate gates.

## Final registry validation

After the actual1.1.4 registry install and removal of the local candidate, `pnpm install --frozen-lockfile` passed. `pnpm test:run --maxWorkers=2 --fsModuleCachePath=<fresh-task-cache>` passed187 files /1,574 tests plus23 script checks and12 immutable assets. Lint has0 errors /3 existing warnings. Production build/TypeScript and static budgets passed: CSS206,837 bytes; hero140,091 bytes; DOCX434,974 raw /124,004 gzip. The watermark adjustment is included in these checks. No dependency, CI or validation bypass was used. Exact-head PR CI/image checks and final deployment readback remain the next gates.
