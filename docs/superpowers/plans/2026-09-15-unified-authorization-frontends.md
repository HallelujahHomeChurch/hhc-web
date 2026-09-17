# Shared Access And Frontend Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give administrators separate church-wide system-role and organization-responsibility experiences instead of raw API dependency choices, and make every client show only destinations authorized by the shared access projection.

**Architecture:** `frontend-platform` publishes one breaking package set that combines the product-neutral auth runtime from the Auth convergence plan with types and pure AuthZ resolvers generated from final provider OpenAPI. Each client uses the same projection for navigation while feature APIs remain the enforcement boundary. Admin system-role editing selects church-wide product capability levels; organization responsibilities bind a fixed operational role to one OrgUnit scope. Atomic codes are advanced read-only detail.

**Tech Stack:** TypeScript, React, Vitest, pnpm, Vite, Next.js, Electron.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- Start only from final provider OpenAPI; never hand-edit generated clients.
- One `frontend-platform` owner publishes one package set and lockfile change.
- Execute Auth convergence Tasks 2-4 inside Task 1 below. Do not publish an
  intermediate auth-only release.
- Auth runtime modules may import only product-neutral session, OAuth, error,
  and generic permission helpers. Domain AuthZ modules may read session state;
  the reverse import is forbidden by CI.
- Navigation predicates cannot widen backend access.
- Preserve accessibility: table headers, radio labels, focus order, and denied-route announcements.

### Task 1: Publish One Auth Runtime And Access Contract

**Files:**
- Modify: `frontend-platform/packages/account-client/src/admin-access.ts`
- Modify: `frontend-platform/packages/account-client/src/admin-access.test.ts`
- Modify: `frontend-platform/packages/account-client/src/index.ts`
- Create: `frontend-platform/packages/account-client/src/session-client.ts`
- Create: `frontend-platform/packages/account-client/src/browser-runtime.ts`
- Create: `frontend-platform/packages/account-client/src/conformance.ts`
- Create: focused tests for each file and `auth-contract.test.ts`
- Create: `frontend-platform/packages/operations-client/package.json`
- Create: `frontend-platform/packages/operations-client/tsconfig.json`
- Create: `frontend-platform/packages/operations-client/tsconfig.build.json`
- Create: `frontend-platform/packages/operations-client/openapi/operations-api.yaml`
- Create: `frontend-platform/packages/operations-client/src/access.ts`
- Create: `frontend-platform/packages/operations-client/src/access.test.ts`
- Create: `frontend-platform/packages/operations-client/src/client.ts`
- Create: `frontend-platform/packages/operations-client/src/client.test.ts`
- Create: `frontend-platform/packages/operations-client/src/generated.ts`
- Create: `frontend-platform/packages/operations-client/src/index.ts`
- Modify: `frontend-platform/package.json`
- Modify: `frontend-platform/pnpm-lock.yaml`
- Modify: `frontend-platform/scripts/check-package-contracts.mjs`
- Modify: `frontend-platform/packages/hhc-web-client/src/client.ts`
- Modify: `frontend-platform/packages/hhc-web-client/src/client.test.ts`
- Modify: `frontend-platform/packages/hhc-web-client/src/index.ts`
- Modify: `frontend-platform/packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `frontend-platform/packages/hhc-web-client/src/generated.ts`

- [ ] Replace broad Admin capabilities and legacy aliases with the canonical staff permission catalog.
- [ ] Implement the Auth convergence session metadata, CSRF single-flight,
      browser runtime, token single-flight, stale-token fencing, one-refresh /
      one-retry, `429 Retry-After` cooldown, hosted OAuth, conformance, and
      sanitized event contracts before adding domain projection.
- [ ] Preserve authenticated identity for both available `permissions: []` and
      `permission_unavailable`; the latter uses an empty fail-closed permission
      list and never triggers refresh, logout, or login.
- [ ] Keep `hasPermission()` generic. Put the final capability identifiers and
      their permission expansion in the domain AuthZ module, with an explicit
      empty compatibility map; auth runtime files must not import that module.
- [ ] Add pure helpers for `canAccessAdmin`, first authorized Admin destination,
  and exact destination lookup. Operations destinations allow either the
  matching global staff permission or the corresponding active operational
  OrgRoleSummary; all other Admin destinations remain global-permission only.
- [ ] Add the Operations-owned portion of `AccessSnapshot` in `@hallelujahhomechurch/operations-client`; combine it with Account `staffPermissions` only inside a pure shared resolver. Do not create a generic authorization service or copy staff RBAC into Operations.
- [ ] Preserve separate `loading | available | unavailable` state for the
  Operations projection. A global staff branch may resolve without it; a
  scoped-only user sees a recoverable authorization-unavailable state rather
  than anonymous, forbidden, or an empty Admin shell when Operations is down.
- [ ] Regenerate the Operations client from final `operations-api/openapi.yaml` and the Website client from final `hhc-web-api/openapi.yaml`.
- [ ] Test unknown permissions/destinations deny, wildcard affects staff
  destinations only, and an Operations-owned scoped role cannot expose CMS,
  Membership, IAM, DSR, Audit, Asset, Campaign, or Presenter destinations.
- [ ] Run `corepack pnpm test`, `lint`, `build`, `check:packages`, `pack:packages`, and `test:consumers`.
- [ ] Publish the final coordinated breaking package line as `1.0.4`, from
      immutable tag `v1.0.4` at `7c6de6c409518ab5966f71cb0ce96f43bb58cc5e`.
      Consumers must lock that exact final version; record its provenance and
      do not retain old runtime or permission aliases.
- [ ] Commit: `feat: publish unified auth and access contracts`

### Task 2: Replace Admin Route Capabilities And Root Behavior

**Files:**
- Modify: `admin-fe/src/lib/access-control.ts`
- Modify: `admin-fe/src/lib/access-control.test.ts`
- Modify: `admin-fe/src/App.tsx`
- Modify: `admin-fe/src/App.test.tsx`
- Modify: `admin-fe/src/components/AppLayout.tsx`
- Modify: `admin-fe/src/preferences/locale-context.tsx`
- Modify: `admin-fe/package.json`
- Modify: `admin-fe/pnpm-lock.yaml`
- Modify: `admin-fe/src/lib/admin-route-title.ts`
- Create: `admin-fe/src/lib/audit-api.ts`
- Create: `admin-fe/src/lib/audit-api.test.ts`
- Create: `admin-fe/src/pages/AuditLogPage.tsx`
- Create: `admin-fe/src/pages/AuditLogPage.test.tsx`

- [ ] Map Page Settings, News, Bulletin, Membership, Campaign, IAM, DSR, Audit
  Log, Asset, and Presenter routes to exact canonical global permissions. Map
  Meetings, Resources, and Reservations to a global-permission OR active
  scoped-operational-role presentation requirement.
- [ ] In this same `admin-fe` PR, replace local required-auth token/session
      lifecycle with the shared runtime. Keep capability expansion in Admin's
      AuthZ adapter and never import it from AuthN runtime code.
- [ ] Lock the core route isolation with this fixture before changing navigation:

```ts
const routeCapabilities = {
  '/content/pages': 'cms:pages:read',
  '/content/news': 'cms:news:read',
  '/content/bulletins': 'cms:bulletins:read',
  '/operations/meetings': {
    global: 'operations:meetings:read',
    scopedRole: 'meeting_manager',
  },
  '/operations/resources': {
    global: 'operations:resources:read',
    scopedRole: 'resource_manager',
  },
  '/operations/reservations': {
    global: 'operations:reservations:read',
    scopedRole: 'reservation_approver',
  },
  '/memberships': 'memberships:read',
  '/memberships/organization-responsibilities': 'memberships:read',
  '/audit': 'audit:read',
} as const
```

- [ ] Fix the existing bulletin wrapper so `/content/bulletins*` uses bulletin capability, not News capability.
- [ ] Hide the global dashboard from scoped staff and redirect `/` to the first authorized route.
- [ ] Wait for every access source required by the candidate destination before
  redirecting. Do not flash a global dashboard or redirect a scoped-only user
  to login while the Operations projection is loading or unavailable.
- [ ] Prove Bulletin Viewer/Editor sees only bulletin navigation plus common account links.
- [ ] Prove direct routes for every unrelated area redirect to forbidden and
  corresponding APIs return backend denial. Prove a scoped Operations user can
  enter only the matching Operations destination and sees only records
  returned by Operations API.
- [ ] Build `/audit` on the released direct Audit query contract with bounded time/action/outcome/resource filters, cursor pagination, detail disclosure, accessible loading/error/empty states, and localized timestamps. Audit-only users enter at `/audit`; queries never accept unrestricted metadata.
- [ ] Prove a successful query produces one `audit.query.read` self-event without recursive event generation.
- [ ] Remove `media-sync:manage` and broad CMS fallbacks.
- [ ] Commit: `feat: isolate admin destinations by capability`

### Task 3: Build The Church-Wide System Role Capability Table

**Files:**
- Modify: `admin-fe/src/pages/RoleDetailPage.tsx`
- Modify: `admin-fe/src/pages/RoleDetailPage.test.tsx`
- Modify: `admin-fe/src/pages/AccessPage.tsx`
- Modify: `admin-fe/src/lib/rbac-catalog.ts`
- Modify: `admin-fe/src/lib/rbac-catalog.test.ts`
- Modify: `admin-fe/src/index.css`
- Modify: `admin-fe/src/preferences/locale-context.tsx`

- [ ] Label this surface System Roles and explain that its grants apply
  church-wide. Render grouped rows with `None | View | Edit | Publish` where
  valid.
- [ ] Compile each selected level to the exact cumulative permissions from the spec; do not expose Asset dependencies.
- [ ] Render Meetings and Resources as `None | View | Edit`, Reservations as `None | View | Approve`, Membership as `None | View | Manage`, and Audit Log as `None | View`; do not force every group into the CMS publish ladder.
- [ ] Keep the capability compilation explicit and cumulative:

```ts
const websiteContentLevels = {
  pageSettings: {
    none: [],
    view: ['cms:pages:read'],
    edit: ['cms:pages:read', 'cms:pages:write'],
    publish: ['cms:pages:read', 'cms:pages:write', 'cms:pages:publish'],
  },
  news: {
    none: [],
    view: ['cms:news:read'],
    edit: ['cms:news:read', 'cms:news:write'],
    publish: ['cms:news:read', 'cms:news:write', 'cms:news:publish'],
  },
  bulletin: {
    none: [],
    view: ['cms:bulletins:read'],
    edit: ['cms:bulletins:read', 'cms:bulletins:write'],
    publish: ['cms:bulletins:read', 'cms:bulletins:write', 'cms:bulletins:publish'],
  },
} as const
```

```ts
const operationsLevels = {
  meetings: {
    none: [],
    view: ['operations:meetings:read'],
    edit: ['operations:meetings:read', 'operations:meetings:write'],
  },
  resources: {
    none: [],
    view: ['operations:resources:read'],
    edit: ['operations:resources:read', 'operations:resources:write'],
  },
  reservations: {
    none: [],
    view: ['operations:reservations:read'],
    approve: ['operations:reservations:read', 'operations:reservations:approve'],
  },
  memberships: {
    none: [],
    view: ['memberships:read'],
    manage: ['memberships:read', 'memberships:manage'],
  },
  auditLog: {
    none: [],
    view: ['audit:read'],
  },
} as const
```

- [ ] Model Bulletin Investigator as a separate specialist role/assignment, not a fourth level in the editor ladder.
- [ ] Show atomic codes only in an advanced read-only disclosure.
- [ ] Keep the default role codes from the spec and allow existing custom-role creation, but compile every role through the same reviewed capability groups; never accept free-form permission expressions or role inheritance.
- [ ] Add keyboard, screen-reader, mobile table, unsaved-change, and invalid-combination tests.
- [ ] Commit: `feat: present grouped role capability matrix`

### Task 4: Rename Website Settings To Page Settings

**Files:**
- Modify: `admin-fe/src/preferences/locale-context.tsx`
- Modify: `admin-fe/src/components/AppLayout.tsx`
- Modify: `admin-fe/src/pages/pages/PageListPage.tsx`
- Modify: `admin-fe/src/pages/pages/PageEditorPage.tsx`
- Modify: `admin-fe/src/pages/pages/PageListPage.test.tsx`
- Modify: `admin-fe/src/pages/pages/PageEditorPage.test.tsx`

- [ ] Replace every user-facing `網站設定`/Website Settings label with `頁面設定`/Page Settings.
- [ ] Keep parent label `網站內容`/Website Content.
- [ ] Scan all locale files, snapshots, titles, breadcrumbs, and role descriptions.
- [ ] Commit: `refactor: rename website settings to page settings`

### Task 5: Move Admin Operations And Add Membership Management

**Files:**
- Modify: `admin-fe/src/lib/cms-api.ts`
- Modify: `admin-fe/src/lib/cms-api.test.ts`
- Modify: `admin-fe/src/lib/mock-cms-api.ts`
- Modify: `admin-fe/src/pages/operations/MeetingListPage.tsx`
- Modify: `admin-fe/src/pages/operations/MeetingListPage.test.tsx`
- Modify: `admin-fe/src/pages/operations/MeetingEditorPage.tsx`
- Modify: `admin-fe/src/pages/operations/MeetingEditorPage.test.tsx`
- Create: `admin-fe/src/lib/operations-api.ts`
- Create: `admin-fe/src/lib/operations-api.test.ts`
- Create: `admin-fe/src/pages/operations/OrgUnitPage.tsx`
- Create: `admin-fe/src/pages/operations/OrgUnitPage.test.tsx`
- Create: `admin-fe/src/pages/operations/OrgResponsibilityPage.tsx`
- Create: `admin-fe/src/pages/operations/OrgResponsibilityPage.test.tsx`
- Create: `admin-fe/src/pages/operations/ResourceListPage.tsx`
- Create: `admin-fe/src/pages/operations/ResourceListPage.test.tsx`
- Create: `admin-fe/src/pages/operations/ReservationListPage.tsx`
- Create: `admin-fe/src/pages/operations/ReservationListPage.test.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipListPage.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipListPage.test.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipDetailPage.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipDetailPage.test.tsx`
- Modify: `admin-fe/src/App.tsx`
- Modify: `admin-fe/src/components/AppLayout.tsx`
- Modify: `admin-fe/src/preferences/locale-context.tsx`

- [ ] Remove operations types and methods from the Website CMS wrapper and consume `@hallelujahhomechurch/operations-client` through one Admin wrapper.
- [ ] Use the shared presentation resolver for Meetings, Resources, and
  Reservations, allowing a corresponding global permission or scoped
  operational role. Keep placement, qualification, entitlement, and every
  OrgRoleAssignment grant/revoke behind global `memberships:read` or
  `memberships:manage` as appropriate; scoped roles satisfy neither.
- [ ] Add a separate Organization Responsibilities surface that assigns a
  person, OrgUnit scope, fixed role, effective dates, and optional expiry. Show
  the selected OrgUnit and fixed descendant rule before confirmation; do not
  expose action checkboxes, calculate an authoritative descendant set, or mix
  scoped assignments into the System Role capability table.
- [ ] Offer exactly `meeting_manager`, `resource_manager`, and
  `reservation_approver` as current scoped operational roles. Show pastoral
  roles separately and never claim that pastor, family leader, or small-group
  leader automatically grants Operations actions.
- [ ] Add the minimal Resource settings, maintenance, reservation list/detail, approve/reject/cancel screens using only the final generated Operations client. A reservation approver cannot edit Resource settings or Meetings.
- [ ] Provide explicit assignment/revocation forms for the three initial bulletin entitlements; never expose entitlement codes as staff permissions.
- [ ] Require effective dates, actor confirmation, optimistic concurrency, and a visible audit result for sensitive membership changes.
- [ ] Test each global and scoped Meeting, Resource, Reservation, and
  Membership role against every sibling route and direct API. Include own
  scope, descendant scope, sibling scope, expired/revoked assignment,
  pastoral-only role, wildcard, and independent permission-unavailable states.
- [ ] Commit: `feat: manage organization membership and entitlements`

### Task 6: Update Website Member Bulletin Experience

**Files:**
- Modify: `hhc-web/src/features/weekly/api.ts`
- Delete: `hhc-web/src/features/weekly/public-api.ts`
- Modify: `hhc-web/src/components/literature-ministry/WeeklyArchive.tsx`
- Modify: `hhc-web/src/components/literature-ministry/WeeklyArchive.test.tsx`
- Modify: `hhc-web/src/app/[locale]/literature-ministry/page.tsx`
- Modify: `hhc-web/src/app/[locale]/literature-ministry/page.test.ts`
- Modify: `hhc-web/src/app/sitemap.ts`
- Modify: `hhc-web/src/app/sitemap.test.ts`
- Modify: `hhc-web/src/components/layout/AccountControl.tsx`
- Modify: `hhc-web/src/components/layout/AccountControl.test.tsx`
- Modify: `hhc-web/package.json`
- Modify: `hhc-web/pnpm-lock.yaml`

- [ ] Remove server/public bulletin fetching and sitemap discovery.
- [ ] In the same `hhc-web` PR, replace local browser token/session lifecycle
      with the shared optional-auth runtime; do not ship a separate auth-only
      consumer migration.
- [ ] After authentication, use the access projection to show only entitled bulletin locales/series, then call protected routes.
- [ ] Handle unauthenticated, unqualified, missing entitlement, revoked, and unavailable states without leaking bulletin metadata.
- [ ] Keep URLs stable only within the protected member surface.
- [ ] Commit: `feat: render member-only weekly bulletins`

### Task 7: Update Account And Presenter Menus

**Account files:**
- Modify: `account-fe/src/App.tsx`
- Modify: `account-fe/src/App.test.tsx`
- Modify: `account-fe/src/lib/api.ts`
- Modify: `account-fe/src/lib/api.test.ts`
- Modify: `account-fe/src/i18n/messages.ts`
- Create: `account-fe/src/pages/ResourceListPage.tsx`
- Create: `account-fe/src/pages/ResourceListPage.test.tsx`
- Create: `account-fe/src/pages/ResourceReservationPage.tsx`
- Create: `account-fe/src/pages/ResourceReservationPage.test.tsx`
- Create: `account-fe/src/pages/MyResourceReservationsPage.tsx`
- Create: `account-fe/src/pages/MyResourceReservationsPage.test.tsx`
- Modify: `account-fe/package.json`
- Modify: `account-fe/pnpm-lock.yaml`

**Presenter files:**
- Modify: `hhc-client-v2/src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Modify: `hhc-client-v2/src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`
- Modify: `hhc-client-v2/src/renderer/src/lib/hhc-line-access.ts`
- Modify: `hhc-client-v2/src/renderer/src/lib/__tests__/hhc-line-access.test.ts`
- Modify: `hhc-client-v2/package.json`
- Modify: `hhc-client-v2/package-lock.json`

- [ ] Replace `canAccessAdmin` legacy behavior with the shared destination resolver.
- [ ] In the same `account-fe` PR, replace its required-auth token/session
      lifecycle with the shared runtime and keep hosted credential flows in
      Account.
- [ ] In the same `hhc-client-v2` PR, delegate Presenter Web to the browser
      runtime and align Desktop stale-token, cooldown, refresh, IPC, and event
      behavior while retaining native OAuth and `safeStorage` in main process.
- [ ] Show Admin, bulletin, Presenter cloud, and LINE destinations only when projected; common profile/security links remain authenticated-account links.
- [ ] Show the Resource application destination only when the Operations access response says the caller is currently eligible. Use the generated client for availability, single-Resource request, own list/detail, and cancel; do not infer eligibility from staff permissions or duplicate the server policy.
- [ ] Handle qualification/org-policy revocation, conflict, stale version, and permission-unavailable presentation without turning the authenticated Account anonymous.
- [ ] Do not derive member access from Admin permissions or email verification.
- [ ] Account verification: `corepack pnpm test:run && corepack pnpm lint && corepack pnpm build`.
- [ ] Presenter verification: `npm run test && npm run lint && npm run typecheck && npm run build && npm run build:web`.
- [ ] Commit separately in each repository.

### Task 8: Consumer Drift And Isolation Gate

- [ ] Run `rg` across all four client repos for every removed permission and old public bulletin route; require zero runtime hits.
- [ ] Run Admin direct-navigation tests for Page Settings Editor, News Editor,
  Bulletin Viewer, Bulletin Editor, global Meeting Editor, global Resource
  Editor, global Reservation Approver, scoped Meeting Manager, scoped Resource
  Manager, scoped Reservation Approver, pastoral-only leader, Membership
  Manager, and Audit Reader.
- [ ] Record packed package version/digest and exact consumer lockfile versions.
- [ ] Keep consumer PRs unmerged until coordinated cutover approval.
- [ ] Run the Auth convergence conformance suite in `hhc-web`, `account-fe`,
      `admin-fe`, Presenter Web, and Presenter Desktop adapters. Future mobile
      receives only the documented adapter interface and conformance cases;
      do not create a mobile package or repository.
