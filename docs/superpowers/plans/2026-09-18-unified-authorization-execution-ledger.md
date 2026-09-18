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
| R: Website hosted Account transport | `released / regression correction in progress / real-user matrix pending` | The same-origin transport chain is released: Gateway [#105](https://github.com/HallelujahHomeChurch/api-gateway/pull/105) merge `72d1e0b`, release `35329779404`; Account [#60](https://github.com/HallelujahHomeChurch/account-fe/pull/60) merge `0df1ff1`, release `35329550832`; Admin [#106](https://github.com/HallelujahHomeChurch/admin-fe/pull/106) merge `5f85df7`, release `35329550048`; `frontend-platform` [#62](https://github.com/HallelujahHomeChurch/frontend-platform/pull/62) merge `55e7f33`, package release `35331233779` as `v1.0.6`; and Website [#115](https://github.com/HallelujahHomeChurch/hhc-web/pull/115) merge `50d56d8`, release `35331982605`. A signed-in Website renders the avatar and warm Website -> Account -> Admin -> Website navigation succeeds. The remaining first-visit Account defect is visual: `/oauth/callback` changes to the login shell after 350 ms even though SSO succeeds. Operations [#22](https://github.com/HallelujahHomeChurch/operations-api/pull/22) merge `2bd28cb` accepts standard OIDC identity scopes and published immutable image release `35333450762`, but the image is not deployed because the repository release workflow currently publishes only. | Replace the Account callback pending state with the neutral branded loader and release it. Add least-privilege Operations deployment through reviewed IaC and CI, then require authenticated `GET /api/operations/me/access` = `200`. Re-run a cold product-local Website -> Account -> Admin -> Website matrix with no credential/provider prompt or login-form-shaped pending state, then run the protected-bulletin matrix. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `contracts frozen / implementation partial / not accepted` | Authentication transport and Operations foundation are released. Account [#94](https://github.com/HallelujahHomeChurch/account-api/pull/94) merge `724c515` and Admin [#107](https://github.com/HallelujahHomeChurch/admin-fe/pull/107) merge `ae31313` are released. | Do not call `frontend-platform` `v1.0.6` the final RBAC package: current source still contains `cms:*` and an Admin compatibility map. Finish the no-alias permission catalog, role expansion, service enforcement, generated contracts, and cross-domain authorization matrix before Gate B can pass. |
| 3A: Operations extraction | `in progress` | Direct sync-window and LINE occurrence route handoffs are released. Operations PR [#21](https://github.com/HallelujahHomeChurch/operations-api/pull/21), merge `5176680`, records the required counted-cutover evidence. | Formal counted export/import, backup, stable-ID digest, approved source removal. The real LINE schedule query is deferred evidence only; it does not block Website/API work. |
| 3B: Audit producers | `dark release / observing` | `audit-log--ex7vpzj` plus producer revisions are healthy. | Read-only 24-hour observation beginning from `hhc-line-function-bot--0000215` healthy at 2026-09-18T03:24:01Z; earliest sign-off is 2026-09-19T03:24:01Z. |
| 4: protected bulletins and Asset boundary | `backend and Website consumer released / partial live verified` | `hhc-web-api--0000102`, `asset-api--0000061`, `engagement-api--0000031`, and Website revision `hhc-web--0000110` are released. An authenticated Website session without an effective bulletin entitlement rendered no weekly surface or download controls, without auth error or public fallback. On 2026-09-18, anonymous production requests to legacy `/api/bulletins`, `/api/bulletins/latest`, and `/api/bulletins/by-number/1737` returned `404`; the protected member list returned `401`. The Asset policy and reconciliation query reject public `cms.weekly.pdf` grants, but no production `bulletinPublicGrants` count has yet been retrieved. | Retrieve the count-only Asset reconciliation result and require zero, then run entitlement and protected-download browser matrix. |
| 5: DSR and permanent deletion closure | `released / external acceptance pending` | Account [#94](https://github.com/HallelujahHomeChurch/account-api/pull/94), merge `724c515`, release `35329793890`, replaces the generic cleanup conflict with bounded owner-incomplete semantics. Admin [#107](https://github.com/HallelujahHomeChurch/admin-fe/pull/107), merge `ae31313`, release `35331200385`, presents only a safe operator message. | Complete the final owner matrix, retained-data behavior, partial failure/retry, and disposable-account DSR/permanent-deletion evidence. |
| 6: shared AuthN runtime and consumers | `browser recovery released / callback regression open / Presenter pending` | Browser transport baseline `v1.0.6` and Website/Account/Admin consumers are released. Admin has no standalone sign-in page and denies users without console access back to the Website. Account correctly restores a session, but its callback pending UI still resembles the login page on the first cold handoff. Presenter PR #71 is merged but not released. | Fix and release Account callback UX; close Gate R; then complete the final no-alias RBAC package/consumer cutover, Presenter Web/Desktop conformance, device release, consumer-drift scan, Sentry redaction, and token-rate evidence. |
| 7: Gateway and coordinated cutover | `not started` | Exact Gateway route work has landed incrementally. | All consumer PRs green and released, full staging matrix, retained-data reconciliation, and explicit coordinated-cutover authorization. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Close the Account cold-handoff UX regression with a focused callback test,
   independent PR/CI/release, and first-visit browser evidence. Do not advance
   Gate R based on a warm Account session.
2. Finish the Operations deployment path: merge the no-drift adoption of the
   existing release identity, add the exact Container App deployment role by a
   reviewed Terraform plan/apply, add CI deployment/rollback to
   `operations-api`, release PR #22's image, and verify authenticated access.
3. Re-run Website -> Account -> Admin -> Website with one central session and
   cold product-local sessions. Require no credential/provider prompt, no login
   form during callback, Admin no-access redirect to Website, and aligned
   sign-out behavior.
4. Complete protected-bulletin acceptance: zero public grants, anonymous denial,
   entitled positive read/download, unentitled denial, and revocation. No step
   may temporarily enable public bulletin access.
5. Close producer evidence in dependency order: Operations counted import and
   source removal, Audit 24-hour observation, then DSR owner/retry/disposable
   account evidence.
6. Execute the final breaking RBAC cutover as its own gate: remove `cms:*`,
   remove all compatibility mappings, publish final generated contracts and
   package, then release Account/Website/Admin consumers with the role and
   direct-URL/API denial matrix. `v1.0.6` is not this gate.
7. Complete Presenter Web/Desktop integration, release, device/deep-link
   verification, browser/Desktop conformance, Sentry redaction, and token-rate
   comparison.
8. Only then run Phase 7 coordinated cutover and Phase 8 meeting/media formal
   acceptance. Update this ledger after every evidence boundary; a downstream
   item cannot promote an upstream item to accepted.
