# Shared Access And Frontend Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give administrators a role/capability table instead of raw API dependency choices and make every client show only destinations authorized by the shared access projection.

**Architecture:** `frontend-platform` owns types and pure resolvers generated from final provider OpenAPI. Each client uses the same projection for navigation while feature APIs remain the enforcement boundary. Admin role editing selects product capability levels; atomic codes are advanced read-only detail.

**Tech Stack:** TypeScript, React, Vitest, pnpm, Vite, Next.js, Electron.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- Start only from final provider OpenAPI; never hand-edit generated clients.
- One `frontend-platform` owner publishes one package set and lockfile change.
- Navigation predicates cannot widen backend access.
- Preserve accessibility: table headers, radio labels, focus order, and denied-route announcements.

### Task 1: Replace Shared Admin Predicates And Add Access Projection

**Files:**
- Modify: `frontend-platform/packages/account-client/src/admin-access.ts`
- Modify: `frontend-platform/packages/account-client/src/admin-access.test.ts`
- Modify: `frontend-platform/packages/account-client/src/index.ts`
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
- [ ] Add pure helpers for `canAccessAdmin`, first authorized Admin destination, and exact destination lookup.
- [ ] Add the Operations-owned portion of `AccessSnapshot` in `@hallelujahhomechurch/operations-client`; combine it with Account `staffPermissions` only inside a pure shared resolver. Do not create a generic authorization service or copy staff RBAC into Operations.
- [ ] Regenerate the Operations client from final `operations-api/openapi.yaml` and the Website client from final `hhc-web-api/openapi.yaml`.
- [ ] Test unknown permissions/destinations deny and wildcard affects staff destinations only.
- [ ] Run `corepack pnpm test`, `lint`, `build`, `check:packages`, `pack:packages`, and `test:consumers`.
- [ ] Publish only with explicit authorization and record package provenance.
- [ ] Commit: `feat: publish unified access contracts`

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

- [ ] Map Page Settings, News, Bulletin, Operations, Membership, Campaign, IAM, DSR, Asset, and Presenter routes to exact canonical permissions.
- [ ] Lock the core route isolation with this fixture before changing navigation:

```ts
const routeCapabilities = {
  '/content/pages': 'cms:pages:read',
  '/content/news': 'cms:news:read',
  '/content/bulletins': 'cms:bulletins:read',
  '/operations/meetings': 'operations:read',
  '/memberships': 'memberships:read',
} as const
```

- [ ] Fix the existing bulletin wrapper so `/content/bulletins*` uses bulletin capability, not News capability.
- [ ] Hide the global dashboard from scoped staff and redirect `/` to the first authorized route.
- [ ] Prove Bulletin Viewer/Editor sees only bulletin navigation plus common account links.
- [ ] Prove direct routes for every unrelated area redirect to forbidden and corresponding APIs return backend denial.
- [ ] Remove `media-sync:manage` and broad CMS fallbacks.
- [ ] Commit: `feat: isolate admin destinations by capability`

### Task 3: Build The Role Capability Table

**Files:**
- Modify: `admin-fe/src/pages/RoleDetailPage.tsx`
- Modify: `admin-fe/src/pages/RoleDetailPage.test.tsx`
- Modify: `admin-fe/src/pages/AccessPage.tsx`
- Modify: `admin-fe/src/lib/rbac-catalog.ts`
- Modify: `admin-fe/src/lib/rbac-catalog.test.ts`
- Modify: `admin-fe/src/index.css`
- Modify: `admin-fe/src/preferences/locale-context.tsx`

- [ ] Render grouped rows with `None | View | Edit | Publish` where valid.
- [ ] Compile each selected level to the exact cumulative permissions from the spec; do not expose Asset dependencies.
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
- Create: `admin-fe/src/pages/memberships/MembershipListPage.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipListPage.test.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipDetailPage.tsx`
- Create: `admin-fe/src/pages/memberships/MembershipDetailPage.test.tsx`
- Modify: `admin-fe/src/App.tsx`
- Modify: `admin-fe/src/components/AppLayout.tsx`
- Modify: `admin-fe/src/preferences/locale-context.tsx`

- [ ] Remove operations types and methods from the Website CMS wrapper and consume `@hallelujahhomechurch/operations-client` through one Admin wrapper.
- [ ] Keep meetings/resources/OrgUnits behind `operations:read/write`; keep placement, qualification, org roles, and entitlement assignment behind `memberships:read/manage`.
- [ ] Provide explicit assignment/revocation forms for the three initial bulletin entitlements; never expose entitlement codes as staff permissions.
- [ ] Require effective dates, actor confirmation, optimistic concurrency, and a visible audit result for sensitive membership changes.
- [ ] Test Operations Editor cannot read member records and Membership Manager cannot write meetings without the second role.
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
- [ ] Show Admin, bulletin, Presenter cloud, and LINE destinations only when projected; common profile/security links remain authenticated-account links.
- [ ] Do not derive member access from Admin permissions or email verification.
- [ ] Account verification: `corepack pnpm test:run && corepack pnpm lint && corepack pnpm build`.
- [ ] Presenter verification: `npm run test && npm run lint && npm run typecheck && npm run build && npm run build:web`.
- [ ] Commit separately in each repository.

### Task 8: Consumer Drift And Isolation Gate

- [ ] Run `rg` across all four client repos for every removed permission and old public bulletin route; require zero runtime hits.
- [ ] Run Admin direct-navigation tests for Page Settings Editor, News Editor, Bulletin Viewer, Bulletin Editor, Operations Editor, and Membership Manager.
- [ ] Record packed package version/digest and exact consumer lockfile versions.
- [ ] Keep consumer PRs unmerged until coordinated cutover approval.
