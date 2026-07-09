# HHC Public And Admin Search Design

## Purpose

This spec defines how search should work for the HHC website and admin console without creating a premature `search-api` or leaking draft/private data through an index.

Search is a cross-cutting feature because it touches public projections, CMS source records, structured content text extraction, locale behavior, asset metadata, cache policy, abuse limits, and future cross-service domains. The design keeps v1 simple while preserving a clean extraction path.

This spec complements:

- `docs/api/public-api.md`
- `docs/api/admin-api.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`

## Core Decision

Do not create `search-api` in v1.

Start with search inside `hhc-web-api` using PostgreSQL-backed search documents generated from existing domain models:

- Public search indexes only published, indexable public projections.
- Admin CMS search indexes protected CMS source records separately and requires CMS scopes.
- Asset manager search remains in `asset-api` admin routes because asset metadata and grants belong to `asset-api`.
- Audit search remains through `audit-log` query APIs because audit retention, metadata, and sensitive-read rules belong to `audit-log`.

Protected search endpoints must declare `x-hhc-authz-action`, required scopes, resource checks, and field-level redaction rules in the OpenAPI contract. Public search is still a policy decision: it can only read published public projections, never source tables.

Extract `search-api` only when cross-service indexing, relevance tuning, index workers, external search engine operation, or independent ownership justifies a new service.

## Alternatives Considered

### Create `search-api` Immediately

Pros:

- Clear future owner for search.
- Easier to add OpenSearch, vector search, or cross-service indexes later.

Cons:

- Adds a service before search has independent scale or ownership.
- Requires event contracts and index rebuild operations before the site needs them.
- Increases draft/private leak risk if services push inconsistent events.
- Creates more deployment and rollback surface for a non-core v1 need.

Reject for v1.

### Use `hhc-web-api` Query-Time Search Over Source Tables

Pros:

- Very simple to implement.
- No separate index table.

Cons:

- Public search could accidentally read draft/source rows.
- Query-time extraction from structured body JSON is slow and hard to tune.
- Admin/public logic becomes tangled.
- Future extraction becomes harder because there is no explicit index contract.

Reject as the main design. Use explicit search documents.

### Use `hhc-web-api` Search Documents

Pros:

- Keeps v1 service count pragmatic.
- Separates public and admin indexes.
- Makes leak prevention testable.
- Gives a clear future extraction boundary.
- Can be rebuilt deterministically from projections/source records.

Cons:

- Requires index maintenance and rebuild tooling.
- Basic PostgreSQL search may be less capable than a dedicated search engine.

Use this for v1 and post-v1 public website search.

## Search Surfaces

| Surface | Route | Owner | Source | Auth | Cache |
| --- | --- | --- | --- | --- | --- |
| Public website search | `GET /api/search` | `hhc-web-api` | public projections only | none | short public cache |
| Admin CMS search | `GET /api/admin/search/content` | `hhc-web-api` | CMS source/search docs | JWT + CMS scopes | `no-store` |
| Admin asset search | `GET /api/assets/admin/assets?query=` | `asset-api` | asset metadata | JWT + asset scopes | `no-store` |
| Admin audit query | `GET /api/admin/audit-events` through `hhc-web-api` or audit query proxy | `audit-log` queried through `hhc-web-api` | audit events | JWT + audit scopes | `no-store` |

Do not build one "global admin search" in v1. Global admin search would need to merge different sensitivity levels, retention rules, permission models, and pagination semantics. Keep each admin search owned by the domain that owns the data.

## Public Search API

Route:

```text
GET /api/search?locale=zh-Hant&q=church&type=news,page,bulletin&page=1&pageSize=10
```

Parameters:

| Parameter | Required | Rules |
| --- | --- | --- |
| `q` | yes | trim, normalize, 2-100 visible characters after normalization |
| `locale` | no | defaults to `zh-Hant`; values: `zh-Hant`, `zh-Hans`, `en` |
| `type` | no | comma-separated allowlist: `news`, `page`, `legal`, `bulletin`, `video`, `location`, `history` |
| `page` | no | starts at 1 |
| `pageSize` | no | default 10, maximum 20 |

Response shape:

```json
{
  "data": {
    "items": [
      {
        "type": "news",
        "id": "news_123",
        "title": "Example title",
        "snippet": "Short safe text snippet",
        "url": "https://www.alive.org.tw/zh-Hant/news/example-title",
        "locale": "zh-Hant",
        "publishedAt": "2026-07-08T12:00:00Z",
        "score": 0.84
      }
    ]
  },
  "meta": {
    "requestId": "req_123",
    "page": 1,
    "pageSize": 10,
    "totalItems": 1
  },
  "error": null
}
```

Rules:

- Results must be published, public, indexable, and current.
- URLs must be public `www.alive.org.tw` URLs.
- Search responses must not include draft ids, internal ids unless already public-safe, Blob/SAS URLs, protected asset URLs, admin URLs, `/priv/*`, `/api/priv/*`, raw HTML, raw structured block JSON, or unpublished asset ids.
- Snippets are plain text only. Highlighting, if added later, must use structured offset metadata or escaped text fragments, not HTML strings.
- Missing or too-short query returns `400 validation_error`.
- Unsupported type filter returns `400 validation_error`.
- Empty result is `200` with an empty `items` array.

## Indexed Public Content

Start with these public result types:

| Type | Source Projection | Indexed Fields | URL |
| --- | --- | --- | --- |
| `news` | `news_detail`, `news_list` | title, summary, body plain text, tags if added | `/{locale}/news/{slug}` |
| `page` | `page_detail` | title, summary, body plain text | `/{locale}/pages/{slug}` or fixed route |
| `legal` | `page_detail` or legal projection | title, body plain text | `/{locale}/privacy-policy`, `/{locale}/terms-of-use` |
| `bulletin` | `bulletin_detail`, `bulletin_archive` | issue date, title, subtitle, optional manually entered summary | `/{locale}/literature-ministry?issue={issueDate}` or bulletin detail route when added |
| `video` | `video_list` | title, description, provider metadata | video page route or external link policy |
| `location` | `location_list` | name, address, service time, public contact display | `/{locale}` or future locations route |
| `history` | `history_timeline` | year/date, title, description | `/{locale}/about` |

Weekly PDF full-text search is not required in v1. If needed later, `hhc-web-api` should own bulletin text extraction as bulletin metadata, while `asset-api` continues to own bytes and scan/processing state. Do not make `asset-api` understand bulletin content semantics.

## Admin CMS Search API

Route:

```text
GET /api/admin/search/content?locale=zh-Hant&q=example&status=draft,published&type=news,page&page=1&pageSize=20
```

Auth:

- `cms:read` for basic content search.
- `cms:publish` or `cms:admin` is not required to search, but result actions still require their own scopes.

Rules:

- Admin search can include draft, unpublished, archived, and published CMS records according to filters.
- It must not include deleted records by default.
- It returns admin routes or resource ids for admin UI navigation, not public URLs for draft records.
- It is always `Cache-Control: no-store`.
- It must not return raw structured block JSON by default.
- It must not include unrelated locales unless explicitly requested.
- It must not query `asset-api` or `audit-log` schemas directly.

Response item shape:

```json
{
  "type": "news",
  "id": "content_123",
  "locale": "zh-Hant",
  "title": "Example title",
  "status": "draft",
  "snippet": "Plain safe text snippet",
  "adminUrl": "https://admin.alive.org.tw/zh-Hant/admin/news/content_123",
  "updatedAt": "2026-07-08T12:00:00Z",
  "updatedBy": "user_123"
}
```

## Search Document Model

Use explicit search document tables rather than querying CMS JSON at request time.

Suggested tables:

```sql
create table hhc_web.search_document (
  id uuid primary key,
  surface text not null,
  resource_type text not null,
  resource_id uuid not null,
  locale text not null,
  status text not null,
  route_path text null,
  title text not null,
  summary text null,
  body_text text null,
  search_text text not null,
  search_tokens text[] not null default '{}',
  search_vector tsvector null,
  projection_key text null,
  projection_version bigint null,
  source_version bigint null,
  published_at timestamptz null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint search_document_surface_check check (surface in ('public', 'admin')),
  constraint search_document_locale_check check (locale in ('zh-Hant', 'zh-Hans', 'en')),
  constraint search_document_status_check check (status in ('draft', 'published', 'unpublished', 'archived')),
  constraint search_document_metadata_is_object check (jsonb_typeof(metadata_json) = 'object')
);
```

Recommended indexes:

```sql
create unique index search_document_surface_resource_locale_uq
  on hhc_web.search_document(surface, resource_type, resource_id, locale);

create index search_document_public_lookup_idx
  on hhc_web.search_document(locale, resource_type, published_at desc)
  where surface = 'public' and status = 'published' and deleted_at is null;

create index search_document_admin_lookup_idx
  on hhc_web.search_document(locale, resource_type, status, updated_at desc)
  where surface = 'admin' and deleted_at is null;

create index search_document_tokens_gin_idx
  on hhc_web.search_document using gin(search_tokens);

create index search_document_vector_gin_idx
  on hhc_web.search_document using gin(search_vector);
```

If `pg_trgm` is available in the target PostgreSQL environment, add trigram indexes for `search_text` and `title`. If it is not available, rely on application-generated tokens and `search_tokens` until a verified extension or external engine is adopted.

## Text Extraction

`hhc-web-api` owns text extraction from CMS body content.

Rules:

- Extract text from validated structured blocks only.
- Ignore decorative image alt text.
- Include non-decorative image alt text only when it improves discoverability and does not duplicate surrounding text.
- Include captions and callout/list/quote text.
- Never index raw HTML, raw Markdown, editor-library native JSON, arbitrary CSS classes, or component props.
- Strip control characters and normalize whitespace.
- Store plain text, not HTML snippets.

For public search, extract text from public projection payloads or from the same render-ready model used to build those projections. Do not extract public index text directly from draft/source rows.

For admin search, extract from current CMS source rows after normal admin validation and permission rules.

## Locale And CJK Search

Supported locales remain:

- `zh-Hant`
- `zh-Hans`
- `en`

Search is locale-scoped by default.

Do not silently mix `zh-Hant`, `zh-Hans`, and `en` results unless the API explicitly adds an `includeLocales` feature later. A user searching in Traditional Chinese should not accidentally get Simplified or English results ranked above exact-locale matches.

For English, PostgreSQL full-text search can be used through `search_vector`.

For Traditional/Simplified Chinese, do not depend on whitespace tokenization. V1 should use one of these portable strategies:

1. Application-generated CJK n-gram tokens stored in `search_tokens`.
2. A verified PostgreSQL extension in the target environment.
3. A future external search engine after `search-api` split triggers are met.

Recommended v1 default:

- Generate normalized 1-gram and 2-gram tokens for CJK text in application code.
- Use exact title match, prefix/title match, token overlap, recency, and type weight for ranking.
- Keep a small synonym table inside `hhc-web-api` config or DB for church-specific terms only when a real need appears.

Do not add AI/vector search for v1 public search.

## Ranking

Ranking should be deterministic and explainable.

Initial weights:

| Signal | Weight |
| --- | --- |
| Exact title match | highest |
| Title token match | high |
| Summary token match | medium |
| Body token match | lower |
| Recent news/bulletin recency | small boost |
| Fixed high-value pages such as about/literature/legal | small curated boost |

Do not use personalized ranking in v1.

Do not use click-tracking ranking until analytics consent, privacy, and retention are designed.

## Index Maintenance

Public search documents are generated from public projections.

Publish flow:

1. Validate source and structured body content.
2. Build public projection.
3. Build public search document from projection-safe text.
4. Commit projection pointer and search document in the same transaction when practical.
5. If search indexing is asynchronous, the worker must read only public projection rows and must never read draft source tables.

Unpublish flow:

1. Remove or supersede public projection pointer.
2. Mark public search document deleted or remove it from public search in the same transaction when practical.
3. Refresh affected list/home/sitemap projections.

Rollback publish flow:

1. Build a new projection version from the rollback source.
2. Build a new public search document for that projection version.
3. Update search document `projection_version` and `published_at`.

If indexing fails after a publish commit, the content may be temporarily absent from search, but it must never leak draft/private data. A failed public index update should alert if it exceeds the freshness SLO.

## Stale Result Protection

Public search should not trust the index alone.

At query time, public search results should verify one of these:

- `search_document.projection_key` and `projection_version` match the active public projection pointer, or
- the search document was generated in the same transaction as the active projection pointer.

If the search document points to an inactive projection, omit it and enqueue repair.

This prevents an unpublish or rollback bug from leaving stale search results visible.

## Caching

Public search can use short cache:

```text
Cache-Control: public, max-age=30, stale-while-revalidate=120
```

Cache key dimensions:

- environment
- locale
- normalized query hash
- type filter
- page
- page size
- active search index generation or projection version watermark

Admin search is always:

```text
Cache-Control: no-store
```

## Abuse Controls

Public search must have route-specific limits:

- Query length maximum.
- Page size maximum.
- Rate limit by IP/client fingerprint.
- Reject wildcard-only, empty, or control-character-heavy queries.
- Do not expose parser errors.
- Log normalized query hash, not full query text, unless privacy policy explicitly allows operational query logging.

Search queries can reveal interests. Treat raw query logs as operational data with retention limits.

## Frontend Integration

Do not add search UI until there is a product need. When added:

Routes:

```text
/{locale}/search?q=...
```

Frontend files:

```text
src/features/search/api.ts
src/features/search/types.ts
src/components/search/SearchForm.tsx
src/components/search/SearchResults.tsx
src/app/[locale]/search/page.tsx
```

Rules:

- Use server-rendered first page for SEO only if the route should be indexable.
- Prefer `noindex` for search result pages unless there is a deliberate SEO strategy for query pages.
- Debounce client-side query suggestions if autocomplete is added later.
- Do not expose admin search behavior in public UI.
- Public snippets render as text, not HTML.

## LINE Bot Integration

LINE bot weekly bulletin download does not require search.

If the bot later adds a public content search function, it should call `GET /api/search` and return public URLs only. It should not query admin search, `asset-api`, public projection tables, or Blob storage directly.

## Extraction To `search-api`

Create `search-api` only when at least one trigger is met:

- Search needs to index multiple service-owned datasets such as events, engagement, members, groups, or donations.
- Search relevance requires a dedicated engine, analyzers, synonyms, or operational tuning.
- Index rebuild workers need independent deployment and scaling.
- Public and admin search traffic becomes large enough to affect `hhc-web-api`.
- Search becomes a product surface with its own owner and release cadence.

Extraction path:

1. Keep `hhc-web-api` as content owner and projection producer.
2. Publish `search_document.upsert_requested` events from owning services.
3. Define service-owned searchable DTOs that are already classified as public/admin/sensitive.
4. Let `search-api` own only index storage and query behavior.
5. Keep source-of-truth records in owning services.
6. Keep public search results limited to public-safe URLs and snippets.

`search-api` must not become a backdoor data lake. It should store only search documents explicitly emitted by owning services.

## Tests

Required tests:

- Public search indexes only published projections.
- Draft, unpublished, archived, deleted, private, restricted, infected, or scan-failed resources never appear in public search.
- Unpublish removes or hides public search documents immediately.
- Rollback publish updates search document projection version and result text.
- Stale search documents pointing to inactive projections are omitted.
- Structured body text extraction ignores raw HTML and unsupported blocks.
- Public snippets are escaped/plain text.
- CJK token generation works for Traditional and Simplified Chinese examples.
- English full-text search works for English examples.
- Type filters reject unsupported values.
- Query validation rejects empty, too short, too long, and control-character-heavy queries.
- Admin content search requires `cms:read`, is `no-store`, and can include drafts only through admin routes.
- Asset admin search is not implemented by querying `asset` schema from `hhc-web-api`.
- Audit search remains under audit query authorization and does not share the public/admin content search index.
- Public search is rate-limited and returns stable `429` errors under abuse tests.

## Acceptance Criteria

- No v1 `search-api` is required.
- Public search is owned by `hhc-web-api` and generated from public projections only.
- Admin CMS search is separate from public search and requires CMS scopes.
- Asset and audit search stay with their owning services.
- Public search results contain only public URLs and plain-text snippets.
- Search supports `zh-Hant`, `zh-Hans`, and `en` without relying on whitespace tokenization for Chinese.
- Search index rebuilds are deterministic from authoritative public projections or protected CMS source records.
- Extraction triggers and migration path to `search-api` are explicit.
