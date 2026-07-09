# HHC Public API Contract

`hhc-web-api` public route behavior, projection ownership, cache policy, and extraction triggers are defined in `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`.

Public projection versioning, Redis keys, ETags, cache headers, negative cache, publish/unpublish invalidation, sitemap refresh, and LINE bot consistency rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.

Publication workflow consistency and grant-before-visible rules are defined in `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

Canonical URLs, sitemap route metadata, locale alternates, slug redirects, robots/noindex policy, and metadata rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

CMS localization, source locale, translation status, fallback behavior, per-locale publish, and weekly bulletin locale consistency are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

Accessibility, image alt/decorative metadata, media dimensions, derivative URLs, and public performance requirements are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

Site layout, navigation, footer links, social links, contact display, and shared public settings are defined in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

Public third-party links, embeds, analytics, consent, provider registry, and provider-scoped CSP behavior are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.

Structured content body blocks, renderer contract, link validation, body asset references, and no-raw-HTML rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Public search ownership, result safety, index maintenance, CJK tokenization, and extraction triggers are defined in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

Shared envelope, error, pagination, locale, cache, and versioning rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

OpenAPI ownership, generated clients, compatibility checks, and consumer contract tests are defined in `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

Public route classification, protected-route metadata, and service-owned authorization policy rules are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

## Base

All public website APIs are served from:

```text
https://www.alive.org.tw/api
```

There is no `api.alive.org.tw`.

Public routes return published content only. Draft, unpublished, archived, deleted, private, restricted, infected, or scan-failed resources must not appear in public responses.

## Envelope

The canonical envelope and error schema live in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Failure:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_123"
  },
  "error": {
    "code": "not_found",
    "message": "Not found"
  }
}
```

## Locale

Supported locales:

- `zh-Hant`
- `zh-Hans`
- `en`

Default locale is `zh-Hant`. Detail endpoints should not silently return another locale unless `meta.fallbackLocale` is present.

Weekly bulletin endpoints do not silently fallback to a different-locale PDF. A missing requested-locale bulletin version returns `404` unless an endpoint explicitly supports fallback metadata.

## Endpoints

### Home

```text
GET /api/home?locale=zh-Hant
```

Returns the published home projection, including hero content, featured news, latest bulletin summary, videos, and locations needed by the current website.

### Site Layout

```text
GET /api/site-layout?locale=zh-Hant
```

Returns published shared layout settings for header navigation, footer links, public social links, public contact display, and site-wide SEO defaults. The response must not include secrets, internal service URLs, Blob URLs, SAS URLs, draft links, admin-only route policy, raw iframe HTML, script tags, tag-manager snippets, tracking pixels, or provider API keys.

External links and provider references must be registry-approved before appearing in public responses.

### News

```text
GET /api/news?locale=zh-Hant&page=1&pageSize=10
GET /api/news/{slug}?locale=zh-Hant
```

List response includes only published news. Detail response returns `404` when the slug is missing, unpublished, or not available in the requested locale.

Detail body content returns render-ready structured blocks such as paragraphs, headings, images, quotes, button links, dividers, callouts, and lists. Public responses must not include raw HTML, raw Markdown, editor-native JSON, arbitrary CSS classes, Blob/SAS URLs, internal URLs, admin URLs, `/priv/*`, or `/api/priv/*`.

### Pages

```text
GET /api/pages/{slug}?locale=zh-Hant
```

Used for public pages such as about, vision, and custom CMS pages.

Page body content uses the same render-ready structured block contract as news details.

### Videos

```text
GET /api/videos?locale=zh-Hant&page=1&pageSize=12
```

Returns published video metadata and external video URLs/embed IDs. Video binary content is not stored in `asset-api` unless explicitly uploaded later. Embed ids are render hints only; browser embed loading follows the third-party governance and consent rules.

### Locations

```text
GET /api/locations?locale=zh-Hant
```

Returns active location cards, map links, service times, and contact display data.

### History

```text
GET /api/history?locale=zh-Hant
```

Returns the published history timeline payload.

### Legal

```text
GET /api/legal/{slug}?locale=zh-Hant
```

Returns published legal pages.

Legal body content uses the same render-ready structured block contract as other CMS pages.

### Bulletins

```text
GET /api/bulletins/latest?locale=zh-Hant
GET /api/bulletins/{issueDate}?locale=zh-Hant
GET /api/bulletins?locale=zh-Hant&page=1&pageSize=20
```

`issueDate` format is `YYYY-MM-DD`.

Response:

```json
{
  "data": {
    "id": "bulletin_2026_07_12",
    "issueDate": "2026-07-12",
    "locale": "zh-Hant",
    "title": "2026-07-12 週報",
    "assetId": "asset_123",
    "downloadUrl": "https://www.alive.org.tw/api/assets/public/asset_123",
    "mimeType": "application/pdf",
    "sizeBytes": 1234567,
    "publishedAt": "2026-07-12T00:00:00Z"
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Rules:

- Latest returns the newest published bulletin for the requested locale.
- Latest does not return a newly requested bulletin while its publication workflow is still waiting for PDF public grant confirmation.
- Specific issue returns `404` when unpublished, missing, or no published version exists for the requested locale.
- Download URL must be a stable gateway URL, not a Blob URL.

### Sitemap Data

```text
GET /api/sitemap-data?locale=zh-Hant
```

Returns published route metadata only.

### Search

```text
GET /api/search?locale=zh-Hant&q=church&type=news,page,bulletin&page=1&pageSize=10
```

This is a post-v1 route to enable only when public website search is implemented.

Rules:

- Search results are generated from published public projections only.
- Draft, unpublished, archived, deleted, private, restricted, infected, scan-failed, or stale projection results must not appear.
- Results return public URLs and plain-text snippets only.
- Public search must not expose raw HTML, raw structured block JSON, Blob/SAS URLs, admin URLs, internal URLs, `/priv/*`, or `/api/priv/*`.
- Search is locale-scoped by default and must support `zh-Hant`, `zh-Hans`, and `en`.

## Cache

Public APIs may be cached by Redis and short CDN/browser TTLs. Publish/unpublish must invalidate or version-bump affected keys immediately. Projection responses should include ETags when implemented. Admin APIs are never CDN-cacheable.
