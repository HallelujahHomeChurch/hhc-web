# Unified Authorization, Membership, And Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the pre-launch authorization/governance foundation by replacing broad permissions, extracting church operations, adding qualified Resource reservations, protecting bulletins, closing DSR/account deletion, and finishing centralized Admin audit.

**Architecture:** `account-api` remains the church-wide staff RBAC and DSR orchestration authority; a new `operations-api` owns organization, scoped pastoral/operational roles, membership, entitlement, the extracted operations kernel, and Resource reservations. Operations administrative actions allow the matching global Account permission or matching scoped operational role for the target OrgUnit; other domains keep their stated owner policy. `audit-log` receives domain-owner outboxes and serves exact protected queries; `hhc-web-api` owns bulletin policy and calls `operations-api` plus `asset-api`. Shared access projection drives navigation but never replaces backend enforcement. The release is an intentional coordinated breaking cutover with no legacy assignment migration or compatibility aliases.

**Tech Stack:** Go 1.25, PostgreSQL 17, `net/http`, TypeScript, React, Vite/Next.js/Electron, pnpm, OpenAPI, Nginx/Dapr, Azure Container Apps.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

**Integrated AuthN plan:**
`frontend-platform/docs/superpowers/plans/2026-09-15-auth-platform-convergence.md`

## Global Constraints

- Start every implementation repository in its own isolated worktree from freshly fetched `origin/main`.
- One task owner per repository at a time. A later plan may start only after the earlier owner merges and releases the producer contract it consumes.
- English is canonical for code, role labels, and permission descriptions. Translate user-facing UI copy through existing locale files.
- No compatibility aliases, dual-read, shadow-read, legacy role mapping, or old permission acceptance.
- Do not migrate test user role, qualification, or entitlement assignments. Do preserve bulletin and operations domain records, stable IDs, revisions, scans, and audit history.
- Human CMS roles never receive `assets:*` implicitly. `hhc-web-api` performs embedded asset actions using its allowlisted service identity after checking the matching CMS write permission.
- Access projection controls discovery and destination only. `account-api`, `operations-api`, `hhc-web-api`, and `asset-api` enforce their own authoritative decisions.
- Account staff permissions are church-wide. Only Meetings, Resources, and
  Reservations initially add an alternative scoped OrgRole branch, evaluated
  by `operations-api`; no OrgUnit id or organization role enters JWT scopes.
- Pastoral organization roles grant no Operations action implicitly. Scoped
  operational-role grant/revoke remains global `memberships:manage` in V1.
- Authentication depends only on identity/session transport. Authorization may
  read the authenticated session; AuthN must not import product permissions,
  capability groups, member entitlements, organization policy, or LINE ACLs.
- An available empty permission list is authenticated. Permission transport
  failure remains authenticated with an empty fail-closed list and a distinct
  `permission_unavailable` status.
- One protected request may perform at most one coordinated refresh and one
  retry after `401`. `403` never refreshes, signs out, or starts login.
- Unknown permission, entitlement, action, subject, or organization kind denies by default.
- Added workstreams consume the canonical AuthN/AuthZ seam and RBAC catalog. They must not define a second permission map, token-refresh client, authorization owner, or compatibility alias.
- Donations and the structured weekly-bulletin reader are registered post-launch work only. No launch task, route, permission, service, or acceptance row may depend on them.
- No production mutation, repository creation, push, PR, package publication, merge, release, session invalidation, or grant revocation without the corresponding explicit authorization.
- Migration numbers shown in subplans are reserved from the 2026-09-15 `origin/main` baselines. Recheck immediately after each fresh fetch; if occupied, update the plan set and contract ledger before writing SQL rather than creating a duplicate version.

## Plan Set And Ownership

The current execution state and evidence are maintained in the
[Unified Authorization Execution Ledger](2026-09-18-unified-authorization-execution-ledger.md).
The task checklists in this plan remain the acceptance contract; a ledger row is
never final acceptance by itself.

| Phase | Plan | Repository owner(s) | Start gate |
| --- | --- | --- | --- |
| 1A | Auth convergence Task 1 contract freeze | documentation owners only | Canonical AuthN/AuthZ seam below is approved |
| 1B | [Operations Task 1 foundation](2026-09-15-unified-authorization-operations-api.md) and [Audit Task 1 foundation](2026-09-15-unified-authorization-audit-log.md) | new `operations-api`, `audit-log` | Explicit new-repository authorization; catalog and route freeze complete |
| 2A | [Account deletion diagnosis](2026-09-12-account-legal-operations-launch.md) Task 6 | `account-api` | Backward-safe diagnostics approved; no production deletion is inferred or automated |
| 2B | [Account staff RBAC](2026-09-15-unified-authorization-account-rbac.md) | `account-api` | Task 6 root cause/regression complete; Operations foundation ready; Account catalog frozen |
| 2C | [Operations Tasks 2-7](2026-09-15-unified-authorization-operations-api.md) | `operations-api`, plus `hhc-web-api` export only | Operations foundation passes; Account subject contract frozen; may run alongside 2A/2B when repositories do not overlap |
| 3A | [Operations Task 8 source removal](2026-09-15-unified-authorization-operations-api.md) | `operations-api` + `azure-infra`, then `asset-api`, then `hhc-web-api` | Counted import and target readiness pass; the direct sync-window and LINE occurrence handoffs are released and observed |
| 3B | [Audit Tasks 2-4](2026-09-15-unified-authorization-audit-log.md) | `audit-log`, `azure-infra`, `api-gateway`, then one domain-owner repository at a time | Audit foundation and final catalog merged; execute OIDC/ACR bootstrap -> immutable image release -> workload plan -> external secrets -> workload apply and dark deploy -> Gateway query route; owning producer contract frozen |
| 4 | [Protected bulletin and Asset boundary](2026-09-15-unified-authorization-protected-bulletins.md) | `hhc-web-api`, then `asset-api`, then `engagement-api`, then LINE bot | Operations entitlement-check contract frozen; operations extraction merged before editing `hhc-web-api` |
| 5 | [DSR owner integration and external closure](2026-09-12-account-legal-operations-launch.md) Tasks 7-8 | `account-api`, registered owners, documentation owner | Owner endpoints dark; deletion result model proven; external evidence available |
| 6 | [Shared AuthN runtime, access contract, and frontend experience](2026-09-15-unified-authorization-frontends.md) plus Auth convergence Tasks 2-8 | one `frontend-platform` integration owner, then one owner per consumer repository | Account session/scope and all producer OpenAPI contracts are final; the Website final AuthN-runtime consumer is released as the narrow Recovery Gate R prerequisite, then R passes before the remaining consumer releases |
| 7 | [Edge, integration, and coordinated cutover](2026-09-15-unified-authorization-cutover.md) plus [Audit Task 5](2026-09-15-unified-authorization-audit-log.md) | `api-gateway`, `azure-infra`, integration owner | All application PRs green and release artifacts ready |
| 8 | [Meeting/media Phase 1 formal acceptance](2026-09-15-meeting-media-phase-1-acceptance.md) | existing released owners and Presenter device | No conflicting release/config churn; controlled test authority and device available |

This order intentionally limits parallelism. `account-api` and the new `operations-api` can be developed in parallel after their contracts are frozen. `hhc-web-api` cannot be owned by the extraction and bulletin workstreams simultaneously. `frontend-platform` has one integration owner and publishes one breaking package set containing the auth runtime, generic permission transport, domain AuthZ subpath, generated clients, and access resolver. The two frontend plans do not publish competing package releases.

### Recovery Gate R — Hosted SSO And Website Product Session

This gate recovers the observed Website authentication regression before the
general Phase 6 consumer releases or coordinated cutover. It is a narrow
`frontend-platform` + `api-gateway` + `hhc-web` transport correction, not an
RBAC, entitlement, or product-capability change.

- [x] Use `account.alive.org.tw` only as the browser's hosted authorization
      authority for `GET /api/account/v1/oauth/authorize`. This is a top-level
      navigation, not a credentialed browser API request.
- [x] Exchange the authorization code and call CSRF, session, access-token, and
      refresh routes through the Website's same-origin `/api/account/v1/*`
      gateway paths. The response host therefore owns the Website's
      `__Host-refresh_token` cookie.
- [x] Keep the Account authorization-server session and every product refresh
      session separate. Gateway overwrites `X-HHC-Client-ID` with `www-web` for
      the exact Website routes; no product sends a caller-selected client id or
      shares a refresh cookie with Account, Admin, or Presenter.
- [x] Expose only the exact Website session, token, refresh, and Operations
      access routes at Gateway. The anonymous Operations smoke returns `401`,
      not the former `404`; unsupported methods and untrusted paths remain
      denied.
- [x] Do not use Account-host CORS or a Website `connect-src` exception for
      browser session transport. A cross-origin token exchange recreates the
      client-bound-cookie regression. CORS is considered only for a distinct,
      documented browser API that cannot use the same-origin gateway path.
- [x] Release the corrected shared package `@hallelujahhomechurch/*@1.0.5`
      from tag `v1.0.5` (merge `45bfd32`), then release the Gateway, Website,
      and Admin consumers. Their immutable release evidence is maintained in
      the execution ledger.
- [ ] With one valid central Account SSO session, observe the real
      Website -> Account -> Admin -> Website matrix without a credential or
      provider prompt, confirm the authenticated Operations request, and then
      run the protected-bulletin entitlement/download matrix. A curl or an
      anonymous route smoke does not close this gate.

## Reviewed Baseline Snapshot

These are the fetched `origin/main` commits used to write this plan. Each executor must fetch and record a newer SHA when applicable rather than assuming this snapshot is still current.

| Repository | Reviewed `origin/main` |
| --- | --- |
| `account-api` | `ee9f1eb82a2a` |
| `hhc-web-api` | `96db97b5661e` |
| `asset-api` | `53d9d481a73c` |
| `engagement-api` | `788b18015934` |
| `api-gateway` | `99323b960b8a` |
| `frontend-platform` | `2c7a764ec605` |
| `admin-fe` | `7c2950eab1f8` |
| `hhc-web` | `043064e3aea2` |
| `account-fe` | `cb8ead347bc9` |
| `azure-infra` | `61e047bc0d83` |
| `hhc-line-function-bot` | `69ffbc8355e7` |
| `hhc-client-v2` | `a494ca371de2` |

## Frozen Contract Ledger

- [ ] Record the starting `origin/main` SHA for every affected repository in the release issue.
- [ ] Copy the canonical permission and role tables from the spec into the release issue without alteration.
- [ ] Freeze the operational OrgRole catalog (`meeting_manager`,
  `resource_manager`, `reservation_approver`) and the formula global Account
  permission OR matching active scoped role for the target OrgUnit. Confirm the
  Account permission codes and 20 default system roles are otherwise unchanged.
- [ ] Freeze these routes and ownership:

```text
GET  /api/operations/me/access                         operations-api
POST /priv/operations/entitlement-checks              operations-api
POST /priv/operations/dsr/exports                     operations-api
POST /priv/operations/dsr/actions                     operations-api
GET  /api/operations/me/resources                     operations-api
GET  /api/operations/me/resources/{resourceKey}/availability operations-api
POST /api/operations/me/resource-reservations         operations-api
GET  /api/operations/me/resource-reservations         operations-api
GET  /api/admin/operations/resource-reservations      operations-api
GET  /api/admin/operations/org-role-assignments       operations-api
POST /api/admin/operations/org-role-assignments       operations-api
POST /api/admin/operations/org-role-assignments/{assignmentId}/revoke operations-api
GET  /api/admin/audit/events                          audit-log
GET  /api/admin/audit/events/{eventId}                audit-log
POST /priv/audit/events                               audit-log
GET  /api/member/bulletins                            hhc-web-api
GET  /api/member/bulletins/latest                     hhc-web-api
GET  /api/member/bulletins/{issueID}/versions/{locale} hhc-web-api
GET  /api/member/bulletins/{issueID}/versions/{locale}/download hhc-web-api
```

- [ ] Freeze `EntitlementCheck` as an exact-subject, exact-code request; do not add a policy expression language:

```json
{
  "subjectId": "account-user-uuid",
  "entitlementCodes": ["bulletin.general.zh-Hant.access"]
}
```

- [ ] Freeze the normalized access snapshot shape. Account supplies `staffPermissions`; Operations supplies the remaining facts; the shared resolver derives destinations:

```ts
export type AccessSnapshot = {
  staffPermissions: string[]
  memberships: OrgMembershipSummary[]
  orgRoles: OrgRoleSummary[]
  qualifications: QualificationSummary[]
  entitlements: EntitlementSummary[]
  version: string
}
```

- [ ] Freeze the AuthN/AuthZ seam:

```ts
type AccountIdentitySession = {
  user: AccountSessionUser
  permissions: readonly string[]
  permissionAvailability:
    | { status: 'available' }
    | { status: 'unavailable'; code: 'permission_unavailable'; requestId?: string; retryAt?: number }
}
```

The session response transports `permissions`; the access token transports
granted permissions in `scope`; Gateway injects verified `X-HHC-Scopes`.
`hasPermission()` implements only exact match plus `*`. The compatibility map
is exactly `{}`. AuthN does not import domain capability names. The current
integrated `frontend-platform` package set is version `1.0.5`, published from
immutable tag `v1.0.5` at merge `45bfd32c7672950282bb60ccc72cab32760a1bfd`.
Consumers must use that exact package line; any other version is a
contract-ledger stop gate.

Operations administrative routes require authenticated identity at Gateway,
which forwards verified scopes without requiring a global Operations scope.
`operations-api` maps the existing six Operations permission strings to its
fixed scoped role bundles and performs the authoritative target-OrgUnit
decision. Membership and role-assignment administration stays global-only.

- [ ] Confirm all consumers treat resolver-produced destinations as presentation data and still handle `401`, `403`, and `404` from feature APIs.

## Dependency And Release Graph

```text
account-api session/scope + global RBAC ─┐
                                    ├─> frontend-platform ─> Admin/Website/Account/Presenter
operations-api scoped roles/reservations ┤          └────> LINE client types if reused
                                    │
operations kernel import ─> hhc-web-api removal ─> protected bulletin ─> asset grant policy
                                                                     └─> LINE protected download

domain mutations ─> owner outboxes ─> audit-log dark ─> exact Gateway query ─> Admin Audit page

Account cleanup diagnostics ─> root-cause fix ─> final DSR owner registry ─> deletion/DSR smoke

all green artifacts ─> api-gateway/infrastructure ─> staging matrix ─> one production cutover
```

## Cross-Repository Stop Gates

### Gate A — Design And Contract Freeze

- [ ] Every atomic staff permission appears once in the Account catalog.
- [ ] Every default role contains only canonical permissions.
- [ ] Meetings, Resources, Reservations, Memberships, and Audit remain separate permission families.
- [ ] The six existing Operations permission codes have church-wide meaning;
      scoped roles reuse their actions internally without new permission codes,
      JWT claims, or compatibility mapping.
- [ ] The three initial bulletin entitlement codes exactly match the spec.
- [ ] No Asset permission appears in Page Settings, News, or Bulletin roles.
- [ ] OpenAPI auth metadata and the authorization matrix agree.
- [ ] The unreleased `operations:read/write` and `resources:approve/manage` codes are absent with no mapping.
- [ ] The Account session distinguishes available empty permissions from
      `permission_unavailable` without changing authenticated identity.
- [ ] Session, JWT `scope`, Gateway `X-HHC-Scopes`, generic
      `hasPermission()`, capability names, and empty compatibility map agree
      across both design documents and both implementation plans.

### Gate B — Producer Readiness

- [ ] Account tests prove role expansion, removed-code denial, and session invalidation behavior.
- [ ] Operations tests prove hierarchy, cycles, primary membership, effective
      periods, qualification, entitlement, access projection, global-or-scoped
      authorization, descendant scope, sibling denial, pastoral-role denial,
      and immediate scoped-role revocation.
- [ ] Resource tests prove qualified-member request policy, privacy, conflict
      serialization, owner cancellation, independent global/scoped Admin
      actions, and disabled-by-default rollout.
- [ ] Operations governance inventory and DSR export/restrict/erase behavior cover member and organization-linked personal data.
- [ ] Account deletion diagnostics name the failing cleanup step internally, the evidenced root cause is fixed, and no failure deletes the Account.
- [ ] Audit owner and producer tests prove append-only catalog validation, transactional outboxes, idempotent retry, DSR metadata minimization, and owner-correct action names.
- [ ] Operations counted import matches the exported kernel counts and stable-ID digest.
- [ ] Bulletin tests prove authorization occurs before metadata, cache validators, ranges, derivatives, or bytes.
- [ ] Asset tests reject public grants for bulletin originals and derivatives.

### Gate C — Consumer Readiness

- [ ] Generated clients come only from the final Account, Operations, and Website OpenAPI contracts.
- [ ] The single published `frontend-platform` release contains both the
      shared auth runtime and final access contracts; no intermediate auth-only
      package is required by a consumer.
- [ ] Every browser adapter passes token single-flight, stale-token fencing,
      `401` one-refresh/one-retry, `403` no-refresh, and `429 Retry-After`
      cooldown conformance. Presenter Desktop passes the same semantics while
      retaining main-process `safeStorage`.
- [ ] Admin capability table exposes only each business-valid level: CMS `None | View | Edit | Publish`, Reservations `None | View | Approve`, Audit `None | View`, and an advanced read-only code view.
- [ ] Admin presents church-wide System Roles separately from Organization
      Responsibilities; the latter binds person, OrgUnit, fixed operational
      role, and effective period without action checkboxes.
- [ ] Bulletin-only staff see only bulletin navigation and common account links.
- [ ] Direct URL and API tests deny Page Settings, News, Campaigns, Operations, IAM, DSR, Asset Library, and Presenter administration.
- [ ] Global and scoped Meeting, Resource, Reservation, Membership, and
      Audit-only roles deny every sibling Admin route/API; scoped operational
      roles additionally deny sibling OrgUnits, and pastoral-only roles deny
      Operations mutations.
- [ ] All labels use `頁面設定`; the parent remains `網站內容`.
- [ ] Website, Account, Presenter, and LINE use the shared access projection or the protected feature API, not removed permission aliases.

### Gate D — Staging Cutover

- [ ] Run every authorization-matrix row with named test principals.
- [ ] Verify old public bulletin routes return a non-disclosing failure.
- [ ] Verify public bulletin grants reconcile to zero for originals and derivatives.
- [ ] Verify member revocation is effective without waiting for access-token expiry.
- [ ] Verify scoped operational-role revocation is effective without waiting
      for access-token expiry and global permission unavailability cannot be
      widened by a scoped role outside its Operations action/scope.
- [ ] Verify Account, Operations, Asset, and Website dependency failures deny protected access.
- [ ] Verify each deployed revision and immutable artifact independently.
- [ ] Verify Audit query routes and service-append routes cannot be confused, producer backlog drains without duplicates, and a 24-hour observation window passes.
- [ ] Verify DSR and permanent deletion share owner contracts but keep separate workflow/evidence, including owner partial failure and retry.

### Gate E — Production Authorization

- [ ] Obtain explicit authorization for merge/release and production mutation.
- [ ] Take reviewed backups for retained CMS and operations records.
- [ ] Record pre-cutover counts and stable-ID digests.
- [ ] Confirm roll-forward artifacts are ready; rollback must not restore public bulletin access.
- [ ] Invalidate test sessions only inside the approved coordinated window.

## Required Evidence Bundle

- [ ] Repository starting and released SHAs.
- [ ] PR and required CI result per repository.
- [ ] Published package versions and generated-client provenance.
- [ ] Permission, role, entitlement, route, and action-registry diffs.
- [ ] Operations export/import counts plus stable-ID digest.
- [ ] Zero legacy assignment-backfill report.
- [ ] Zero bulletin public-grant report, including derivatives.
- [ ] Positive and negative authorization-matrix report.
- [ ] Deployed revision, readiness, and same-origin route smoke per service.
- [ ] Authenticated Admin, Website, Account, Presenter, and real LINE-user evidence.
- [ ] Account deletion cleanup-step/root-cause evidence and final DSR owner matrix.
- [ ] Audit catalog checksum, producer coverage matrix, backlog/dead-letter state, query isolation, and 24-hour observation sign-off.
- [ ] Meeting/media Phase 1 SLO, infected/failure, schedule propagation, scale-to-zero, cost, and installed-device acceptance.

## Spec Acceptance Traceability

| Spec acceptance | Implemented and verified by |
| --- | --- |
| Distinct staff, organization, qualification, entitlement, audience, and workflow meanings | Account Tasks 2-3; Operations Tasks 2-5; Bulletin Task 7 |
| No broad CMS scopes or compatibility fallbacks | Account Tasks 1-4; Bulletin Task 1; Frontend Tasks 1-2; Cutover Tasks 1-2 |
| AuthN/AuthZ one-way dependency and stable recovery | Account Task 4; Auth Convergence Tasks 1-3; Frontend Task 1; Cutover Tasks 4, 9 |
| Independent Page Settings, News, Bulletin, Operations, and Membership administration | Account Tasks 1-2; Bulletin Task 1; Frontend Tasks 2-5 |
| Independent Meeting, Resource, Reservation, Membership, and Audit administration | Account Tasks 1-2; Operations Task 6; Audit Tasks 2-4; Frontend Tasks 2-5 |
| Embedded CMS files need no human Asset permission | Bulletin Tasks 1 and 4; Gate B and Gate C |
| Typed OrgUnit hierarchy and scoped leadership | Operations Tasks 2-3 |
| Church-wide staff RBAC plus scoped Operations responsibilities | Account Tasks 1-4; Operations Tasks 3-4 and 6; Frontend Tasks 1-5; Cutover Tasks 1-4 and 9 |
| Qualification independent from Account/Admin/email verification | Account Task 3; Operations Tasks 3-4 |
| Independent Traditional, Simplified, and English bulletin entitlements | Operations Tasks 3-4; Bulletin Tasks 2-3 |
| All historical electronic bulletins protected | Bulletin Tasks 3-5; Cutover Tasks 2, 6, and 8-9 |
| No legacy assignment migration; retained domain data preserved | Account Task 2; Operations Tasks 6-7; Cutover Task 6 |
| Shared presentation projection plus independent API enforcement | Operations Task 4; Frontend Tasks 1-8; runtime matrix |
| Permanent deletion and DSR owner cleanup are observable, idempotent, and fail closed | Legal Tasks 6-7; Operations Task 5; Cutover DSR gate |
| Central Audit preserves domain ownership and exact query isolation | Audit Tasks 1-5; staging and observation gates |
| Entitlement-based Email/Web Push audience | Bulletin Task 7 |
| Multi-agent repository ownership without parallel incompatible rollout | Plan ownership table; all PR/release stop gates |
| No generic authorization service or policy DSL | Global constraints; Operations Tasks 1 and 4 |

## Final Completion Rule

This program is complete only when every subplan is checked, every required CI and release is independently green, the staging and production authorization matrices pass, retained-data counts reconcile, public bulletin grants are zero, old routes fail closed, and real-client checks succeed. A green unit test, PR, package, deployment, or synthetic probe alone is not completion.

## Post-Launch Registry

- FunBIZ donation (`01a02372-2d23-7191-91fc-9f76dab78e4a`): planning evidence only. Revalidate provider contract, Sandbox, bank/egress prerequisites, accounting owner, receipt, and tax-export boundary before creating `donation-api` or `donations:*` permissions.
- Structured bulletin reader (`01a02027-773d-7822-9c45-83b8f5ccf894`, historical plan commit `20df37b`): rebaseline after this cutover. Keep CMS extraction/editor work where still valid; replace public discovery/SEO/offline assumptions with protected member routes, consume the shared AuthN runtime, and reuse the final DSR owner contract. It is not a pre-launch acceptance row.
