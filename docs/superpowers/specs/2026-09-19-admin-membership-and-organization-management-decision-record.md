# Admin Membership And Organization Management Decision Record

## Status

This document records the decisions confirmed during the 2026-09-19 Admin
Console design review. It preserves discussion state before implementation and
does not authorize application, API, data, release, or production changes.

It refines the membership and organization portions of
`2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md`.
Where the older document describes congregation nodes, primary pastoral
membership, administrator-entered validity periods, or a separate organization
responsibility page, this decision record is the newer product decision. The
canonical design and repository plans must be reconciled before implementation.

The social-login visual-style question is explicitly out of scope.

## Workstreams In Scope

The review has exactly three workstreams:

1. the twelve-point Admin layout, membership, and organization improvement;
2. the first-entry authentication regression when moving from Website to
   Account or Admin after signing in;
3. reuse of the existing Admin Header SearchBar for every page search.

The role, membership, organization, fellowship, approval, and delegation
decisions below refine workstream 1. They are not separate projects.

## Current Baseline

- Admin PR #110, `feat: unify member and organization management`, already
  removed the standalone organization-responsibility route and navigation and
  integrated responsibility controls into member and organization surfaces.
  This completed behavior must not be planned or implemented again.
- Admin PR #111 localized the resulting membership status labels.
- The Admin layout refinements in this document have not started.
- The authentication regression work is paused. The shared Account runtime
  root fix was prematurely merged and published as `frontend-platform` 1.0.9.
  Account has an unmerged bootstrap guard in an isolated worktree; Account,
  Admin, and Website consumer delivery is incomplete and not deployed as a
  completed fix.

## Admin Layout Contract

### Shared Page Chrome

- Message, Bulletin, Newsletter, Schedule, Roles And Permissions,
  Organization Units, Meetings, Resources, LINE Media Sync, Membership, and
  future Admin list pages use the existing Message-page creation-action
  pattern: icon plus `建立`.
- List pages do not render a redundant main title or description below the
  Admin shell.
- Every page search uses the existing Admin Header SearchBar component. Pages
  do not add a second search field.
- Domain filters and sorting remain page-local controls; they are not another
  search implementation.
- Selectors reuse the shared Admin UI selector components.
- Back navigation follows the existing Admin back-button pattern.

### Organization Unit Pages

- The organization-unit list initially shows churches.
- Entering a church opens its organization workspace, with scoped views for
  families, small groups, fellowships, members, and responsible people.
- Creation uses a dedicated page without a redundant title or description.
- One creation page may add multiple units.
- Internal codes are generated uniquely by the service, are stable, and are
  hidden from administrators and ordinary tables.
- The existing test unit named `phase 1 驗收` is removed.
- The `congregation` / `會堂` kind and its conditions are removed.
- Initial reviewed data is:
  - churches: `台北家教會`, `中壢家教會`;
  - family: `學青二姐家族`, under `台北家教會`;
  - small group: `家瑾腳步使命必達`, under `學青二姐家族`;
  - `rayselfs@gmail.com` is added to that small group after its Account and
    membership prerequisites are satisfied.
- A small group may belong directly to a church when it has no family.

### Membership Pages

- Membership uses the same compact list-page chrome and shared Header
  SearchBar.
- Creation uses a dedicated multi-row page.
- One batch targets one church.
- Every row resolves an existing HHC Account; unresolved accounts cannot be
  submitted as placeholder members.
- Initial organization placement may be selected during creation so an
  administrator does not need an immediate second edit.
- Responsibility and member-entitlement grants are not hidden inside bulk
  member creation.

## Domain Boundaries

The following remain separate even when shown on one screen:

1. Account identity and authentication;
2. Member domain identity;
3. church membership;
4. organization-unit membership;
5. organization responsibility;
6. member entitlement;
7. workflow records such as attendance or paper distribution.

### Account And Member

- An HHC Account must exist before a Member can be created.
- The service still keeps a stable Member domain identifier. Organization
  membership, responsibility, attendance, and physical workflows reference
  `member_id`, not `account_user_id` directly.
- For the current product rule, `Member.account_user_id` is required and
  unique.
- This seam permits a later reviewed change to account-optional members by
  relaxing the binding and adding Member-owned identity fields without
  rewriting organization and workflow relationships.
- No account-optional member flow is implemented now.

### Church Membership

- A Member may have one active church membership at a time.
- A Member may have zero or many organization-unit memberships inside that
  church.
- Moving to another church is a transfer, not simultaneous membership in two
  churches.
- Ending church membership removes active organization placement and
  responsibilities. Historical audit facts remain.
- Member-only entitlements remain recorded but are ineffective without active
  church membership.
- A transfer ends old organization placement and responsibility, activates the
  new church membership atomically, and preserves person-level entitlement
  records.

### Organization Unit Types

The reviewed tree is:

```text
church
├── family
│   └── small_group
├── small_group
└── fellowship
```

Allowed parent rules:

| Child | Allowed parent |
| --- | --- |
| `church` | none |
| `family` | `church` |
| `small_group` | `church` or `family` |
| `fellowship` | `church` |

`fellowship` is initially a leaf. A later confirmed need may allow a
fellowship to contain small groups without changing the scoped organization
model.

### Multiple Organization Memberships

- A Member may join multiple families, small groups, and fellowships in the
  same church.
- Organization membership itself grants no administrative permission.
- A small group under a family requires family membership as its parent
  eligibility.
- A direct church small group and a fellowship use church membership as their
  parent eligibility.
- Church-wide counts deduplicate by Member. Unit-level counts include the
  Member in every unit they actively belong to.

### Organization Unit Lifecycle

Renaming is allowed. The internal id and hidden code remain stable, existing
URLs and relationships continue to resolve, and the change is audited. Units
of the same kind under the same parent cannot share a name.

Changing an existing unit's kind is not allowed. An unused mistake may be
deleted and recreated; a used unit requires a new unit plus reviewed
relationship movement.

Within one church, a small group may move between families or between a family
and direct church ownership. The operation previews members, responsible
people, operational references, and missing new-parent eligibility. Moving a
small group into a family atomically adds missing new-family memberships. It
does not remove old-family memberships because a Member may belong to multiple
families.

Normal editing cannot move a family, small group, or fellowship across
churches. That would change the single-church membership invariant and requires
a separately reviewed structural migration.

A used unit is archived rather than deleted. An archived unit:

- is absent from normal active lists;
- accepts no new membership, responsibility, meeting, or Resource;
- remains resolvable by historical meetings, attendance, reports, and audit;
- appears through an archived filter;
- may be restored only while its parent is active and its constraints remain
  valid.

Archiving previews and requires explicit handling of children, active members,
responsible people, and unfinished operational records. It never silently
cascades.

Hard deletion is available only when a unit has no child, membership,
responsibility, Meeting, Resource, attendance, workflow, or historical
reference and has never been formally used. The known `phase 1 驗收` test data
is removed by the breaking seed/data cleanup; it does not justify unrestricted
production deletion.

Structure-management authority is:

| Actor | Structure authority |
| --- | --- |
| Global Administrator | churches and every descendant unit |
| Global Membership Manager | families, small groups, and fellowships in every church; not church creation or archival |
| Church Membership Manager | families, small groups, and fellowships in the assigned church |
| Family, small-group, or fellowship manager | no structure mutation by default |

Roster management and structure management are distinct capabilities. A
family manager does not automatically receive create, move, archive, or delete
authority over descendant small groups.

## Membership Admission And Candidate Search

### Admission Outcomes

| Candidate | Outcome |
| --- | --- |
| Active Member of the same church | authorized unit manager may add directly |
| Existing Account without church membership | create a pending church-membership request |
| Active Member of another church | reject normal add and require transfer |

Global and church membership managers may create active membership directly
inside their scope. Family, small-group, and fellowship managers cannot grant
church membership; they may submit the pending request tied to their desired
unit.

### Candidate Scope

| Target unit | Normal selector candidates |
| --- | --- |
| family | active Members of the same church |
| small group under family | active Members of the parent family |
| small group under church | active Members of the same church |
| fellowship | active Members of the same church |

A family manager who also manages a descendant small group may complete the
family and small-group additions together. A small-group manager cannot bypass
the parent family requirement.

Normal selectors expose only valid in-scope candidates. An exact full-email
Account lookup is a separate onboarding operation when no eligible Member is
found.

### Account Lookup Privacy

- Global Administrators may use the existing global Account-administration
  capability.
- Global Membership Managers may search Members globally and perform a minimal
  exact-email Account lookup for onboarding.
- Church Membership Managers may broadly search their church Members and use
  exact-email lookup for an Account outside their church.
- Family, small-group, and fellowship managers may broadly search eligible
  Members in their approved parent scope and use exact-email lookup only for a
  pending membership request.
- Minimal lookup results contain only display identity and the membership state
  needed to choose add, request, or transfer. They do not expose MFA, devices,
  login providers, unrelated Account RBAC, or entitlements.

The administrator-facing role bundle includes the required technical lookup
permission. Administrators never select raw API dependencies.

## Responsibility And Delegation

The UI calls this concept `負責人`, not `組織責任`. The data remains a scoped,
audited responsibility assignment and is editable from both Member detail and
organization detail.

### Effective Management Scope

- a family manager manages family membership and descendant-small-group
  membership inside that family;
- a small-group manager manages only that small group;
- a fellowship manager manages only that fellowship;
- a Member's memberships in other units do not widen or narrow the manager's
  authority;
- managers edit the relationship inside their scope, not the Member's Account,
  church membership, unrelated unit relationships, or entitlements.

### Assignment Authority

| Actor | May assign |
| --- | --- |
| Global Administrator | Global Membership Managers and every lower responsibility |
| Global Membership Manager | church, family, small-group, and fellowship responsibility in every church |
| Church Membership Manager | family, small-group, and fellowship responsibility in that church |
| Family manager | small-group responsibility under that family |
| Small-group or fellowship manager | no responsibility assignment by default |

A Global Membership Manager cannot create another Global Membership Manager;
only a Global Administrator can grant that global role. An assignee must be an
active Member of the target church. Multiple responsible people are allowed.
Removing the final responsible person warns but does not block. Every grant and
removal is audited.

Within membership management, a Global Administrator has the same effective
global membership capability as a Global Membership Manager, while retaining
its distinct higher-privilege role and audit identity.

### Scoped Admin Experience

Organization managers use the existing Admin Console; HHC does not create a
separate family or small-group administration product.

- a manager with one effective assignment may enter the assigned unit directly
  from Organization Units;
- a manager with multiple assignments first sees only `我管理的組織`;
- a family manager may manage family membership, descendant-small-group
  membership, and descendant-small-group responsibility;
- a family manager may submit a pending church-membership request for an
  existing HHC Account but cannot approve church membership;
- structure mutation, Account administration, entitlements, global RBAC, and
  unrelated organization data remain unavailable;
- Meeting, Resource, and Reservation actions still require their separately
  reviewed operational responsibility;
- Header SearchBar and every API list remain constrained to effective scope.

An organization responsibility may therefore permit entry to the relevant
scoped Admin surface even when the Account has no church-wide staff role. The
owning API remains the enforcement point.

## Church Transfer

Church transfer is Admin-only. There is no Member self-service transfer UI or
Account-side transfer state.

Because the Member does not confirm the transfer, one church cannot
unilaterally remove the Member from another church. Normal completion requires
both administrative sides:

```text
source church confirms release
AND target church confirms acceptance
```

- either source or target Church Membership Manager may initiate;
- when source initiates, target approval remains;
- when target initiates, source approval remains;
- a Global Administrator or Global Membership Manager may complete a reviewed
  correction directly after recording a reason;
- when either church has no Membership Manager, a global membership authority
  may act for that side;
- one Member may have only one in-progress transfer.

Transfer states are limited to:

```text
pending_source_approval
pending_target_approval
completed
rejected
cancelled
```

Until completion, the Member remains fully attached to the source church.
Rejection or cancellation changes no membership facts. Completion atomically
ends source-church membership, organization memberships, and responsibilities;
creates target-church membership and reviewed initial organization placement;
preserves person-level entitlements; refreshes the access projection; and
records both church scopes in audit. A completed transfer is not reverted by
changing its status; a reverse move is a new transfer.

## Binding Lifecycle

Administrator-facing relationship actions are only:

```text
加入 / 移除
指派負責人 / 解除負責人
```

Administrators do not enter validity, start, or expiry dates and do not manage
an `已離開` state. The service records actor and system timestamps for audit
and historical reconstruction.

- Removed relationships disappear from current lists.
- History is available through Member activity or Audit Log.
- Removing a parent relationship never silently cascades.
- If descendant small-group membership exists, the UI previews it and requires
  an explicit remove, move, or cancel choice.
- The server applies the reviewed group of changes atomically and rejects an
  orphaned child relationship.
- Ending church membership previews and resolves every active organization
  relationship and responsibility in the same operation.

## Entitlement Effectiveness

Member-only access requires all relevant layers:

```text
authenticated Account
AND active church membership
AND active matching entitlement
AND resource/workflow policy
```

Ending church membership immediately makes weekly-bulletin download, paper
distribution, member recording, and other member-only entitlements
ineffective. Entitlement history is retained. Organization responsibility is
not retained as a dormant permission.

AuthN continues to publish identity session and opaque staff permissions only.
Operations and content owners enforce membership, scope, entitlement, and
resource rules. Frontend checks control UX only.

## Search Contract

- The Admin Header SearchBar is the only free-text search control on list
  pages.
- Each route provides its searchable domain and authorized scope to that shared
  component.
- Page-local filters remain separate from free-text search.
- Creation-form Account and Member selectors are shared selector controls, not
  competing list-page search bars.
- The backend applies the same scope and privacy constraints even when the UI
  hides an unavailable candidate.

## Paused First-Entry Authentication Regression

Observed behavior after Website sign-in:

- first Account entry briefly shows the login page before Profile;
- first Admin entry may show `OAuth 回呼失敗`; a second entry succeeds.

Production evidence showed a successful OAuth exchange followed by consumption
of a pre-exchange anonymous session revalidation. Account additionally commits
the cold-bootstrap anonymous notification before its hosted-login bootstrap
decision.

Paused delivery state:

- `frontend-platform` 1.0.9 contains and published the shared post-exchange
  revalidation fix;
- Account has an unmerged initial-bootstrap guard and regression test in an
  isolated worktree;
- Admin and Website consumer dependency updates are incomplete;
- no completed cross-product release or real-user acceptance has been claimed.

When resumed, preserve independent PR, CI, package, merge, release, deployed
revision, and authenticated first-entry verification gates. Do not call the
issue fixed until the exact logout, Website login, first Account entry, and
first Admin entry sequence passes without credential UI flash or callback
failure.

## Remaining Product Decisions

Only these product questions remain before converting this record into an
implementation plan:

1. batch creation semantics: all-or-nothing versus per-row partial success,
   duplicate handling, and retry presentation;
2. shared Header SearchBar interaction: route-scoped search placeholder,
   result navigation, URL/query persistence, and interaction with page filters.

Everything else above is confirmed. Technical permission names, API shapes,
schema migrations, capability expansion, audit events, and cross-repository
release order belong in the implementation plan after these product decisions
close; they do not require administrators to understand API permissions.
