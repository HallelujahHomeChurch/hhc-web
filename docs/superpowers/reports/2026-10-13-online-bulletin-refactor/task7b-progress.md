# Task 7b candidate execution

## Producer gate completed

Coordinator explicitly verified frontend-platform release `1.0.63`, commit `f442be782223c61300dbbf60fe21e5d2e0ddd188`, run `38387987250` before authorizing the registry install. Independent all-seven-package SHA-512/SHA-1 and image manifest verification is copied in `receipts/producer-release.{json,md}`. This Web task updates only `@hallelujahhomechurch/ui` from 1.0.61 to 1.0.63; other direct and transitive dependencies are unchanged. UI integrity:

`sha512-uFTYMTwfLWYzboeXzS2Q1m/J98hx6dlT0KpopQTI+AZoCwcSOKNGJrJWt/SkEFeAgM6enWm9bJwRXxSFrzjHaA==`

Actual registry install and subsequent frozen-lockfile install passed. Installed UI package version and exported capability function checked. No local artifact path or unpublished version appears in package.json/lockfile. The producer is published; this consumer remains unmerged and undeployed.

## Candidate source and runtime scope

Six policy/test files use the released registry's snapshot/font/cover-spacing capability predicates. Existing code-owned exact asset tables, digest/template validators, 40 MiB Hans V7-family versus 32 MiB remaining streaming limits, receipt/binding checks, DOM style restoration and storage remain unchanged. Missing DOM marker retains legacy fitting. Explicit unknown marker throws before mutating that page.

Task 4/8 changes from Web #209 are not included. Baseline `b4cf65093fa3cc039e8595a1796b7b1973fe1721` remains the parent of this branch. Preflight and source advisor reported C0/I0/M0; final package/lock and receipt re-review is separate.

## Checks

Local toolchain: Node 24.21.0, pnpm 10.12.1, FontTools 4.60.2/Brotli 1.2.0. CI's Node 22 verification remains separately required.

- Targeted API/offline/paper suites: 3 files, 121 tests passed with maxWorkers=2.
- Lint: exit 0, one pre-existing `LegalRequiredNavigation.tsx:17` internal navigation warning; zero errors.
- Release policy shell test: exit 0.
- Full tests/build/static and root-owned browser fixtures: running/pending at this receipt stage. No skipped or simulated test is claimed as full acceptance.

No Web merge, tag, release, deploy, data/infrastructure or feature-gate change. Preserve the unmerged task worktree and follow-up gates.

## Browser and test-pin follow-up

Root's bounded actual Chromium same-profile run passed: installed UI 1.0.61 → 1.0.63 → 1.0.61, capability absent/present/absent. Preserved 20 synthetic IndexedDB fixtures, resource hashes, original mutation payload/ID/time/baseVersion, conflict and dirty return state; actual DOM spacing/restore checked for absent renderer marker plus V1–V10. Exact source/harness hashes and explicit limits are in `browser-task7b/README.md` and JSON receipts. No full Next/SW/authenticated backend/device acceptance is claimed. No production source changed after that run.

The first full suite passed 141 files/1172 tests with one failed existing exact dependency-pin assertion in `src/i18n/locales.test.ts`, which still expected UI 1.0.61. Only that expected UI version was updated to the actually published/pinned 1.0.63; other package expectations remain intact. This is required test maintenance, not a policy exception or weakening. Full suite rerun follows and final advisor was informed.

Final full candidate suite: **142 files / 1173 tests passed**, maxWorkers=2. Required Node budget/immutable-asset tests and `verify-weekly-template-assets --base-ref origin/main` also completed in the same `test:run`. Log retained in `receipts/full-tests.log`; initial obsolete pin assertion failure remains described above.

Final dependency/source and browser-receipt review: Critical 0 / Important 0 / Minor 0, including the one-line existing pin assertion update. No source correction requested. Build/static/CI evidence is separate from this review.

## Local checks completed; PR gates remain

Production build passed. Static budgets passed: four local fonts, hero 140091 bytes, generated CSS 159000 bytes. Full/targeted tests, lint, release policy, frozen install and immutable-asset checks passed as stated above. Build/static logs are retained. No feature flag was enabled.

Required GitHub CI still must verify the exact pushed candidate, including clean Node 22 install/test/lint/build/static checks, dependency and image vulnerability scans, and production container build. Local verification is not claimed as CI completion. No full Next/service-worker upgrade, authenticated backend, live or physical-device acceptance is claimed; browser scope/limits remain explicit in its receipt.

Advisor independently read final local validation receipts and confirmed C0/I0/M0 before PR. No unresolved findings; exact-head CI/container/security and broader Next/SW/backend/device/live gates remain explicitly separate.
