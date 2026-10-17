# Independent whole-branch review

Read-only review of `009d37c..2f9781a` against the approved specification, implementation plan, connected owning source and tests. The reviewer did not edit source, spawn reviewers or rerun the executor's checks.

## Findings and verified fixes

- Critical: none.
- Important: empty recording/upcoming results could declare an empty combined library while live discovery was pending or failed. Fixed the empty branch to require live discovery to finish successfully. Three new deferred library/search success/failure tests failed before the fix and passed afterward.
- Important: a direct watch response could remove recommendation placeholders before its independently loading indexes settled. Retained the recommendation region independently, reusing its existing skeleton, and show retry on an index error. Three new deferred recommendation ready/empty/error tests failed before the fix and passed afterward. Playback remains independent.
- Minor / deferred minors: none.

Fix verification: six regressions RED→GREEN; focused 65/65; full suite 1,390/1,390 across 170 files. Production build, lint, static budgets, release-policy and final-source local smoke passed. No second reviewer/fix loop.

## Rulings I made

- Task 2: Ruling: VideoWatchSkeleton has an optional recommendations flag — already-ready recommendations must render normally rather than overlap a second sidebar skeleton — wrong choice would cause duplicate/overlapping recommendation rows. Regression reproduced RED before fix.
- Task 4: Ruling: ignore aborted weekly request failures before writing keyed results — a late rejected old-account request could replace the current ready result with the old key; regression reproduced RED before abort-fence fix — wrong choice would leave the new result stuck loading.
- Task 5: Ruling: OrganizationsGate accepts a page-provided loading fallback, selected by the existing shell pathname — a member/unit route should not briefly show a roots-list shape — wrong choice would cause a visual handoff mismatch only. No auth decision uses the pathname.
- Task 7: Ruling: retain an initial live-discovery flag separate from scheduled completion — delayed first live lookup must not expose VOD as a completed list before live precedence is known — wrong choice would produce a transient wrong ordering. The deferred test needed an extra React-settlement flush; after correcting it the old behavior failed RED.
- Task 7: Ruling: ContentLoading is an explicit client boundary because the pinned UI barrel imports React context consumers — production build reproduced createContext is not a function when WeeklyLoading was imported by the server route — wrong choice prevents production build. Keep the package version unchanged; wrapper still SSR-prerenders.
- Task 7: Ruling: use deterministic regression tests for authorization/out-of-order scope handoffs and report browser timing limits explicitly — the synthetic production fixture covers geometry/native navigation without live member writes, but Ego froze the animation clock and cannot establish an exact 150 ms paint boundary — cost if wrong: first-painted feedback timing still needs physical-browser acceptance.
- Final: Ruling: retain the global first-load mask and analytics boundary — explicitly deferred by the user and unchanged — cost if wrong: current initial-load interruption remains for a separately approved change.
- Final: Ruling: unchanged backend authorization, assets/cache, playback internals and bulletin offline lifecycle stand on their existing ownership and integration tests — this frontend scope does not re-audit or certify them — cost if wrong: pre-existing service/lifecycle defects may remain.
- Final: Ruling: exact 150 ms painted onset and cache-fast latency are unproven — verify the CSS delay and native lifecycle without claiming the frozen browser clock proves timing — cost if wrong: actual feedback onset may differ on a real device.
- Final: Ruling: physical-device behavior and manual screen-reader announcement quality remain unaccepted — responsive emulation and semantic tests are bounded evidence — cost if wrong: device/assistive-technology-specific UX defects may remain.
- Final: Ruling: retain native route failure recovery and modified/external/new-tab/consent-excluded click behavior — no event interception or routing/privacy rewrite, but runtime coverage was a subset — cost if wrong: a browser-specific navigation edge case may remain.
- Final: Ruling: production release/readiness is not claimed — this loading change has implementation/PR authorization, not a new merge/release instruction — cost if wrong: the improvement remains unavailable until the approved release stage.

## Review limits

The reviewer set aside replacing the unchanged first-load/analytics boundary, re-auditing unchanged backend/assets/playback/offline owners, exact browser paint/cache timing, physical devices/manual screen readers, unexercised native click/failure variants, and production readiness. Each item has an explicit ruling and cost above. This is an implementation review, not live production acceptance.
