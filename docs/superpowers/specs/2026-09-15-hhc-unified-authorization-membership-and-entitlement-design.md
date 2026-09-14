# HHC Unified Authorization, Membership, And Entitlement Design

## Status And Scope

This is the canonical target design for HHC staff authorization, church
organization scope, membership qualification, member entitlements, protected
weekly bulletins, shared UI access projection, and coordinated breaking
delivery.

It governs the following repositories and future deployable:

- `account-api`
- `operations-api` (new target owner described below)
- `hhc-web-api`
- `asset-api`
- `engagement-api`
- `notification-api`
- `api-gateway`
- `frontend-platform`
- `admin-fe`
- `hhc-web`
- `account-fe`
- `hhc-client-v2`
- `hhc-line-function-bot`

This design supersedes conflicting scope catalogs, role bundles, weekly
bulletin public-projection rules, and compatibility guidance in older platform
specifications. Unaffected identity, gateway, service-identity, asset-safety,
audit, privacy, and release rules remain in force.

This is a direct breaking redesign. The current membership and authorization
data is test-only, so there is no legacy user-role, member-verification, or
member-entitlement backfill. Existing bulletin source records, revisions, and
asset bytes are retained; only their access model changes.

## Decisions

1. Staff administration uses RBAC: users receive roles and roles contain
   atomic staff permissions.
2. Church organization access uses scoped relationships, not global
   permissions.
3. Membership qualification, member entitlements, and staff permissions are
   separate concepts and separate data.
4. Workflow records such as registration, attendance, and paper distribution
   are not permissions.
5. Services enforce authorization for their own resources. HHC does not add a
   generic authorization service, external policy engine, or administrator
   policy DSL.
6. Frontends share one access-projection contract for navigation, but UI
   visibility is never the security boundary.
7. Electronic weekly bulletins are member-only. The public-access switch and
   all public bulletin compatibility paths are removed.
8. Every historical published electronic bulletin becomes protected in the
   same breaking cutover.
9. General bulletin access is independently assignable for Traditional
   Chinese, Simplified Chinese, and English. A future children's bulletin is a
   new bulletin series, not a locale.
10. Embedded CMS uploads run through the content-owning service identity.
    Content editors do not need generic Asset permissions.
11. `網站設定` is renamed to `頁面設定` from RBAC labels through Admin UI copy.
12. No legacy aliases, fallback scopes, dual-read, dual-write, deprecation
    period, or legacy session compatibility is retained for this redesign.

## Non-Goals

This design does not introduce:

- OPA, Cedar, OpenFGA, Zanzibar, or another runtime policy engine;
- an `authorization-api`;
- administrator-authored conditional policies;
- arbitrary custom roles or role inheritance;
- resource ids or locale values in staff permission codes;
- a global permission row for every user-resource pair;
- organization memberships or member entitlements in access-token claims;
- household, guardian, payment, multi-day event, or ticketing implementation;
- preservation of test-only legacy member assignments;
- a new public bulletin mode or a feature flag that restores public access.

## Terminology

| Term | Meaning | Owner |
| --- | --- | --- |
| Principal | Authenticated user, internal service, or future managed device performing an action | identity boundary |
| Staff permission | Atomic administrative capability carried in the Account permission contract | `account-api` |
| Staff role | Human-friendly bundle of staff permissions | `account-api` |
| OrgUnit | Typed node in the HHC church organization tree | `operations-api` |
| OrgMembership | A user's active or historical pastoral/organizational placement | `operations-api` |
| OrgRoleAssignment | A time-bounded leadership or operational relationship within one OrgUnit scope | `operations-api` |
| MembershipQualification | Church-wide approved membership status | `operations-api` |
| Member entitlement | A member-facing benefit assigned to a user, organization userset, or qualification bundle | `operations-api` |
| Audience | A domain-owned rule describing which qualified subjects may access content | content owner |
| Workflow record | Registration, attendance, distribution, approval, or other business state | workflow owner |
| Access projection | Non-authoritative summary used to render application destinations and controls | `frontend-platform` contract |
| Access decision | Domain-owned allow/deny result for principal, action, resource, and context | resource owner |

Authentication answers who the user is. Staff RBAC answers which
administrative functions the user may perform. Organization relationships
answer where the user belongs or leads. Qualification and entitlements answer
which member benefits the user may consume.

## Layered Decision Model

Every protected operation is expressed conceptually as:

```text
can(principal, action, resource, context) -> allow | deny(reason)
```

The relevant facts may include:

- a valid gateway-verified Account principal whose token is not emergency
  denied; Account status remains enforced by Account login/refresh/session
  revocation rather than per-request Account introspection;
- staff permissions for administrative actions;
- active membership qualification;
- active OrgMembership and ancestor relationships;
- active OrgRoleAssignment and its effective period;
- active member entitlement;
- resource owner, OrgUnit, series, locale, publication, and lifecycle state;
- registration or occurrence state;
- internal caller identity for service-to-service operations.

No layer can widen a denial from another required layer. Unknown permissions,
entitlements, actions, subjects, resource types, or relationship types deny by
default.

## Service Ownership

| Domain | Source Of Truth | Responsibilities | Must Not Own |
| --- | --- | --- | --- |
| Identity and staff RBAC | `account-api` | users, login, MFA, sessions, staff roles, staff permissions, access-token issuance | OrgMembership, member qualification, member entitlement, CMS resources |
| Church operations | `operations-api` | OrgUnit, OrgMembership, OrgRoleAssignment, MembershipQualification, EntitlementAssignment, Meeting, occurrence, Resource, registration, attendance, paper distribution eligibility | identity credentials, CMS content bytes, provider delivery |
| Website content | `hhc-web-api` | pages, news, bulletin series/issues/versions, publication state, protected content policy | account roles, organization membership source data, file mechanics |
| File mechanics | `asset-api` | upload sessions, bytes, scan state, derivatives, grants, protected downloads, deletion lifecycle | CMS meaning, member qualification, event eligibility |
| Engagement | `engagement-api` | consent, suppression, audience snapshots, campaigns, schedules | membership source data, provider delivery |
| Delivery | `notification-api` | durable Email/Web Push delivery, provider retry and state | audience eligibility and domain timing |
| Public ingress | `api-gateway` | JWT validation, trusted headers, coarse route permission, route ownership | resource-level policy, business aggregation |
| Shared frontend contract | `frontend-platform` | generated clients, permission predicates, access-projection types, destination resolver | security decisions or feature-specific booleans |

### Why `operations-api` Is Admitted

The existing `ChurchUnit`, `Resource`, `Meeting`, occurrences, overrides, and
collection bindings already form one operational transaction boundary. The
new organization, membership, entitlement, registration, attendance, and
paper-distribution facts have a lifecycle distinct from CMS publication, carry
more sensitive personal data, and are consumed by Website, Admin, Presenter,
and LINE flows.

Those are concrete service-admission triggers. Extraction must move the whole
operations kernel together. HHC must not create a Resource-only,
Membership-only, registration-only, or attendance-only service.

`operations-api` is not a generic authorization service. It owns church
operations facts and evaluates only policies for resources it owns. A content
owner such as `hhc-web-api` obtains the minimum qualification/entitlement facts
it needs and still makes the final bulletin content decision.

## Staff RBAC

### Canonical Permission Catalog

The existing unaffected permissions remain canonical:

```text
*
users:read
users:manage
rbac:read
rbac:manage
oauth:read
oauth:manage
campaigns:read
campaigns:write
campaigns:send
assets:read
assets:write
presenter:cloud:manage
presenter:line:manage
dsr:read
dsr:manage
```

The broad CMS permissions are removed and replaced with:

```text
cms:pages:read
cms:pages:write
cms:pages:publish

cms:news:read
cms:news:write
cms:news:publish

cms:bulletins:read
cms:bulletins:write
cms:bulletins:publish
cms:bulletins:investigate

operations:read
operations:write

memberships:read
memberships:manage
```

`cms:bulletins:investigate` replaces the staff-facing use of
`bulletin:trace`. It is separate because watermark/source investigations can
expose member-linked evidence that ordinary bulletin editors do not need.

The following codes are removed:

```text
cms:read
cms:write
cms:publish
media-sync:manage
bulletin:read
bulletin:trace
line:main:function:download_weekly_paper:execute
```

`campaigns:*` never accepts `cms:*` as a fallback. DSR permissions are not
bundled into IAM roles. Presenter LINE access never accepts
`media-sync:manage` as an alias.

`operations:*` covers organization structure, resources, meetings, and their
current operational configuration. `memberships:*` separately protects member
placement, qualification, and entitlement data. A Meeting editor must not gain
member-management access merely because both domains are hosted by
`operations-api`. Future registration or attendance permissions are added only
when those administrative features are implemented and distinct staff duties
are confirmed.

The `*` staff wildcard grants the canonical staff permission catalog only. It
never creates membership qualification, organization relationships, member
entitlements, registrations, or Asset collection ACLs.

### Staff Role Defaults

| Stable role code | Admin label | Permissions |
| --- | --- | --- |
| `page_settings_viewer` | Page Settings Viewer | `cms:pages:read` |
| `page_settings_editor` | Page Settings Editor | `cms:pages:read`, `cms:pages:write` |
| `page_settings_publisher` | Page Settings Publisher | `cms:pages:read`, `cms:pages:write`, `cms:pages:publish` |
| `news_viewer` | News Viewer | `cms:news:read` |
| `news_editor` | News Editor | `cms:news:read`, `cms:news:write` |
| `news_publisher` | News Publisher | `cms:news:read`, `cms:news:write`, `cms:news:publish` |
| `bulletin_viewer` | Bulletin Viewer | `cms:bulletins:read` |
| `bulletin_editor` | Bulletin Editor | `cms:bulletins:read`, `cms:bulletins:write` |
| `bulletin_publisher` | Bulletin Publisher | `cms:bulletins:read`, `cms:bulletins:write`, `cms:bulletins:publish` |
| `bulletin_investigator` | Bulletin Investigator | `cms:bulletins:read`, `cms:bulletins:investigate` |
| `operations_viewer` | Operations Viewer | `operations:read` |
| `operations_editor` | Operations Editor | `operations:read`, `operations:write` |
| `membership_viewer` | Membership Viewer | `memberships:read` |
| `membership_manager` | Membership Manager | `memberships:read`, `memberships:manage` |

Existing campaign, IAM, Presenter, DSR, and break-glass administration roles
remain separate. IAM Reader/Editor must not include DSR permissions. Generic
Asset Viewer/Manager roles remain available only for direct Asset Library
administration.

The `website_editor` and `website_reader` bundles are removed. Test accounts
are reassigned manually after the cutover; there is no role mapping migration.

### Embedded Asset Operations

Page, news, and bulletin upload/status/retry/complete routes require only their
own content write permission from the human user. The content-owning service
calls `asset-api` through its allowlisted service identity and namespace
policy.

Human `assets:read` or `assets:write` is required only when the user is
directly administering the generic Asset Library. It is not bundled into Page
Settings Editor, News Editor, or Bulletin Editor.

The content owner remains a confused-deputy boundary: it verifies the content
permission, resource id, asset namespace, ownership, lifecycle state, and
request context before calling Asset API.

## Admin Console Permission Experience

The Admin Console presents roles and capability groups, not raw API
dependencies.

The role-detail page uses a grouped table with these access levels where
applicable:

```text
None | View | Edit | Publish
```

For example:

| Group | Capability | Selected access |
| --- | --- | --- |
| Website Content | Page Settings | Edit |
| Website Content | News | None |
| Website Content | Weekly Bulletin | View |
| Church Operations | Meetings and resources | None |

The UI may show the atomic permission codes in an advanced read-only details
panel, but administrators never select Asset API dependencies or service
identity permissions.

A user with only Bulletin Viewer or Bulletin Editor access:

- can enter the Admin Console;
- sees only the bulletin navigation and authorized common account links;
- cannot see or access Page Settings, News, Campaigns, Operations, IAM, DSR,
  Asset Library, or Presenter administration;
- receives a backend denial for direct URL or API attempts outside bulletin
  scope;
- is redirected from the Admin root to the first authorized page rather than
  an information-leaking global dashboard.

All user-facing `網站設定` labels become `頁面設定`. The parent navigation
label remains `網站內容`.

## Church Organization Model

The existing untyped `ChurchUnit` is directly renamed to `OrgUnit`.

### OrgUnit Kinds

```text
organization
congregation
family
small_group
```

Canonical parent rules:

| Child | Allowed parent |
| --- | --- |
| `organization` | none; one HHC root |
| `congregation` | `organization` |
| `family` | `congregation` |
| `small_group` | `family` or `congregation` |

The HHC root contains the mother congregation, Zhongli congregation, and China
congregations as siblings. A directly pastored small group can belong directly
to a congregation without a family node.

Parent changes must reject cycles and invalid kind combinations. Paused or
archived units remain addressable for historical records but do not accept new
active memberships or assignments.

Public location content and physical venues remain separate:

- `OrgUnit` represents organization and pastoral scope;
- `Resource(kind=venue)` represents a reservable physical venue;
- public Location content owns translated address and visitor information.

### OrgMembership

```text
OrgMembership
- id
- user_id
- org_unit_id
- status: pending | active | suspended | left | rejected
- is_primary
- valid_from
- valid_to
- approved_by
- approved_at
- created_at
- updated_at
```

A user may have multiple memberships but at most one active primary pastoral
membership. Membership at a small group implies contextual ancestry through
its family and congregation; it does not create duplicate membership rows at
every ancestor.

Membership qualification is church-wide. Moving between OrgUnits does not by
itself remove general member benefits.

### OrgRoleAssignment

```text
OrgRoleAssignment
- id
- user_id
- org_unit_id
- role: pastor | family_leader | small_group_leader | event_operator
- status: active | suspended | expired | revoked
- valid_from
- valid_to
- assigned_by
- assigned_at
- revoked_by
- revoked_at
```

Initial scope behavior is compiled policy, not administrator configuration:

| Org role | Effective scope |
| --- | --- |
| `small_group_leader` | assigned small group only |
| `family_leader` | assigned family and descendant small groups |
| `pastor` on congregation | assigned congregation and all descendants |
| `event_operator` | explicitly assigned occurrence or event only |

Do not store a single `leader_user_id` on OrgUnit. Multiple leaders, temporary
delegation, expiry, revocation, and history must be supported by assignments.

Church `family` is a pastoral organization node. It must never be reused for a
real-world household, marriage, guardian, child, or emergency-contact
relationship. A future Household/Guardian domain is separate.

## Membership Qualification And Entitlements

### MembershipQualification

```text
MembershipQualification
- id
- user_id
- status: pending | active | suspended | revoked | expired
- valid_from
- valid_to
- approved_by
- approved_at
- reason_code
- created_at
- updated_at
```

Qualification is not an Account role, staff permission, email-verification
flag, or Admin Console access result. Admin users do not automatically qualify
as members.

### EntitlementAssignment

```text
EntitlementAssignment
- id
- subject_type: user | org_members | qualification_bundle
- subject_id
- entitlement_code
- status: active | suspended | revoked | expired
- valid_from
- valid_to
- source: qualification_bundle | manual_assignment | organization_assignment | event_registration
- assigned_by
- assigned_at
- revoked_by
- revoked_at
```

An entitlement is effective only when:

- the Account principal is authenticated through a valid gateway-verified
  token that is not emergency denied;
- the MembershipQualification is active when the entitlement is a member
  benefit;
- the assignment is active and within its effective period;
- its subject relationship still matches;
- the resource and workflow state permit the action.

Initial entitlement definitions are compiled, reviewed catalog entries. Admin
users cannot create arbitrary entitlement codes or edit policy expressions.
Locale and series may appear in entitlement codes because they select a member
benefit. They must not appear in staff permission or access-token scope names.

## Protected Weekly Bulletin Model

### Series And Locale

Bulletin authorization has two independent dimensions:

```text
BulletinSeries: general | children | future reviewed series
Locale: zh-Hant | zh-Hans | en | future supported locale
```

Initial entitlement catalog:

```text
bulletin.general.zh-Hant.access
bulletin.general.zh-Hans.access
bulletin.general.en.access
```

Future children's bulletin example:

```text
bulletin.children.zh-Hant.access
```

`access` intentionally grants discovery, list, metadata, online reading, PDF
download, and the associated protected derivatives for that exact series and
locale. HHC does not split read and download until a real business policy
requires different audiences.

The Admin UI labels the first three entitlements as:

```text
可存取繁體週報
可存取簡體週報
可存取英語週報
```

Technical entitlement codes are hidden from ordinary administrators.

### Decision Rule

A bulletin request is allowed only when all of these are true:

```text
authenticated account
AND valid gateway-verified Account principal
AND active MembershipQualification
AND active matching bulletin.<series>.<locale>.access entitlement
AND requested bulletin version is published
AND referenced asset is clean, ready, and not deleted
```

There is no public-open state and no general member wildcard in the initial
catalog. A member with only Traditional Chinese access cannot discover, read,
or download Simplified Chinese, English, or children's bulletin versions.

Staff bulletin permissions do not satisfy the member decision. A staff member
who needs the member-facing experience must separately hold active membership
qualification and the matching entitlement.

### Protected Routes

The public bulletin routes are removed. The canonical browser surface is
protected and member-scoped, for example:

```text
GET /api/member/bulletins
GET /api/member/bulletins/latest?series=general&locale=zh-Hant
GET /api/member/bulletins/{issueId}/versions/{locale}
GET /api/member/bulletins/{issueId}/versions/{locale}/download
```

Exact paths are finalized in the owning `hhc-web-api` OpenAPI contract. Every
list, latest, id/date lookup, online-reader, PDF, thumbnail, derivative, Range,
and conditional request authorizes before returning metadata or bytes.

Unauthorized or mismatched series/locale resources return a non-enumerating
`404`. Missing authentication follows the gateway's `401` contract.

Responses use `Cache-Control: private, no-store`. Stable URLs do not imply
stable permission.

### Asset Boundary

`hhc-web-api` owns the bulletin business decision and calls `asset-api` through
an allowlisted service identity. `asset-api` owns scan and byte-delivery
mechanics and must not infer membership from Account roles or headers.

Protected download authorization occurs before metadata, ETag/304, Range/206,
or byte processing. Original PDFs, generated member copies, online-reader
artifacts, thumbnails, and derivatives inherit the same series/locale policy.

### LINE And Other Clients

LINE weekly-bulletin access uses the HHC Account binding and asks for the same
series/locale entitlement decision. The Bot does not receive or synthesize a
weekly-paper permission and does not bypass qualification through LINE group
membership.

Presenter, Account, Admin, and Website menus use the shared access projection,
but each content request still reaches the authoritative backend check.

### Notification Audience

Bulletin publication may request an audience snapshot from active matching
entitlements. `engagement-api` still applies consent, suppression, and channel
eligibility; `notification-api` only delivers the approved Email/Web Push
commands. Membership never bypasses communication consent.

## Content Audience Extension

Content owners may use a finite reviewed audience catalog:

```text
public
authenticated
verified_members
org_unit_members
event_registrants
explicit_subjects
```

Electronic weekly bulletins do not use `public`; they use an exact entitlement
for series and locale. Future examples include congregation news for one
OrgUnit, event material for accepted registrants, and small-group recordings
for one organization userset.

Audience type is a domain field, not a staff permission or arbitrary policy
expression. Adding an audience type requires owner policy, OpenAPI, denied-path
tests, data-classification review, and shared client updates.

## Workflow Extensions

Workflow state remains separate from authorization grants.

### Registration And Attendance

The existing weekly/once Meeting and stable MeetingOccurrence identity are
reused first:

```text
EventRegistration
- occurrence_id
- user_id
- status: requested | accepted | waitlisted | cancelled

AttendanceCheckIn
- occurrence_id
- user_id
- checked_in_at
- checked_in_by
- method
```

Recurring gatherings and one-time activities do not require a new Event
service. Add an independent Event aggregate only when multi-session packages,
payments, ticket classes, or another distinct lifecycle actually exists.

### Paper Bulletin Distribution

Paper eligibility can later be represented by a reviewed member entitlement,
while issuance is a workflow record:

```text
BulletinDistribution
- bulletin_issue_id
- user_id
- distribution_org_unit_id
- status: eligible | issued | declined
- issued_at
- confirmed_by
```

Do not treat receiving paper, registering, being accepted, or checking in as a
staff permission. Do not store handwritten signature images without a reviewed
legal, privacy, and retention requirement.

## Shared Access Projection

Frontends consume a normalized summary such as:

```ts
type AccessSnapshot = {
  staffPermissions: string[]
  memberships: OrgMembershipSummary[]
  orgRoles: OrgRoleSummary[]
  qualifications: QualificationSummary[]
  entitlements: EntitlementSummary[]
  version: string
}
```

`account-api` remains the source of staff permissions. `operations-api`
provides organization and member facts. `frontend-platform` owns the DTOs,
clients, and pure destination resolver; it does not add feature-specific
Account booleans.

Before parallel consumer work begins, the Operations OpenAPI must freeze two
small provider contracts:

```text
GET  /api/operations/me/access
POST /priv/operations/entitlement-checks
```

The self route returns only the caller's presentation-safe organization and
member summary. The internal route accepts the sanitized initiating user id
and a finite list of entitlement codes from an allowlisted caller and returns
decisions with reason and version. It does not accept arbitrary policy text,
resource queries, email, roles, or raw tokens. `hhc-web-api` still combines the
returned member fact with bulletin publication and asset state before allowing
content access.

The resolver produces application destinations and child navigation for:

- official website;
- Account Console;
- Admin Console and authorized Admin child pages;
- HHC Presenter;
- member bulletin surfaces;
- future member recordings and event surfaces.

The snapshot is presentation input only. Direct URLs, stale snapshots, hidden
controls, and locally modified clients cannot bypass backend policy. Dynamic
organization and entitlement facts are not embedded into long-lived tokens.

## Decision Reasons And Error Policy

Internal decisions use stable reasons:

```text
authentication_required
staff_permission_required
membership_required
membership_suspended
entitlement_required
wrong_org_scope
assignment_expired
registration_required
resource_unavailable
caller_not_allowed
```

Admin and self-service views may expose an appropriate explanation. Public or
cross-scope resource probes return non-enumerating errors and must not reveal
the protected resource, membership, or roster.

## Lifecycle, History, And Revocation

- Role, OrgMembership, OrgRoleAssignment, qualification, and entitlement
  changes are soft lifecycle transitions with actor, time, and reason.
- Organization moves preserve historical event references. Historical
  attendance and distribution reports do not reinterpret old records through
  today's parent tree.
- Role downgrade and account suspension follow existing Account session
  revocation rules.
- Qualification, entitlement, or organization revocation affects new domain
  decisions immediately and is not delayed by access-token expiry.
- Access projections may be cached briefly for UI, but protected writes and
  content downloads revalidate authoritative facts.
- Downloaded or previously shared files cannot be recalled. Revocation prevents
  later access through HHC-controlled routes.

## Audit And Privacy

Audit at minimum:

- staff role and permission changes;
- membership approval, suspension, departure, and reactivation;
- OrgRoleAssignment grant, expiry, and revocation;
- member entitlement grant and revocation;
- protected bulletin publication and access-policy changes;
- public Asset grant revocation;
- sensitive roster reads and attendance mutations;
- important denied administrative or investigation actions.

Do not log access tokens, cookies, email addresses, LINE identifiers, raw
signatures, bulletin personalized marks, private asset URLs, or full
authorization contexts. Use stable internal ids and approved redaction.

Membership, organization placement, attendance, and household/guardian data
have different purposes and retention. They must not be flattened into an
Account profile or generic authorization log.

## Direct Breaking Cutover

### Explicit Exception

This redesign is an explicitly approved exception to the platform's normal
compatibility-first protocol because the affected membership assignments and
new entitlement system are still test-only.

The exception permits coordinated removal of old contracts and data shapes. It
does not permit bypassing authentication, scan gates, audit, backups for
retained CMS data, contract tests, or production verification.

### No User-Assignment Migration

There is no translation or backfill from:

- `verified_member` role;
- direct `bulletin:read` or `bulletin:trace` grants;
- Admin Console derived member status;
- `line:main:function:download_weekly_paper:execute`;
- `website_editor` or `website_reader` role assignments;
- any legacy access alias.

Test users receive new staff roles, membership qualification, and entitlement
assignments explicitly after the cutover.

### Retained Data

Retain:

- bulletin issues and language versions;
- source PDFs and other bulletin assets;
- revision and publication history;
- scan and processing evidence;
- existing OrgUnit, Resource, Meeting, occurrence, override, and collection
  binding identities and history when extracting the operations kernel;
- audit records required by policy.

Do not reset or delete retained CMS content merely because authorization data
is test-only.

Moving the existing operations kernel to `operations-api` uses a one-time,
counted export/import or equivalent reviewed migration that preserves stable
ids and audit continuity. It does not use cross-schema runtime reads, legacy
API compatibility, dual-read, or shadow-read. This retained-domain migration
is distinct from the explicitly rejected legacy user-assignment backfill.

### Removed Public State

For all historical and future electronic bulletins:

- remove the public access setting and Admin toggle;
- remove public list/latest/by-number/by-date routes;
- remove bulletin public projections and public sitemap/navigation entries;
- revoke public grants for originals and every derivative;
- clear public cache/CDN state;
- remove reopen/close/retry/membership transition endpoints and workers;
- make old public URLs fail closed without redirect or compatibility fallback;
- replace Bot and frontend public clients with protected member clients.

The cutover blocks member bulletin access until public-grant revocation and the
new protected route policy are verified. Already downloaded or independently
copied files cannot be recalled.

### Session And Client Cutover

- invalidate existing test sessions and require sign-in after release;
- deploy no consumer that depends on old permission codes;
- remove old client fields, predicates, fixtures, mocks, and UI controls;
- publish generated clients only from the final provider OpenAPI;
- use one coordinated release window because old and new contracts are
  intentionally incompatible.

## Multi-Agent Development Model

Development may run in parallel only after this design, the code catalogs,
OpenAPI contracts, and access matrix are frozen.

Recommended workstreams:

| Workstream | Primary repositories | Boundary |
| --- | --- | --- |
| Staff RBAC | `account-api`, then `frontend-platform` | permission catalog, role bundles, token/session behavior |
| Church operations | new `operations-api` | OrgUnit, membership, org roles, qualification, entitlement, operational kernel |
| Protected bulletin | `hhc-web-api`, `asset-api`, `hhc-line-function-bot` | series/locale policy, protected routes, grants, Bot binding |
| Admin and website | `admin-fe`, `hhc-web`, `account-fe`, `frontend-platform` | role matrix, member entitlement UI, access projection, navigation |
| Edge and infrastructure | `api-gateway`, infrastructure repo | protected routes, service identity, deployable admission |

Rules:

- one isolated worktree per repository and task;
- one declared owner for each OpenAPI, migration sequence, permission catalog,
  entitlement catalog, and generated package version;
- agents do not edit generated code manually;
- consumers use frozen fixtures until the producer contract is published;
- shared lockfiles and generated clients have one integration owner;
- an agent completion message is not integration evidence;
- cross-repository API, CI, merge, release, deployed revision, and smoke status
  are tracked independently;
- parallel development does not authorize parallel incompatible production
  rollout.

## Delivery Sequence

The implementation plan must decompose the redesign into independently
reviewable repository plans while preserving this dependency order:

1. Freeze catalog, access matrix, target API paths, and service ownership.
2. Create and pass the `operations-api` admission/readiness foundation.
3. Implement Account staff RBAC and session-breaking changes.
4. Implement operations membership, qualification, entitlement, and existing
   kernel extraction.
5. Implement protected bulletin routes and Asset protected-download contract.
6. Publish producer OpenAPI contracts and generated `frontend-platform`
   clients.
7. Update Admin, Website, Account, Presenter, and LINE consumers.
8. Update Gateway route policy and remove public bulletin routes.
9. Run full positive and negative integration matrices in test/staging.
10. Execute one coordinated breaking cutover and public-grant reconciliation.
11. Verify deployed revisions, protected routes, public denials, Admin
    isolation, entitlement revocation, and real clients.

No PR, merge, package publication, release, infrastructure mutation, public
grant revocation, or environment reset is implied by approval of this design
document.

## Authorization Matrix

Minimum required cases:

| Principal | Resource/action | Result |
| --- | --- | --- |
| anonymous | any historical bulletin metadata/PDF | deny without disclosure |
| authenticated non-member | general Traditional bulletin | deny |
| active member without matching entitlement | general Traditional bulletin | deny |
| active member with Traditional entitlement | Traditional general list/read/download | allow |
| active member with Traditional entitlement | Simplified/English/children bulletin | deny |
| suspended member with matching entitlement | bulletin access | deny |
| Admin without membership qualification | member bulletin | deny |
| Bulletin Viewer | Admin bulletin read | allow |
| Bulletin Viewer | Admin bulletin write/publish | deny |
| Bulletin Editor | Admin bulletin read/write | allow |
| Bulletin Editor | Admin bulletin publish/investigate | deny |
| Bulletin Publisher | Admin bulletin publish | allow |
| Bulletin Editor | generic Asset Library write | deny |
| Page Settings Editor | Admin News/Bulletin pages and APIs | deny |
| News Editor | Admin Page Settings/Bulletin pages and APIs | deny |
| Operations Editor | membership, qualification, or entitlement administration | deny |
| Membership Manager | membership, qualification, and entitlement administration | allow |
| Membership Manager | meeting/resource write | deny without `operations:write` |
| small-group leader A | group A roster/check-in | allow when policy and occurrence state permit |
| small-group leader A | group B roster/check-in | deny without disclosure |
| family leader A | descendant group A roster | allow when action policy grants descendant scope |
| expired temporary operator | occurrence roster/check-in | deny |
| unallowlisted service | protected internal entitlement or asset route | deny |

## Test And Evidence Requirements

### Unit

- deterministic role bundle expansion;
- unknown permission, entitlement, action, and OrgUnit kind deny;
- valid and invalid OrgUnit parent matrices and cycle rejection;
- one active primary membership invariant;
- assignment effective-period and revocation behavior;
- exact bulletin series/locale entitlement matching;
- staff permission never satisfies member entitlement;
- embedded content upload does not require human Asset permissions;
- descendant scope follows compiled role policy only.

### Contract And Drift

- Account role bundles reference only canonical staff permissions;
- service action registries match OpenAPI authorization metadata;
- Gateway routes match provider OpenAPI surface and auth mode;
- generated clients compile from released provider contracts;
- Admin route capability map contains no broad or legacy CMS permissions;
- every removed public bulletin route is absent from Gateway, OpenAPI, clients,
  fixtures, sitemap, and Bot behavior;
- no code or seed contains removed permission or entitlement aliases.

### Integration

- each authorization-matrix row has a positive or negative test;
- direct Admin URLs and APIs enforce page/news/bulletin isolation;
- member list, metadata, online-reader, PDF, derivative, ETag, and Range paths
  all authorize before response processing;
- public URLs and old sessions fail closed;
- entitlement and qualification revocation take effect without waiting for
  access-token expiry;
- public Asset grants for every retained historical bulletin and derivative
  reconcile to zero;
- service identity cannot be used as a confused deputy for unrelated assets;
- account, organization, entitlement, registration, and content outages fail
  closed for protected access.

### Release Evidence

- policy and role-bundle diff;
- permission and entitlement catalog diff;
- affected route/action inventory;
- schema migration and retained-data proof;
- zero legacy assignment backfill proof;
- public projection and Asset grant reconciliation counts;
- OpenAPI/Gateway/service/UI drift checks;
- negative access-matrix results;
- deployed revisions and immutable artifacts;
- authenticated Website/Admin/Presenter/LINE smoke as applicable;
- rollback or roll-forward plan that does not restore public bulletin access.

## Deferred Extensions

The model deliberately leaves room for, but does not implement:

- children's and other bulletin series/locales;
- congregation/family/small-group content audiences;
- organization-userset Asset collection ACLs;
- member recording entitlements and signed playback;
- paper bulletin distribution rosters;
- real-name gathering attendance;
- one-time activity registration and waitlists;
- temporary event operators and managed check-in devices;
- Household and GuardianRelationship;
- organization-aware Campaign audience sources;
- an external relationship policy engine after measured duplication,
  performance, or policy-management pressure justifies it.

Adding one of these extensions must reuse Principal, OrgUnit relationships,
qualification, entitlement, audience, domain decision, and workflow-state
boundaries rather than adding a feature-specific Account role or Boolean.

## Acceptance Criteria

- Staff permissions, staff roles, organization relationships, membership
  qualification, member entitlements, audiences, and workflow records have
  distinct meanings and owners.
- Broad CMS scopes and their compatibility fallbacks are absent.
- Page Settings, News, Bulletin, and Operations Admin access are independently
  assignable and backend-enforced.
- Embedded CMS file operations use service identity and do not require generic
  human Asset permissions.
- OrgUnit models organization, congregation, family, and small group with
  validated parent rules and scoped leadership assignments.
- Member qualification is independent of email verification and Admin access.
- General Traditional, Simplified, and English bulletin access are independent
  member entitlements and can be extended by series and locale.
- All historical electronic bulletins are protected; no public switch, public
  projection, public grant, public route, or compatibility fallback remains.
- No legacy member or staff assignment is migrated; retained bulletin content
  and audit data is preserved.
- Every frontend consumes shared access-projection contracts while every API
  independently enforces its authoritative policy.
- Development can be divided by declared owner and frozen contract; final
  breaking release remains coordinated.
- No generic authorization service or policy DSL is introduced.
