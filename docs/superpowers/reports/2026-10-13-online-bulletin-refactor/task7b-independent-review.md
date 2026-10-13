# Independent Task 7b candidate source review (before registry pin)

2026-10-13. Candidate: isolated `hhc-web-capabilities`, branch `refactor/online-bulletin-capabilities-20261013`, based on `b4cf650` origin/main. Reviewed actual six changed source/test files, task7b-plan.md, full surrounding validation/staging/paper adjustment logic and product callers. No repository edits or test execution by reviewer.

What this change does: Web reads snapshot, font-family and composer-cover-spacing predicates from the shared renderer registry. Existing binding checks, immutable validators, asset allowlists, resource streaming and geometry/restore implementation stay in their original owners.

**Source findings: Critical 0 / Important 0 / Minor 0.** No code fix required at this stage.

- `verifyReaderAccess` calls the unchanged digest/template validator before capabilities. Snapshot parser and forbidden legacy snapshot branch remain. V7-family asset assembly still uses the same exact code-owned lists, fallback font role filtering and URL/SHA/kind comparisons; account/edition/revision/receipt/page checks are untouched.
- `stageOfflineSave` still calls verifyReaderAccess first. Only the Hans font-family predicate changes; capacities remain 40 MiB for Hans V7–V10 and 32 MiB otherwise. Chunk limits, checksum verification, no-store/credentials policy, buffer ownership and commit behavior are unchanged.
- `fitPaperLines` reads the nearest renderer marker once per page. Missing marker explicitly retains legacy adjustment. V1–V7 fit and V8–V10 no-adjust semantics match the table; style restoration, layout math, text/anchors and header treatment are unchanged. Explicit unknown marker fails closed before that page mutates; existing product flow already validates renderer version. Product caller WeeklyReader passes the paper root emitted by PaperViewport with verified marker.
- Tests expand altered digest/asset rejection to every supported version/locale pair, unknown-stage rejection without replacing saved content, full 32/40 MiB table, missing-marker/V1–V7 fit/restore and V8–V10 preserved markup. Expectations retain explicit baseline tables independent of the getter. Existing proof/snapshot/binding, expiry and buffer tests remain.
- No #209 summary projection, PassageText or range helper changes were copied. No frozen renderer, CSS, asset, font, gate, storage schema or authorization change. Formal dependencies/lock were intentionally still absent from the diff pending producer publication.

## Revised browser harness precondition review

Reviewed `/tmp/bulletin-task7b-browser/rollback-server.mjs` and `rollback.mjs`. Temp entry node_modules now symlinks `join(source, 'node_modules')` instead of runner cwd. Each source entry reads its own UI manifest and exports the actually imported module's capability presence. Driver asserts source identity and phase versions 1.0.61 → 1.0.63 → 1.0.61, with getter absent → present → absent. This addresses the earlier shared-package contamination risk, provided each source node_modules really is the corresponding installed lock (verify after install before execution).

Harness retains one profile/tab/origin and full Date clock, real stage/enqueue/claim/ack/recovery/return code, fixed manifests and mutation identities, existing previewStore dedupe and shared-renderer DOM parity. It still does not call fitPaperLines itself; add the separate bounded real DOM spacing/restore check requested in preflight or document that browser portion as unverified. This is a validation gate, not a product code finding. No full Next/SW/member/backend/device claim is justified by this harness.

## Remaining gates

Actual released UI1.0.63 registry pin/integrity/frozen install, candidate targeted/full tests/lint/build/static/container/security checks, final PR CI and actual browser run are pending. Source review cannot treat unexecuted tests as passed. Re-review the final package/lock diff and receipts after publication; unexpected dependency churn or source changes require fresh assessment.

Not checked: the new dependency was not yet published/installed and no candidate tests/browser/CI were executed during this review.
Risk: only static source approval is established; preserve the release-before-pin gate and keep Web unmerged/undeployed.

### Follow-up: real DOM spacing fixture precondition

Reviewed the newly added `fitCheck` and driver calls only. It imports each source's actual fitPaperLines, attaches a 600 px positioned page to document.body (so offsetLeft/offsetWidth are real layout), runs absent-marker and V1–V10 cases, records date/issue styles and text, invokes restoration, and removes its owned node. Baseline restoration is asserted and candidate/rollback results must exactly equal baseline for all eleven cases. This is an appropriate bounded browser check of the changed spacing predicate; C0/I0. It closes the previously missing harness capability, not the still-pending execution gate. Actual released dependencies and per-phase UI identity assertions remain prerequisites; do not run or count this as passed before those are available.

## Final registry pin and browser evidence review

The producer release receipt records successful v1.0.63 release run 38387987250 and verification of all seven registry tarballs and the immutable GHCR image. Independently reviewed final package.json / pnpm-lock.yaml: only UI changes 1.0.61 → 1.0.63 in the importer, registry resolution/integrity and snapshot key. Integrity equals the released UI receipt. No transitive dependency or other shared-package pin changed. Actual installed JS exports the getter and declarations export its readonly result type. Reviewer independently exercised the installed V1–V10 capability table, frozen values and rejection of unknown/prototype names; passed.

The original six source/test diffs remain as reviewed. A seventh test-file change in src/i18n/locales.test.ts updates only the exact expected UI version 1.0.61 → 1.0.63, preserving all other expected package pins. This is necessary maintenance of the existing dependency contract assertion. The prior full-run failure at that stale expectation is superseded only when the full rerun succeeds; it is not evidence of a product defect.

Reviewed the executed browser driver, server, result.json, README, spacing and store receipts under /tmp/bulletin-task7b-browser/rollback. The run records actual loaded UI versions 1.0.61 → 1.0.63 → 1.0.61 and imported getter presence false → true → false. Independently recomputed all four recorded source/harness hashes against current files and compared complete baseline-before-switch versus candidate-offline-before-actions dumps, and candidate-before-rollback versus baseline-rollback-offline dumps; all match. All eleven attached real-DOM spacing cases record exact restoration; the driver asserts spacing/semantic equality in both later phases. Actual driver assertions cover original mutation IDs, response-lost replay, candidate-created pending mutation, conflict/dirty return preservation and fixed Date clock. Bounded synthetic browser verification passes. It does not establish full Next/service-worker, authenticated backend, full WeeklyReader/recovery UI, device or live acceptance.

Current code/dependency findings: Critical 0 / Important 0 / Minor 0. Final local test/lint/build and PR CI dispositions remain pending receipts; this appendix does not approve an unobserved run.

## Final local validation disposition

Independently read the final candidate logs `/tmp/bulletin-web-capabilities-{fulltest-final,targeted,lint,build,static,frozen-install,policy}.log` and the owning task7b-progress.md. Final full run passes 142 files / 1173 tests, plus 8 Node budget/immutable-asset tests (zero skipped) and 12 verified V1 template assets. This supersedes the obsolete UI-pin expectation failure; no product source change followed browser verification. Targeted suites pass 3 files / 121 tests. Build log records successful compilation, TypeScript and generated routes. Static budgets pass: 4 local fonts, hero 140091 bytes and CSS 159000 bytes. Lint has zero errors and one existing LegalRequiredNavigation navigation warning. Frozen install completes with an up-to-date lockfile. Release-policy exit 0 is recorded by the executing agent/owning progress report; its retained log is empty, so there is no independent textual policy assertion beyond that receipt.

Final review disposition: Critical 0 / Important 0 / Minor 0; no requested correction remains before opening the consumer PR. Local candidate gates and bounded synthetic Chromium upgrade/rollback checks are complete within the stated scope. This is NOT full acceptance: exact pushed-head required GitHub CI (including Node 22, dependency/image scans and production container build) is still pending. Full Next/SW update, authenticated backend, full Reader/recovery UI, physical-device and live acceptance remain unverified. Keep Web unmerged and undeployed.
