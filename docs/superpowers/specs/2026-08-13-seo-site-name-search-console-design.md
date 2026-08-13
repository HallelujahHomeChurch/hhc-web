# HHC Site Name and Search Console Verification Design

**Date:** 2026-08-13

## Goal

Make the domain-level Google site-name signal language-neutral by using `HHC`
consistently, while keeping every localized page title and description in its
own language. Then verify the deployed result through Google Search Console.

## Scope

This slice includes only:

- domain-level `HHC` site-name consistency;
- all five full localized church names as `WebSite.alternateName` values;
- focused metadata and rendered-HTML regression tests;
- the existing repository PR, CI, merge, and production release flow;
- Search Console sitemap submission and URL Inspection for `/`, `/zh-Hant`,
  `/zh-Hans`, `/en`, `/ja`, and `/ko`.

It does not add legacy URL redirects, Google Business Profile changes,
`Organization`, `NewsArticle`, `BreadcrumbList`, location pages, analytics, or
sitemap pagination/`lastModified` changes.

## Site-Name Contract

Google supports one site name per domain rather than one name per locale
subdirectory. The domain therefore uses:

- primary site name: `HHC`;
- alternate names:
  - `哈利路亞家教會`;
  - `哈利路亚家教会`;
  - `Hallelujah Home Church`;
  - `ハレルヤ・ホームチャーチ`;
  - `할렐루야 가정교회`.

The shared non-localized site configuration owns the primary `HHC` value so
every `og:site_name` is consistent. Localized message files continue to own
localized page titles, descriptions, headings, navigation, and visible church
names. The PWA application name and CMS content are unchanged.

The neutral root continues to expose:

- `<title>HHC</title>`;
- visible `<h1>HHC</h1>`;
- `WebSite.name = HHC`;
- the five full names in `WebSite.alternateName`;
- `og:site_name = HHC`;
- the existing canonical and five locale alternates plus `x-default`.

## Implementation Shape

Reuse `siteConfig.name` as the single domain-brand source and change it from
the Traditional Chinese full name to `HHC`. Add Traditional Chinese to the
root structured-data alternate names and remove the duplicate `HHC` alternate.
Do not introduce a new SEO configuration layer or dependency.

Tests must fail before the implementation change and then prove:

- the rendered root JSON-LD has `name: HHC`;
- all five localized full names are present as alternate names;
- root metadata uses `HHC` as the Open Graph site name;
- localized page titles remain localized;
- canonical, `hreflang`, `x-default`, redirect, and sitemap behavior do not
  regress.

## Search Console Workflow

After the production release succeeds:

1. Use the existing signed-in Google session and select the verified
   `alive.org.tw` domain property or `https://www.alive.org.tw/` URL-prefix
   property.
2. Submit `https://www.alive.org.tw/sitemap.xml` if it is not already the
   current submitted sitemap; otherwise resubmit it.
3. Inspect the neutral root and all five localized home URLs.
4. Record availability, crawl/index status, user-declared canonical,
   Google-selected canonical, last crawl, and rendered-page status.
5. Request indexing for the six inspected URLs when the UI allows it.

If the browser is not signed in, the property is not verified, or Search
Console blocks a request because of quota or ownership, stop and report the
exact blocker. Do not switch Google accounts, create properties, change DNS,
or modify unrelated Search Console settings.

## Validation and Release

Before merge:

- focused metadata tests;
- full `test:run`;
- lint;
- production build;
- rendered root JSON-LD and metadata smoke checks;
- code review and green required CI.

After merge:

- wait for the immutable production release;
- confirm the deployed revision and gateway health;
- verify public root and five localized pages before Search Console actions;
- preserve Search Console observations as rollout evidence, noting that Google
  may need days or weeks to recrawl and update displayed results.

## Success Criteria

- all domain-level `WebSite` and Open Graph site-name signals say `HHC`;
- all five localized full names remain discoverable as alternatives;
- localized titles and descriptions remain unchanged;
- all local and CI checks pass;
- production smoke checks pass;
- the sitemap is submitted in Search Console and all six URLs are inspected;
- any indexing request limitation is reported without bypassing Google policy.
