# HHC Public Projection And Cache Invalidation Design

This spec defines how published website data moves from CMS source records to public projections, Redis, HTTP cache headers, Next.js rendering, asset URLs, sitemap data, and LINE bot weekly bulletin reads.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`

## Purpose

Public content should be fast, stable, and safe.

The hard problem is not adding Redis. The hard problem is ensuring that publish, unpublish, asset grants, sitemap updates, Next.js page cache, browser/CDN cache, and LINE bot reads all agree about what is public.

Canonical URL, redirect, sitemap, robots, locale alternate, and metadata rules are specified in `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

Source locale, translation status, stale translation behavior, per-locale publish, fallback policy, and weekly bulletin locale consistency are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

This design prevents:

- draft content leaking into public responses
- unpublished content remaining visible after cache TTL
- public asset links outliving revoked content
- latest bulletin returning stale data to the website or LINE bot
- sitemap and SEO metadata advertising unpublished routes
- cache invalidation failures silently producing unsafe public state
- stale public search results pointing at unpublished or rollback-superseded content

## Core Decision

Use database-backed public projections as the public source of truth. Redis and HTTP caches are accelerators only.

`hhc-web-api` owns public projection generation and versioning. Public API handlers read public projections, not draft CMS source tables. Next.js and LINE bot read the same public API contract.

Cache invalidation should prefer versioned keys plus short TTLs over deleting mutable keys only.

## Layers

| Layer | Owner | Purpose | Source Of Truth |
| --- | --- | --- | --- |
| CMS source tables | `hhc-web-api` | drafts, localized source, editorial state | yes for admin |
| Public projection tables | `hhc-web-api` | published read model | yes for public |
| Redis | `hhc-web-api` | fast projection reads, negative cache, version pointers | no |
| Gateway/CDN/browser cache | `api-gateway` and clients | short public cache | no |
| Next.js rendering cache | `hhc-web` | page rendering optimization | no |
| Asset download policy | `asset-api` | file access mechanics | yes for file access |
| LINE bot client cache | `hhc-line-function-bot` optional | reduce repeat calls | no |

Public routes must be correct when Redis is empty.

## Projection Types

Required public projections:

| Projection | Key Dimensions | Consumers |
| --- | --- | --- |
| `home` | locale | homepage, metadata |
| `site_layout` | locale | header, footer, social links, public contact display, metadata defaults |
| `news_list` | locale, page, page size | news index |
| `news_detail` | locale, slug | news detail |
| `page_detail` | locale, slug | about, vision, legal and generic pages |
| `video_list` | locale | video page, home sections |
| `location_list` | locale | location page, home sections |
| `history_timeline` | locale | history page |
| `bulletin_latest` | locale | website weekly card, LINE bot latest |
| `bulletin_archive` | locale, page, page size | bulletin archive |
| `bulletin_detail` | locale, issue date | website and LINE bot specific issue |
| `sitemap_data` | locale | sitemap generation and route metadata |

Post-v1 public search documents are not public projections, but they are generated from public projections and must track active projection versions.

Each projection row should include:

- `projection_type`
- `locale`
- `cache_key`
- `version`
- `payload`
- `etag`
- `published_at`
- `source_resource_ids`
- `asset_ids`
- `generated_at`
- `expires_at` optional

The payload must already be public-safe. Public handlers should not need to filter drafts, private assets, raw editor state, or unsafe structured body blocks after reading a projection. They can still perform defensive checks.

For content bodies, projection payloads contain render-ready structured blocks only. They must not contain raw HTML, raw Markdown, editor-library native JSON, arbitrary CSS classes, component props, Blob/SAS URLs, internal URLs, admin URLs, `/priv/*`, or `/api/priv/*`.

## Versioning Model

Use monotonic projection versions per projection key.

Example:

```text
home:zh-Hant -> version 42
bulletin_latest:zh-Hant -> version 7
bulletin_detail:zh-Hant:2026-07-12 -> version 1
```

Redis should store:

```text
{env}:hhc-web-api:projection-pointer:{projectionKey} = version
{env}:hhc-web-api:projection:{projectionKey}:v{version} = payload
```

Example:

```text
prod:hhc-web-api:projection-pointer:bulletin_latest:zh-Hant = 7
prod:hhc-web-api:projection:bulletin_latest:zh-Hant:v7 = {...}
```

Benefits:

- New publishes can atomically switch a pointer to a new version.
- Old cached payloads expire naturally.
- Rollback can point back to a previous safe version when source data and asset grants permit it.
- Cache deletion failures do not keep the active pointer on stale data if the pointer is updated.

## ETag And HTTP Cache

Public projection responses should include `ETag` based on projection type, locale, and version:

```text
ETag: "home:zh-Hant:v42"
```

Recommended public API headers:

```text
Cache-Control: public, max-age=60, stale-while-revalidate=300
ETag: "<projection-etag>"
Vary: Accept-Language
```

Route-specific starting points:

| Route Class | Max Age | Stale While Revalidate | Notes |
| --- | --- | --- | --- |
| home | 60s | 300s | home depends on multiple modules |
| site layout | 60s | 300s | header/footer/social links should update quickly |
| news list | 60s | 300s | page/query included in projection key |
| news detail | 300s | 600s | safe if published and immutable enough |
| page/legal | 300s | 600s | legal pages can be shorter if policy changes |
| weekly latest | 30s | 120s | important for LINE bot and church weekly update |
| weekly detail | 300s | 600s | specific issue is stable after publish |
| sitemap data | 300s | 600s | must remove unpublished routes promptly |
| public asset metadata | 60s | 300s | asset download itself has separate policy |

Admin, preview, and internal routes use:

```text
Cache-Control: no-store
```

Preview render models are not public projections. Admin preview must not create or update public projection rows, public Redis keys, sitemap data, public ETags, or public asset grants.

## Negative Cache

404 responses for missing public resources can be cached briefly, but must not hide newly published content for long.

Rules:

- `news_detail`, `page_detail`, and `bulletin_detail` 404 can have `Cache-Control: public, max-age=30`.
- `bulletin_latest` 404 can have `Cache-Control: public, max-age=15`.
- Admin and preview 404 responses are `no-store`.
- Publish must create/update the positive projection and pointer immediately.
- Negative Redis keys must use short TTL and must not override an existing positive projection pointer.

## Publish Transaction And Workflow

Publishing must be a local domain transaction plus retryable side effects. The exact workflow depends on whether the public projection requires remote side effects before it is safe to expose.

Recommended order for `projection_only` content:

1. Validate caller role/scope and version precondition.
2. Validate source record is publishable.
3. Validate structured body blocks, inline links, and body asset references.
4. Build public-safe projection payload.
5. Insert new projection row with next version.
6. Update projection pointer in PostgreSQL.
7. Commit transaction.
8. Update Redis pointer and version payload.
9. Enqueue outbox events for audit, cache purge, sitemap refresh if needed.

Recommended order for `required_public_asset` content:

1. Validate caller role/scope and version precondition.
2. Validate structured body blocks, inline links, body asset references, and asset namespace eligibility.
3. Validate asset ownership, scan status, processing status, and namespace.
4. Commit a publication workflow row in `waiting_asset_grant`.
5. Enqueue public asset grant outbox rows with versioned idempotency keys.
6. Return `202 Accepted` unless the workflow finishes within the request budget.
7. Worker confirms public grants through `asset-api`.
8. Worker re-reads source version and cancels stale workflows.
9. Worker builds projection using stable gateway asset URLs.
10. Worker inserts projection row, updates pointer, updates Redis, and emits audit/cache/sitemap outbox events.

If asset public grant fails, the public projection pointer must not change. Weekly bulletin PDF publish always uses this grant-before-visible path.

## Unpublish Transaction

Unpublish must remove public discoverability before or with asset access revocation.

Recommended order:

1. Validate caller role/scope and version precondition.
2. Mark source state unpublished.
3. Remove or supersede public detail projection pointer.
4. Refresh list/home/latest/sitemap projections that referenced the item.
5. Commit transaction.
6. Update Redis pointers.
7. Revoke public asset grants when no other published projection references the asset.
8. Enqueue audit/cache/sitemap outbox events.

If Redis update fails, public API handlers must fall back to PostgreSQL pointer state and repair Redis on read.

If asset grant revoke fails after projection removal, the asset may still be directly downloadable if someone has the URL. For sensitive assets, use the emergency takedown workflow from `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`, including high-priority revoke/deny commands and alerting. For public weekly PDFs, projection removal is required immediately and grant revoke retries should be alerted.

## Affected Projection Map

Every mutation should declare affected projection keys.

| Mutation | Refresh/Invalidate |
| --- | --- |
| publish news | `news_detail`, `news_list`, `home`, `sitemap_data` |
| unpublish news | `news_detail`, `news_list`, `home`, `sitemap_data` |
| publish page/legal | `page_detail`, `sitemap_data`, possible `home` |
| unpublish page/legal | `page_detail`, `sitemap_data`, possible `home` |
| publish bulletin | `bulletin_detail`, `bulletin_latest`, `bulletin_archive`, `home`, `sitemap_data` |
| unpublish bulletin | `bulletin_detail`, `bulletin_latest`, `bulletin_archive`, `home`, `sitemap_data` |
| rollback publish content | same affected projections as publish for that content type |
| rollback publish bulletin | `bulletin_detail`, `bulletin_latest`, `bulletin_archive`, `home`, `sitemap_data` |
| publish site settings | `site_layout`, possible `home`, `sitemap_data`, route metadata projections |
| unpublish site settings | `site_layout`, possible `home`, `sitemap_data`, route metadata projections |
| rollback publish site settings | `site_layout`, possible `home`, `sitemap_data`, route metadata projections |
| update video list | `video_list`, `home`, `sitemap_data` if route set changes |
| update locations | `location_list`, `home` |
| update history | `history_timeline`, `sitemap_data` if route set changes |
| asset grant revoke | affected projections referencing that asset, `asset public metadata` |

When public search is enabled, publish, unpublish, and rollback of indexable content must also upsert, remove, or refresh affected public search documents.

The mutation handler should compute affected keys from module-specific rules and write them to the outbox for observability and retries.

## Redis Failure Behavior

Redis is disposable.

Rules:

- Public API handlers first try Redis pointer + version payload.
- On Redis miss or error, read PostgreSQL public projection pointer and payload.
- On PostgreSQL read success, repair Redis asynchronously or best-effort.
- If PostgreSQL is unavailable but Redis has a non-expired public projection, public reads may serve stale projection with `meta.cache=stale`.
- Public reads must never reconstruct payload from draft/source tables during fallback.
- Admin writes must not depend on Redis success to commit source/projection state.

## Next.js Rendering Cache

`hhc-web` may cache rendered pages, but it must treat `hhc-web-api` public projection as source of truth.

Rules:

- Public pages can use short revalidation windows.
- Admin pages are `no-store` and `noindex`.
- Preview pages use admin/protected APIs and are `no-store`.
- Server-side public fetches must use the same public contract as browsers.
- Server-only internal base URLs must return the same public projection contract and must not expose drafts.
- If on-demand revalidation is added later, it should be triggered by signed internal webhook or deployment event, not public client input.

## Gateway/CDN Cache

The gateway can set and pass cache headers. It should not cache protected/admin/internal routes.

Rules:

- Cache only `GET` and `HEAD`.
- Do not cache responses with `Authorization`.
- Do not cache admin, preview, `/priv/*`, or provider webhook routes.
- Respect `ETag` and `Cache-Control`.
- Support cache purge by route prefix only if the platform actually deploys a purge-capable CDN later.
- Do not rely on CDN purge as the only invalidation mechanism; projection versioning remains required.

## Asset Cache And URL Policy

Asset public URLs are stable gateway URLs:

```text
https://www.alive.org.tw/api/assets/public/{assetId}
```

Rules:

- Stable URL does not imply stable permission.
- `asset-api` checks visibility, grant, scan status, processing status, and deleted state on every uncached authorization decision.
- Public asset downloads can use longer cache only after clean scan and public grant.
- If a public grant is revoked, `asset-api` must return `404` or `403` according to visibility policy even if content still references the asset.
- For revocation-sensitive assets, use short TTL and avoid long-lived CDN cache.
- Raw Blob URLs and SAS URLs are not public cache contracts.

## LINE Bot Weekly Bulletin Consistency

The LINE bot reads:

```text
GET /api/bulletins/latest?locale=zh-Hant
GET /api/bulletins/{issueDate}?locale=zh-Hant
```

Rules:

- The bot should not cache latest longer than the API response max-age.
- The bot should respect 404 for no published issue.
- The bot should not call `asset-api` or Blob for public bulletins.
- The bot response should include the gateway download URL returned by `hhc-web-api`.
- Publish of a new bulletin must update `bulletin_latest` before admin UI reports publish success.
- Unpublish of latest must make the bot return the next newest published issue or clean 404.

## Sitemap And SEO

Sitemap and metadata must use public projections only.

Rules:

- `GET /api/sitemap-data` returns published route metadata only.
- Unpublish removes routes from sitemap projection immediately.
- Draft preview routes are never included.
- Locales included in sitemap must match v1 locale policy: `zh-Hant`, `zh-Hans`, `en`.
- Sitemap cache TTL should be short enough that unpublished routes disappear quickly.
- Next.js metadata generation must not read draft tables or admin APIs.

## Observability

Metrics:

- projection generation count by type/outcome
- projection generation latency
- projection pointer version by type/locale
- Redis hit/miss/error by projection type
- stale served count
- projection fallback to PostgreSQL count
- projection repair count
- cache purge event count/failure
- asset grant revoke retry count
- latest bulletin age by locale

Logs should include:

- request id
- correlation id
- projection type
- locale
- projection version
- cache state: hit, miss, stale, repaired
- mutation id for publish/unpublish

Do not log full projection payloads.

## Failure Modes

| Failure | Required Behavior |
| --- | --- |
| Redis down | Read PostgreSQL projections; continue public reads if DB healthy |
| PostgreSQL down, Redis fresh | Serve public projection if non-expired; mark `meta.cache=stale` |
| PostgreSQL down, Redis missing | Public read returns `503` or cached page fallback; never read draft source |
| Publish projection generation fails | Publish fails; source remains draft/unpublished |
| Asset public grant fails | Publish fails before projection pointer changes |
| Redis pointer update fails after commit | Read-through repairs from PostgreSQL pointer |
| CDN/browser still has stale public page | Short TTL limits exposure; versioned API ETags show new content |
| Unpublish asset revoke fails | Projection removed; revoke retries and alerts |
| Latest bulletin projection stale | Alert when latest age or expected version mismatch exceeds threshold |

## Tests

Required tests:

- public handlers read projections, not draft/source tables
- draft/unpublished/deleted records never appear in public projections
- public content projections contain render-ready structured blocks only and never raw HTML, raw Markdown, editor-library opaque JSON, arbitrary CSS classes, component props, Blob/SAS URLs, or unsafe links
- body image blocks produce normalized asset references and projection asset ids
- publish creates detail, list, home, latest, archive, and sitemap projections as applicable
- unpublish removes detail and refreshes list/home/latest/archive/sitemap projections
- publish with asset grant failure does not expose projection
- restore to draft does not change public projection
- rollback publish creates a new projection version and updates ETag
- Redis miss reads PostgreSQL and repairs Redis
- Redis stale pointer does not override PostgreSQL pointer
- ETag changes when projection version changes
- negative cache expires and does not block newly published content
- admin/preview routes are `Cache-Control: no-store`
- admin preview creates no public projection, sitemap route, ETag pointer, public Redis key, or public asset grant
- public search documents are generated from active public projections only and omit stale projection versions
- public `/api/bulletins/latest` updates for website and LINE bot after publish/unpublish
- public `/api/site-layout` updates after site settings publish/unpublish/rollback
- site layout projection never includes secrets, Blob/SAS URLs, internal service URLs, admin URLs, or `/priv/*` routes
- public asset route denies revoked, private, deleted, infected, or scan-failed assets
- sitemap excludes unpublished and non-v1 locale routes

## Acceptance Criteria

- Public projection tables are the only source for public content APIs.
- Projection versions and ETags are defined.
- Redis key pattern uses environment, projection type, locale, query hash/page, and version.
- Publish/unpublish affected projection map is explicit.
- Asset grant ordering prevents public projection exposure before public file access is safe.
- Redis failure degrades to PostgreSQL public projections without reading drafts.
- Next.js cache and gateway/CDN cache are optimizations, not sources of truth.
- LINE bot weekly bulletin reads the same public projection contract as the website.
- Sitemap and SEO metadata are generated from public projections only.
- Site layout projection is part of the public read model for shared header/footer/social/contact display data.
- Content body projections use safe structured block render models, not raw CMS/editor payloads.
- Public search, when enabled, uses public projection-derived search documents and verifies active projection versions before returning results.
