# HHC Web Content Domain Model

## Purpose

This spec maps the current visible `hhc-web` pages and TypeScript feature models to the future `hhc-web-api` CMS source model and public projections. It prevents the backend from becoming a generic CMS with unclear content ownership, while keeping the public website API compatible with the current frontend.

Detailed admin/editorial workflow, preview, publish/unpublish, localization, asset picker, and module-specific CMS operations are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`.

Detailed source locale, translation status, stale translation, locale fallback, per-locale publish, localized slug, SEO alternate, and weekly bulletin locale rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

Detailed content revision, restore to draft, rollback publish, and published/draft isolation rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

Detailed structured content block schema, inline marks, renderer contract, body asset references, schema versioning, and no-raw-HTML rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Detailed migration/bootstrap rules for current mock data, i18n editorial copy, public assets, seed manifests, API fixtures, parity tests, and rollback are defined in `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`.

## Current Website Surface

| Route | Current Components | Current Data | Future CMS Module |
| --- | --- | --- | --- |
| `/[locale]` | `HomeHero`, `NewsSection`, `WeeklyCard`, `VideoSection`, `AboutTeaser`, `LocationSection` | i18n messages + feature APIs | home projection composed from CMS modules |
| `/[locale]/about` | `AboutHero`, `VisionContent`, `HistoryTimeline` | i18n messages + history feature API | page/about + history timeline |
| `/[locale]/literature-ministry` | `AboutHero`, `WeeklyArchive` | i18n messages + weekly feature API | weekly bulletin archive |
| `/[locale]/privacy-policy` | `LegalDocument` | i18n messages | legal page |
| `/[locale]/terms-of-use` | `LegalDocument` | i18n messages | legal page |

Current feature models:

- `NewsItem`: `id`, `title`, `summary`, `date`, `imageAlt`, `href`
- `WeeklyIssue`: `id`, `date`, `versions`
- `WeeklyBulletin`: `locale`, `date`, `title`, `subtitle`, `href`
- `VideoItem`: `id`, `title`, `imageSrc`, `imageAlt`, `href`
- `LocationItem`: `id`, `name`, `address`, `mapHref`
- `HistoryTimelinePayload`: `events`

The CMS source model should be richer than these public models. Public projections can adapt down to the current shapes while frontend migration is staged.

## Locale Policy

V1 locales are the current site locales:

- `zh-Hant`
- `zh-Hans`
- `en`

Default locale is `zh-Hant`.

Do not introduce `ja` into v1 contracts unless the frontend locale registry adds it first. Future locales are additive and require:

- frontend locale registry update
- i18n messages
- CMS locale validation
- sitemap/SEO alternates
- admin translation UI support

Canonical URL, locale alternate, slug, redirect, sitemap, robots, and metadata rules are specified in `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

Source locale, translation staleness, per-locale publish, fallback policy, and weekly bulletin locale behavior are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

Accessibility metadata, image alt/decorative rules, media dimensions, and public performance requirements are specified in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

Site settings, header navigation, footer links, social links, public contact display, shared layout projections, and runtime-config separation are specified in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

## CMS Ownership Split

CMS-managed content:

- Header navigation and footer/social/public layout settings.
- News articles.
- Weekly bulletin issues and localized PDF versions.
- Videos and display metadata.
- Locations.
- History timeline.
- About/vision page content.
- Legal pages.
- Home page curated sections.
- SEO fields for CMS pages.

Frontend i18n-managed UI copy:

- Button labels.
- Menu open/close labels.
- Language-switcher labels.
- Generic empty/error/loading states.
- Form labels.
- Reusable component chrome.

This split keeps editorial content in CMS and product UI language in frontend i18n.

## Shared CMS Source Model

All CMS records share:

- `id`
- `type`
- `status`
- `slug`
- `translationGroupId`
- `createdBy`
- `updatedBy`
- `publishedBy`
- `publishedAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

Statuses:

- `draft`
- `published`
- `unpublished`
- `archived`

Each localized content record has:

- `locale`
- `title`
- `summary`
- `bodyJson`
- `seoJson`

`bodyJson` must use structured blocks, not raw HTML.

## Structured Content Blocks

`bodyJson` uses the versioned block AST defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

V1 supports paragraph, heading, image, quote, buttonLink, divider, callout, and list blocks. Unsupported block types fail validation in admin APIs rather than render unpredictably.

## Slug And URL Rules

- Public slugs are lowercase ASCII with hyphen separators.
- Legal page slugs are stable: `privacy-policy`, `terms-of-use`.
- News detail slugs are unique per locale.
- CMS IDs are not exposed as public route identifiers unless no slug exists.
- Changing a published slug requires a redirect record.

Redirect model:

```text
from_path
to_path
locale
status_code
created_at
created_by
```

V1 can defer redirect UI, but the schema should not make slug changes destructive.

## SEO Model

Every public detail page can define:

- `metaTitle`
- `metaDescription`
- `openGraphTitle`
- `openGraphDescription`
- `openGraphImageAssetId`
- `canonicalPath`
- `noIndex`

If SEO fields are missing:

- title defaults to content title + site name
- description defaults to summary
- Open Graph image defaults to content cover asset or site default image

Sitemap includes only published, indexable content.

## Domain Modules

### Home

Home is a composed projection, not a large independent content record.

Sources:

- hero: `home_section`
- featured news: published `news`
- latest weekly: published `bulletin`
- videos: published `video`
- about teaser: `page` or `home_section`
- locations: active `location`

Admin should allow choosing sort/order/visibility for home sections without duplicating source content.

### News

CMS fields:

- `slug`
- localized `title`
- localized `summary`
- localized `bodyJson`
- cover `assetId`
- display date
- pinned flag
- category/tag list, optional in v1

Public `NewsItem` projection:

```json
{
  "id": "formation-sharing",
  "title": "...",
  "summary": "...",
  "date": "2025 / 05 / 10",
  "imageAlt": "...",
  "href": "/zh-Hant/news/formation-sharing"
}
```

The current frontend only lists news; detail pages can be added later without changing source ownership.

### Weekly Bulletins

Source:

- `bulletin_issue`: issue date and lifecycle.
- `bulletin_version`: locale, title, subtitle, PDF asset, lifecycle.

Public projection must remain compatible with:

```ts
type WeeklyIssue = {
  id: string;
  date: string;
  versions: WeeklyBulletin[];
};
```

Download URLs must come from `asset-api` stable public URL:

```text
https://www.alive.org.tw/api/assets/public/{assetId}
```

### Videos

V1 videos are external YouTube links, not uploaded video files.

CMS fields:

- external provider: `youtube`
- external id or URL
- localized title
- localized image alt
- thumbnail URL or thumbnail asset ID
- published date/order
- visibility on home

Public `VideoItem` projection:

```json
{
  "id": "breakthrough",
  "title": "...",
  "imageSrc": "https://img.youtube.com/...",
  "imageAlt": "...",
  "href": "https://youtu.be/..."
}
```

If a custom thumbnail is uploaded later, it should use `asset-api` namespace `cms.video.thumbnail`.

### Locations

CMS fields:

- stable location key
- localized name
- localized address
- map URL
- service times, optional in v1
- phone/email, optional
- sort order
- active flag

Public projection should remain compatible with `LocationItem`.

### About And Vision

About page uses:

- hero title/subtitle
- vision content blocks
- history timeline

The page-level editorial content belongs to CMS. Generic component labels remain in i18n messages.

### History Timeline

History timeline should be modeled as ordered events:

- event date display text
- sort date, nullable when the display value is non-specific
- localized body
- `continued` flag
- sort order

Public projection remains compatible with:

```ts
type HistoryEvent = {
  date: string;
  body: string;
  continued?: boolean;
};
```

### Legal Pages

Legal pages are CMS content with stable slugs:

- `privacy-policy`
- `terms-of-use`

They should support published version history. The admin should show last published timestamp and editor.

## Admin Workflows

### Standard Content Workflow

1. Create draft.
2. Edit localized content.
3. Attach assets where needed.
4. Preview in admin.
5. Validate missing locale/SEO/asset rules.
6. Publish.
7. Public projection refreshes.
8. Audit event is emitted.

### Weekly Bulletin Workflow

1. Create issue by issue date.
2. Upload one PDF per locale.
3. `asset-api` scans and marks asset ready.
4. Admin adds localized title/subtitle.
5. Publish issue/version.
6. `hhc-web-api` grants public read to PDF asset.
7. Website and LINE bot can download through public API.

### Location Workflow

1. Create or edit location.
2. Validate map URL.
3. Publish/activate.
4. Home and locations projection refresh.

## Validation Rules

- `locale` must be one of `zh-Hant`, `zh-Hans`, `en`.
- Published content must have at least `zh-Hant` content unless explicitly configured otherwise.
- Public content must not reference private, infected, or scan-failed assets.
- Bulletin PDF must be `application/pdf`.
- News cover must be an image asset.
- External URLs must use `https`.
- YouTube videos must store canonical provider metadata, not only arbitrary embed HTML.
- Legal page slugs cannot be changed casually after publish.

## Migration From Current Mock Data

Migration should follow `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md` and preserve public shapes first:

1. Snapshot current mock data, locale files, static routes, and public assets with checksums.
2. Validate current rendered text in `zh-Hant`, `zh-Hans`, and `en` before seeding canonical CMS data.
3. Generate deterministic seed manifests and public API fixtures.
4. Implement public projections matching existing TypeScript models.
5. Move weekly bulletins to CMS source and `asset-api`.
6. Move news/videos/locations/history from mock data to CMS source.
7. Move about/legal/home editorial content from i18n messages to CMS source.
8. Move navigation, footer links, social links, public contact display, and site SEO defaults into site settings; keep button labels, menu/language chrome, generic UI states, and route registry in frontend i18n/code for v1.

Do not remove mock data until public API parity tests cover every current route.
