# News Content Structured Data and SEO Design

**Date:** 2026-08-14

## Goal

Improve the existing news-content SEO without changing the established
multilingual URL model. Add accurate content ownership and publication
metadata at the CMS source, carry it through the public contract, and use it
for visible article attribution, structured data, concise search metadata, and
crawlable links to recent content.

## Confirmed Product Decisions

- Implement the complete cross-repository solution rather than a frontend-only
  approximation.
- A public article author is not the CMS editor account. `createdBy` and
  `updatedBy` remain private audit fields and are never exposed publicly.
- `authorName` is optional and shared across all locales. When it is blank, the
  public site displays and marks up the localized HHC organization name.
- There is no author URL or author profile page in this phase.
- Related-content links are automatic: display the newest three items available
  in the article's resolved content locale, excluding the current article.
  There is no manual relationship editor, tag system, or category taxonomy.
- The existing news `displayDate` is an activity date, not an article
  publication date.
- The article footer displays the public author and publication date in muted
  text. It displays an updated date only after a later successful republication.
- Existing articles use their currently stored successful publication timestamp
  as the best-known initial publication timestamp. The migration documents this
  legacy limitation; all future publication timestamps are exact.

## Current State

The current production site already has localized news titles, descriptions,
canonical URLs, language alternates, Open Graph metadata, and basic crawlable
links from the home page and news list. It only emits `WebSite` structured data
on the neutral root. It does not emit `Organization`, `NewsArticle`, or
`BreadcrumbList` data.

The CMS stores a required news `displayDate`, localized title/summary/body/image
alt text, internal `createdBy`/`updatedBy` identifiers, and one `published_at`
timestamp that is overwritten after every successful publication. Public
projections do not currently expose the author or publication timestamps.

## Approaches Considered

### Chosen: backward-compatible staged delivery

Extend the source model and public response with optional fields, publish the
client contract, then upgrade Admin and the public site. Old consumers continue
to work while the repositories are released in dependency order.

This approach minimizes production coupling and permits independent rollback of
each consumer.

### Rejected: coordinated big-bang release

Making the new fields required immediately would require API, package, Admin,
and website releases to land together. That conflicts with the workspace's
independent PR and immutable-release boundaries and creates unnecessary outage
risk.

### Rejected: frontend-only heuristics

Deriving authors from CMS editor identifiers or treating activity dates as
publication dates would emit inaccurate public information. Fetching the
current page alone also cannot distinguish first publication from later
republication.

## Repository Ownership

### `hhc-web-api`

Owns the CMS source fields, lifecycle timestamps, validation, revisions, public
projection, OpenAPI specification, migration, and backward-compatible public
response.

### `frontend-platform`

Owns the generated `@hallelujahhomechurch/hhc-web-client` contract. The next
package version is `0.6.8`.

### `admin-fe`

Owns the public-author input and summary-writing guidance. It consumes the
versioned client rather than duplicating the HTTP contract.

### `hhc-web`

Owns visible article attribution, metadata normalization, automatic recent-news
links, and page-level structured data.

No gateway route, new microservice, asset contract, identity contract, or CMS
editor-account exposure is required.

## Source Data Model

### Public author

Add `author_name text NOT NULL DEFAULT ''` to `hhc_web.news_item` and expose it
as `authorName` on news admin items, write inputs, revisions, and public
projections.

Validation rules:

- trim surrounding whitespace;
- maximum 200 Unicode code points;
- accept blank as the explicit HHC fallback;
- reject `authorName` on non-news modules instead of silently retaining an
  inapplicable value.

The field is not localized. A named person keeps the same public identity on
every translation. A blank value is localized by `hhc-web` to the resolved
page locale's church name. Admin guidance asks for a person's display name;
organization or team bylines stay blank and use the HHC fallback. The API does
not attempt unreliable semantic name classification.

### Publication timestamps

Add nullable `first_published_at timestamptz` to
`hhc_web.content_entry`. Continue using the existing `published_at` column as
the latest successful publication timestamp.

Migration behavior:

- for an existing row with `published_at`, set `first_published_at` to that
  value;
- leave never-published rows null;
- do not derive either value from `displayDate`, `createdAt`, `updatedAt`, or
  audit-user activity.

Successful publication behavior:

```text
first_published_at = COALESCE(first_published_at, successful_publish_time)
published_at       = successful_publish_time
```

Failed or queued publication does not change either timestamp. Unpublish keeps
both timestamps so a later republish preserves the original first-publication
value. The public projection exposes them as optional RFC 3339 strings named
`firstPublishedAt` and `lastPublishedAt`.

For a first publication the two values are equal. The website only shows and
marks up `dateModified` when `lastPublishedAt` is later than
`firstPublishedAt`.

## API and Client Contract

The `ContentWriteInput` and admin `ContentItem` schemas gain optional
`authorName`. The public `PublicContentItem` gains optional `authorName`,
`firstPublishedAt`, and `lastPublishedAt`.

All fields remain optional at the HTTP boundary during staged delivery. The API
always emits the timestamp fields for successfully published content after the
migration. Older projections remain readable, and the migration updates
existing news projection JSON so already-published articles receive the new
metadata without requiring an editorial republish.

The projection backfill reads the source `news_item.author_name`,
`content_entry.first_published_at`, and `content_entry.published_at`; it does not
rewrite titles, bodies, locale metadata, assets, routes, or versions. It
recomputes ETags only for the affected news projections using the repository's
existing SQL-migration convention because their payloads change.

`frontend-platform` copies the released API OpenAPI schema, regenerates the
TypeScript client, tests generated-file consistency, publishes
`@hallelujahhomechurch/hhc-web-client@0.6.8`, and verifies both consumer builds
before downstream repositories upgrade.

## Admin Experience

For the news module only, the basic-settings section adds a text field:

```text
Public author (optional, person name only)
Leave blank to show Hallelujah Home Church as the author.
```

The exact label and hint are localized in every Admin UI locale. The field is
shared across content translations and participates in dirty-state detection,
save, revision restore, and mock mode.

Each news-summary editor retains the existing 500-character API maximum and
adds:

- a live character count;
- localized guidance to write one or two page-specific summary sentences;
- no SEO keyword stuffing guidance, hard 160-character truncation, or separate
  SEO-description field.

When a localized summary is blank, the existing API behavior continues to
derive a 160-code-point excerpt from that locale's body. AI translation preview
continues translating the body; it does not introduce a second summary
generation pipeline.

## Public Website Experience

### Metadata normalization

For news detail metadata, normalize the selected summary by trimming it and
collapsing whitespace runs to one space. Do not truncate it. If it is blank,
retain the existing localized news-page description fallback.

The visible article body and stored summary are not modified by this metadata
normalization.

### Visible article metadata

Keep the activity date near the article heading and relabel it as the localized
equivalent of `Activity date`.

Add a muted footer after the article body containing:

- localized `Author` plus `authorName`, or the resolved locale's HHC name when
  blank;
- localized `Published` plus `firstPublishedAt`;
- localized `Updated` plus `lastPublishedAt` only when it is later than
  `firstPublishedAt`.

Dates use locale-aware formatting while machine-readable `<time dateTime>`
values retain their exact RFC 3339 timestamps.

### Automatic internal links

After resolving the article, fetch the first four newest news items for its
resolved content locale, remove the current item by stable ID, and render at
most three remaining items below the article. This keeps fallback articles and
their internal links in the same language. Use the existing crawlable
`NewsSection` links and a localized `Latest news` heading.

The related-list request is non-critical. If it fails, the article, metadata,
and structured data still render and the section is omitted. The page does not
label these chronologically selected entries as semantically `related`.

## Structured Data

All structured data is JSON-LD, is serialized with the existing `<` escaping
rule, uses absolute HTTPS URLs, and mirrors visible page content.

### Root `Organization`

Define one reusable domain-level `Organization` node and emit it on `/` with:

- `@id: https://www.alive.org.tw/#organization`;
- `name: HHC`;
- the five full localized church names as `alternateName`;
- `url: https://www.alive.org.tw/`;
- absolute logo URL;
- existing official YouTube and Facebook URLs in `sameAs`.

Keep the existing `WebSite` node and emit it with the `Organization` in one
JSON-LD `@graph`; do not add a second root script or a new serialization
dependency. Do not add an address, telephone number, opening hours, geographic
coordinates, or branch data. Those belong to the separate Google
Business/Profile and local search work. News detail JSON-LD graphs include the
same `Organization` node so `author` and `publisher` references are
self-contained on the article page.

### News `NewsArticle`

Each news detail page emits one `NewsArticle` node with:

- canonical page URL as `mainEntityOfPage`;
- localized `headline` and normalized `description`;
- resolved content locale as `inLanguage`;
- representative image only when available;
- `datePublished` from `firstPublishedAt` when available;
- `dateModified` only after a later successful republication;
- `author` as a `Person` with the shared public `authorName`, or a reference to
  the HHC `Organization` when blank;
- `publisher` referencing `https://www.alive.org.tw/#organization`.

Do not emit CMS account IDs, activity dates as publication dates, invented
author URLs, ratings, or unsupported rich-result fields.

### News `BreadcrumbList`

Each news detail page emits one localized three-level breadcrumb:

```text
Home -> Latest news -> Current article
```

Each item uses the canonical resolved-locale URL. Visible site navigation
already exposes Home and Latest news links; the structured breadcrumb does not
introduce a separate visual breadcrumb component in this phase.

## Compatibility and Failure Handling

- API changes are additive and consumers treat new fields as optional.
- Admin and website continue working during an API rollback.
- The API remains the only owner of source and projection data.
- Existing ETag and optimistic-concurrency behavior remains unchanged.
- A blank author uses a deterministic organization fallback.
- Missing timestamps omit the corresponding visible line and schema property.
- Recent-news request failure never fails the detail page.
- Invalid structured-data inputs omit optional properties rather than emitting
  malformed values.

## Testing

### `hhc-web-api`

- migration policy and migration-content assertions;
- author normalization, length validation, and non-news rejection;
- first publish, republish, unpublish/republish, and failed-publication timestamp
  behavior;
- revision preservation and restore;
- public projection and legacy projection backfill;
- OpenAPI contract tests and full Go test suite.

### `frontend-platform`

- generated contract check;
- client serialization of `authorName`;
- parsing/typing of public timestamps;
- package build, pack, and consumer tests.

### `admin-fe`

- load/edit/save/restore of the shared author field;
- blank-author hint and 200-code-point browser constraint;
- summary count and guidance in every news locale tab;
- dirty-state and mock-mode regressions;
- full tests, lint, and production build.

### `hhc-web`

- summary whitespace normalization;
- organization JSON-LD exact contract;
- `NewsArticle` person and organization author paths;
- publication/update date rules and locale-aware visible output;
- localized `BreadcrumbList` URLs and labels;
- newest-three exclusion and graceful list failure;
- existing canonical, `hreflang`, fallback-locale, metadata, and full site build
  regressions.

After deployment, validate representative URLs with Google's Rich Results Test
and Search Console URL Inspection. Structured data eligibility does not
guarantee that Google will display an enhanced result.

## Delivery Sequence

Every repository uses a separate focused branch, PR, CI gate, squash merge,
immutable release, and production verification.

1. Release the backward-compatible `hhc-web-api` migration and runtime. Verify
   migrations, readiness, a published news response, and rollback state.
2. Release `frontend-platform` client `0.6.8`. Verify the registry package and
   consumer compatibility.
3. Upgrade and release `admin-fe`. Verify author editing, summary guidance,
   save/reload, and publication against the live API.
4. Upgrade and release `hhc-web`. Verify root Organization data, a news page's
   article/breadcrumb data, visible dates/author, latest-news links, health, and
   all five locales.
5. Run Rich Results and Search Console checks after the public revision is live.

If a producer release fails, stop before releasing its consumers. If a consumer
release fails, keep the prior healthy consumer revision; do not roll back the
already-compatible producer solely because an optional consumer is delayed.

## Explicit Exclusions

- Google Business Profile, Maps, addresses, coordinates, and opening hours;
- tags, categories, manual related-news selection, or recommendation ranking;
- author profile pages, author URLs, avatars, or CMS-account disclosure;
- title rewriting beyond the existing localized title pattern;
- a separate SEO-description field or arbitrary description-length cap;
- `Event`, `LocalBusiness`, `Place`, review, rating, FAQ, or video schema;
- gateway, authentication, asset, campaign, or notification changes.

## Success Criteria

- editors can save one optional shared public author without exposing their CMS
  identity;
- successful publications preserve the first publication time and update the
  last publication time, with legacy values migrated as documented;
- published news responses carry backward-compatible author and timestamp data;
- every news detail page keeps its activity date, shows unobtrusive attribution
  and publication data, and links to up to three recent locale-appropriate news
  items;
- root `Organization`, news `NewsArticle`, and news `BreadcrumbList` JSON-LD
  validate and match visible/canonical content;
- all four repositories pass local verification, independent CI, release, and
  production smoke checks in dependency order.
