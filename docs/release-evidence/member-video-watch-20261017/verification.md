# Member video experience — implementation evidence

Scope: four isolated branches at `video-experience-20261017`, no production mutations or deployment. Approved execution is inline, with an independent final reviewer.

## Functional acceptance

- Live captures precede scheduled broadcasts; scheduled discovery uses schedule-time/ID keyset pagination and server-side search before paging. VOD follows scheduled pages, with a plain VOD list when the other groups are empty.
- Retired upcoming-only navigation redirects to the normal locale library, retaining a valid search query.
- Site share dialog includes LINE, WhatsApp, Facebook, X, email, copy and optional editable VOD time. Local browser verified `2:35` generates `t=155`; native OS share is absent.
- Expandable information card distinguishes unavailable/pre-launch metrics from genuine zero.
- Desktop comments and mobile sheet share mounted discussion state. Local browser preserved a typed draft through close/reopen and desktop resize. No horizontal document/dialog overflow at 320, 375, 390, 768, 1024 or 1440 CSS pixels.
- Comment count, top/newest sorting, reactions, edit/delete/report, flat reply targeting and cursor-expiry recovery are covered by local tests. Reactions and ephemeral ranking rows participate in account cleanup.

## Independent review

A fresh-context reviewer inspected all four diffs and new files and independently ran 10 frontend tests. Findings were corrected:
1. Refresh must update an existing row's reaction and like count without replacing a pending mutation intent. Regression reproduced then passed.
2. A visible reply under a deleted root must remain replyable; the deleted root itself is still rejected as a target. Real PostgreSQL regression reproduced then passed with race detection.
3. Live list dates use actual `startedAt`, falling back to capture creation only for older responses.

## Release sequence and constraints

1. API: additive migration `103_recording_comment_experience.sql`, optional response fields and new reaction endpoint. Retain the intentionally retired legacy DSR export routes; future export owners must include the new data described in API documentation.
2. Gateway: exact authenticated WWW PUT reaction policy.
3. Shared client: merge reviewed code, then publish through the existing version/tag workflow.
4. Web: pin the actually published client version and registry lockfile, rerun clean install/build/CI, then merge/release.

The Web checkout currently tests a copied candidate client in ignored `node_modules`. Its committed manifest still pins the existing registry package. The draft Web PR is deliberately blocked on producer publication; local builds are not proof of a fresh registry installation.

Screenshots use synthetic local fixtures and a placeholder player, not personal member content. The temporary preview route was removed after inspection. Physical Safari/iOS/Android keyboards, actual media playback and authenticated production writes have not been accepted. Browser emulator viewport checks are not a substitute for those checks.

Impeccable detector found one existing width-transition warning in untouched PlayerChrome CSS; no new finding in the changed UI. Ego Lite reports an available update; no upgrade was performed.

## Verification checkpoint

- Shared client: tests, lint, build, package packing and packed consumer builds passed.
- Gateway: Go tests and disposable image recording runtime matrix passed.
- API: targeted domain/HTTP tests, real PostgreSQL comment/discovery tests with race detection, catalog/snapshot checks, vet and migration policy passed. The full race run hit its root package's 10-minute schema-validation timeout under host load; a bounded retry with a longer process timeout is recorded separately. Remaining package results and remote CI must be checked before merge.
- Web: 351 feature/reader targeted tests passed before the final review additions; the final five comment tests passed, including both refresh regressions. Production build and static budgets passed with the local candidate client. Lint has only the existing LegalRequiredNavigation warning after removing an unnecessary inline suppression.
- Full Web run exposed unrelated reader/organization timing failures under host load; no test assertion was weakened or unrelated feature code changed. Final bounded run status must be checked before merge.
- Registry-clean Web build and Docker image remain blocked on the reviewed client publication; no release or physical-device claim is made.
