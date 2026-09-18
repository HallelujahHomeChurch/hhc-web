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
| R: Website hosted Account transport | `live verified / gate closed` | `hhc-web` PR [#105](https://github.com/HallelujahHomeChurch/hhc-web/pull/105), merge `877a212`, changed the shared session client from same-origin `/api/account/v1` to `account.alive.org.tw`; live Website CORS preflight from `www` initially had no allow-origin header. Gateway PR [#102](https://github.com/HallelujahHomeChurch/api-gateway/pull/102), merge `672a9fe`, release [35309023148](https://github.com/HallelujahHomeChurch/api-gateway/actions/runs/35309023148), and revision `api-gateway--0000142` are healthy; live `www` preflight allows only the exact origin and an untrusted origin has no allow-origin header. Website CSP PR [#110](https://github.com/HallelujahHomeChurch/hhc-web/pull/110), merge `998cd04`, was released successfully by [35309929662](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/35309929662). Browser Network evidence then found the Sentry `sentry-trace` request header disallowed by the Account CORS preflight. Gateway PR [#103](https://github.com/HallelujahHomeChurch/api-gateway/pull/103), merge `bbdf384`, release [35310771544](https://github.com/HallelujahHomeChurch/api-gateway/actions/runs/35310771544), and revision `api-gateway--0000143` are healthy. `hhc-web` PR [#104](https://github.com/HallelujahHomeChurch/hhc-web/pull/104), merge `90c0a64`, release [35312641475](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/35312641475), and revision `hhc-web--0000109` adopted `@hallelujahhomechurch/account-client@1.0.4`. A real Website Google OAuth completion proves the browser `/oauth/token` access-token exchange; the post-release authenticated reload found the AccountControl and no fail-closed avatar placeholder or login control. No user or token data was retained. | Gate R is closed. Continue with the remaining consumer releases and their conformance evidence. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `released / not accepted` | Final shared package `@hallelujahhomechurch/*@1.0.4`, tag `v1.0.4` at `7c6de6c`; Account `account-api--0000096`; Operations `operations-api--0000009`. | Complete the master Gate B evidence, especially counted import and cross-domain authorization matrix. |
| 3A: Operations extraction | `in progress` | Direct sync-window and LINE occurrence route handoffs are released. Operations PR [#21](https://github.com/HallelujahHomeChurch/operations-api/pull/21), merge `5176680`, records the required counted-cutover evidence. | Formal counted export/import, backup, stable-ID digest, approved source removal. The real LINE schedule query is deferred evidence only; it does not block Website/API work. |
| 3B: Audit producers | `dark release / observing` | `audit-log--ex7vpzj` plus producer revisions are healthy. | Read-only 24-hour observation beginning from `hhc-line-function-bot--0000215` healthy at 2026-09-18T03:24:01Z; earliest sign-off is 2026-09-19T03:24:01Z. |
| 4: protected bulletins and Asset boundary | `backend and Website consumer released` | `hhc-web-api--0000102`, `asset-api--0000061`, `engagement-api--0000031`, and Website revision `hhc-web--0000109` are released. | Entitlement and protected-download browser matrix. |
| 5: DSR and permanent deletion closure | `in progress` | Owner integrations and diagnostics are released incrementally. | Final owner matrix, retained-data behavior, partial failure/retry, and real DSR/permanent-deletion evidence. |
| 6: shared AuthN runtime and consumers | `Website live verified / remaining consumers ready` | Package is public. Website revision `hhc-web--0000109` is the required Gate R AuthN-runtime release and its authenticated session UI is live verified. `account-fe` PR [#59](https://github.com/HallelujahHomeChurch/account-fe/pull/59) and `admin-fe` PR #103 at `16e5d2c` are green. The former Admin test race after bulletin-detail navigation is corrected; its 519 local tests, lint, build, and CI pass. | Merge/release Account and Admin, then run browser/Electron conformance. |
| 7: Gateway and coordinated cutover | `not started` | Exact Gateway route work has landed incrementally. | All consumer PRs green and released, full staging matrix, retained-data reconciliation, and explicit coordinated-cutover authorization. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Merge and release the remaining dependency-ready consumer PRs, then run
   browser/Electron conformance. Do not alter Account permissions, OAuth
   scopes, or bulletin access.
2. Resume the protected-bulletin entitlement and download matrix after the
   consumers are released.
3. Resume the master plan from the next dependency-ready producer gate,
   updating this ledger after each evidence boundary.
