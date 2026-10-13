# Candidate verification receipts

Code commits: Task4 `1bea9ba`; Task8 `7900a9f`. Initial baseline `b4cf65093fa3cc039e8595a1796b7b1973fe1721`. No dependency/lock/CSS/asset/frozen renderer changes.

- Frozen lockfile install: passed; token only supplied via process environment, not recorded.
- Task4 corrected summary/integrity/UI suite: **45/45 passed**, 2026-10-13 16:56 local; 19.33s, maxWorkers=1. Preserves second read and pending warning source field.
- Task8 first caller: **2/2 passed**; final shared helper/component + three callers/selection: **49/49 passed**, 16:57, 18.96s, maxWorkers=1.
- Lint: exit 0, one existing unrelated LegalRequiredNavigation no-location-assign warning.
- Production `pnpm build`: exit 0 under escalated local build process permissions. Earlier sandbox/contended attempt was interrupted, not counted.
- `pnpm perf:static`: passed, 4 local fonts, hero 140091 bytes, CSS 159000 bytes.
- `scripts/test-release-policy.sh`: exit 0.
- Full `pnpm test:run --maxWorkers=2`: Node budget/immutable tests 8/8 and v1 assets verifier passed; Vitest **1158 passed, 1 failed** (143 files). Unrelated StatementProvider expiry-boundary UI test failed under parallel load. Unchanged isolated rerun **22/22 passed**. Full local run is still recorded as failed; required CI must pass independently, not bypassed.
- Independent Task4/Task8 source reviews: remaining Critical/Important=0; reports retain finding/disposition. Task9 concrete design reviewed and no-extraction approved; WeeklyReader source remains unchanged.
- Chromium from platform lockfile Playwright1.63.0: observed **153.0.8010.12**. Initial test-only loopback real-IDB seed/read/mount with exact verified assets passed. This is harness setup only, not memory/performance/upgrade acceptance.

## Outstanding gates

Required Web CI including image/security checks; final full integration set; browser baseline/candidate profiling (1/5/20, three trials, ten cycles with ownership); recovery keyboard/touch component receipts. Real app/SW/private-queue upgrade/rollback, physical iPad/iPhone/Android/PWA, real account/cloud and live production acceptance remain unverified. The loopback fixture uses synthetic identity and no SW and cannot establish those outcomes.

Task7b is intentionally not implemented: formal consumer pin requires a real released producer package and subsequent authorization. Do not infer a package release from Task7a's packed tests. No merge/tag/publish/release/deploy or production mutation is authorized here.
