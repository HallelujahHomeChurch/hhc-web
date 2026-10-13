# Task 4 synthetic browser retained-state acceptance

2026-10-13. Independent operator; no repository edits. **Passed the scoped OfflineContentPage retained-state gate in pinned Chromium.** This is a synthetic component-memory result, not normal Next application/service-worker upgrade, private queue rollback, backend/member, production, or physical-device acceptance.

## Setup and reproducibility

- Actual Playwright 1.63.0 Chromium **153.0.8010.12**, asserted in every trial. Fixed loopback origin `http://127.0.0.1:7144`; owned server stopped after completion. Root's existing 7143 server was untouched.
- Baseline archive `/tmp/bulletin-web-baseline-20261013`; candidate isolated `hhc-web` worktree. `identities.json` records start-time commit/diff, lock SHA, baseline/candidate readerFixture SHA and test-entry SHA. `source-identities.json` records four repository fetched baseline/candidate identities and exact task code hashes. Fixture and lock bytes were equal before execution. This entry transpiles pinned source with installed Vite; it is not the deployable Next artifact.
- The entry uses real OfflineContentPage/offline-store, original stage/commit/lock operations and `readerFixture`. Account identity is explicitly synthetic. Stage calls actual verifyReaderAccess and checksum-verifies the real permanent asset bytes. Feature enablement is confined to this loopback test entry; no production gate changed.
- Baseline-generated manifests for N=1/5/20 preserve synthetic bindings, revision, epoch, receipt times, expiry, byte sizes and resource SHA-256 plus explicit renderer/template/locale identities. Each subsequent trial, including candidate, must deep-equal the frozen baseline manifest before measurement. Baseline/candidate availability must also deep-equal. All comparisons passed.
- N=20 covers two representatives for every V1–V10; actual supported Hant/Hans mix includes Hans V2/4/6/8/10 (including the fallback-font and snapshot families). This does not claim every Cartesian version/locale pair or actual reader rendering.
- Clock fixed at T=2026-10-02 UTC. Current receipts T−1 day, expired T−8 days, exact seven-day interval; locked records use original lock operation. No failure is repaired by obtaining a new receipt. Every full trial gets its own newly created persistent Chromium profile; no user profile or production storage is accessed.

The prior fixture-precondition finding F1 is **resolved for Task 4 component profiling** by source/lock identity checks, explicit manifests and deep equality in the driver. It is not closed for unrelated application/SW upgrade gates.

## Executed procedure and assertions

Eighteen fresh profiles: baseline and candidate × N=1/5/20 × three trials. After seeding, reload releases evaluation temporaries while keeping IDB data. Cold timing runs from that navigation until the final React list rows settle (the component sets rows only after all availability reads). Warm timing runs the fourth reopened list after three warmup reopenings. Timing scopes differ intentionally and are reported separately.

Each mounted cold/warm snapshot and each of ten mount/unmount cycles uses exactly two `HeapProfiler.collectGarbage` calls, then two animation frames, `Runtime.getHeapUsage`, and `HeapProfiler.takeHeapSnapshot`. Total **36 mounted snapshots and 180 unmounted snapshots**. `backingStorageSize` was present, not filled with zero when absent.

The independent snapshot parser finds the actual OfflineContentPage Fiber by its type closure, follows its hook `memoizedState` array to row.save, and records node IDs, fields and paths. For baseline resources it continues through resources[] → bytes ArrayBuffer → internal backing_store → native JSArrayBufferData, recording individual backing-store IDs and sizes. This is ownership evidence, not attribution of all process heap to React. The baseline positive control proves the analyzer can find the body/resource paths it expects the candidate to remove.

Hard assertions passed in all trials:

- Candidate returned/list-owned save keys are exactly `documentId`, `offlineValidUntil`, `revision`, `selector`, `size`.
- Mounted candidate Fiber list state contains no value/document, resource array or resource backing-store path. Baseline corresponding paths are present.
- All ten unmounted snapshots in every trial have no OfflineContentPage Fiber or list save path; cycles 6–10 have no newly retained list-owned bodies/buffers. Baseline also cleans up on unmount; this change improves mounted state, not a claimed preexisting unmount leak.
- Manifest and availability parity, fixed browser identity, expected row count and no page errors passed.

## Results

Three-trial medians [minimum–maximum], milliseconds. Concurrent host activity and source fixture execution make these observations only; no speed promise is justified.

| Copies | Build | Cold navigation to settled | Fourth warm reopen to settled | Mounted list-owned resource backing bytes |
| --- | --- | --- | --- | --- |
| 1 | Baseline | 184.71 [126.36–251.85] | 59.13 [47.93–69.26] | 24,882,350 |
| 1 | Candidate | 165.72 [109.71–166.42] | 49.25 [48.14–65.99] | 0 |
| 5 | Baseline | 378.89 [288.49–388.00] | 215.19 [198.60–228.30] | 128,953,638 |
| 5 | Candidate | 396.53 [381.89–414.23] | 198.57 [163.27–246.01] | 0 |
| 20 | Baseline | 1002.66 [940.05–1191.82] | 1012.57 [729.17–1028.56] | 547,918,024 |
| 20 | Candidate | 1004.95 [950.41–1042.77] | 783.68 [714.30–797.51] | 0 |

Zero means no resource backing store reachable through the list state in the observed snapshots. It does not mean zero total browser memory, no IDB disk storage, or no transient read allocation. The deliberately retained second readOfflineSave validation still executes.

## Receipts and limits

`run.mjs`, `server.mjs`, `analyze.mjs`, `summarize.py`, `identities.json`, `source-identities.json`, `manifest-{1,5,20}.json`, `availability-{1,5,20}.json`, `results.json`, `summary.json` and `snapshot-manifest.json` are in `/tmp/bulletin-task4-browser/`. Every full snapshot has a SHA-256/size entry; raw snapshots and synthetic browser profiles stay here and are not suitable for bulk Git commit. Compact receipts can be committed in the owning Web branch. The pilot is separately named and excluded from the 18-trial/216-snapshot counts.

The mounted N20 candidate screenshot was inspected: synthetic rows, revision/size/expiry, current/locked wording and removal controls are present. This minimal component entry lacks the production global shell; it is not a pixel/layout acceptance claim.

Not checked: full Next/SW baseline→candidate→baseline, offline reader rendering, real member authorization, queue replay/dedupe, mobile/physical devices, live or production actions.
Risk: these receipts establish this fixed fixture's retained-state improvement only; other CI, compatibility, release and live/device gates remain distinct.

Owning-branch preservation: compact JSON receipts are alongside this report. Captured runner/server/analyzer/summarizer sources have `.txt` appended to preserve the exact executed evidence separately from executable application/test discovery; remove that suffix into a scratch evidence directory when replaying. Raw snapshots/profiles remain local at the path above with hashes in snapshot-manifest.json.
