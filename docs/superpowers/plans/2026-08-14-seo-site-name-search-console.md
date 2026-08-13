# HHC Site Name and Search Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Publish `HHC` as the single domain-level site name, retain all five localized church names as alternatives, release through the normal PR pipeline, and submit/inspect the affected URLs in Google Search Console.

**Architecture:** Keep the existing `siteConfig.name` as the only domain-brand source. Change that value to `HHC`, update the root `WebSite` JSON-LD alternatives, and leave locale-owned page titles/descriptions untouched. Search Console work happens only after the merged revision is live.

**Tech Stack:** Next.js 16, TypeScript, React 19, Vitest, pnpm, GitHub Actions, Google Search Console.

## Global Constraints

- Work only in `hhc-web` on `codex/seo-site-name-search-console`; never push directly to `main`.
- Rebase the focused documentation commits onto `origin/main` before implementation so the PR contains only this SEO slice.
- Do not add dependencies, an SEO abstraction, redirects, new schema types, analytics, or CMS/PWA changes.
- Do not change localized titles, descriptions, headings, canonical URLs, `hreflang`, `x-default`, redirects, or sitemap contents.
- Do not create a Search Console property, switch Google accounts, change DNS, or bypass ownership/quota restrictions.

---

## Task 1: Put the branch on the current production baseline

**Files:**

- Preserve: `docs/superpowers/specs/2026-08-13-seo-site-name-search-console-design.md`
- Preserve: `docs/superpowers/plans/2026-08-14-seo-site-name-search-console.md`

**Step 1: Confirm the branch is clean and fetch the current remote baseline**

Run:

```bash
git status --short --branch
git fetch origin main
```

Expected: branch is `codex/seo-site-name-search-console`, the worktree is clean, and `origin/main` is available.

**Step 2: Move only this slice's documentation commits onto `origin/main`**

Run:

```bash
git rebase --onto origin/main e22d3cb codex/seo-site-name-search-console
```

Expected: the design and plan commits are retained, while the earlier multilingual SEO feature commits disappear from this branch's unique history.

**Step 3: Verify the PR baseline**

Run:

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: only the site-name design and plan documents differ.

---

## Task 2: Lock the domain site-name contract with a failing test

**Files:**

- Modify: `src/app/page.test.tsx`

**Step 1: Add one focused root contract test**

Add this test inside `describe('RootPage', ...)`:

```tsx
it('publishes HHC with all localized full names as the website identity', async () => {
  const markup = renderToStaticMarkup(await RootPage());
  const jsonLd = markup.match(
    /<script type="application\/ld\+json">([^<]+)<\/script>/
  )?.[1];

  expect(jsonLd).toBeDefined();
  expect(JSON.parse(jsonLd!)).toMatchObject({
    '@type': 'WebSite',
    name: 'HHC',
    alternateName: [
      '哈利路亞家教會',
      '哈利路亚家教会',
      'Hallelujah Home Church',
      'ハレルヤ・ホームチャーチ',
      '할렐루야 가정교회'
    ]
  });
  expect(metadata.openGraph).toMatchObject({siteName: 'HHC'});
});
```

**Step 2: Run the focused test and prove it fails for the intended reason**

Run:

```bash
pnpm vitest run src/app/page.test.tsx
```

Expected: failure shows the current JSON-LD primary name is `哈利路亞家教會` and/or the alternate-name array still contains `HHC` instead of Traditional Chinese.

**Step 3: Commit the red test**

Run:

```bash
git add src/app/page.test.tsx
git commit -m "test: define HHC site-name contract"
```

---

## Task 3: Implement the smallest site-name change

**Files:**

- Modify: `src/lib/site.ts`
- Modify: `src/app/page.tsx`
- Verify: `src/app/[locale]/page.test.ts`

**Step 1: Change the shared domain brand**

In `src/lib/site.ts`, change only:

```ts
name: 'HHC',
```

**Step 2: Make the structured-data alternatives exact**

In `src/app/page.tsx`, make `alternateName` exactly:

```ts
alternateName: [
  '哈利路亞家教會',
  '哈利路亚家教会',
  'Hallelujah Home Church',
  'ハレルヤ・ホームチャーチ',
  '할렐루야 가정교회'
]
```

Do not change any other metadata or visible content.

**Step 3: Run focused regression tests**

Run:

```bash
pnpm vitest run src/app/page.test.tsx 'src/app/[locale]/page.test.ts'
```

Expected: both files pass; the root reports `HHC`, and locale-specific titles remain localized.

**Step 4: Review the implementation diff**

Run:

```bash
git diff --check
git diff -- src/lib/site.ts src/app/page.tsx src/app/page.test.tsx
```

Expected: one shared value change, one exact alternate array change, and one focused test.

**Step 5: Commit the implementation**

Run:

```bash
git add src/lib/site.ts src/app/page.tsx
git commit -m "fix: use HHC as domain site name"
```

---

## Task 4: Verify the repository and rendered output

**Files:**

- Verify only; no new files expected.

**Step 1: Run all required local checks**

Run:

```bash
pnpm test:run
pnpm lint
pnpm build
```

Expected: every command exits successfully.

**Step 2: Verify no locale content or excluded scope changed**

Run:

```bash
git diff --name-only origin/main...HEAD
git diff --check origin/main...HEAD
rg -n "name: 'HHC'|哈利路亞家教會|哈利路亚家教会|Hallelujah Home Church|ハレルヤ・ホームチャーチ|할렐루야 가정교회" src/lib/site.ts src/app/page.tsx
```

Expected: product-code changes are limited to `src/lib/site.ts`, `src/app/page.tsx`, and `src/app/page.test.tsx`; all six identity strings appear only where intended.

**Step 3: Self-review against the confirmed design**

Confirm:

- `WebSite.name` and Open Graph site name resolve to `HHC`;
- `alternateName` contains exactly five full localized names and no duplicate `HHC`;
- localized titles/descriptions and existing canonical/alternate behavior are unchanged;
- no placeholder, TODO, new dependency, redirect, or second-phase schema was added.

---

## Task 5: Open, review, merge, and release the PR

**Files:**

- No additional product files expected.

**Step 1: Push and open a focused pull request**

Run:

```bash
git push -u origin codex/seo-site-name-search-console
gh pr create --base main --head codex/seo-site-name-search-console --title "fix: use HHC as domain site name" --body-file /tmp/hhc-seo-pr-body.md
```

The PR body must summarize the site-name contract, tests run, exclusions, and Search Console follow-up. Create the temporary body with a safe patch/write mechanism and do not commit it.

**Step 2: Review the final PR diff**

Run the repository's code-review workflow and inspect:

```bash
gh pr diff
gh pr checks --watch
```

Expected: no actionable review finding and every required CI check is green. Fix failures through additional focused commits; never bypass them.

**Step 3: Squash merge after CI succeeds**

Run:

```bash
gh pr merge --squash --delete-branch
```

Expected: PR is merged into `main` and produces one immutable release commit.

**Step 4: Wait for the production workflow and verify the release**

Identify the workflow triggered by the merge, wait for success, and verify:

```bash
gh run list --branch main --limit 10
release_run_id="$(gh run list --branch main --limit 10 --json databaseId,workflowName --jq '.[] | select(.workflowName == "Production Release") | .databaseId' | head -n 1)"
gh run watch "$release_run_id" --exit-status
curl -fsS https://www.alive.org.tw/
curl -fsS https://www.alive.org.tw/zh-Hant
curl -fsS https://www.alive.org.tw/zh-Hans
curl -fsS https://www.alive.org.tw/en
curl -fsS https://www.alive.org.tw/ja
curl -fsS https://www.alive.org.tw/ko
```

Expected: release workflow succeeds; root HTML exposes `WebSite.name = HHC`, all five alternate names, and `og:site_name = HHC`; localized routes remain healthy and localized.

---

## Task 6: Submit and inspect through Google Search Console

**Files:**

- No repository changes.

**Step 1: Open Search Console with the existing signed-in browser session**

Open `https://search.google.com/search-console` and select the already verified `alive.org.tw` domain property or `https://www.alive.org.tw/` URL-prefix property.

Expected: the correct property is accessible. If authentication or ownership is unavailable, stop and report the blocker without changing accounts, DNS, or properties.

**Step 2: Submit or resubmit the sitemap**

Submit:

```text
https://www.alive.org.tw/sitemap.xml
```

Expected: Search Console accepts it or shows the existing submission as successful. Record the displayed status and discovered URL count when available.

**Step 3: Inspect all six entry URLs**

Inspect:

```text
https://www.alive.org.tw/
https://www.alive.org.tw/zh-Hant
https://www.alive.org.tw/zh-Hans
https://www.alive.org.tw/en
https://www.alive.org.tw/ja
https://www.alive.org.tw/ko
```

For each URL, record availability/index state, last crawl, user-declared canonical, Google-selected canonical, and rendered/live-test status where shown.

**Step 4: Request indexing where allowed**

Request indexing for each inspected URL after the live test succeeds.

Expected: each request is accepted, already queued, or explicitly blocked by quota/ownership. Record the exact outcome; do not retry around a Google limitation.

**Step 5: Report rollout evidence**

Report the merged PR, production workflow/revision, live smoke results, sitemap status, six URL Inspection outcomes, and indexing-request outcomes. State that Google controls recrawl timing and the displayed search result may take days or weeks to change.
