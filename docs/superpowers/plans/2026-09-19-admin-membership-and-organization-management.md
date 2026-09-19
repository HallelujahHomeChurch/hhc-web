# Admin Membership, Organization, And First-Entry Auth Recovery Plan

> **Status:** Product direction and implementation are approved. Phase 0–6
> code, CI, releases, and reviewed test-stage data setup are complete. The
> intentionally deferred cold-login, scoped-account browser, DSR/governance,
> Audit observation, and device evidence remain open for final integrated
> verification; they are not inferred from automated tests.

**Goal:** Repair the first-entry Website -> Account/Admin authentication
regression first, then replace the current test-stage membership and
organization model with the approved church-scoped model and align the Admin
layout without weakening authorization or protected bulletin access.

**Product decisions:**
[2026-09-19-admin-membership-and-organization-management-decision-record.md](../specs/2026-09-19-admin-membership-and-organization-management-decision-record.md)

**Parent architecture:**
[2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Implementation Evidence

| Phase | State | Evidence |
| --- | --- | --- |
| 0 | Released; Gate R pending | `frontend-platform` 1.0.9 and Account/Admin/Website consumers are released; the user deferred the cold first-entry matrix until the full plan is ready. |
| 1–2 | Released; restore artifact evidence open | Operations [#26](https://github.com/HallelujahHomeChurch/operations-api/pull/26)–[#31](https://github.com/HallelujahHomeChurch/operations-api/pull/31) replaced the test membership model, preserved retained Operations records, removed the fixed Phase 1 fixtures, and deployed `operations-api--0000016`. The separate pre-cutover counted export/restore artifact was not retained and remains explicitly unchecked below. |
| 3 | Released | Account [#100](https://github.com/HallelujahHomeChurch/account-api/pull/100) and [#101](https://github.com/HallelujahHomeChurch/account-api/pull/101) released the exact Account resolver and bounded label lookup. |
| 4 | Published | `frontend-platform` [#66](https://github.com/HallelujahHomeChurch/frontend-platform/pull/66) and [#67](https://github.com/HallelujahHomeChurch/frontend-platform/pull/67) published 1.0.10 and 1.0.11. |
| 5 | Released; scoped-browser evidence pending | Admin [#113](https://github.com/HallelujahHomeChurch/admin-fe/pull/113), [#114](https://github.com/HallelujahHomeChurch/admin-fe/pull/114), and [#115](https://github.com/HallelujahHomeChurch/admin-fe/pull/115) implement the membership/organization workspace and complete layout/action alignment. The final action-convention merge `a6598f6` passed release run `35467794596`; the production Admin origin returned `200` with the new index. |
| 6 | Complete | Production read-back shows both church roots, the reviewed family/small-group chain, and `rayselfs@gmail.com` bound to Taipei, the family, and the small group without an implicit responsibility or bulletin entitlement. |

## Non-Negotiable Constraints

- Phase 0 is the only first implementation phase. Its code, CI, release, and
  health checks complete before membership, organization, or layout work. At
  the user's direction, the cold first-entry matrix is deferred to final
  integrated acceptance; it remains open and cannot be inferred from automated
  tests or a warm browser session.
- AuthN stays independent of product permissions and capabilities. Empty
  `permissions: []` remains authenticated. One `401` may coordinate one refresh
  and one retry; `403` never refreshes, signs out, or restarts login.
- Gateway and domain APIs enforce authorization. Frontend checks control only
  discovery and UX.
- Weekly bulletins remain protected for the entire rollout. No public grant,
  public route, legacy `cms:*` compatibility, or OAuth bulletin scope returns.
- Existing HHC Account is required before Member creation. Account-optional
  members are a preserved seam, not current scope.
- The released `account-api` User/Account model and all registered Account data
  are immutable inputs to this plan. Do not delete, transform, re-key, or
  backfill them. Account work is limited to the smallest read-only private
  identity lookup contract.
- Member self-application and the social-login visual style are out of scope.
  Membership requests originate only from authorized Admin organization flows.
- This is a direct break change only for test-stage Operations membership and
  organization data. Do not add dual-read, data backfill, compatibility aliases,
  or legacy status mapping. Inventory non-test Operations references before
  cleanup so Meetings, Resources, attendance, audit, retained legal records,
  and every Account record are not erased.
- Reuse the existing Admin shell, Header SearchBar, shared selectors, page
  actions, and back button. Do not introduce a second design system, search
  framework, or generic workflow engine.
- Each repository uses its own branch, PR, CI, merge, release, and live proof.
  A consumer cannot merge before its producer contract is released.

## Expected Existing Working Set

Recheck each path against fresh `origin/main`; this is a focused change map,
not permission to scaffold parallel implementations.

- `frontend-platform`: `packages/account-client/src/browser-runtime.ts` and its
  tests/conformance cases, package manifests, and packed-consumer checks.
- `account-fe`: `src/auth/auth-context.tsx` and its test plus package lock.
- `admin-fe`: `src/App.tsx`, `src/components/AppLayout.tsx`,
  `src/lib/operations-api.ts`, membership pages, `OrgUnitPage`, locale files,
  shared selectors/styles, and their focused tests.
- `hhc-web`: browser bootstrap/account controls and their tests plus package
  lock; do not modify bulletin access policy to fix AuthN.
- `operations-api`: `internal/membership`, `internal/operations`,
  `internal/access`, membership/access HTTP handlers, PostgreSQL repositories,
  DSR, audit/outbox fixtures, migrations, and `openapi.yaml`.
- `account-api`: `internal/handlers/admin_user_handler.go`, routes, bounded
  membership-directory tests, and `docs/openapi.yaml`.
- `api-gateway`: route/OpenAPI policy only for new public Admin Operations
  routes that the inventory proves are missing. The Account resolver remains a
  private service-to-service route.

Current schema inspection confirms one `operations-api` schema migration is
required: the deployed model stores Account `user_id` directly and has no
stable Member, ChurchMembership, transfer, or church-root constraints. Do not
reserve its number in advance; fetch first and use the next available number.
No `account-api` data/schema migration is authorized by this plan.

## Phase 0 — Repair Cold First-Entry Authentication

This phase resumes the paused isolated worktrees. It fixes the root race once
in the shared runtime and adds only the consumer bootstrap behavior each host
needs. Do not patch the callback screen, add retries, or hide the login page
with timeouts.

### 0.1 Reconcile The Shared Runtime Release

**Repository:** `frontend-platform`

- [x] Review the already merged/published `1.0.9` change against the invariant:
      after OAuth code exchange, an older in-flight anonymous revalidation must
      settle before one fresh session revalidation begins.
- [x] Verify single-flight token refresh, stale-token fencing, `429 Retry-After`
      cooldown, hosted login, empty-permission authentication, and `403`
      behavior remain unchanged.
- [x] Run the auth runtime tests, package build, packed-artifact inspection, and
      consumer conformance fixture against the published immutable package.
- [x] If `1.0.9` differs from the reviewed root fix, publish a new patch through
      the normal PR/release flow; never replace `1.0.9` in place.
      It matched, so no replacement package was published.

**Stop gate:** A package version and digest are recorded. Passing package tests
is not product acceptance.

### 0.2 Finish The Three Browser Consumers

**Repositories, in order:** `account-fe`, `admin-fe`, `hhc-web`

- [x] Start from each current `origin/main`; compare the paused worktree diff
      before carrying forward only still-needed changes.
- [x] Pin the same reviewed auth package version in each manifest and lockfile.
- [x] Account: keep the required-auth shell in a bootstrap state until the
      first runtime observation resolves; do not render the credential page
      from an interim anonymous event when a hosted callback/session recovery
      is still in progress.
- [x] Admin: consume the fresh post-exchange result and preserve the existing
      behavior: unauthenticated users go to hosted login; authenticated users
      without Admin capability return immediately to Website; no standalone
      “HHC 管理中心需要登入” interstitial is restored.
- [x] Website: preserve optional-auth rendering and avatar/menu recovery; do
      not make page rendering depend on permission transport success.
- [x] Add one focused regression test per affected consumer. Do not duplicate
      the shared runtime state machine in application code.
- [x] Run each repository's full test, lint, typecheck/build, PR, CI, merge,
      release, revision, and health checks separately.

### 0.3 Cold Live Acceptance Matrix

- [ ] Sign out completely, then sign in from Website using a real hosted login.
- [ ] On the **first** navigation to Account profile, verify no login page or
      credential-shaped frame appears, even briefly.
- [ ] On the **first** navigation to Admin, verify no “OAuth 回呼失敗”, retry
      card, standalone login page, or second provider prompt appears.
- [ ] Verify an authenticated user without Admin access returns to Website and
      does not see protected Admin content.
- [ ] Verify Account -> Admin -> Website and sign-out propagation after the
      cold entries. A second warm visit is supplementary, never a substitute.
- [ ] Correlate browser requests and server logs: one successful code exchange,
      no reuse of a consumed callback, product-local session established, and
      no refresh loop.
- [ ] Re-run anonymous, unentitled, entitled, revoked, and unavailable weekly
      bulletin checks. Protected responses remain `private, no-store`; denied
      content remains non-disclosing.

**Gate R:** Only this exact real-browser matrix closes the authentication
workstream. The production code/release portion of Phase 0 may unblock later
implementation, but final completion remains blocked until this matrix passes.
If it fails during final acceptance, stop release closure and fix the shared
root cause before declaring the program complete.

## Phase 1 — Freeze The Replacement Domain Contract

**Repositories:** documentation in `hhc-web`, then OpenAPI owners

- [x] Reconcile the parent architecture spec with the approved decision record.
      Remove the active canonical use of `organization`, `congregation`,
      primary OrgMembership, `MembershipQualification`, administrator-entered
      `valid_from`/`valid_to`, and a separate Organization Responsibility page.
- [x] Freeze these aggregates:
  - `Member`: stable domain identity, currently bound one-to-one to an existing
    `account_user_id`;
  - `ChurchMembership`: one active church per Member, including pending and
    transfer lifecycle;
  - `OrgMembership`: zero or many family, small-group, and fellowship bindings
    within the active church;
  - `OrgRoleAssignment`: explicit scoped responsibility, assigned/revoked with
    system audit timestamps but no administrator-entered effective period;
  - `EntitlementAssignment`: person-level grant, effective only while church
    membership is active. Store `member_id` internally; private checks accept
    the trusted Account subject and resolve it through `Member.account_user_id`;
  - `MembershipTransfer`: dual-approval cross-church move.
- [x] Freeze OrgUnit kinds and parents: `church`; `family -> church`;
      `small_group -> church|family`; `fellowship -> church`.
- [x] Freeze role names and exact scope rules for global membership manager,
      church membership manager, family leader, small-group leader, and
      fellowship leader. Keep Meeting, Resource, and Reservation roles
      independent. A pastoral title grants no management action implicitly.
- [x] Freeze the technical ownership without exposing it as administrator API
      knowledge:
  - Account keeps the existing global `membership_manager` role bundle over
    `memberships:read` and `memberships:manage`; Global Administrator `*`
    satisfies the same membership actions while retaining its distinct role;
  - Operations owns scoped `church_membership_manager`, `family_leader`,
    `small_group_leader`, and `fellowship_leader` assignments;
  - scoped assignment codes never enter JWT permissions and never grant
    Meeting, Resource, or Reservation actions;
  - `pastor` remains a separate pastoral responsibility and grants no roster or
    structure action unless an explicit management assignment is also present.
- [x] Freeze admission, exact-email lookup, batch, archive/delete, move, and
      transfer state/error contracts.
- [x] Preserve the private entitlement-check wire contract consumed by
      `hhc-web-api`: trusted Account subject in, bounded entitlement decisions
      out, with stable non-disclosing membership denial reasons. Resolve the
      Account-to-Member change inside Operations so bulletin code does not need
      an unrelated rewrite.
- [x] Freeze minimal Account lookup data: Account id, email, and display name
      only. No MFA, device, provider, global RBAC, or entitlement data crosses
      the boundary.
- [x] Update generated-client/OpenAPI drift gates before implementation begins.

**Gate A:** Design, SQL invariants, routes, error codes, audit events, DSR
ownership, and release compatibility are reviewed together. No repository may
invent its own interpretation afterward.

## Phase 2 — Replace Operations Membership And Organization Storage

**Repository:** `operations-api`

### 2.1 Inventory And Breaking Migration

- [x] Export a read-only inventory of OrgUnits and every foreign-key/reference
      owner before writing the migration. Classify test membership/organization
      rows separately from retained Meetings, Resources, reservations,
      attendance, audit, and legal records.
- [ ] Produce a counted export of every affected Operations table and rehearse
      restoring it in a non-production database before approval to run the
      destructive migration. Record counts, stable-ID digest, backup location,
      retention, and restore evidence without exposing personal data.

> **Evidence gap:** the released migration was transactional and its retained-
> data behavior is covered by PostgreSQL regression tests, but no separate
> pre-cutover export/restore artifact was retained. That historical evidence
> cannot be reconstructed or marked complete after the cutover; current-state
> backup validation belongs to final operational verification.
- [x] Add exactly one focused Operations schema migration for stable `Member`,
      one active ChurchMembership, church roots, removal of
      MembershipQualification, and transfer state. It directly replaces
      test-stage membership structures and performs no Account/User migration
      or legacy assignment conversion/backfill.
- [x] Add the replacement tables and database constraints: unique Account
      binding, one active ChurchMembership per Member, allowed parent kinds,
      same-parent/kind/name uniqueness, and optimistic versions.
- [x] Replace the single organization-root tree with a church-root forest.
      Every family, small group, fellowship, membership, and responsibility
      resolves to exactly one church; cross-church ancestry is impossible.
- [x] Remove legacy qualification, primary-membership, congregation, validity,
      and `left` live-state semantics. Preserve immutable audit facts rather
      than keeping a selectable “已離開” status.
- [x] Generate stable opaque internal OrgUnit codes server-side. Do not accept
      or expose them in Admin create/list contracts.
- [x] Directly remove the known `phase 1 驗收` test data. Do not silently delete
      any retained operational reference found by the inventory gate.
- [x] Fail the migration preview if any removal or constraint change would
      delete, orphan, re-key, or rewrite registered Accounts or retained
      Meeting, Resource, reservation, attendance, audit, DSR, or legal data.
- [x] If a legacy OrgUnit is referenced by retained operational data, stop at
      this gate and produce an explicit per-unit preservation/mapping proposal
      for user approval. Do not silently delete, archive, rename, or remap that
      live relationship merely to make the new hierarchy pass.

### 2.2 Organization And Member Services

- [x] Implement church-first list/detail plus scoped family, small-group,
      fellowship, member, and responsible-person views.
- [x] Implement atomic multi-row OrgUnit creation, including references to an
      earlier new family in the same request. Reject duplicate sibling
      kind/name, invalid parents, cycles, and silent substitution of an existing
      unit; return row-addressable validation details and create all or none.
- [x] Implement rename, same-church small-group move, archive/restore, and
      never-used hard delete with preview/conflict responses.
- [x] Archived units reject new membership, responsibility, Meeting, and
      Resource writes while remaining resolvable from history. Archive never
      silently cascades to children or active relationships.
- [x] Implement Member batch creation with row-level idempotency and partial
      success; one batch targets one church and may include initial placement.
      Block duplicate Accounts in one batch; keep successful rows complete,
      retry failed rows only, reuse an existing pending request, report an
      existing active membership idempotently, and require transfer for another
      active church.
- [x] Implement add/remove organization binding and assign/revoke responsibility
      as immediate state changes with actor, timestamp, request id, version,
      before/after audit, and outbox event.
- [x] Prevent orphaned child placement. Removing a family binding with active
      child-small-group bindings returns a preview and requires explicit child
      remove/move/cancel choices applied atomically. Moving a small group into
      a family adds missing parent-family memberships but never removes other
      valid family memberships.
- [x] Implement pending church-membership request approval/rejection and
      dual-approval transfer. Transfer completion atomically removes source
      placement/responsibility, activates target membership/placement, and
      preserves person-level entitlements.
- [x] Allow either source or target Church Membership Manager to initiate a
      transfer; require approval from the other side. Global Administrator or
      Global Membership Manager may direct-complete a correction only with an
      audited reason. Enforce one in-progress transfer per Member.

### 2.3 Scoped Authorization And Search

- [x] Global Administrator can manage all levels and has global member
      management. Global Membership Manager manages all churches' members and
      church/family/small-group/fellowship structures, including church-root
      lifecycle management.
- [x] Church Membership Manager manages membership and descendant structures
      inside the assigned church. Family leader manages that family roster,
      descendant small-group rosters/leaders, and may submit/view/cancel its own
      pending requests. Small-group and fellowship leaders manage only their
      own rosters and may submit/view/cancel their own requests. Only global or
      target-church membership authority may approve/reject church membership.
- [x] Only Global Administrator may grant Global Membership Manager. Global
      Membership Manager may assign church and lower responsibility; Church
      Membership Manager may assign lower responsibility in its church; Family
      leader may assign child-small-group responsibility. Assignees must be
      active Members of the target church; multiple responsible people are
      allowed.
- [x] Enforce candidate domains server-side: family from active church members;
      family child small group from active family members; direct church small
      group/fellowship from active church members.
- [x] Provide route/tab-scoped list search and a separate exact-email Account
      resolution action. Never implement a global omnibox or allow a lower
      manager to enumerate other scopes.
- [x] Expose the scoped membership-management portion of
      `/api/operations/me/access`; keep Account permissions opaque and do not
      place OrgUnit scope in JWT permissions.
- [x] Preserve separate Meeting/Resource/Reservation authorization branches.

### 2.4 Entitlement, DSR, And Audit Adaptation

- [x] Replace `MembershipQualification` checks with active ChurchMembership in
      entitlement checks, Resource eligibility, paper distribution, and future
      member workflows.
- [x] Replace legacy `user`, `org_members`, and `qualification_bundle`
      entitlement subjects with the reviewed direct Member grant for current
      bulletin locale actions. Do not add speculative group-derived grant rules
      until a concrete product workflow requires them.
- [x] Keep the three bulletin locale entitlements and make them ineffective,
      not deleted, when church membership is inactive.
- [x] Update Operations DSR export/restrict/erase behavior for Member,
      membership, responsibility, transfer, and entitlement records. Shared
      OrgUnits and retained audit facts are not deleted with one person.
- [x] Publish all mutations through the existing outbox/audit producer and
      verify no pending/dead-letter regression.

**Gate B:** Migration and repository tests, OpenAPI validation, direct-API
positive/negative scope matrix, DSR tests, audit/outbox tests, counted export,
restore rehearsal, and a counted test-data reset pass. Keep the Operations PR
unmerged until the Account private resolver in Gate C is released; Operations
must not consume an unavailable producer.

## Phase 3 — Add The Minimal Account Resolution Boundary

**Repository:** `account-api`

- [x] Reuse the existing membership-directory query implementation where it
      already satisfies the minimal response. Do not grant scoped leaders the
      global `memberships:read` permission.
- [x] Add or narrow an allowlisted private Operations -> Account exact lookup
      contract for Account id/email/display name. Operations authorizes the
      caller's scope before exposing any candidate result through its Admin API.
- [x] Keep broad global membership search behind global Account membership
      authority; church/lower scoped list search comes from Operations-owned
      Member and relationship data.
- [x] Require exact normalized email for outside-scope lookup; rate limit,
      audit, and return a non-enumerating result.
- [x] Verify Gateway strips caller-supplied identity/service headers and does
      not expose the private Account resolver publicly.

**Gate C:** Wrong caller, cross-scope enumeration, guessed email, missing
Account, duplicate binding, permission-unavailable, and DSR/log-redaction tests
pass before Operations consumes the contract in production.

## Phase 4 — Publish Shared Contracts And Access Presentation

**Repository:** `frontend-platform`

- [x] Regenerate the Operations client from the released contract and remove
      legacy qualification, congregation, primary, validity, and `left` models.
- [x] Extend the shared destination/access resolver only with presentation-safe
      scoped Admin destinations. `hasPermission()` remains generic
      list/wildcard logic and learns no church role or entitlement semantics.
- [x] Keep the auth runtime unchanged after Phase 0 unless a conformance failure
      proves a transport defect.
- [x] Publish one versioned package set and record tarball contents/digests.

**Gate D:** Package tests and Account/Admin/Website consumer conformance pass;
no product domain is imported into AuthN.

## Phase 5 — Align Admin Information Architecture And Layout

**Repository:** `admin-fe`

### 5.1 Shared Admin Chrome

- [x] Centralize route/tab search metadata in the existing Admin Header
      SearchBar. Use one URL key, `q`; query changes preserve filters/sort,
      reset pagination, and use URL replace. Tab changes clear `q`.
- [x] Search remains route/tab scoped and renders results in the page table.
      Keep the existing debounce, clear action, mobile overlay, and accessible
      labeling. Hide it on create/edit/callback/error/confirmation and other
      non-searchable pages.
- [x] Normalize all current create actions—News, Bulletins, Newsletter,
      Schedule, Roles And Permissions, Organization Units, Meetings, Resources,
      LINE Media Sync, Membership—and the reusable list-page pattern to icon
      plus `建立`.
- [x] Normalize editor primary actions on desktop through the existing shared
      action/button pattern: icon plus generic `儲存`, `發布`, and other actual
      verbs. Do not repeat the current domain in labels (`儲存週報`,
      `儲存最新消息`, and similar forms are forbidden). Inventory every current
      icon-only editor action so this is global rather than page-by-page drift.
- [x] Normalize destructive actions through the same shared action definition:
      Trash icon plus `刪除`, or plus `永久刪除` when irreversibility is the
      material distinction. Use `移除` for a nested unsaved form item. Do not
      generate domain-repeated labels such as `刪除週報` or `刪除最新消息`.
- [x] Enforce one placement rule for existing and future pages:
  - persisted editor/resource deletion lives in a visually separated danger
    section at the end of the editor, never in the top-right Save/Publish group;
  - list-row deletion is the final control in the rightmost action column,
    after view/edit;
  - nested-item removal is the trailing action in that item/card header;
  - bulk deletion exists only in the selection action bar after selection.
- [x] Require confirmation for every persisted server-side delete. The confirm
      button uses the same Trash icon plus destructive text and is never
      icon-only. Keep archive/restore separate; used records follow the domain's
      archive rule instead of exposing an unsafe hard delete. Desktop danger
      sections place explanatory consequences on the left and the destructive
      action on the right. Dialog footers place `取消` before the rightmost
      destructive confirmation.
- [x] On constrained mobile layouts, icon-only is allowed only through the same
      shared action definition with an accessible name, tooltip, consistent
      order, disabled/loading state, and destructive-action distinction.
      Confirmation buttons remain text-visible on every viewport.
- [x] Remove redundant list-page title/description blocks; retain semantic
      document headings for accessibility without visual duplication.
- [x] Replace page-local selector implementations with the existing shared
      selector component and use the existing back-button pattern.

### 5.2 Organization Management

- [x] Show churches as the first level. Entering a church opens tabbed family,
      small-group, fellowship, member, and responsible-person tables with the
      standard back action.
- [x] Add a dedicated multi-row OrgUnit create page. Hide internal codes and
      submit one atomic graph request.
- [x] Integrate responsible-person assignment into the relevant organization
      and member views; do not restore a separate Organization Responsibility
      route or navigation item.
- [x] Add rename, move preview, archive/restore, and constrained delete flows
      only for actors whose backend access projection permits them.

### 5.3 Membership Management

- [x] Add a dedicated multi-row Member create page with Account resolution,
      one target church, and optional initial family/small-group/fellowship
      placement. Do not place entitlement or responsibility grant controls in
      this batch page. Only global/church membership authority uses this direct
      active-member flow; lower leaders use their scoped roster add/pending
      request flow.
- [x] Replace the current qualification/primary/date/left editor with clear
      sections for church membership, organization affiliations,
      responsibilities, and entitlements.
- [x] Add pending-request approval, removal confirmation, responsibility
      assignment, and transfer screens with scope-aware actions and conflict
      recovery.
- [x] Route a user with one scoped assignment directly to it; show “我管理的組織”
      when multiple assignments exist. Keep all experiences inside the same
      Admin Console.
- [x] Show no Account security, global RBAC, unrelated church, or sibling data
      to scoped leaders. Frontend hiding is supplementary to API enforcement.

### 5.4 Admin Verification

- [ ] Test every route directly, after reload, and through navigation for:
      global Administrator, global Membership Manager, church manager, family
      leader, small-group leader, fellowship leader, unrelated Member, and
      authenticated non-Admin.
- [ ] Test desktop/mobile Header SearchBar, keyboard/focus/accessibility,
      pagination/filter preservation, tab query clearing, empty/error states,
      batch partial success, atomic OrgUnit failure, and optimistic conflict.
- [x] Add a shared-action inventory/regression test proving every Admin editor
      displays icon + generic action text at desktop width, retains an
      accessible name at constrained width, and never generates a domain-
      repeated label.
- [x] Cover destructive placement in the same inventory: editor danger section,
      row-action ordering, nested `移除`, selection-only bulk delete,
      confirmation, and the absence of Delete beside Save/Publish.
- [x] Verify previously completed PR #110 behavior is retained and not
      reimplemented.

**Gate E:** Full Admin tests/lint/build, PR/CI/release, deployed revision, and
real scoped-account browser verification pass.

## Phase 6 — Seed The Reviewed Test-Stage Structure

**Owners:** released `operations-api` contract and `admin-fe`; use the normal
reviewed Admin API/UI with idempotency and audit, never ad hoc production SQL
or a new one-off seed framework

- [x] Create churches `台北家教會` and `中壢家教會`.
- [x] Create `學青二姐家族` under `台北家教會`.
- [x] Create `家瑾腳步使命必達` under that family.
- [x] Resolve the existing `rayselfs@gmail.com` Account, create/confirm its
      Member and active Taipei church membership as needed, add family parent
      eligibility, then bind it to the small group.
- [x] Reconcile counts, parents, one-active-church constraint, audit events,
      and access projection. Do not grant responsibility or bulletin locale
      entitlement implicitly.

**Gate F:** Read-back through the released API and Admin UI matches the exact
reviewed structure; retrying an already completed create/bind is idempotent.

## Phase 7 — Cross-Repository Release And Regression Closure

Release order is strict:

1. Phase 0 shared package verification/release if needed;
2. `account-fe`, `admin-fe`, and `hhc-web` Phase 0 consumer releases and health
   checks; keep the cold first-entry Gate R open for the final integrated live
   acceptance requested by the user;
3. frozen documentation/OpenAPI contracts;
4. prepare all remaining producer/consumer PRs, CI, migration preview, restore
   rehearsal, generated packages, and release runbooks without merging a
   consumer ahead of its producer;
5. `account-api` private lookup boundary;
6. `operations-api` replacement model, Account resolver consumption, and
   access projection;
7. `api-gateway` only if new Admin Operations routes are missing from the
   existing allowlist;
8. `frontend-platform` generated client/access package;
9. `admin-fe` layout and workflows;
10. create the reviewed initial structure through released Admin APIs;
11. complete Gate R plus authorization, DSR, Audit, protected-bulletin, and
    live browser matrices.

Because the user explicitly chose a direct test-stage break change, the
Operations schema/API replacement and the new Admin membership consumer cannot
be made zero-downtime without temporarily preserving the old contract. Do not
add that compatibility layer. Use a reviewed, bounded maintenance window for
only the Admin membership/organization surfaces, release Operations and Admin
back-to-back, and keep Website, Account, hosted login, bulletin access, and
unrelated Admin pages available. Start that window only after every downstream
PR, package, CI gate, runbook, migration preview, and restore rehearsal is
ready. Before database commit, rollback is transactional; after commit, prefer
a reviewed forward fix, or restore the counted Operations export when forward
recovery is unsafe. Never describe an application rollback as data recovery.

At every repository boundary record branch, PR, CI, merge SHA, artifact/package
version, deployed revision, health, and live proof independently. Stop on an
unexpected migration plan, permission drift, private-route exposure, audit
backlog, failed cold login, or bulletin-public regression.

## Review Traceability And Completion Gate

### Original Brief Mapping

| Request | Planned owner |
| --- | --- |
| 1. All create buttons use icon + `建立`, including future pages | Phase 5.1 reusable list-page action pattern |
| 2. Remove redundant page title/description | Phase 5.1 shared Admin chrome |
| 3. Dedicated batch OrgUnit create page; hidden generated code | Phases 1, 2.1-2.2, 5.2 |
| 4. Remove test/congregation data; create reviewed church/family/group structure and bind the Account | Phases 2.1 and 6 |
| 5. Church-first navigation, child tables, back action, and responsible-person shortcut shared with Member data | Phases 2.2-2.3 and 5.2 |
| 6. Reuse shared selectors | Phase 5.1 and scoped candidate API in Phase 2.3 |
| 7. Compact Membership page and dedicated multi-member creation with initial placement | Phases 2.2 and 5.3 |
| 8. Retain scoped pending approval; remove confusing `left` editing and constrain manager scope | Phases 1, 2.2-2.3, 5.3 |
| 9. Integrate responsible people and enforce family/child management rules | Phases 1, 2.3, 5.2-5.3 |
| 10. Remove administrator-entered start/end dates | Phases 1, 2.1, 4, 5.3 |
| 11. Reach product decisions before implementation | Decision record plus this approval stop |
| 12. Review adjacent improvements | Batch idempotency, archive/delete, transfer, privacy, DSR, Audit, accessibility, and bounded maintenance gates |
| First Account/Admin entry regression | Phase 0, before every row above |
| One shared, route-scoped Admin Header SearchBar | Phases 2.3 and 5.1 |
| Restore desktop editor actions from icon-only to icon + generic verb | Phase 5.1 shared action inventory and regression tests |
| Standardize Delete as icon + semantic text and one placement hierarchy | Phase 5.1 destructive-action contract and regression tests |

Before requesting implementation approval, the documentation owner must pass
all of these reviews:

- [x] every one of the original twelve Admin requests maps to an explicit task
      or explicit non-goal;
- [x] every confirmed decision in the 2026-09-19 decision record maps to a data
      invariant, API enforcement point, UI behavior, and test where applicable;
- [x] no active plan recreates Organization Responsibility, congregation,
      MembershipQualification, primary membership, administrator-entered
      validity, or `left` as a live editing state;
- [x] completed PR #110/#111 work is not duplicated;
- [x] AuthN/AuthZ dependency remains one-way and Phase 0 does not broaden OAuth
      scopes, CORS, cookies, or retry semantics;
- [x] lower-scope managers cannot enumerate Accounts or members outside their
      approved candidate domain;
- [x] Meeting/Resource/Reservation roles remain independent from roster and
      responsibility management;
- [x] DSR, Audit, history, optimistic concurrency, and archived-reference
      behavior cover every new aggregate and mutation;
- [x] Account/User schema and registered Account row checksums/counts remain
      unchanged; no Account migration is present;
- [x] release order exposes no consumer before its producer and keeps current
      Website, Account, hosted login, and unrelated Admin service usable; the
      approved direct break uses only the documented bounded membership/org
      maintenance window;
- [x] weekly bulletins remain protected before, during, and after every phase;
- [x] active plans and the execution ledger identify Gate R as reopened until
      the exact cold first-entry matrix passes;
- [x] repository links, file references, Markdown, and `git diff --check` pass.

Implementation is complete only after every phase gate and the parent unified
authorization plan's remaining external/device gates pass. This plan alone
does not close the existing Audit observation, legal/DSR human review,
Presenter Desktop evidence, LINE real-user evidence, or meeting/media formal
acceptance.
