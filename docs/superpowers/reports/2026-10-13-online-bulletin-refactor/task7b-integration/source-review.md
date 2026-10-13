# Independent final combined Web #210 source integration review

2026-10-14. Reviewed actual head `6a0f580d0776f30a4ee25f1d8d484ff46210f330`, parents original210 `5c83167882449f350ede618920c2ae66db6817e8` and actual209 main `bd98ef18c786a3428366e686851c52916189dcf8`, in hhc-web-capabilities owned worktree. Read-only source/caller/test review; no branch edit, execution of heavy tests, deployment or production request.

**Critical 0 / Important 0 / Minor 0 source findings.** No fix requested. Static combined-source gate passes; fresh tests/build/CI and exact-source browser receipts remain separate pending gates.

## Integration scope

Relative to actual main, product delta remains exactly9files/31insertions16deletions: UI1.0.63 package/lock,3capability consumers and their tests, existing exact-pin assertion. Independently compared all added/removed product lines with the previously reviewed standalone210 patch: identical. Context/line offsets changed with209 summary projection; no semantic conflict resolution was introduced. Entire components/weekly-reader, selection and return-state ownership files have no delta from209 main. Shared UI integrity remains the published1.0.63 receipt; no other dependency or transitive snapshot churn.

## Actual connected behavior

Read offline-store storage/identity/staging/commit/check/read/list/private-queue paths and OfflineContentPage caller. listOfflineSaves projects only selector, documentId, revision, size and offlineValidUntil. It does not turn summaries into authorization. OfflineContentPage still invokes the second readOfflineSave per row; checks retain account/edition/document/revision pointers, epoch, clock rollback, expiry and locked state. Corrupted/missing state remains unavailable. React state stores summaries+availability only; removal still consults pending writes using documentId. The newly imported capability getter is used only by staging size policy after verifyReaderAccess: HansV7–10 remain40MiB, all remaining cases32MiB. Stream checksum/bounds/cancel, previous-save preservation and resource ownership are unchanged. No coupling with listing changes exists beyond the shared module import.

Read API receipt validation and exact asset table selection. requireBulletinRenderer still validates artifact/template before the getter; only template-snapshot/version-family predicates move to its published registry. Account, issue/document, series/locale, revision/currentRevision, seven-day envelope, proof, pages and exact URL/SHA/kind allowlist stay unchanged. Digest remains original response-byte SDK validation; no hashing of redacted projection or envelope merging occurs.

Read paper-lines plus PaperViewport marker ownership. Missing renderer marker retains legacy fitting; V1–7 adjust cover spacing and V8–10 keep composer spacing. Explicit unknown marker fails closed before mutation of that page, consistent with validated product callers. Style restore/layout/measurement math and markup remain local. The code does not promise global rollback if an artificially mixed multi-page root fails on a later invalid marker; actual product root is bound to one verified version.

Read PassageText and NoteReanchor/HighlightHistory/ReaderRecovery usage. It remains controlled markup: passed ref, sentence text/codepoint offsets, selected/ARIA state and optional tabIndex. Caller useReaderSelection, clear/reset, pending mutation IDs, conflict/recovery decisions and editable/source distinction remain outside. UI package upgrade does not replace this component or alter its callers. Task9 position/restoration code remains in WeeklyReader unchanged. Private queue claim/ack/recovery CAS, confirmed/local states, original IDs and retained return records have no210 changes.

## Test coverage and pending verification

Merged tests retain209 summary five-key shape/no-resource projection, corruption/availability cases and controlled-passage/caller behavior while adding210 independent explicit capability tables: all supported version/locale asset/digest checks, unknown-stage preservation,32/40MiB bounds, missing/V1–7 spacing, V8–10 preservation, unknown DOM marker rejection/restoration. Existing snapshot/receipt bindings, expiry and queue/recovery suites remain. Tests were inspected, not declared passed by this source review.

Backend executor is running fresh integrated full tests/lint/build/static/policy; platform executor is building/running actual default Next/SW on this exact combined source with publishedUI1.0.63. Review those receipts independently before merge; neither standalone210 nor209 prior browser/CI can substitute. Required pushed-head CI/container/security also remains mandatory. Even successful synthetic fullNext/SW cannot establish real backend authentication/migration/dedupe, full online recovery or physical/live acceptance. Keep each scope explicit.

### Local gate receipt update

Executor reports fresh integrated6a0f580 frozen install, full tests, lint, default build, static budget and release-policy checks passed; receipts retained in owning task7b-integration directory. Reviewer read full-suite final totals:143files1191tests pass, plus executor's Node immutable checks. Lint has one pre-existing warning. These are executor-run candidate results, not independent reruns by reviewer. Exact-source Next/SW receipts and pushed-head required CI remain separately under review/pending.
