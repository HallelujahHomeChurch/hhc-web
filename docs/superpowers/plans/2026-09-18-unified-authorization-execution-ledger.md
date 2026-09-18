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
| R: Website hosted Account transport | `released / warm real-user verified / cold matrix pending` | The same-origin transport chain is released: Gateway [#105](https://github.com/HallelujahHomeChurch/api-gateway/pull/105) merge `72d1e0b`, release `35329779404`; Account [#61](https://github.com/HallelujahHomeChurch/account-fe/pull/61) merge `6642069`, release `35336198313`; Admin [#106](https://github.com/HallelujahHomeChurch/admin-fe/pull/106) merge `5f85df7`, release `35329550048`; `frontend-platform` [#62](https://github.com/HallelujahHomeChurch/frontend-platform/pull/62) merge `55e7f33`, package release `35331233779` as `v1.0.6`; and Website [#115](https://github.com/HallelujahHomeChurch/hhc-web/pull/115) merge `50d56d8`, release `35331982605`. Account #61 keeps `/oauth/callback` on the neutral branded loader instead of rendering a login-form-shaped pending state. Azure Infra [#88](https://github.com/HallelujahHomeChurch/azure-infra/pull/88) merge `859b79f` applied exactly one Container App-scoped deployment role (`1 add / 0 change / 0 destroy`). Operations [#23](https://github.com/HallelujahHomeChurch/operations-api/pull/23) merge `02f327e`, release `35337164571`, deployed immutable digest `b5a1744f…` as healthy revision `operations-api--0000010`. An authenticated production browser observed CSRF `200`, access-token `200`, and `GET /api/operations/me/access` `200`; warm Website -> Account -> Admin navigation retained the same session with no Account login card or Admin standalone sign-in page. | Re-run the first-visit matrix with genuinely cold product-local state while preserving the central Account SSO session; warm navigation is not a substitute. The final RBAC transport remains separate: the current access token carries identity scopes only, so hhc-web-api content calls remain fail-closed until the no-alias permission transport cutover. |

The OAuth scope correction in PR #105 remains required: `www-web` requests
only `openid profile email`. Recovery Gate R must not reintroduce
`bulletin:read` as an OAuth scope or make bulletins public.

## Phase Ledger

| Master phase | State | Released or current evidence | Remaining acceptance gate |
| --- | --- | --- | --- |
| 1A–2C: contracts, Account, Operations foundation | `contracts frozen / implementation partial / not accepted` | Authentication transport and Operations foundation are released. Account [#94](https://github.com/HallelujahHomeChurch/account-api/pull/94) merge `724c515` and Admin [#107](https://github.com/HallelujahHomeChurch/admin-fe/pull/107) merge `ae31313` are released. Operations authenticated access is live on revision `operations-api--0000010`. | Do not call `frontend-platform` `v1.0.6` the final RBAC package: current source still contains `cms:*` and an Admin compatibility map. Production evidence confirms the Account session can contain `permissions: ["*"]` while the current access token carries only identity scopes; hhc-web-api therefore correctly returns `403` rather than receiving product permissions. Finish the no-alias catalog, explicit permission transport, role expansion, service enforcement, generated contracts, and cross-domain authorization matrix before Gate B can pass. |
| 3A: Operations extraction | `in progress` | Direct sync-window and LINE occurrence route handoffs are released. Operations PR [#21](https://github.com/HallelujahHomeChurch/operations-api/pull/21), merge `5176680`, records the required counted-cutover evidence. | Formal counted export/import, backup, stable-ID digest, approved source removal. The real LINE schedule query is deferred evidence only; it does not block Website/API work. |
| 3B: Audit producers | `dark release / observing` | `audit-log--ex7vpzj` plus producer revisions are healthy. | Read-only 24-hour observation beginning from `hhc-line-function-bot--0000215` healthy at 2026-09-18T03:24:01Z; earliest sign-off is 2026-09-19T03:24:01Z. |
| 4: protected bulletins and Asset boundary | `backend and Website consumer released / negative matrix live verified` | `hhc-web-api--0000102`, `asset-api--0000061`, `engagement-api--0000031`, and Website revision `hhc-web--0000110` are released. An authenticated Website session without an effective bulletin entitlement rendered no weekly surface or download controls, without auth error or public fallback. On 2026-09-18, anonymous production requests to legacy `/api/bulletins`, `/api/bulletins/latest`, and `/api/bulletins/by-number/1737` returned `404`; the protected member list returned `401`. A count-only production call from `hhc-web-api` through its existing Dapr service identity returned `bulletinPublicGrants: 0`. Authenticated requests without entitlement for `general` `zh-Hant`, `zh-Hans`, and `en`, plus unknown `children` `zh-Hant`, all returned non-disclosing `404` with `Cache-Control: private, no-store`. | After the final permission transport enables the approved management path, create a qualified disposable test subject through product APIs and run positive list/read/download plus revocation. Do not edit Operations data directly or add public access to manufacture evidence. |
| 5: DSR and permanent deletion closure | `released / external acceptance pending` | Account [#94](https://github.com/HallelujahHomeChurch/account-api/pull/94), merge `724c515`, release `35329793890`, replaces the generic cleanup conflict with bounded owner-incomplete semantics. Admin [#107](https://github.com/HallelujahHomeChurch/admin-fe/pull/107), merge `ae31313`, release `35331200385`, presents only a safe operator message. | Complete the final owner matrix, retained-data behavior, partial failure/retry, and disposable-account DSR/permanent-deletion evidence. |
| 6: shared AuthN runtime and consumers | `browser recovery released / warm verified / cold matrix and Presenter pending` | Browser transport baseline `v1.0.6` and Website/Account/Admin consumers are released. Admin has no standalone sign-in page and denies users without console access back to the Website. Account #61 replaced callback pending UI with the neutral branded loader; a warm production handoff reached Account profile without a login card and then Admin without a standalone sign-in page. Presenter PR #71 is merged but not released. | Close Gate R with genuinely cold product-local evidence; then complete the final no-alias RBAC package/consumer cutover, Presenter Web/Desktop conformance, device release, consumer-drift scan, Sentry redaction, and token-rate evidence. |
| 7: Gateway and coordinated cutover | `not started` | Exact Gateway route work has landed incrementally. | All consumer PRs green and released, full staging matrix, retained-data reconciliation, and explicit coordinated-cutover authorization. |
| 8: meeting/media formal acceptance | `not started` | No acceptance evidence. | Controlled device and runtime evidence after Phase 7, without release/config churn. |

## Deferred Evidence

| Item | State | Resume condition |
| --- | --- | --- |
| Real HHC LINE schedule query after the Operations occurrence handoff | `deferred` | Obtain an actual user-originated LINE schedule query and correlate it with the Operations route. It is not a Website/API implementation blocker. |

## Immediate Order

1. Re-run Website -> Account -> Admin -> Website with one central session and
   cold product-local sessions. Require no credential/provider prompt, no login
   form during callback, Admin no-access redirect to Website, and aligned
   sign-out behavior.
2. Complete protected-bulletin acceptance: zero public grants, anonymous denial,
   entitled positive read/download, unentitled denial, and revocation. No step
   may temporarily enable public bulletin access.
3. Close producer evidence in dependency order: Operations counted import and
   source removal, Audit 24-hour observation, then DSR owner/retry/disposable
   account evidence.
4. Execute the final breaking RBAC cutover as its own gate: remove `cms:*`,
   remove all compatibility mappings, publish final generated contracts and
   package, then release Account/Website/Admin consumers with the role and
   direct-URL/API denial matrix. `v1.0.6` is not this gate.
5. Complete Presenter Web/Desktop integration, release, device/deep-link
   verification, browser/Desktop conformance, Sentry redaction, and token-rate
   comparison.
6. Only then run Phase 7 coordinated cutover and Phase 8 meeting/media formal
   acceptance. Update this ledger after every evidence boundary; a downstream
   item cannot promote an upstream item to accepted.
