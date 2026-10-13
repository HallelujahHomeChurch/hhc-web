# Independent final Web source review

2026-10-13. Candidate `89114f2` plus working-tree fixture-only rename `document` to `bulletin`; compared entire branch against origin/main. Read actual OfflineContentPage, list/read/check/commit/remove/private-write lookup/account lifecycle callers, all three recovery callers and their state/mutation paths, shared markup/range helpers, existing/new regressions, test fixture script, and Task 9 decision/review. No Web source edits or runtime executions by reviewer.

## Verdict

Critical: 0. Important product/source findings: 0. Source integration review passes; this is not final runtime, memory, rollback, physical-device or live acceptance.

## Integration checks

- Task 4 prior Important W4-1 remains resolved: summary.documentId comes from `save.value.document.documentId`, preserving the original removal-warning lookup, including corrupt access-ID records. The added corrupt fixture asserts that exact source field. UI still asks hasPendingReaderWrites before removal and keeps cancellation. Access revision/expiry remain from the access envelope. `readOfflineSave` remains the second transient read; its selector/check/document/revision consistency and clock observation are unchanged. Listing state retains only summaries/status.
- Task 8 `PassageText` is controlled markup only. Root ref, selection, locked/suspended behavior and clear/reset remain caller-owned. NoteReanchor/HighlightHistory still pass root tabIndex 0; partial RecoveryChoice omits it; legacy nonpartial search/checkbox branch is unchanged. Unicode scalar fragment bounds, DOM classes and mobile button semantics are preserved.
- `selectionPassage` preserves explicit ranges and original selection.ids reference/order; fallback derives full-sentence ranges from document order and invalid/non-contiguous quote remains empty. NoteReanchor onSave, HighlightHistory mutation creation and ReaderRecovery manualReaderRecovery/queue resolution calls have not moved or changed. Conflict retry/reselection, cancel/complete/reopen clear tests remain present.
- `text-range.ts` imports ReaderSelection with `import type`; useReaderSelection imports actual range functions in the other direction. The reverse edge erases at compilation, so this is not a new runtime cycle and does not pull React runtime into range utilities. PassageText's type imports also erase. No new package pin/dependency required.
- WeeklyReader.tsx has no branch diff. The documented, independently approved Task 9 no-extraction decision preserves existing effect declaration order and ownership. It should be reported as deliberate retention, not an implemented position hook.
- Fixture script is only under scripts, creates a temporary entry and a Vite server bound/asserted to 127.0.0.1:7143, and is not imported by app sources, package scripts or release workflows. Synthetic account alias and test-only gate define are confined to that fixture. It adds no production route or auth bypass. The uncommitted rename fixes lexical shadowing of browser document in mountRecovery; both React props now correctly receive bulletin while DOM access uses browser document.

## Acceptance limitations carried forward

Earlier fixture acceptance finding F1 remains an execution gate unless companion driver receipts close it: seed/resource manifest must be pinned to baseline and compared against candidate with explicit package/commit/browser identities. The current entry alone does not supply those manifests or heap retaining-path proof. It also uses the invoking worktree's node_modules when a separate source path is supplied; baseline/candidate package identity must therefore be stated rather than presumed. Current package/lock files are unchanged, reducing but not replacing that evidence requirement.

Six Chromium synthetic interaction checks can establish the cases they execute; they do not complete N=1/5/20 three-trial memory/backing-store profiling, persistent production app/SW upgrade/rollback, ReaderRecovery/backend original-ID dedupe, device or live acceptance. Date.now is fixed for store receipts, but recovery mutation new Date timestamps are real-time in this fixture; do not characterize that smoke fixture as a deterministic mutation replay harness. None of these limitations requires changing current product source; record missing receipts honestly.

No source corrections requested. Do not count prior baseline tests or this static verdict as candidate test/CI completion. No merge/release/deployment authorized.
