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
| R: Website hosted Account transport | `local verified / recovery in progress` | A real user observed `www /api/operations/me/access` 404 and an immediate Account `session/access-token` 401 after Website Google sign-in. The former Gateway and Website evidence is therefore superseded: PR #105 made the token exchange direct to Account, while the shared runtime used one base for both authorize and exchange; the Account-host refresh session stayed bound to `www-web` and was correctly rejected as `account-console`. Gateway exposed Operations access only on Admin and WWW had no local refresh route. Remediation is `frontend-platform` PR [#61](https://github.com/HallelujahHomeChurch/frontend-platform/pull/61) and Gateway PR [#104](https://github.com/HallelujahHomeChurch/api-gateway/pull/104), both locally verified; Website and Admin consumer patches are prepared. | Merge/release package `1.0.5` and Gateway, release Website and Admin consumers, then observe the real Website -> Account -> Admin -> Website and authenticated bulletin matrix. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `released / not accepted` | Final shared package `@hallelujahhomechurch/*@1.0.4`, tag `v1.0.4` at `7c6de6c`; Account `account-api--0000096`; Operations `operations-api--0000009`. | Complete the master Gate B evidence, especially counted import and cross-domain authorization matrix. |
| 3A: Operations extraction | `in progress` | Direct sync-window and LINE occurrence route handoffs are released. Operations PR [#21](https://github.com/HallelujahHomeChurch/operations-api/pull/21), merge `5176680`, records the required counted-cutover evidence. | Formal counted export/import, backup, stable-ID digest, approved source removal. The real LINE schedule query is deferred evidence only; it does not block Website/API work. |
| 3B: Audit producers | `dark release / observing` | `audit-log--ex7vpzj` plus producer revisions are healthy. | Read-only 24-hour observation beginning from `hhc-line-function-bot--0000215` healthy at 2026-09-18T03:24:01Z; earliest sign-off is 2026-09-19T03:24:01Z. |
| 4: protected bulletins and Asset boundary | `backend and Website consumer released` | `hhc-web-api--0000102`, `asset-api--0000061`, `engagement-api--0000031`, and Website revision `hhc-web--0000110` are released. An authenticated Website session without an effective bulletin entitlement rendered no weekly surface or download controls, without auth error or public fallback. | Entitlement and protected-download browser matrix. |
| 5: DSR and permanent deletion closure | `in progress` | Owner integrations and diagnostics are released incrementally. | Final owner matrix, retained-data behavior, partial failure/retry, and real DSR/permanent-deletion evidence. |
| 6: shared AuthN runtime and consumers | `recovery in progress / Presenter pending` | The released `1.0.4` Website/Account/Admin handoff is not accepted: a real Website -> Account transition found the client-bound session regression recorded in Gate R. `frontend-platform` `1.0.5`, Gateway, Website, and Admin must recover the product-local token/refresh transport before the prior release evidence can count again. Presenter PR #71 is merged but not released. | Release the recovery chain, then run full Website -> Account -> Admin -> Website, protected-bulletin, browser/Desktop conformance, and consumer-drift evidence. |
| 7: Gateway and coordinated cutover | `not started` | Exact Gateway route work has landed incrementally. | All consumer PRs green and released, full staging matrix, retained-data reconciliation, and explicit coordinated-cutover authorization. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Run the protected-bulletin entitlement and download matrix with controlled
   principals; do not alter Account permissions, OAuth scopes, or bulletin
   access.
2. Align Presenter Web/Desktop with the canonical Account session and shared
   destination projection, then release and verify it.
3. Run browser/Desktop conformance and the consumer drift scan.
4. Resume the Operations counted import and the DSR owner evidence gates,
   updating this ledger after each evidence boundary.
