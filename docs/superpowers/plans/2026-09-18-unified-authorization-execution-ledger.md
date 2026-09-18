# Unified Authorization Execution Ledger

**Updated:** 2026-09-18

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
| R: Website hosted Account transport | `accepted` | The final browser consumers use `frontend-platform` `v1.0.8`: Account [#62](https://github.com/HallelujahHomeChurch/account-fe/pull/62) merge `6c66479`, release `35347595420`; Website [#118](https://github.com/HallelujahHomeChurch/hhc-web/pull/118) merge `ddcc523`, release `35347768029`, revision `hhc-web--0000118`; and Admin [#108](https://github.com/HallelujahHomeChurch/admin-fe/pull/108) merge `f3c0643`, release `35347923411`. On 2026-09-18, product `localStorage` and `sessionStorage` were cleared separately for Website, Account, and Admin while preserving the central Account cookie. Website immediately restored the avatar; Website -> Account profile rendered no login UI; Account -> Admin rendered no standalone sign-in page. A deliberate series of nine full Admin document reloads reached the Account `429` limit; the shared runtime persisted the server cooldown, made no immediate retry loop, and recovered after cooldown without logout. A qualified disposable membership then passed protected bulletin list/latest-PDF download for `zh-Hant`, `zh-Hans`, and `en`, each with `private, no-store`; revoking all three entitlements restored non-disclosing `404`, and the test membership and qualification were cleaned up. | None. Later AuthN changes must preserve this gate and must not make bulletins public. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `final RBAC transport released / broader Gate B evidence pending` | Account [#95](https://github.com/HallelujahHomeChurch/account-api/pull/95) merge `28f053e`, release `35339777901`, revision `account-api--0000098`, transports opaque granular permissions while keeping empty permissions authenticated. Account [#96](https://github.com/HallelujahHomeChurch/account-api/pull/96) merge `4f748dc`, release `35350895475`, revision `account-api--0000099`, restored the bounded membership-directory contract. Gateway [#106](https://github.com/HallelujahHomeChurch/api-gateway/pull/106), [#107](https://github.com/HallelujahHomeChurch/api-gateway/pull/107), [#108](https://github.com/HallelujahHomeChurch/api-gateway/pull/108), and [#109](https://github.com/HallelujahHomeChurch/api-gateway/pull/109) released through `api-gateway--0000149`; the final permission transport, request id, Website Operations self-service routes, and all bounded Admin DSR owner routes are live. Website API granular enforcement is live. `frontend-platform` [#63](https://github.com/HallelujahHomeChurch/frontend-platform/pull/63) and [#64](https://github.com/HallelujahHomeChurch/frontend-platform/pull/64) published `v1.0.8`; final consumers are released. Runtime drift scanning found removed `cms:read|write|publish` only in explicit rejection/regression tests and historical/down migrations, not active permission catalogs or compatibility maps. | Complete scoped-role denial, DSR, Audit observation, Presenter device, and full cross-domain authorization evidence before Gate B/C acceptance. |
| 3A: Operations extraction | `complete / released / live verified` | Operations [#24](https://github.com/HallelujahHomeChurch/operations-api/pull/24) records the counted source-removal evidence. HHC Web API [#109](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/109), merge `003d01b`, release `35344386125`, removed the six legacy Operations source tables and deployed `hhc-web-api--0000103`. Operations [#25](https://github.com/HallelujahHomeChurch/operations-api/pull/25), merge `813df16`, release `35345728154`, added the missing typed public meeting/occurrence response contract and deployed `operations-api--0000011`. Live `/api/meetings` and `/api/meeting-occurrences` returned `200` with typed data. Gateway [#108](https://github.com/HallelujahHomeChurch/api-gateway/pull/108), merge `6947e0e`, release `35353145847`, deployed `api-gateway--0000148`; unauthenticated Resource self-service routes return `401`, while authenticated Resource and reservation lists return `200`. | The real LINE-user schedule query remains deferred device evidence and does not reopen the source extraction. |
| 3B: Audit producers | `repair released / observing` | HHC Web API [#110](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/110), merge `f48b2f5`, release `35353145909`, revision `hhc-web-api--0000104`, removes unsupported `filterNames` from producer payloads and requeues only the known failed list events. Consecutive snapshots at and after 2026-09-18T14:38:16Z reported `pendingCount=0` and `deadLetterCount=0`. | The fresh read-only 24-hour observation is active from 2026-09-18T14:38:16Z; earliest sign-off is 2026-09-19T14:38:16Z. Any producer/release churn or recurrence resets this gate. |
| 4: protected bulletins and Asset boundary | `accepted` | `hhc-web-api`, `asset-api`, `engagement-api`, and Website are released. Anonymous legacy bulletin routes remain `404`; protected member routes return `401`. Production reports zero public bulletin grants. Authenticated unentitled requests for all three final locales return non-disclosing `404` with `private, no-store`. A qualified disposable membership passed list and latest-PDF download for `zh-Hant`, `zh-Hans`, and `en`, each with `private, no-store`; entitlement revocation restored the denial matrix, and the membership and qualification were cleaned up. | None. Future bulletin types add a new entitlement without changing the protected default. |
| 5: DSR and permanent deletion closure | `automated owner matrix accepted / manual governance pending` | Account [#94](https://github.com/HallelujahHomeChurch/account-api/pull/94), merge `724c515`, release `35329793890`, replaces the generic cleanup conflict with bounded owner-incomplete semantics. Admin [#107](https://github.com/HallelujahHomeChurch/admin-fe/pull/107), merge `ae31313`, release `35331200385`, presents only a safe operator message. Account [#97](https://github.com/HallelujahHomeChurch/account-api/pull/97), merge `6b60319`, release `35355781674`, removed the forged Operations Dapr caller header. Gateway [#109](https://github.com/HallelujahHomeChurch/api-gateway/pull/109), merge `4e693e7`, release `35357987052`, revision `api-gateway--0000149`, exposes the bounded Operations and Website Watermark retry routes. Account [#98](https://github.com/HallelujahHomeChurch/account-api/pull/98), merge `3dcf00c`, release `35360146638`, added the existing Watermark investigation record type. Account [#99](https://github.com/HallelujahHomeChurch/account-api/pull/99), merge `79e076d`, release `35363587917`, revision `account-api--0000102`, validates the Website API's strict `{data, meta, error}` envelope. The same live request then completed Operations with five records and retained-data reason codes and completed Website Watermark with eight records. Engagement and Notification remained succeeded, Asset remained not applicable, and Account correctly remained pending with `DSR_WAITING_FOR_MANUAL_RESOLUTION`. | Complete the real Website manual review, then verify the export outcome. Permanent-deletion evidence remains a distinct human-governance workflow and must not be inferred from access-export success. |
| 6: shared AuthN runtime and consumers | `browser consumers and Presenter released / Desktop evidence pending` | `frontend-platform` `v1.0.8`, Account #62, Website #118, and Admin #108 are released. Cold product-local Website -> Account -> Admin SSO passed without credential/provider prompt or login-form-shaped state. Admin direct and SPA routes for Page Settings, News, Bulletins, Meetings, Resources, Reservations, Memberships, Roles, and Audit loaded with the final capability model; the role table exposes business labels and the independent `page_settings_editor`, `news_editor`, and `bulletin_editor` roles. Presenter [#72](https://github.com/rayselfs/hhc-presenter/pull/72) and workflow repair [#73](https://github.com/rayselfs/hhc-presenter/pull/73) released immutable `v2.5.9` artifacts for Windows and macOS. Presenter Web reused the central Account session and rendered the signed-in user without showing a credential form or popup. | Complete Presenter Desktop physical-device/deep-link checks, Sentry redaction, and final token-rate comparison. |
| 7: Gateway and coordinated cutover | `application cutover released / acceptance matrix pending` | Final Account permission transport, granular Gateway enforcement, Website API enforcement, generated clients, and three browser consumers are live. Public Operations contract regression is fixed and verified. | Complete bulletin, DSR, Audit, scoped-role/direct-API negative matrices, retained-data reconciliation, Presenter release, and explicit final acceptance. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Let the Audit 24-hour read-only observation complete from the repaired
   revision; do not reset it without release or producer churn.
2. Finish the real Website manual DSR review and permanent-deletion evidence
   without conflating those workflows; all automated owners now pass live.
3. Complete Presenter Web/Desktop device/deep-link verification,
   browser/Desktop conformance, Sentry redaction, and token-rate comparison.
4. Finish the scoped-role/direct-API denial matrix and
   external legal dispositions; do not replace external counsel with an
   engineering assertion.
5. Only then close Phase 7 coordinated cutover and Phase 8 meeting/media formal
   acceptance. Update this ledger after every evidence boundary; a downstream
   item cannot promote an upstream item to accepted.
