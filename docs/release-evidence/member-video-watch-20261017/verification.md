# Member video experience — implementation evidence

Scope: four isolated branches at `video-experience-20261017`. Implementation was completed inline with an independent final reviewer. The user subsequently authorized merging reviewed PRs with passing CI and releasing through the existing workflows. Historical verification checkpoints below describe their state at the time; release evidence is recorded separately.

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

The initial Web checkpoint used a copied candidate client in ignored `node_modules`; it was removed after publication. The final manifest and lockfile pin the actual registry `@hallelujahhomechurch/hhc-web-client@1.0.75`, installed with the repository-specified pnpm 10.12.1. Frozen-lockfile installation passed.

Screenshots use synthetic local fixtures and a placeholder player, not personal member content. The temporary preview route was removed after inspection. Physical Safari/iOS/Android keyboards, actual media playback and authenticated production writes have not been accepted. Browser emulator viewport checks are not a substitute for those checks.

Impeccable detector found one existing width-transition warning in untouched PlayerChrome CSS; no new finding in the changed UI. Ego Lite reports an available update; no upgrade was performed.

## Verification checkpoint

- Shared client: tests, lint, build, package packing and packed consumer builds passed.
- Gateway: Go tests and disposable image recording runtime matrix passed.
- API: targeted domain/HTTP tests, real PostgreSQL comment/discovery tests with race detection, catalog/snapshot checks, vet and migration policy passed. The full race run hit its root package's 10-minute schema-validation timeout under host load; a bounded retry with a longer process timeout is recorded separately. Remaining package results and remote CI must be checked before merge.
- Web: 351 feature/reader targeted tests passed before the final review additions; the final five comment tests passed, including both refresh regressions. Production build and static budgets passed with the local candidate client. Lint has only the existing LegalRequiredNavigation warning after removing an unnecessary inline suppression.
- Full Web run exposed unrelated reader/organization timing failures under host load; no test assertion was weakened or unrelated feature code changed. Final bounded run status must be checked before merge.
- Registry-clean Web build and Docker image remain blocked on the reviewed client publication; no release or physical-device claim is made.

## Final review and CI status (2026-10-17)

Independent reviewer confirmed all findings closed, including the same-values reaction-refresh case. Final comment regression suite: 5 passed.

- API PR [#248](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/248): all remote CI jobs passed, including Go/race, policy and image checks. Local root race retry passed in 489 seconds; all other packages passed in the full run.
- Gateway PR [#176](https://github.com/HallelujahHomeChurch/api-gateway/pull/176): full remote CI passed.
- Client PR [#133](https://github.com/HallelujahHomeChurch/frontend-platform/pull/133): local checks passed; remote renderer measurement CI was still running at this checkpoint.
- Web PR [#226](https://github.com/HallelujahHomeChurch/hhc-web/pull/226): remote full test suite and lint passed. Registry build failed exactly on missing new client contract fields/methods; this is the documented producer-publication dependency, not a passed build. Local candidate production build passed.
- Local overloaded Web run finished with worker startup and unrelated reader/layout timing failures. Isolated rerun of the five affected/unstarted reader/organization/cover files passed all 175 tests; the remote full suite passed without weakening assertions.

Do not merge the Web draft until the producer package has actually been published, its exact registry version/lock installed, and clean install/build/image/required CI rerun successfully. These test results alone do not establish release acceptance.

## Integration review

The independent reviewer rechecked the API notification/S10 integration, cached management navigation and coordinated 1.0.75 package version bump. No new blocker was found. Gateway PR #176 merged as `68ec93479d512a06681ac45b325c982d6ff87ba7`; release run 39034589916 passed. Production revision `api-gateway--0000214` matched the immutable release digest and passed public health/readiness, anonymous reaction rejection, method/query restrictions and host-isolation checks.

API PR #248 merged as `f0824489226fa41343466d37f68d0846399cae1a`; release run 39034583788 passed all jobs. Migration execution `hhc-web-migrate-m0u9pst` succeeded. Production revision `hhc-web-api--0000219` was Healthy/Running with 100% traffic and matched the release image digest; public health/readiness and locations returned 200. Client PR #133 passed CI 39032577863 and merged as `a86aaf2fb83431e72bdac6948753fb1419e5e110`; tag `v1.0.75` starts the existing package release workflow.

Client release run 39037002908 passed all steps, including isolated renderer validation, registry publication and immutable renderer publication. Web now resolves the registry 1.0.75 tarball and integrity; no other package version or transitive dependency changed. Final Web tests/build/CI are rerun against this package before merge.
