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
| R: Website hosted Account transport | `transport live verified / authenticated evidence pending` | `hhc-web` PR [#105](https://github.com/HallelujahHomeChurch/hhc-web/pull/105), merge `877a212`, changed the shared session client from same-origin `/api/account/v1` to `account.alive.org.tw`; live Website CORS preflight from `www` initially had no allow-origin header. Gateway PR [#102](https://github.com/HallelujahHomeChurch/api-gateway/pull/102), merge `672a9fe`, release [35309023148](https://github.com/HallelujahHomeChurch/api-gateway/actions/runs/35309023148), and revision `api-gateway--0000142` are healthy; live `www` preflight allows only the exact origin and an untrusted origin has no allow-origin header. Website CSP PR [#110](https://github.com/HallelujahHomeChurch/hhc-web/pull/110), merge `998cd04`, was released successfully by [35309929662](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/35309929662). Browser Network evidence then found the Sentry `sentry-trace` request header disallowed by the Account CORS preflight. Gateway PR [#103](https://github.com/HallelujahHomeChurch/api-gateway/pull/103), merge `bbdf384`, release [35310771544](https://github.com/HallelujahHomeChurch/api-gateway/actions/runs/35310771544), and revision `api-gateway--0000143` are healthy. A real Chrome Website request now receives a successful unauthenticated session response with no CORS/CSP failure; its profile has no valid Account session. The hosted Website sign-in reaches Account successfully, but awaits user credentials. | Complete hosted sign-in in the preserved Chrome tab, then record authenticated Website session and access-token success without retaining user/token data. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `released / not accepted` | Final shared package `@hallelujahhomechurch/*@1.0.4`, tag `v1.0.4` at `7c6de6c`; Account `account-api--0000096`; Operations `operations-api--0000009`. | Complete the master Gate B evidence, especially counted import and cross-domain authorization matrix. |
| 3A: Operations extraction | `in progress` | Direct sync-window and LINE occurrence route handoffs are released. | Formal counted export/import, backup, stable-ID digest, approved source removal. The real LINE schedule query is deferred evidence only; it does not block Website/API work. |
| 3B: Audit producers | `dark release / observing` | `audit-log--ex7vpzj` plus producer revisions are healthy. | Read-only 24-hour observation beginning from `hhc-line-function-bot--0000215` healthy at 2026-09-18T03:24:01Z; earliest sign-off is 2026-09-19T03:24:01Z. |
| 4: protected bulletins and Asset boundary | `backend released / consumer pending` | `hhc-web-api--0000102`, `asset-api--0000061`, and `engagement-api--0000031` are released. `hhc-web` PR [#104](https://github.com/HallelujahHomeChurch/hhc-web/pull/104) is green but behind `main`. | Recovery Gate R, rebase and merge the Website consumer, then entitlement and protected-download browser matrix. |
| 5: DSR and permanent deletion closure | `in progress` | Owner integrations and diagnostics are released incrementally. | Final owner matrix, retained-data behavior, partial failure/retry, and real DSR/permanent-deletion evidence. |
| 6: shared AuthN runtime and consumers | `blocked by Recovery Gate R` | Package is public. `account-fe` PR [#59](https://github.com/HallelujahHomeChurch/account-fe/pull/59) is green; `hhc-web` PR [#104](https://github.com/HallelujahHomeChurch/hhc-web/pull/104) was rebased at `28f887a` and is green. The Admin #103 failure was a test race after bulletin-detail navigation; it was corrected, rebased through the Admin OAuth scope hotfix at `16e5d2c`, and passed 519 local tests, lint, and build. Its CI is green. | Close Recovery Gate R, merge only dependency-ready consumers, then run browser/Electron conformance. |
| 7: Gateway and coordinated cutover | `not started` | Exact Gateway route work has landed incrementally. | All consumer PRs green and released, full staging matrix, retained-data reconciliation, and explicit coordinated-cutover authorization. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Close Recovery Gate R in `api-gateway`; do not alter Account permissions,
   OAuth scopes, or bulletin access.
2. Verify the released Gateway with a real Website login, session, and
   access-token flow.
3. Rebase and re-evaluate the three consumer PRs; investigate the non-package
   Admin CI failure before any merge.
4. Resume the master plan from the next dependency-ready phase, updating this
   ledger after each evidence boundary.
