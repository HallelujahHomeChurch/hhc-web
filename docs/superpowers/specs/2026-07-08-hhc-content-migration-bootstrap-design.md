# HHC Content Migration And Bootstrap Design

## Purpose

This spec defines how the current visible `hhc-web` content moves from frontend mock data, i18n JSON, and `public/assets` into `hhc-web-api`, CMS source tables, public projections, and `asset-api`.

The migration goal is public behavior parity first. The website should keep the same routes, locales, SEO behavior, and visible content while the data source changes behind typed adapters.

Local seed execution, fake asset dependencies, public API fixture generation, and CI/staging verification boundaries should follow `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md`.

Canonical URLs, route parity, sitemap fixtures, locale alternates, redirects, and metadata migration should follow `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

Accessibility metadata, image alt text, dimensions, derivative fixture expectations, and performance parity checks should follow `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

CMS revision snapshots, seeded revisions, restore, and rollback behavior should follow `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

Site settings, navigation, footer links, social links, public contact display, shared layout projections, and runtime-config separation should follow `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

Structured content block schema, body migration rules, renderer contract, and no-raw-HTML rules should follow `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

## Decision

Use a deterministic seed/import pipeline owned by `hhc-web-api` for v1.

Do not manually copy current frontend data into SQL by hand. Do not delete mock data during the first API rollout. Do not introduce a long-term dual-write model between mock files and CMS.

The intended flow is:

1. Snapshot current frontend sources.
2. Normalize them into versioned seed manifests.
3. Import records idempotently into `hhc_web` source tables.
4. Import or register content assets through `asset-api`.
5. Create `seeded` content revisions for imported source aggregates.
6. Convert editorial body text into HHC structured block AST with `schemaVersion`.
7. Generate public projections.
8. Verify API and rendered page parity.
9. Switch frontend modules to API-backed reads.
10. Remove production dependence on mock data only after parity is proven.

## Source Inventory

Current content sources in `hhc-web`:

| Source | Current Role | Migration Target |
| --- | --- | --- |
| `src/i18n/locales/zh-Hant.json` | localized UI and editorial text | split into frontend i18n and CMS seed |
| `src/i18n/locales/zh-Hans.json` | localized UI and editorial text | split into frontend i18n and CMS seed |
| `src/i18n/locales/en.json` | localized UI and editorial text | split into frontend i18n and CMS seed |
| `src/features/news/mock-data.ts` | news list data | CMS `news` records and public `news` projection |
| `src/features/weekly/mock-data.ts` | weekly issue/version data | CMS `bulletin_issue`, `bulletin_version`, and asset references |
| `src/features/videos/mock-data.ts` | video list data | CMS `video` records |
| `src/features/locations/mock-data.ts` | location list data | CMS `location` records |
| `src/features/history/mock-data.ts` | history timeline data | CMS `history_event` records |
| `src/lib/site.ts` | site name, canonical URL, social links, music link | split runtime config from site settings seed |
| `src/app/sitemap.ts` | static public route registry | public sitemap projection plus route registry |
| `public/assets/about/*` | about and vision images | `asset-api` namespace `cms.page.image` if CMS references them |
| `public/assets/banners/*` | hero/banner images | `asset-api` namespace `cms.page.image` if CMS-managed |
| `public/assets/brand/*` | logo/favicon | keep static brand assets unless brand management becomes a CMS feature |

Expected current public routes:

- `/[locale]`
- `/[locale]/about`
- `/[locale]/literature-ministry`
- `/[locale]/privacy-policy`
- `/[locale]/terms-of-use`

Supported v1 locales:

- `zh-Hant`
- `zh-Hans`
- `en`

## Content Classification

### Keep In Frontend i18n

These remain in locale JSON or code-level i18n:

- button labels and command labels
- loading, empty, and error text
- form labels
- component chrome
- menu open/close and language-switcher labels
- accessibility labels that describe UI controls
- route names that are not content slugs

Reason: these are product UI strings, not editorial content.

### Move To CMS

These should become CMS source records:

- home hero editorial text
- home section headings if they are editor-owned
- about hero copy
- vision content
- history timeline
- weekly bulletin issue/version metadata
- news list entries and future news detail content
- video display metadata
- location names, addresses, map links, and sort order
- privacy policy
- terms of use
- SEO title, description, canonical path, no-index flag, and Open Graph image references
- header navigation items
- footer legal/resource links
- social profile URLs and music channel URL
- public contact display fields
- public site name and site SEO defaults

Reason: these are website content that editors should change without a frontend deployment.

### Keep In Code Or Config For V1

These can stay code/config until an explicit admin editing need appears:

- supported locale registry
- static route registry
- site base URL per environment
- brand logo and favicon
- default Open Graph image fallback only until the referenced asset is managed through site settings

Reason: changing these can affect routing, deployment, security, or brand governance. They do not need to be CMS-editable in v1.

## Encoding And Content Quality Gate

Before seeding content, run an encoding and render-quality check.

Required checks:

- Read source files as UTF-8.
- Render current pages in all three locales.
- Compare visible browser text with the intended church copy.
- Flag mojibake, broken quotes, malformed strings, or temporary links.
- Preserve source checksums in the seed manifest.
- Do not seed corrupted text as canonical CMS content.

If current mock or i18n text is already corrupted, the seed should mark those fields as `needs_review` and use corrected editor-approved text before production import.

This avoids converting a temporary frontend data problem into permanent CMS state.

## Seed Manifest

Create deterministic seed manifests before importing into PostgreSQL.

Suggested location once implementation starts:

```text
hhc-web-api/seeds/content/v1/
  seed-manifest.json
  home.zh-Hant.json
  home.zh-Hans.json
  home.en.json
  news.json
  weekly-bulletins.json
  videos.json
  locations.json
  history.json
  legal-pages.json
  assets.json
```

For frontend parity tests, mirror public API fixtures under the frontend repo:

```text
src/test/fixtures/public-api/
  home.zh-Hant.json
  news.zh-Hant.json
  bulletins.latest.zh-Hant.json
  videos.zh-Hant.json
  locations.zh-Hant.json
  history.zh-Hant.json
  legal.privacy-policy.zh-Hant.json
```

`seed-manifest.json` fields:

```json
{
  "seedVersion": "2026-07-08-v1",
  "sourceRepo": "hhc-web",
  "sourceCommit": "git-sha",
  "locales": ["zh-Hant", "zh-Hans", "en"],
  "sources": [
    {
      "path": "src/features/news/mock-data.ts",
      "sha256": "..."
    }
  ],
  "assets": [
    {
      "sourcePath": "public/assets/about/process-illustration.png",
      "sha256": "...",
      "namespace": "cms.page.image"
    }
  ]
}
```

## Stable Identifiers

Seed records must be idempotent. Re-running the seed cannot create duplicates.

Use stable natural keys:

| Data Type | Stable Key |
| --- | --- |
| CMS page | `type + slug + locale` |
| translation group | `type + canonicalSlug` |
| news | `news + slug + locale` |
| weekly issue | `issueDate` |
| weekly version | `issueDate + locale` |
| video | `provider + providerVideoId` or stable slug |
| location | stable location key |
| history event | `timeline + sortOrder + locale` or explicit event key |
| legal page | `slug + locale` |
| asset | `namespace + sha256 + sourcePath` during seed |

Public IDs should stay compatible with existing TypeScript models where possible. For example, existing news IDs like `formation-sharing` can become slugs and public projection IDs.

## Asset Migration

`asset-api` owns bytes, storage keys, scan state, visibility, grants, derivatives, and stable gateway URLs.

Migration rules:

- Do not expose Azure Blob URLs or SAS URLs in seed output.
- Do not keep CMS-referenced public images as permanent direct `/assets/*` dependencies unless they are intentionally static brand assets.
- Import CMS page/news/video/bulletin assets through `asset-api`.
- Store only `assetId` in `hhc-web-api` CMS source records.
- Public projections expose gateway URLs generated by `asset-api`.

Asset namespace mapping:

| Source Asset | Namespace |
| --- | --- |
| weekly PDFs | `cms.weekly.pdf` |
| news cover images | `cms.news.cover` |
| about, vision, hero, legal page images | `cms.page.image` |
| custom video thumbnails | `cms.video.thumbnail` |
| brand logo/favicon | keep static for v1 |

Weekly PDFs referenced by old paths such as `/assets/weekly/{issue}-{locale}.pdf` must become asset records. The public download URL becomes:

```text
https://www.alive.org.tw/api/assets/public/{assetId}
```

## Database Bootstrap Flow

Suggested importer stages:

1. Load and validate seed manifest.
2. Upsert assets through an internal seed adapter that calls `asset-api` or uses local dev asset stubs.
3. Upsert CMS source records in `hhc_web`.
4. Upsert localized content records with `translationGroupId`.
5. Create or refresh public projections.
6. Emit audit events for production seed runs.
7. Write a seed run record with seed version, source commit, checksums, row counts, and warnings.

Seed run table:

```text
content_seed_run
- id
- seed_version
- source_repo
- source_commit
- manifest_sha256
- status
- warning_count
- inserted_count
- updated_count
- skipped_count
- started_at
- finished_at
- created_by
```

Seeded records should include:

```text
seed_version
source_path
source_key
source_sha256
```

These fields make rollback, audit, and later cleanup practical.

## Public Projection Parity

The first public API projections should match current frontend feature shapes.

Required projection compatibility:

| Current Type | Public API Compatibility |
| --- | --- |
| `NewsItem` | `id`, `title`, `summary`, `date`, `imageAlt`, `href` |
| `WeeklyIssue` | `id`, `date`, `versions` |
| `WeeklyBulletin` | `locale`, `date`, `title`, `subtitle`, `href` |
| `VideoItem` | `id`, `title`, `imageSrc`, `imageAlt`, `href` |
| `LocationItem` | `id`, `name`, `address`, `mapHref` |
| `HistoryTimelinePayload` | `events` |

The source CMS model can be richer, but the projection layer should let frontend migration happen without rewriting presentation components first.

## Frontend Migration Strategy

Do not switch every page at once.

Recommended order:

1. Add typed API client with mock fallback for local development and tests.
2. Add public API fixtures generated from seed data.
3. Switch site layout for header, footer, navigation, social links, contact display, and site SEO defaults.
4. Switch weekly latest/archive.
5. Switch news, videos, locations, and history.
6. Switch about, home editorial sections, privacy policy, and terms of use.
7. Switch sitemap data from static registry to API-backed data when dynamic content pages exist.
8. Remove production mock fallback only after staging parity.

Feature adapters should preserve current exported function names:

- `getLatestWeekly`
- `getWeekly`
- `getWeeklyIssues`
- `getWeeklyIssuePage`
- `getNews`
- `getVideos`
- `getLocations`
- `getHistoryTimeline`
- `getSiteLayout`

This keeps component changes small and reduces migration risk.

## Legal Pages

Legal pages need stricter handling than normal page content.

Rules:

- Preserve slugs: `privacy-policy`, `terms-of-use`.
- Preserve route behavior in every locale.
- Store version history.
- Record last published timestamp and publisher.
- Avoid casual slug changes.
- Add `noIndex` only if explicitly required.
- Keep previous published version available for rollback.

## Weekly Bulletin Bootstrap

Weekly bulletins are the best first migration slice because they exercise CMS metadata, PDF assets, public projections, asset grants, website downloads, and LINE bot reuse.

Bootstrap steps:

1. Import issue dates into `bulletin_issue`.
2. Import one localized version per locale into `bulletin_version`.
3. Import PDF files into `asset-api` as `cms.weekly.pdf`.
4. Keep versions unpublished until PDFs are clean.
5. Publish issue/version.
6. Grant public read on each published PDF asset.
7. Refresh latest and archive projections.
8. Verify website download links.
9. Verify LINE bot can fetch latest and a specific issue through public APIs.

LINE bot should call `hhc-web-api` public bulletin routes, not `asset-api` or Blob directly, for public weekly downloads.

## Rollback Strategy

Rollback should be boring and reversible.

Frontend rollback:

- Feature flag API-backed reads off.
- Fall back to existing mock data in local/staging while production cutover is validated.
- Keep old static routes and locale messages until parity is complete.

Backend rollback:

- Keep seeded source rows with a `seed_version`.
- Mark imported content `unpublished` instead of deleting it.
- Rebuild public projections from the last known good seed version.
- Revoke public asset grants when content is unpublished.

Asset rollback:

- Do not delete imported blobs immediately.
- Remove public grants first.
- Retain objects for a recovery window.

## Verification Matrix

Required checks before removing production mock dependence:

| Area | Verification |
| --- | --- |
| Encoding | current rendered text is approved for all locales |
| API fixtures | generated fixtures match current TypeScript shapes |
| Weekly | latest and archive return published issues only |
| Assets | public URLs are gateway URLs, never Blob/SAS URLs |
| News | list order, dates, summaries, links, and locale data match |
| Videos | YouTube links and thumbnails are valid |
| Locations | address and map URLs are valid HTTPS links |
| History | event order and `continued` flags match |
| Legal | slugs and locale pages still render |
| Sitemap | all current locale routes remain present |
| SEO | alternates, canonical paths, and Open Graph defaults remain valid |
| Admin | seeded records can be edited, previewed, published, and unpublished |
| Audit | production seed run and publish actions are traceable |
| LINE | latest and date-specific bulletin downloads work through public API |

## Implementation Ownership

`hhc-web-api` owns:

- seed manifest format
- importer code
- CMS source upserts
- public projection generation
- seed run records
- production seed audit events

`asset-api` owns:

- asset import/upload mechanics
- scan status
- storage paths
- public grants
- stable download URLs

`hhc-web` owns:

- typed public API adapters
- mock fallback removal timing
- route rendering parity tests
- admin UI components for editing seeded content
- site-layout adapters and local/test fallback while migration is staged

`hhc-line-function-bot` owns:

- weekly bulletin function arguments
- bot reply formatting
- using public `hhc-web-api` routes for public bulletins

## Anti-Patterns To Avoid

- Seeding directly into `public_projection` without CMS source records.
- Letting frontend call `asset-api` or Blob directly for CMS content.
- Treating CMS asset paths as static `/assets/*` URLs.
- Moving generic button labels, loading states, menu chrome, and language-switcher UI text into CMS too early.
- Treating editable site settings as runtime config or env-only values.
- Creating `cms-api` only to import current content.
- Creating `bulletin-api` only because weekly PDFs have a distinct UI.
- Permanently maintaining mock data as a second source of truth.
- Importing corrupted or unreviewed locale strings into production CMS.

## Rollout Checklist

- [ ] Snapshot current content sources and public assets.
- [ ] Record source commit and checksums.
- [ ] Render current pages in all locales and approve visible content.
- [ ] Generate seed manifest.
- [ ] Import assets through `asset-api` or local dev stubs.
- [ ] Import CMS source records into `hhc_web`.
- [ ] Convert editorial body content into supported structured blocks.
- [ ] Generate public projections.
- [ ] Generate frontend public API fixtures.
- [ ] Add API clients and feature adapters with mock fallback.
- [ ] Switch weekly bulletin pages.
- [ ] Verify LINE bot weekly download through public API.
- [ ] Switch news, videos, locations, and history.
- [ ] Switch about, home editorial content, and legal pages.
- [ ] Verify migrated `bodyJson` uses supported structured block types only.
- [ ] Switch header/footer/navigation/social/contact display to `GET /api/site-layout`.
- [ ] Run full route, locale, SEO, sitemap, asset URL, and admin workflow parity checks.
- [ ] Disable production mock fallback.
- [ ] Remove unused mock data only after a stable production window.
