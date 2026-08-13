# HHC Public Web SEO, URL, And Discoverability Design

This spec defines how the public HHC website should manage URLs, slugs, redirects, canonical metadata, sitemap data, robots policy, Open Graph metadata, and structured data after content moves into CMS-backed public projections.

Site-wide editable public layout settings, including navigation, footer links, social links, public contact display, site SEO defaults, and the `site_layout:{locale}` projection, are specified in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

CMS localization, translation status, fallback policy, per-locale publish, localized slugs, and SEO alternate eligibility are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

## Purpose

The public website is a long-lived surface. Once search engines, church members, LINE groups, and external websites share links, URLs become contracts. CMS flexibility should not accidentally break discoverability, locale alternates, legal pages, weekly bulletin links, or historical routes.

This spec covers:

- canonical public URL rules
- locale routing and alternates
- slug ownership and validation
- redirect lifecycle
- sitemap and robots behavior
- metadata, Open Graph, and structured data
- `404`, `410`, and redirect behavior
- tests and rollout checks

## Core Decision

Do not create a standalone `seo-api` in v1.

`hhc-web-api` owns published route metadata as part of public projections. `hhc-web` renders metadata, canonical links, sitemap, robots, and page responses from those public projections. `api-gateway` owns host routing and host-level blocking, not SEO business rules.

This keeps SEO behavior tied to the same publish/unpublish transaction and cache invalidation model as public content.

## Public URL Contract

Production canonical public URLs use:

```text
https://www.alive.org.tw/{locale}/...
```

Allowed v1 locales:

- `zh-Hant`
- `zh-Hans`
- `en`
- `ja`
- `ko`

Default locale:

- `zh-Hant`

Rules:

- `www.alive.org.tw` is the only canonical host for public website pages.
- `admin.alive.org.tw` is never canonical and must be noindex.
- `account.alive.org.tw` is account UI/API only and should not appear in public website sitemap.
- `/api/*` routes are API contracts, not canonical public page URLs.
- Public asset URLs are stable gateway URLs but are not page canonical URLs.
- Do not create or use `api.alive.org.tw`.

## Route Categories

| Category | Example | Owner | Sitemap |
| --- | --- | --- | --- |
| Fixed public page | `/zh-Hant/about` | route registry plus CMS projection | yes |
| Legal page | `/zh-Hant/privacy-policy` | protected CMS legal module | yes |
| News detail | `/zh-Hant/news/{slug}` | CMS news projection | yes when published |
| Generic CMS page | `/zh-Hant/pages/{slug}` | CMS page projection | yes when published and indexable |
| Weekly bulletin archive | `/zh-Hant/weekly` or current route shape | CMS/bulletin projection | yes if page exists |
| Weekly bulletin file | `/api/assets/public/{assetId}` | `asset-api` | no page sitemap entry unless page references it |
| Admin UI | `admin.alive.org.tw/{locale}/admin` | `hhc-web` admin | no, noindex |
| API | `/api/*` | gateway/backend services | no |
| Preview | admin-only preview route | `hhc-web-api`/`hhc-web` | no, noindex/no-store |

## Slug Ownership

Slugs are content identity, not decorative text.

`hhc-web-api` owns slug validation and uniqueness for CMS-managed content. `hhc-web` consumes published route metadata and must not invent slugs independently.

Slug rules:

- Slugs are locale-specific unless the module defines a fixed global slug.
- Slugs are unique within `locale + slugScope`.
- Legal slugs are fixed: `privacy-policy`, `terms-of-use`.
- System page slugs such as `about` and `literature-ministry` are protected.
- News and generic page slugs can change only through an explicit slug-change workflow.
- Slugs use lowercase URL-safe characters for English-style slugs.
- Non-Latin display titles do not need to become raw URL slugs.
- Slugs cannot contain `/`, `?`, `#`, `%2f`, path traversal, reserved API prefixes, or admin/internal route names.
- Slugs cannot collide with locale codes, static route names, or future reserved namespaces.

## Reserved Paths

Reserved path segments:

```text
api
admin
account
assets
priv
_next
static
sitemap.xml
robots.txt
favicon.ico
opengraph-image
```

CMS slug validation must reject reserved names in the relevant route scope.

## Locale Routing

Locale appears in the page URL path:

```text
/{locale}/...
```

Rules:

- `/` is the crawlable `x-default` language entry. It redirects with `307`
  only when a valid locale cookie or supported `Accept-Language` identifies a
  locale; otherwise it returns the language selector with `200`.
- Localized routes never redirect because of browser language.
- Unsupported locale returns `404` or redirects only if a deliberate locale negotiation rule exists.
- Do not silently map unsupported locale to default for detail pages.
- Detail pages missing in the requested locale return `404` unless the public API explicitly returns `meta.fallbackLocale`.
- If fallback is used, metadata must show the actual content language and avoid claiming a translated alternate exists.

## Locale Alternates

Translation status and fallback rules come from `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

Public pages should generate alternates only for published/indexable locales.

For a content item:

- Include `hreflang` for each published locale variant.
- For home-page locale groups, include `x-default` pointing to
  `https://www.alive.org.tw/`.
- Do not include alternate links for drafts, missing translations, unpublished locales, or archived content.
- If slugs differ by locale, alternate URLs must use the locale-specific slug.

`hhc-web-api` should return alternate route metadata in public projections so `hhc-web` does not guess cross-locale URLs.

## Canonical URL Rules

Every indexable public page should have exactly one canonical URL.

Canonical rules:

- Use `https://www.alive.org.tw`.
- Include the locale prefix, except for the canonical language-neutral `/`
  entry.
- Use the current published slug.
- Exclude tracking query parameters.
- Exclude preview/admin paths.
- Exclude API paths.
- Exclude Blob/SAS/provider URLs.
- For paginated pages, canonical should point to the specific page when page content differs.
- For list filters, canonical policy should be explicit before indexable filters are added.

## Redirect Lifecycle

Redirects are required when a published URL changes.

Use `content_slug_redirect` for CMS-owned route changes.

Rules:

- Published slug change creates a redirect from old path to new path.
- Default permanent redirect is `301` or `308`; pick one per implementation and use consistently.
- Temporary redirects use `302` only for operational transitions.
- Redirects are locale-specific.
- Redirect chains are not allowed.
- Redirect loops are rejected.
- Redirect from deleted sensitive/private content should not reveal private existence.
- Redirect rows are public projection data and must be cache-aware.

V1 can defer redirect admin UI, but backend schema and publish workflow should preserve redirect data when slugs change.

## Deleted And Unpublished Content

Use distinct behavior:

| State | Public Page Behavior | Sitemap | Notes |
| --- | --- | --- | --- |
| Draft | `404` | exclude | Never expose |
| Unpublished | `404` or redirect if replacement exists | exclude | Do not leak state |
| Archived but public history desired | published archive page if explicitly supported | include if indexable | Not v1 default |
| Deleted accidental duplicate | redirect to canonical replacement | exclude old URL | Use redirect |
| Permanently removed public page | `410` only if intentional | exclude | Use sparingly |
| Protected/private | `404` for public | exclude | Avoid existence leak |

Default to `404` for unpublished or missing public content. Use `410` only when the church deliberately wants search engines to forget a page.

## Sitemap Ownership

`hhc-web-api` owns sitemap route metadata. `hhc-web` generates `/sitemap.xml` from `GET /api/sitemap-data`.

Sitemap data should include:

- URL path
- locale
- canonical URL
- last modified time
- content type
- alternate URLs
- indexable flag
- priority/change frequency only if intentionally used

Rules:

- Include published, indexable public pages only.
- Exclude admin, account, API, preview, private, restricted, draft, unpublished, archived, and deleted routes.
- Include only supported locales.
- Update immediately on publish/unpublish.
- Use projection versioning and ETag.
- Keep sitemap generation deterministic so tests can compare snapshots.

## Robots Policy

Public host:

- `www.alive.org.tw/robots.txt` can allow public pages.
- It should reference `https://www.alive.org.tw/sitemap.xml`.
- It should not list private or admin paths as a security control.

Admin host:

- `admin.alive.org.tw` should be noindex through headers and/or host-specific robots.
- Admin pages use `X-Robots-Tag: noindex`.

Account host:

- Account UI can use noindex unless there is a deliberate reason to index login/help pages.

Robots is not access control. Private content must be protected by auth/grants, not robots.

## Metadata Sources

Metadata comes from public projections, not draft CMS data.

Canonical host and route policy come from deployment/runtime configuration. Editable site name, public SEO defaults, shared OG default image, navigation, footer, social links, and contact display come from the published `site_layout:{locale}` projection.

For each page:

- `title`
- `description`
- canonical URL
- locale/language
- alternates
- Open Graph title/description/image
- optional structured data
- noindex flag

Fallback rules:

- If SEO title is missing, use public title plus site name.
- If SEO description is missing, use public summary or site default.
- If Open Graph image is missing, use module default or site default image.
- Defaults must be public and safe.
- Site defaults must not override canonical host, supported locale policy, reserved route policy, or gateway route policy.
- Never use admin-only text, draft body, raw upload filenames, private asset URLs, or provider URLs as metadata.

## Open Graph And Social Sharing

Open Graph images should use public `asset-api` gateway URLs only after assets are clean, public, and ready.

Rules:

- Do not use Blob URLs or SAS URLs.
- Do not use protected/private assets for public OG images.
- If a referenced OG asset is later revoked, public projection must fall back to a safe default.
- Weekly bulletin shares should point to page/API response context, not a raw Blob provider URL.

## Structured Data

V1 should keep structured data conservative.

Allowed initial structured data:

- organization/church identity on home page
- breadcrumb for detail pages if routes are stable
- video metadata only when provider metadata is reliable
- article/news metadata if news detail pages are enabled

Do not add event, donation, member, review, or organization claims unless the data is accurate and owned by the relevant domain.

Structured data should be generated by `hhc-web` from public projection metadata, not manually entered arbitrary JSON.

## Public API Shape

`GET /api/sitemap-data` should return route metadata, not raw CMS records.

Recommended fields:

```json
{
  "data": {
    "routes": [
      {
        "path": "/zh-Hant/about",
        "canonicalUrl": "https://www.alive.org.tw/zh-Hant/about",
        "locale": "zh-Hant",
        "contentType": "page",
        "resourceId": "page_about",
        "lastModified": "2026-07-08T00:00:00Z",
        "indexable": true,
        "alternates": [
          {
            "locale": "en",
            "url": "https://www.alive.org.tw/en/about"
          }
        ]
      }
    ]
  }
}
```

Public page/detail APIs should include enough metadata for `hhc-web` to render canonical and alternates without re-deriving route rules.

## Redirect API Behavior

Redirect evaluation should happen before rendering a CMS detail page.

Recommended behavior:

1. `hhc-web` receives a public route.
2. It asks `hhc-web-api` for published detail by locale and slug.
3. If route is not found, `hhc-web-api` can return a redirect hint when a redirect exists.
4. `hhc-web` returns the appropriate redirect response.
5. If no redirect exists, return `404`.

Do not expose redirect tables as generic public admin data. Return only route behavior needed by the public renderer.

## Cache And Invalidation

Publish/unpublish and slug changes must update:

- public page projection
- sitemap projection
- locale alternate metadata
- redirect projection
- page ETag
- sitemap ETag
- affected Redis keys
- optional Next.js route revalidation

Do not rely only on TTL. Route metadata must change as part of the same publish/unpublish projection flow.

## Admin Workflow

Admin UI should make URL impact visible:

- show current public URL per locale
- warn when changing published slug
- show redirect that will be created
- block reserved slugs
- show locale completion and alternate impact
- show SEO preview using public metadata rules
- prevent publishing default locale if required SEO fallback is missing

V1 can keep the UI simple, but backend validation must already protect URL contracts.

## Migration From Current Static Site

Current static routes should become seed/projection route records:

- `/zh-Hant`
- `/zh-Hans`
- `/en`
- `/zh-Hant/about`
- `/zh-Hans/about`
- `/en/about`
- `/zh-Hant/literature-ministry`
- `/zh-Hant/privacy-policy`
- `/zh-Hant/terms-of-use`
- matching supported locale variants

Migration should:

- preserve existing route paths where possible
- generate sitemap fixture from current routes
- verify canonical URLs
- verify locale alternates
- keep static fallback until CMS route parity is proven

## Testing Requirements

Required tests:

- canonical URL uses `www.alive.org.tw`
- no production canonical uses `api.alive.org.tw`
- admin pages are noindex/no-store
- unsupported locale is rejected
- missing translation does not create false alternate
- sitemap includes published/indexable routes only
- sitemap excludes API/admin/preview/private routes
- slug validation rejects reserved paths
- slug change creates redirect
- redirect loop/chains are rejected
- unpublish removes sitemap route and alternates
- public metadata never uses draft fields
- site layout metadata defaults do not include secrets, Blob/SAS URLs, internal hostnames, admin URLs, or private routes
- Open Graph image uses public gateway asset URL only
- `GET /api/sitemap-data` returns deterministic route metadata

## Observability

Track:

- sitemap generation failures
- sitemap route count by locale
- missing metadata fallback count
- redirect hit count by route
- redirect loop validation failures
- public 404 count by route group
- public 410 count when used
- OG asset fallback count
- unsupported locale route count

Unexpected 404 spikes after a publish are a release risk and should be visible in dashboards.

## Acceptance Criteria

- No v1 standalone `seo-api` is required.
- Public canonical URLs use `www.alive.org.tw`; localized pages include a
  locale prefix and the language-neutral `/` entry does not.
- CMS slug changes preserve old published URLs through redirects.
- Legal and system slugs are protected.
- Sitemap includes only published, indexable public routes.
- Admin, API, preview, private, restricted, draft, unpublished, archived, and deleted routes are excluded from sitemap.
- Locale alternates are generated only for published/indexable locale variants.
- Metadata and Open Graph data are generated from public projections only.
- Site-wide metadata defaults can come from published site settings, while canonical host and route policy remain runtime/deployment config.
- Robots/noindex policy does not replace real access control.
- Publish/unpublish updates page, sitemap, alternate, redirect, cache, and ETag state without relying only on TTL.
- Tests cover canonical, alternates, sitemap, robots/noindex, slug validation, redirects, and metadata fallbacks.
