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

## Deferred authorization and acceptance gates

Task7b is intentionally not implemented: formal consumer pin requires a real released producer package and subsequent authorization. Do not infer a package release from Task7a's packed tests. No merge/tag/publish/release/deploy or production mutation is authorized here.


## Subsequent candidate receipts

- Web required CI on `89114f2`: **verify passed**, run `38374057142`, job `115217869666` (4m28s). Includes full tests, lint, build, static budgets, release policy, dependency/image scanning and image build. This resolves the required CI gate independently of the explicitly retained local flaky failure.
- Candidate position/interaction integration: **5 suites, 140 tests passed** (61.05s); exact command: `pnpm exec vitest run --maxWorkers=1 src/components/weekly-reader/WeeklyReader.test.tsx src/features/weekly-reader/progress.test.tsx src/features/weekly-reader/useReaderSearchNavigation.test.tsx src/features/weekly-reader/usePaperGestures.test.tsx src/features/weekly-reader/useReaderExitGuard.test.tsx`.
- Recovery browser: **6/6 passed** on pinned Chromium. NoteReanchor + HighlightHistory keyboard, touch emulation and programmatic native-range selection; correct ranges, root focus and callback payloads, zero browser errors. See recovery-browser.json. This does not exercise a physical device or the entire ReaderRecovery upgrade flow.
- Task4 browser memory: **18/18 fresh-profile trials, 216 snapshots**, exact baseline/candidate manifests/availability equal. Candidate list-state keys exactly five; no list-owned document/resource paths. No retained OfflineContentPage/list body buffers after ten unmount cycles in any trial. See browser-memory/README.md and parsed receipts; raw snapshots remain at `/tmp/bulletin-task4-browser/`, integrity hashes retained in branch. No total-heap or latency improvement claim.
- Final whole-branch source review: Critical/Important=0, final-review.md. Fixture-only DOM variable shadowing corrected after browser self-check; no product code changes after reviewed commits.

Remaining release acceptance: full Next/SW upgrade/rollback and full private conflict/recovery recipe; physical iPad/iPhone/Android/PWA; authorized real member/cloud/live acceptance. Task7b and any package publication/deployment remain outside this authorization. Final receipt commits rerun required CI; confirm the final PR head before any future merge.

- Bounded same-profile storage rollback: **PASS**, baseline → candidate → baseline with no clearing; original-ID retry/dedupe, candidate-created queue, stale-version conflict, dirty returns and V1–V10 verified-input shared-renderer DOM parity. See browser-rollback/README.md and exact synthetic receipts. This does not close full Next/SW, authenticated backend, recovery UI or device gates. Driver copies use `.txt` to stay outside application test discovery; restore filenames only in a scratch environment.
