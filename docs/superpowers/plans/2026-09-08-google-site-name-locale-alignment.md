# Google Site Name Locale Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Google domain site name fixed as Traditional Chinese while preserving five independently localized page titles and descriptions.

**Architecture:** Restore `siteConfig.name` as the fixed domain-brand source and use it consistently on the neutral root. Continue sourcing descriptions and localized-route metadata from the existing locale-owned site layout, keep localized organization aliases, and remove cross-language `WebSite.alternateName` candidates that Google can select as the single domain name.

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
- Modify: `src/app/layout.test.tsx`
- Verify: `src/app/site-layout-metadata.test.ts`
- Verify: `src/i18n/locales.test.ts`

**Interfaces:**
- Consumes: `RootPage()` rendered JSON-LD and `generateMetadata()` from `src/app/page.tsx`.
- Produces: a failing contract requiring fixed root title/Open Graph/H1/`WebSite.name`, no `WebSite.alternateName`, and unchanged localized metadata.

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
expect(metadata.title).toBe('哈利路亞家教會');
expect(markup).toContain('>哈利路亞家教會</h1>');
```

- [ ] **Step 2: Require the default root layout to use the domain brand**

Update the existing root-layout metadata assertion:

```ts
expect(metadata).toMatchObject({
  title: '哈利路亞家教會',
  openGraph: {title: '哈利路亞家教會', siteName: '哈利路亞家教會'}
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
corepack pnpm vitest run src/app/page.test.tsx src/app/layout.test.tsx src/app/site-layout-metadata.test.ts src/i18n/locales.test.ts
```

Expected: root tests fail because the current root still uses CMS site-name values, `HHC` in the visible heading, and cross-language `WebSite.alternateName`; localized metadata assertions remain green.

### Task 2: Remove the ambiguous root site-name alternatives

**Files:**
- Modify: `src/lib/site.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/app/page.test.tsx`
- Test: `src/app/layout.test.tsx`
- Verify: `src/lib/structured-data.ts`

**Interfaces:**
- Consumes: the fixed domain brand `siteConfig.name` and locale-owned descriptions.
- Produces: consistent root metadata/heading plus one `WebSite` graph node with `name` and `url` only; localized route metadata and the existing `Organization` node remain unchanged.

- [ ] **Step 1: Make the minimum production change**

Add the domain brand to the existing site config:

```ts
name: '哈利路亞家教會',
```

Use `siteConfig.name` for the neutral root title, Open Graph title/site name,
image alt, visible `h1`, and `WebSite.name`. Delete the `alternateName` property
from the root `WebSite` node:

```ts
{
  '@type': 'WebSite',
  url: `${siteConfig.url}/`,
  name: siteConfig.name
}
```

Keep the locale-owned root description and do not change
`organizationStructuredData(layout.links)` or any `[locale]` route.

- [ ] **Step 2: Run focused tests and confirm GREEN**

Run:

```bash
corepack pnpm vitest run src/app/page.test.tsx src/app/layout.test.tsx src/app/site-layout-metadata.test.ts src/i18n/locales.test.ts
```

Expected: both files pass.

- [ ] **Step 3: Commit the focused SEO change**

```bash
git add src/lib/site.ts src/app/page.tsx src/app/page.test.tsx src/app/layout.tsx src/app/layout.test.tsx
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
