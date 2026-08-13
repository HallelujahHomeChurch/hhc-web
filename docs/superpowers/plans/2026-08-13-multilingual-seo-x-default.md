# Multilingual SEO And X-Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the bare domain a crawlable language-neutral `x-default` entry while preserving automatic locale routing for users with an explicit preference and independent indexing for all five localized sites.

**Architecture:** Keep the existing locale-prefixed routes, self-canonicals, sitemap, and shared locale detector. Change root negotiation to return no locale when no supported signal exists, render a minimal server-side language selector in that case, and add `x-default` only to the home-page alternate group. Keep all localized routes independent and never redirect them by browser language.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, next-intl, Vitest, existing `@hallelujahhomechurch/preferences` locale registry.

## Global Constraints

- Work from current `origin/main` on a focused branch; do not implement from a stale checkout.
- Supported product locales are exactly `zh-Hant`, `zh-Hans`, `en`, `ja`, and `ko`.
- `/` returns `200` when neither cookie nor `Accept-Language` identifies a supported locale.
- Negotiated redirects use `307`; do not use permanent redirects.
- Localized routes remain self-canonical and must never redirect because of browser language.
- Add `x-default` only to the home-page alternate group.
- CMS alternates continue to include only `availableLocales`.
- Do not add dependencies, middleware, IP geolocation, backend changes, or gateway changes.
- Google supports one site name per domain; localized domain-level site names are not an acceptance criterion.

---

### Task 1: Root locale negotiation contract

**Files:**
- Modify: `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`
- Modify: `src/lib/root-locale.ts`
- Test: `src/lib/root-locale.test.ts`

**Interfaces:**
- Consumes: `detectLocale(languages: readonly string[]): Locale` and `getStoredLocale(cookie: string): Locale | undefined` from `src/i18n/locales.ts`.
- Produces: `resolveRootLocale(cookieHeader: string, acceptLanguage: string): Locale | undefined`.

- [ ] **Step 1: Update the SEO contract before changing behavior**

Replace the old rule that `/` always redirects to `/zh-Hant` with the request
matrix in `docs/superpowers/specs/2026-08-13-multilingual-seo-x-default-design.md`.
Keep `zh-Hant` as the content default locale, but state that the bare domain is
the language-neutral `x-default` entry.

- [ ] **Step 2: Add failing resolver tests**

Add these cases to `src/lib/root-locale.test.ts`:

```ts
it('returns no locale without a supported user language signal', () => {
  expect(resolveRootLocale('', '')).toBeUndefined();
  expect(resolveRootLocale('', 'fr-FR,fr;q=0.9')).toBeUndefined();
});

it('resolves every supported product language', () => {
  expect(resolveRootLocale('', 'zh-TW,zh;q=0.9')).toBe('zh-Hant');
  expect(resolveRootLocale('', 'zh-CN,zh;q=0.9')).toBe('zh-Hans');
  expect(resolveRootLocale('', 'en-US,en;q=0.9')).toBe('en');
  expect(resolveRootLocale('', 'ja-JP,en;q=0.8')).toBe('ja');
  expect(resolveRootLocale('', 'ko-KR,en;q=0.8')).toBe('ko');
});

it('skips unsupported languages before a supported preference', () => {
  expect(resolveRootLocale('', 'fr-FR,ja-JP;q=0.9')).toBe('ja');
});
```

Keep the existing cookie-priority assertions, including Japanese.

- [ ] **Step 3: Run the focused test and confirm the missing-signal cases fail**

Run:

```sh
corepack pnpm exec vitest run src/lib/root-locale.test.ts
```

Expected: the empty and unsupported cases fail because the current detector
falls back to English.

- [ ] **Step 4: Implement the minimal optional result**

Use the existing detector only when at least one supported language family is
present:

```ts
import {detectLocale, getStoredLocale, type Locale} from '@/i18n/locales';

const supportedLanguage = /^(?:zh|en|ja|ko)(?:-|$)/i;

export function resolveRootLocale(cookieHeader: string, acceptLanguage: string): Locale | undefined {
  const storedLocale = getStoredLocale(cookieHeader);
  if (storedLocale) return storedLocale;

  const languages = acceptLanguage
    .split(',')
    .map((value) => value.split(';', 1)[0].trim())
    .filter(Boolean);

  return languages.some((language) => supportedLanguage.test(language))
    ? detectLocale(languages)
    : undefined;
}
```

- [ ] **Step 5: Run the resolver test and commit the contract**

Run:

```sh
corepack pnpm exec vitest run src/lib/root-locale.test.ts
git add docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md src/lib/root-locale.ts src/lib/root-locale.test.ts
git commit -m "fix: preserve neutral root locale fallback"
```

Expected: focused tests pass.

---

### Task 2: Home-page x-default alternates

**Files:**
- Modify: `src/lib/seo.ts`
- Test: `src/lib/seo.test.ts`
- Test: `src/app/sitemap.test.ts`

**Interfaces:**
- Consumes: `siteConfig.url`, `getLocalizedPath(locale, pathname)`, and the optional locale subset used by CMS routes.
- Produces: `getAlternates(pathname: string, locales?: readonly Locale[]): Partial<Record<Locale | 'x-default', string>>`.

- [ ] **Step 1: Add failing alternate tests**

Add to `src/lib/seo.test.ts`:

```ts
it('uses the bare domain as x-default only for home pages', () => {
  expect(getAlternates('/')).toMatchObject({
    'zh-Hant': 'https://www.alive.org.tw/zh-Hant',
    ja: 'https://www.alive.org.tw/ja',
    ko: 'https://www.alive.org.tw/ko',
    'x-default': 'https://www.alive.org.tw/'
  });
  expect(getAlternates('/about')).not.toHaveProperty('x-default');
});
```

Extend `src/app/sitemap.test.ts` so the `/zh-Hant` home entry contains
`x-default`, while `/ja/privacy-policy` does not.

- [ ] **Step 2: Run the focused tests and confirm x-default is missing**

Run:

```sh
corepack pnpm exec vitest run src/lib/seo.test.ts src/app/sitemap.test.ts
```

Expected: the new `x-default` expectations fail.

- [ ] **Step 3: Extend the existing helper without creating another SEO layer**

Implement the home-only addition in `src/lib/seo.ts`:

```ts
export type LanguageAlternates = Partial<Record<Locale | 'x-default', string>>;

export function getAlternates(pathname: string, locales: readonly Locale[] = productLocales): LanguageAlternates {
  const alternates: LanguageAlternates = Object.fromEntries(
    locales.map((locale) => [locale, `${siteConfig.url}${getLocalizedPath(locale, pathname)}`])
  );

  if (pathname === '/') alternates['x-default'] = `${siteConfig.url}/`;
  return alternates;
}
```

Do not add `x-default` to CMS detail paths or invent alternates for missing
translations.

- [ ] **Step 4: Run focused tests and commit**

Run:

```sh
corepack pnpm exec vitest run src/lib/seo.test.ts src/app/sitemap.test.ts
git add src/lib/seo.ts src/lib/seo.test.ts src/app/sitemap.test.ts
git commit -m "feat: publish multilingual x-default alternates"
```

Expected: focused tests pass and the existing sitemap entry count remains 35.

---

### Task 3: Crawlable neutral root entry

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/page.test.tsx`
- Modify: `src/components/layout/LocaleDocument.tsx`
- Test: `src/app/layout.test.tsx`

**Interfaces:**
- Consumes: `resolveRootLocale(...)`, `getAlternates('/')`, `localeMetadata`, `siteConfig`, and `redirect(path)`.
- Produces: a `200` server-rendered selector when negotiation returns `undefined`; otherwise preserves the negotiated `307` redirect.

- [ ] **Step 1: Add failing root-page tests**

Mock `next/headers` and `next/navigation` in `src/app/page.test.tsx`. Assert:

```ts
expect(markup).toContain('href="/zh-Hant"');
expect(markup).toContain('href="/zh-Hans"');
expect(markup).toContain('href="/en"');
expect(markup).toContain('href="/ja"');
expect(markup).toContain('href="/ko"');
expect(markup).toContain('"@type":"WebSite"');
expect(markup).toContain('ハレルヤ・ホームチャーチ');
expect(markup).toContain('할렐루야 가정교회');
```

Add a second case where `Accept-Language: ja-JP` calls `redirect('/ja')` and
does not render the selector.

In `src/app/layout.test.tsx`, add a root-path case that expects
`<html lang="und"`, while retaining the existing `/ja/about` assertion.

- [ ] **Step 2: Run focused tests and confirm the root cannot render**

Run:

```sh
corepack pnpm exec vitest run src/app/page.test.tsx src/app/layout.test.tsx
```

Expected: the selector and `lang="und"` assertions fail.

- [ ] **Step 3: Render the minimum no-JavaScript selector**

In `src/app/page.tsx`:

- export root metadata with canonical `/`, `getAlternates('/')`, title `HHC`,
  and description `繁體中文・简体中文・English・日本語・한국어`;
- redirect only when `resolveRootLocale(...)` returns a locale;
- otherwise render the existing logo, `HHC`, and native labels from
  `localeMetadata` as ordinary links;
- set `hrefLang` and `lang` on each link;
- render one safely serialized `WebSite` JSON-LD object with the official name
  and the English, Japanese, Korean, and `HHC` alternatives;
- use existing utility classes and `/assets/brand/logo.png`; add no component,
  stylesheet, or dependency.

Serialize the static JSON-LD safely:

```ts
const websiteJsonLd = JSON.stringify(websiteStructuredData).replace(/</g, '\\u003c');
```

In `LocaleDocument.tsx`, use `und` only when the first path segment is not a
supported locale:

```ts
const locale = routeLocale && isLocale(routeLocale) ? routeLocale : 'und';
```

- [ ] **Step 4: Run focused tests and inspect server-rendered markup**

Run:

```sh
corepack pnpm exec vitest run src/app/page.test.tsx src/app/layout.test.tsx src/lib/root-locale.test.ts src/lib/seo.test.ts src/app/sitemap.test.ts
```

Expected: all focused tests pass; the selector requires no client JavaScript.

- [ ] **Step 5: Commit the neutral entry**

```sh
git add src/app/page.tsx src/app/page.test.tsx src/components/layout/LocaleDocument.tsx src/app/layout.test.tsx
git commit -m "feat: add crawlable language-neutral homepage"
```

---

### Task 4: Repository verification

**Files:**
- No product file changes expected.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: reproducible evidence that tests, lint, build, redirects, metadata, and all five localized home pages work together.

- [ ] **Step 1: Run all repository gates**

```sh
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
```

Expected: all commands exit `0`; build output includes `/`, `/zh-Hant`,
`/zh-Hans`, `/en`, `/ja`, and `/ko`.

- [ ] **Step 2: Start the production build locally**

```sh
corepack pnpm start -p 3100
```

Run the following checks from another terminal:

```sh
curl -sS -o /dev/null -D - http://127.0.0.1:3100/
curl -sS -o /dev/null -D - -H 'Accept-Language: ja-JP' http://127.0.0.1:3100/
curl -sS -o /dev/null -D - -H 'Cookie: hhc_locale=ko' http://127.0.0.1:3100/
curl -sS http://127.0.0.1:3100/ja
curl -sS http://127.0.0.1:3100/ko
curl -sS http://127.0.0.1:3100/sitemap.xml
```

Expected:

- bare `/` without language signals returns `200`;
- Japanese header returns `307` with `Location: /ja`;
- Korean cookie returns `307` with `Location: /ko`;
- `/ja` and `/ko` return `200` with self-canonical metadata;
- localized home pages list all five alternates plus root `x-default`;
- sitemap home alternates include root `x-default` and non-home entries do not.

- [ ] **Step 3: Validate structured data and diff scope**

- Validate the rendered root JSON-LD with Schema Markup Validator.
- Confirm no dependency or lockfile change.
- Run `git diff --check origin/main...HEAD`.
- Confirm the implementation diff touches only the files named in Tasks 1-3.

---

### Task 5: PR, release, and search verification

**Files:**
- No local production configuration changes.

**Interfaces:**
- Consumes: verified branch from Task 4.
- Produces: merged immutable release plus live SEO evidence.

- [ ] **Step 1: Push and open a focused PR**

Use title:

```text
feat: add multilingual x-default homepage
```

PR evidence must include the resolver matrix, five localized canonical checks,
home `x-default`, full test/lint/build results, and a statement that no
localized route redirects by browser language.

- [ ] **Step 2: Wait for required CI and merge through the repository workflow**

Do not bypass a failing check and do not deploy the branch directly. Squash
merge only after approval and required CI success.

- [ ] **Step 3: Verify the deployed release**

Repeat the Task 4 HTTP matrix against `https://www.alive.org.tw`. Also verify:

```text
/robots.txt       → 200 and references /sitemap.xml
/sitemap.xml      → 200 and contains five localized home URLs
/zh-Hant          → self-canonical
/zh-Hans          → self-canonical
/en               → self-canonical
/ja               → self-canonical
/ko               → self-canonical
```

If root negotiation or a localized canonical is wrong, stop Search Console
submission and use the repository release rollback path.

- [ ] **Step 4: Request recrawl and monitor by localized page**

In Search Console:

- resubmit `https://www.alive.org.tw/sitemap.xml`;
- inspect and request indexing for `/zh-Hant`, `/zh-Hans`, `/en`, `/ja`, and
  `/ko`;
- confirm Google's selected canonical equals each inspected localized URL;
- monitor queries `哈利路亞家教會`, `Hallelujah Home Church`,
  `ハレルヤ・ホームチャーチ`, and `할렐루야 가정교회` by landing page;
- record the result after Google recrawls; do not treat an unchanged snippet on
  deployment day as a failed release.
