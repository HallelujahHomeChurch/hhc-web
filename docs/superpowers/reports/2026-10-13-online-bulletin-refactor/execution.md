# Online bulletin refactor execution

Authorization: implementation, isolated worktrees, independent reviews, local/CI/browser checks and focused PRs only. No merge, tag, package publication, release, deployment, production data/infrastructure/feature-gate changes.

Fresh fetch 2026-10-13: Web `b4cf65093fa3cc039e8595a1796b7b1973fe1721`; API `9c2d75120040a5a68e761ed005545ab314130ea6`; Platform `3f8dd7576f3f705e6f1ebcaddd8bf17b0af73109`; Admin `6abde585c4af5072b4c256be54e0d5950fb476eb` (new recording-cover changes only). Primary checkouts and existing worktrees preserved.

Central authoritative inputs were read in full: workspace `docs/superpowers/specs/2026-10-13-online-bulletin-refactor-design.md`, `plans/2026-10-13-online-bulletin-refactor.md`, and four matching reports including re-reviews. Central workspace is not Git; those files are not claimed as committed. This record belongs to the Web task branch.

## Batches and ownership

| Batch | Owner / isolated repo | Tasks | Gate |
| --- | --- | --- | --- |
| A | admin_impl / Admin | 1 then 3, separate commits | callers, regressions, full Admin checks, independent review |
| A | platform_impl / Platform | 2 then 6, separate commits | frozen closure/bytes, non-writing schema check, full platform checks, review |
| A | backend_impl / API | 5 | baseline exact-byte goldens, all callers, disposable PG, CI/container checks, review |
| A | root / Web | 4 | summary projection, original full read validation, negatives, browser retention, review |
| B | Platform | 7a after A review | additive producer API, frozen digests, packed consumers, PR; no publish |
| B | Web | 8 after A review and reviewer approves independence from 7b | controlled markup only, caller state/clear/retry preserved |
| C | Web | 9 pre-code design | exact ownership/types + independent review, justified no-extraction permitted |
| Final | each owning repo | 10 authorized subset | complete candidate checks, independent final review, PR and required CI |

Task 7b formal dependency pin and releasable consumer change wait for a real producer package release and later authorization. Do not put predicted versions/local paths in production manifests/locks. Release, deployed smoke, physical devices and real member/backend acceptance are separate outstanding gates, not unit-test claims.

## Web Task 4 scope

`listOfflineSaves` runtime caller: `OfflineContentPage`; tests/mocks: offline-store, OfflineContentPage, sync tests. Listing projects each fetched document immediately into `{selector,documentId,revision,size,offlineValidUntil}`. Storage schema, pointer/check validation, owner/epoch/clock rules and the second transient `readOfflineSave` stay unchanged. No performance improvement is claimed without browser receipts.

Regression red receipt: candidate tests against original implementation: 40 passed / 1 failed, new exact summary assertion rejects full document/resources. First green trial exposed test fixture ordering (IDB locale key order); expected order corrected without changing production sorting.

Default multi-repo test fanout saturated host and caused timeouts. Those incomplete runs are not acceptance evidence; reruns use bounded workers. Final command results will be recorded separately.
