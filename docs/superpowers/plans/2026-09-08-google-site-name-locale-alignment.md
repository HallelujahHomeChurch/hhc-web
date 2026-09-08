# Google Site Name Locale Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Google domain site name fixed as Traditional Chinese while preserving five independently localized page titles and descriptions.

**Architecture:** Change only the neutral-root `WebSite` identity in `hhc-web`. Continue sourcing page metadata from the existing locale-owned site layout, keep localized organization aliases, and remove cross-language `WebSite.alternateName` candidates that Google can select as the single domain name.

**Tech Stack:** Next.js 16, TypeScript, React 19, Vitest, pnpm

**Spec:** `docs/superpowers/specs/2026-09-08-account-menu-and-seo-locale-alignment-design.md`

## Global Constraints

- Work only in the isolated `hhc-web` worktree on `feat/account-menu-seo-alignment`.
- Do not change localized titles, descriptions, visible content, canonical URLs, `hreflang`, `x-default`, sitemap entries, or redirects.
- Keep localized names in `Organization.alternateName`; remove them only from the root `WebSite` node.
- Do not push, merge, release, request indexing, or mutate Search Console without separate authorization.

---

### Task 1: Lock the domain site-name contract

**Files:**
- Modify: `src/app/page.test.tsx`
- Verify: `src/app/site-layout-metadata.test.ts`
- Verify: `src/i18n/locales.test.ts`

**Interfaces:**
- Consumes: `RootPage()` rendered JSON-LD and `generateMetadata()` from `src/app/page.tsx`.
- Produces: a failing contract requiring `WebSite.name = 哈利路亞家教會`, no `WebSite.alternateName`, and unchanged localized metadata.

- [ ] **Step 1: Replace the stale root identity expectation**

Parse the root JSON-LD graph, select the `WebSite` and `Organization` nodes, and assert:

```ts
expect(website).toMatchObject({
  '@type': 'WebSite',
  name: '哈利路亞家教會',
  url: 'https://www.alive.org.tw/'
});
expect(website).not.toHaveProperty('alternateName');
expect(organization.alternateName).toContain('哈利路亚家教会');
expect(metadata.openGraph).toMatchObject({siteName: '哈利路亞家教會'});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
corepack pnpm vitest run src/app/page.test.tsx src/app/site-layout-metadata.test.ts src/i18n/locales.test.ts
```

Expected: `src/app/page.test.tsx` fails because the current `WebSite` node still contains cross-language `alternateName`; localized metadata assertions remain green.

### Task 2: Remove the ambiguous root site-name alternatives

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/page.test.tsx`
- Verify: `src/lib/structured-data.ts`

**Interfaces:**
- Consumes: `layout.siteName`, currently `哈利路亞家教會` for the root `zh-Hant` layout.
- Produces: one `WebSite` graph node with `name` and `url` only; the existing `Organization` node remains unchanged.

- [ ] **Step 1: Make the minimum production change**

Delete only the `alternateName` property from the root `WebSite` node:

```ts
{
  '@type': 'WebSite',
  url: `${siteConfig.url}/`,
  name: layout.siteName
}
```

Do not change `organizationStructuredData(layout.links)`.

- [ ] **Step 2: Run focused tests and confirm GREEN**

Run:

```bash
corepack pnpm vitest run src/app/page.test.tsx src/app/site-layout-metadata.test.ts src/i18n/locales.test.ts
```

Expected: both files pass.

- [ ] **Step 3: Commit the focused SEO change**

```bash
git add src/app/page.tsx src/app/page.test.tsx
git commit -m "fix: keep Google site name in Traditional Chinese"
```

### Task 3: Verify `hhc-web`

**Files:**
- Verify only.

**Interfaces:**
- Consumes: the complete SEO change.
- Produces: local evidence for tests, lint, build, and the rendered root contract.

- [ ] **Step 1: Run repository gates**

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
git diff --check origin/main...HEAD
```

- [ ] **Step 2: Verify the rendered contract locally**

Confirm built or server-rendered output contains:

```text
WebSite.name = 哈利路亞家教會
WebSite.alternateName = absent
Organization.alternateName = five localized names
```

- [ ] **Step 3: Record delivery boundaries**

Report the branch, commits, verification output, and that PR/CI/merge/release/live Google recrawl remain unperformed.
