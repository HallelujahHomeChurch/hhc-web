# Unified Authorization Execution Ledger

**Updated:** 2026-09-20

This is the single current-state companion to
[the unified authorization master plan](2026-09-15-unified-authorization-master.md).
It records execution evidence and remaining gates without rewriting the
master plan's acceptance checklists.

## Update Rules

- Record a repository item through these states: `planned` -> `local verified`
  -> `PR green` -> `merged` -> `released` -> `live verified` -> `accepted`.
  Do not skip a state and do not call a released component accepted before its
  dependent matrix and external evidence pass.
- Update the applicable row after every PR, CI result, merge, release, live
  smoke, external test, deferral, or newly discovered regression. Include the
  immutable reference: PR, commit/tag, workflow run, revision, or evidence
  record.
- Keep a real-user/device check `pending` until it is actually observed. A
  synthetic probe, a green build, or a healthy revision is not a substitute.
- The master plan remains the source of requirements. This ledger is the source
  of current progress and the next executable gate.

## Current Recovery Gate

| Item | State | Evidence | Remaining gate |
| --- | --- | --- | --- |
| R: Website hosted Account transport | `production repair released / cold live matrix deferred` | The root race was traced to post-exchange revalidation coalescing an older anonymous in-flight request. `frontend-platform` PR #65 published `1.0.9`. Account [#63](https://github.com/HallelujahHomeChurch/account-fe/pull/63) merge `d5da5a5`, release `35437382307`; Admin [#112](https://github.com/HallelujahHomeChurch/admin-fe/pull/112) merge `0581f11`, release `35437395499`; and Website [#121](https://github.com/HallelujahHomeChurch/hhc-web/pull/121) merge `c87c3a4`, release `35437395382`, revision `hhc-web--0000121`, all passed CI, production release, and health checks. | At the user's direction, run the exact cold first-visit Website -> Account -> Admin matrix in final integrated acceptance. A warm repeat or automated test is not acceptance. Preserve protected bulletins. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `final RBAC transport released / broader Gate B evidence pending` | Account [#95](https://github.com/HallelujahHomeChurch/account-api/pull/95) merge `28f053e`, release `35339777901`, revision `account-api--0000098`, transports opaque granular permissions while keeping empty permissions authenticated. Account [#96](https://github.com/HallelujahHomeChurch/account-api/pull/96) merge `4f748dc`, release `35350895475`, revision `account-api--0000099`, restored the bounded membership-directory contract. Gateway [#106](https://github.com/HallelujahHomeChurch/api-gateway/pull/106), [#107](https://github.com/HallelujahHomeChurch/api-gateway/pull/107), [#108](https://github.com/HallelujahHomeChurch/api-gateway/pull/108), and [#109](https://github.com/HallelujahHomeChurch/api-gateway/pull/109) released through `api-gateway--0000149`; the final permission transport, request id, Website Operations self-service routes, and all bounded Admin DSR owner routes are live. Website API granular enforcement is live. `frontend-platform` [#63](https://github.com/HallelujahHomeChurch/frontend-platform/pull/63) and [#64](https://github.com/HallelujahHomeChurch/frontend-platform/pull/64) published `v1.0.8`; final consumers are released. Runtime drift scanning found removed `cms:read|write|publish` only in explicit rejection/regression tests and historical/down migrations, not active permission catalogs or compatibility maps. | Complete scoped-role denial, DSR, Audit observation, Presenter device, and full cross-domain authorization evidence before Gate B/C acceptance. |
| 3A: Operations extraction | `complete / released / live verified` | Operations [#24](https://github.com/HallelujahHomeChurch/operations-api/pull/24) records the counted source-removal evidence. HHC Web API [#109](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/109), merge `003d01b`, release `35344386125`, removed the six legacy Operations source tables and deployed `hhc-web-api--0000103`. Operations [#25](https://github.com/HallelujahHomeChurch/operations-api/pull/25), merge `813df16`, release `35345728154`, added the missing typed public meeting/occurrence response contract and deployed `operations-api--0000011`. Live `/api/meetings` and `/api/meeting-occurrences` returned `200` with typed data. Gateway [#108](https://github.com/HallelujahHomeChurch/api-gateway/pull/108), merge `6947e0e`, release `35353145847`, deployed `api-gateway--0000148`; unauthenticated Resource self-service routes return `401`, while authenticated Resource and reservation lists return `200`. | The real LINE-user schedule query remains deferred device evidence and does not reopen the source extraction. |
| 3B: Audit producers | `repair released / observation reset after planned producer releases` | HHC Web API [#110](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/110), merge `f48b2f5`, release `35353145909`, revision `hhc-web-api--0000104`, removed unsupported `filterNames`. The first candidate window stayed healthy but included Account, Audit, and Operations release churn, so it is not accepted. A new zero-backlog baseline was captured at 2026-09-19T20:16Z on Account `0000104`, Asset `0000061`, Engagement `0000031`, HHC LINE `0000215`, HHC Web API `0000104`, and Operations `0000016`; each reported `pendingCount=0`, `oldestPendingSeconds=0`, and `deadLetterCount=0`. | Observe these exact producer revisions through 2026-09-20T20:16Z. Any producer revision change, backlog/dead-letter recurrence, unsupported `filterNames`, or query/append isolation failure resets or fails the gate. |
| 4: protected bulletins and Asset boundary | `accepted` | `hhc-web-api`, `asset-api`, `engagement-api`, and Website are released. Anonymous legacy bulletin routes remain `404`; protected member routes return `401`. Production reports zero public bulletin grants. Authenticated unentitled requests for all three final locales return non-disclosing `404` with `private, no-store`. A qualified disposable membership passed list and latest-PDF download for `zh-Hant`, `zh-Hans`, and `en`, each with `private, no-store`; entitlement revocation restored the denial matrix, and the membership and qualification were cleaned up. | None. Future bulletin types add a new entitlement without changing the protected default. |
| 5: DSR and permanent deletion closure | `automated owner matrix accepted / manual governance pending` | Account [#94](https://github.com/HallelujahHomeChurch/account-api/pull/94), merge `724c515`, release `35329793890`, replaces the generic cleanup conflict with bounded owner-incomplete semantics. Admin [#107](https://github.com/HallelujahHomeChurch/admin-fe/pull/107), merge `ae31313`, release `35331200385`, presents only a safe operator message. Account [#97](https://github.com/HallelujahHomeChurch/account-api/pull/97), merge `6b60319`, release `35355781674`, removed the forged Operations Dapr caller header. Gateway [#109](https://github.com/HallelujahHomeChurch/api-gateway/pull/109), merge `4e693e7`, release `35357987052`, revision `api-gateway--0000149`, exposes the bounded Operations and Website Watermark retry routes. Account [#98](https://github.com/HallelujahHomeChurch/account-api/pull/98), merge `3dcf00c`, release `35360146638`, added the existing Watermark investigation record type. Account [#99](https://github.com/HallelujahHomeChurch/account-api/pull/99), merge `79e076d`, release `35363587917`, revision `account-api--0000102`, validates the Website API's strict `{data, meta, error}` envelope. The same live request then completed Operations with five records and retained-data reason codes and completed Website Watermark with eight records. Engagement and Notification remained succeeded, Asset remained not applicable, and Account correctly remained pending with `DSR_WAITING_FOR_MANUAL_RESOLUTION`. Admin [#109](https://github.com/HallelujahHomeChurch/admin-fe/pull/109), merge `7557cfd`, release `35369719536`, now restricts a successful Website export review to `DSR_WEBSITE_MANUAL_CHECK_COMPLETED` and a Website correction to `DSR_WEBSITE_CORRECTION_APPLIED`; production UI verification confirmed the exact export reason without submitting the execution. | Complete the real Website record inventory and requester-response delivery before submitting the now-correct manual result, then verify the generated export outcome. The Admin action is not evidence that the review or delivery occurred. Permanent-deletion evidence remains a distinct human-governance workflow and must not be inferred from access-export success. |
| 6: shared AuthN runtime and consumers | `browser repair released / cold matrix and Presenter evidence pending` | `frontend-platform` `1.0.9` and the Account/Admin/Website consumers are released; all three consumer CI/release runs succeeded and Website is healthy on `hhc-web--0000121`. Membership contracts subsequently published as 1.0.10/1.0.11 without changing the AuthN seam. The exact cold first-entry matrix remains unobserved after release. | Complete Gate R in the final integrated acceptance requested by the user, then complete Presenter Desktop physical-device/deep-link checks, Sentry redaction, and final token-rate comparison. |
| 7: Gateway and coordinated cutover | `application and Admin membership cutover released / acceptance matrix pending` | Final Account permission transport, granular Gateway enforcement, Website API enforcement, generated clients, and three browser consumers are live. Account [#100](https://github.com/HallelujahHomeChurch/account-api/pull/100)–[#101](https://github.com/HallelujahHomeChurch/account-api/pull/101), Operations [#26](https://github.com/HallelujahHomeChurch/operations-api/pull/26)–[#31](https://github.com/HallelujahHomeChurch/operations-api/pull/31), `frontend-platform` [#66](https://github.com/HallelujahHomeChurch/frontend-platform/pull/66)–[#67](https://github.com/HallelujahHomeChurch/frontend-platform/pull/67), and Admin [#113](https://github.com/HallelujahHomeChurch/admin-fe/pull/113)–[#115](https://github.com/HallelujahHomeChurch/admin-fe/pull/115) complete the approved membership/organization implementation. Admin #115 merge `a6598f6` passed release run `35467794596` and its production origin returned `200`. The reviewed Taipei/Zhongli structure and Account binding are present without implicit responsibility or bulletin grants. | Complete Gate R, scoped-role browser/direct-API negative evidence, the reset Audit window, DSR/permanent-deletion human governance, Presenter/device evidence, and explicit final acceptance. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Keep the completed 2026-09-19 membership/organization implementation frozen;
   run its scoped-account browser matrix together with the deferred Phase 0
   cold first-entry matrix during final integrated acceptance.
2. Let the reset Audit 24-hour read-only observation complete from the
   2026-09-19T20:16Z zero-backlog baseline; reset it again only for producer
   release/config churn or a failed invariant.
3. Finish the real Website manual DSR review and permanent-deletion evidence
   without conflating those workflows; all automated owners now pass live.
4. Complete Presenter Web/Desktop device/deep-link verification,
   browser/Desktop conformance, Sentry redaction, and token-rate comparison.
5. Finish the scoped-role/direct-API denial matrix and
   external legal dispositions; do not replace external counsel with an
   engineering assertion.
6. Only then close Phase 7 coordinated cutover and Phase 8 meeting/media formal
   acceptance. Update this ledger after every evidence boundary; a downstream
   item cannot promote an upstream item to accepted.
