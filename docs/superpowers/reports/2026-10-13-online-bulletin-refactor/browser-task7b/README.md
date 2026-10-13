# Task 7b published-package browser upgrade / rollback

2026-10-13: PASS for the bounded synthetic cases below. Playwright 1.63.0 / Chromium 153.0.8010.12, fresh persistent profile, same tab and loopback origin 127.0.0.1:7144, full fixed Date clock. No storage clearing or service worker.

Baseline source b4cf650 uses locked registry UI1.0.61; candidate uses actually released UI1.0.63. Entry dependency resolution is scoped to each source node_modules, not the driver cwd. Every phase reads its installed version and asserts the imported capability API is absent/present/absent across baseline -> candidate -> baseline. See result.json packagePhases. This candidate is the standalone Task7b branch, not unmerged Web#209.

Twenty real IndexedDB saves were seeded through baseline stage/commit using checksum-verified resource bytes: ten current V1-V10 representatives with valid Hant/Hans mix and ten expired/locked saves. Every baseline/candidate/rollback phase preserves matching document/resource hashes, pointers, checks, account/revision bindings, identity epoch and exact receipt deadlines. Current saves render through actual verifyReaderAccess plus shared paper/Ebook components; text and sentence/fragment anchors match all three phases.

Actual enqueue/claim/ack paths retain original mutation IDs, payloads, timestamps and baseVersion. A response-lost highlight replay uses existing createReaderPreviewStore dedupe and stays version1; candidate acknowledges a baseline unsent note; rolled-back baseline acknowledges a candidate-created note. The stale-version unresolved conflict and baseline/candidate dirty return records survive unchanged until explicit actions. Synthetic bridge responses are not authenticated backend acceptance.

Actual fitPaperLines runs on attached 600px positioned DOM with real browser offsets. Eleven cases (missing marker and V1-V10) compare date/issue style/text results across all three phases and assert exact markup restoration. No mocked DOM dimensions. Source-only harness preflight first verified baseline UI1.0.61 and 11 restore cases; acceptance is the subsequent complete run.

Compact manifests, action log, semantic DOM, spacing results and exact source/harness hashes are included. Driver/server files are archived as .txt outside application test discovery; restore names only in scratch space. Raw profile remains at the local path in result.json. Driver exits0 and its finally block closes browser/server. Do not reuse this fixture entry as a production route or auth bypass.

Not checked: full Next artifact/service-worker update, authenticated API/backend dedupe, ReaderRecovery choice UI, full WeeklyReader restoration/device/authorization flows, pixel/font-layout equivalence or all locale x version pairs. No real member/cloud/physical-device/live acceptance is claimed.
