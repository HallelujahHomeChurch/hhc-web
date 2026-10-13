# Independent Web Task 4 and sequencing review

2026-10-13; reviewer is Admin Tasks 1/3 implementer, not the Web author. Read current four changed files and full list/read/check/commit/remove/hasPendingReaderWrites/account lifecycle implementations, caller inventory and existing tests. No Web edits or test claims by this reviewer.

## Important W4-1 — pending-warning identity changed

`listOfflineSaves` currently projects `save.value.access.documentId`; `OfflineContentPage.remove` now uses it for `hasPendingReaderWrites`. Baseline used `save.value.document.documentId`. These are equal for validated records, but not all persisted/corrupt records: `readOfflineSave` compares saved access to checks and selector, not document.documentId to access.documentId. The proposed projection can therefore suppress the prior unsynced-warning lookup for a corrupted access field. Relevant negative fixtures deliberately include corrupt saved access IDs, so claiming exact behavior equivalence without this distinction is incorrect.

Smallest disposition: project summary.documentId from `save.value.document.documentId`, preserving the user-facing removal warning, and add a divergent-ID regression proving that exact lookup. Valid data UI keys remain identical; corrupt-only row key identity changes can be explicitly recorded. Do not add another document-ID field or weaken validation. Important remains open pending fix/review.

## Other findings and scope

No additional Critical/Important found. Projection is at the listing boundary, avoids body/buffer retention in React state, keeps source storage and second transient `readOfflineSave` validation. Account filtering, cancellation and clocks remain in existing owners. All list callers are the page, offline-store tests and sync length/empty assertions; mocks updated. Current regression coverage includes corrupt selector/access/check/pointer, missing documents, locked/expired records and pending account switch. Candidate receipts are still required; timeouts under host load are not passes.

## Browser precondition design

Accept the proposed loopback-only Vite fixture harness using the installed toolchain, actual OfflineContentPage/offline-store and readerFixture, with a test-entry-only synthetic AccountControl alias. No production route, dependency, runtime gate or auth code changes. Enabling the test bundle gate is fixture configuration, not production activation. This is a synthetic structural/memory/compatibility test, never live member/backend acceptance.

Before acceptance, record exact baseline/candidate/package/browser identities, actual supported locale/version fixture manifest and real pinned asset hashes. Seed through stage/commit and fixed clock; do not renew receipts to repair failures. Same-origin baseline/candidate switching and untouched profile are appropriate. Memory N=1/5/20, three profiles, identical double-GC, cold/warm and ten-cycle retainer/backing-store evidence remain required. Vite fixture has no production SW by itself: record that explicitly; do not claim normal app/SW upgrade equivalence from this harness. A full Task 8 rollback receipt also needs real callers and original mutation/recovery pipelines plus simulated dedupe, beyond merely listing saved content.

## Task 8 sequencing decision

Approved to execute Task 8 without unpublished Task 7b after Task 4 Important disposition is resolved. Read NoteReanchor and HighlightHistory callers and checked the plan boundary: controlled PassageText and pure range conversion use existing sentence/range APIs, no new renderer capability export or package version. Keep selection/ref/clear/locked/mutation ownership in callers, retain RecoveryChoice partial-only extraction and focus differences. Do not change dependencies or claim Task 7b complete. Task 8 candidate and browser/rollback verification still required independently.

Not checked: candidate test results, full CI, heap snapshots, persistent-profile execution, physical devices or live services. No readiness claim beyond the conditional design/sequencing approval above.

## Re-review disposition

Inspected corrected projection and negative fixture after author response. Summary.documentId now comes from `save.value.document.documentId`; the corrupt access-ID fixture explicitly asserts the old pending-warning identity survives. Combined with the UI test asserting the passed summary ID and cancelled deletion, this is adequate regression coverage without duplicating the full private-state pipeline. W4-1 resolved. The React key now follows document ID for corrupt-only rows; no valid-record key, displayed content, availability or deletion policy changes. Remaining Critical/Important: 0 for code/design review. Candidate full tests, CI and browser receipts remain separate gates. Task 8 sequencing approval above may proceed.
