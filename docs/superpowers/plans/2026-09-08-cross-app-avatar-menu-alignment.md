# Cross-App Avatar Menu Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align authenticated avatar-menu destinations across the public website, Account, Admin, and Presenter Web according to current location and effective Admin permissions.

**Architecture:** Reuse the existing shared `AccountMenu` in the three website applications and the existing lower-left `UserMenu` in Presenter. Each consumer declares only its destinations; Account/Admin/public web use the released `canAccessAdmin`, while Presenter pins the same capability matrix in its existing auth helper without adding a private package dependency.

**Tech Stack:** React 19, TypeScript, Vite/Next.js, Vitest, React Testing Library, HeroUI v3

**Spec:** `docs/superpowers/specs/2026-09-08-account-menu-and-seo-locale-alignment-design.md`

## Global Constraints

- Use separate latest-`origin/main` worktrees and branches in `account-fe`, `admin-fe`, and `hhc-presenter`; retain the existing `hhc-web` worktree for reference verification.
- Never show a link to the current product.
- Show Admin only when the canonical Admin-access predicate passes.
- Do not gate the public Presenter destination on `presenter:cloud:use`.
- Presenter product links are Web-only and use the approved tools-first placement.
- Add no dependency, backend contract, centralized navigation service, or speculative abstraction.
- Do not push, merge, release, or mutate production without separate authorization.

---

### Task 1: Align the Account menu

**Files:**
- Modify: `account-fe/src/App.test.tsx`
- Modify: `account-fe/src/App.tsx`
- Modify: `account-fe/src/i18n/messages.ts`

**Interfaces:**
- Consumes: `auth.profile.permissions`, `canAccessAdmin(permissions)`, `AccountMenu.links`, and existing `publicSiteUrl`/locale state.
- Produces: ordered links `official-site`, `projection`, and conditional `admin`; no Account link because Account is current.

- [ ] **Step 1: Create an isolated worktree and establish baseline**

Fetch `origin/main`, create `feat/account-menu-alignment`, install with the repository package manager, and run `corepack pnpm test:run` before editing.

- [ ] **Step 2: Write ordinary-user and Admin-user RED tests**

Extend the existing dismissible menu test for an ordinary profile:

```ts
expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
  'Official site', 'Projection system', 'Sign out'
]);
expect(screen.queryByRole('menuitem', {name: 'Admin console'})).not.toBeInTheDocument();
```

Add an Admin profile with `permissions: ['cms:read']` and assert:

```ts
expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
  'Official site', 'Projection system', 'Admin console', 'Sign out'
]);
```

Assert exact hrefs for the locale-aware public page, `https://client.alive.org.tw/`, and `https://admin.alive.org.tw/`.

- [ ] **Step 3: Run the focused test and confirm RED**

```bash
corepack pnpm vitest run src/App.test.tsx
```

Expected: Projection and Admin items are missing.

- [ ] **Step 4: Implement the minimum Account link array**

Import `canAccessAdmin`, replace the current `manageAccountHref` use with:

```tsx
links={[
  {id: 'official-site', label: t.nav.churchSite, href: `${publicSiteUrl}/${locale}`},
  {id: 'projection', label: t.nav.projectionSystem, href: 'https://client.alive.org.tw/'},
  ...(canAccessAdmin(auth.profile.permissions ?? [])
    ? [{id: 'admin', label: t.nav.adminManagement, href: 'https://admin.alive.org.tw/'}]
    : [])
]}
```

Do not pass `manageAccountHref`, because Account is the current product. Add `projectionSystem` and `adminManagement` translations to all five existing locale blocks.

- [ ] **Step 5: Confirm GREEN and commit**

```bash
corepack pnpm vitest run src/App.test.tsx
git add src/App.tsx src/App.test.tsx src/i18n/messages.ts
git commit -m "feat: align account product navigation"
```

### Task 2: Align the Admin menu

**Files:**
- Modify: `admin-fe/src/App.test.tsx`
- Modify: `admin-fe/src/components/AppLayout.tsx`
- Modify: `admin-fe/src/preferences/locale-context.tsx`

**Interfaces:**
- Consumes: existing authenticated Admin shell, `AccountMenu.links`, `manageAccountHref`, `runtimeConfig.publicSiteUrl`, and current Admin locale.
- Produces: ordered public website, Presenter, Account, and sign-out actions; no Admin link because Admin is current.

- [ ] **Step 1: Create an isolated worktree and establish baseline**

Fetch `origin/main`, create `feat/account-menu-alignment`, install dependencies, and run `corepack pnpm test:run` before editing.

- [ ] **Step 2: Write the RED menu-order test**

After opening the existing mocked avatar menu, assert:

```ts
expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
  'Official site', 'Projection system', 'Manage account', 'Sign out'
]);
```

Assert the public link uses the current locale, Presenter uses
`https://client.alive.org.tw/`, and Account keeps
`http://localhost:5173/profile` under the existing test config.

- [ ] **Step 3: Run focused test and confirm RED**

```bash
corepack pnpm vitest run src/App.test.tsx
```

Expected: Official site and Projection system are missing.

- [ ] **Step 4: Add the two non-current destinations**

Pass these links before the existing Account management action:

```tsx
links={[
  {id: 'official-site', label: messages.officialSite, href: `${runtimeConfig.publicSiteUrl}/${locale}`},
  {id: 'projection', label: messages.projectionSystem, href: 'https://client.alive.org.tw/'}
]}
```

Read `locale` from the existing locale context and add `officialSite` and
`projectionSystem` to each current Admin locale block.

- [ ] **Step 5: Confirm GREEN and commit**

```bash
corepack pnpm vitest run src/App.test.tsx
git add src/App.test.tsx src/components/AppLayout.tsx src/preferences/locale-context.tsx
git commit -m "feat: align admin product navigation"
```

### Task 3: Define Presenter Admin access locally

**Files:**
- Modify: `hhc-presenter/src/shared/hhc-auth.ts`
- Create: `hhc-presenter/src/shared/__tests__/hhc-auth.test.ts`

**Interfaces:**
- Consumes: `readonly string[] | undefined` effective permissions.
- Produces: `canAccessHhcAdmin(permissions): boolean` matching the released Account client's readable Admin capabilities and legacy aliases.

- [ ] **Step 1: Create an isolated worktree and establish baseline**

Fetch `origin/main`, create `feat/web-account-menu-alignment`, run `npm ci --ignore-scripts`, then run the existing focused shared-auth test before editing.

- [ ] **Step 2: Write the RED permission matrix**

Assert access for `*`, every readable capability, and its supported legacy alias; deny `[]`, `presenter:cloud:use`, and write-only permissions that do not imply a readable Admin module.

```ts
expect(canAccessHhcAdmin(['cms:read'])).toBe(true)
expect(canAccessHhcAdmin(['users:manage'])).toBe(true)
expect(canAccessHhcAdmin(['presenter:cloud:use'])).toBe(false)
```

- [ ] **Step 3: Run focused test and confirm RED**

```bash
npx vitest run src/shared/__tests__/hhc-auth.test.ts
```

Expected: import/export failure because `canAccessHhcAdmin` does not exist.

- [ ] **Step 4: Implement the pinned predicate**

Add the minimum readonly capability and alias constants beside
`hasHhcPermission`, then:

```ts
const adminCapabilities = [
  'cms:read',
  'campaigns:read',
  'users:read',
  'rbac:read',
  'media-sync:manage',
  'dsr:read'
] as const

const legacyAdminPermissions: Readonly<Record<string, string>> = {
  'campaigns:read': 'cms:read',
  'users:read': 'users:manage',
  'rbac:read': 'rbac:manage',
  'dsr:read': 'dsr:manage'
}

export function canAccessHhcAdmin(permissions: readonly string[] | undefined): boolean {
  return adminCapabilities.some(
    (capability) =>
      hasHhcPermission(permissions, capability) ||
      hasHhcPermission(permissions, legacyAdminPermissions[capability] ?? '')
  )
}
```

Do not copy unrelated write/send aliases from the Account client because they
do not participate in `canAccessAdmin`. Do not create a generic RBAC layer.

- [ ] **Step 5: Confirm GREEN and commit**

```bash
npx vitest run src/shared/__tests__/hhc-auth.test.ts
git add src/shared/hhc-auth.ts src/shared/__tests__/hhc-auth.test.ts
git commit -m "feat: expose presenter admin access policy"
```

### Task 4: Add Web-only links to the existing Presenter menu

**Files:**
- Modify: `hhc-presenter/src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Modify: `hhc-presenter/src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx`
- Modify: `hhc-presenter/src/renderer/src/locales/zh-TW.json`
- Modify: `hhc-presenter/src/renderer/src/locales/zh-CN.json`
- Modify: `hhc-presenter/src/renderer/src/locales/en.json`

**Interfaces:**
- Consumes: `isWeb()`, `session.permissions`, `canAccessHhcAdmin`, current i18n language, and HeroUI `Dropdown.Item` native `href` support.
- Produces: Web-only website, conditional Admin, and Account menu items in the approved tools-first group.

- [ ] **Step 1: Write Web ordinary/Admin and Electron RED tests**

For Web ordinary permissions, assert Website and Account exist, Admin does not,
and the three product items appear after Keyboard Shortcuts and before About.
For `permissions: ['cms:read']`, assert Admin appears between Website and Account.
For Electron, assert none of the three new product links appears.

- [ ] **Step 2: Run the focused test and confirm RED**

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
```

Expected: Website and Account items are missing in Web mode.

- [ ] **Step 3: Add localized labels and locale mapping**

Add `officialSite`, `adminManagement`, and `accountManagement` to the existing
three `userMenu` translation objects. Map public-site locales without a new
module:

```ts
const publicSiteLocale =
  i18n.language === 'zh-TW' ? 'zh-Hant' : i18n.language === 'zh-CN' ? 'zh-Hans' : 'en'
```

- [ ] **Step 4: Render the approved tools-first group**

Immediately after Keyboard Shortcuts and only when authenticated and `isWeb()`:

```tsx
<Dropdown.Item href={`https://www.alive.org.tw/${publicSiteLocale}`}>
  {t('userMenu.officialSite')}
</Dropdown.Item>
{canAccessHhcAdmin(session.permissions) && (
  <Dropdown.Item href="https://admin.alive.org.tw/">
    {t('userMenu.adminManagement')}
  </Dropdown.Item>
)}
<Dropdown.Item href="https://account.alive.org.tw/profile">
  {t('userMenu.accountManagement')}
</Dropdown.Item>
```

Retain the existing divider before About and add the existing divider class to
the first product item. Use existing Lucide icons; do not create a new menu component.

- [ ] **Step 5: Confirm GREEN and commit**

```bash
npx vitest run src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
git add src/renderer/src/components/Control/UserMenu/UserMenu.tsx \
  src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx \
  src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json \
  src/renderer/src/locales/en.json
git commit -m "feat: add web product navigation to presenter"
```

### Task 5: Verify all menu consumers

**Files:**
- Verify only.

**Interfaces:**
- Consumes: completed menu changes in all worktrees.
- Produces: local repository-gate evidence and exact remaining delivery gaps.

- [ ] **Step 1: Verify Account**

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
git diff --check origin/main...HEAD
```

- [ ] **Step 2: Verify Admin**

Run the same four commands in the Admin worktree.

- [ ] **Step 3: Verify Presenter**

```bash
npm test
npm run lint
npm run typecheck
npm run build
git diff --check origin/main...HEAD
```

- [ ] **Step 4: Verify the public website reference matrix**

Run the focused public `AccountControl` test in the `hhc-web` worktree and
confirm its ordinary/Admin link ordering remains Projection, conditional Admin,
Account, Sign out.

- [ ] **Step 5: Report boundaries**

Report each branch, commit, test/lint/build result, and the unperformed
PR/CI/merge/release/live-browser steps separately.
