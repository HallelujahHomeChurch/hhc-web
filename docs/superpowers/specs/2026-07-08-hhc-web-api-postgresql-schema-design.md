# HHC Web API PostgreSQL Schema Design

## Purpose

This spec defines the detailed PostgreSQL schema strategy for `hhc-web-api`.

Canonical URL, slug redirect, sitemap route metadata, locale alternate, and SEO projection rules follow `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

CMS revision snapshot, restore, rollback, draft/published isolation, and public projection consistency rules follow `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

Publication workflow consistency, grant-before-visible publish, stale side-effect cancellation, emergency takedown, and reconciliation rules follow `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

Structured content block schema, body JSON shape, asset reference extraction, renderer contract, schema versioning, and no-raw-HTML rules follow `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

CMS localization, source locale, translation status, stale translation, fallback policy, per-locale publish, localized slug, and weekly bulletin locale rules follow `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

Public/admin search document ownership, CJK tokenization, stale-result protection, and extraction triggers follow `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

Site settings, navigation, footer links, external links, contact display, shared layout projections, and the boundary between runtime config and editable site data follow `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

Third-party provider registry, analytics, consent, embed, CMS URL validation, and no-arbitrary-script rules follow `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.

It turns the CMS/content architecture into concrete tables, constraints, indexes, versioning, projection storage, seed provenance, and migration rules. The goal is to make implementation deterministic without turning `hhc-web-api` into either a vague generic CMS or a pile of unrelated feature tables.

## Core Decision

Use a hybrid schema:

- shared content tables for lifecycle, identity, locale translations, SEO, assets, versions, and workflow
- module-specific detail tables for fields that are real domain concepts
- separate first-class bulletin tables because weekly bulletins have issue/version/PDF semantics
- public projection tables for published read models
- search document table for post-v1 public and admin CMS search
- local outbox tables for async side effects
- seed run tables for bootstrapping current `hhc-web` content

This keeps common CMS behavior reusable while preserving strong database constraints for news, pages, videos, locations, history, legal pages, home sections, and bulletins.

## Rejected Alternatives

### One Generic JSON Table

Example:

```text
content(id, type, status, payload_json)
```

Pros:

- Fast to start.
- Easy to add content types.

Cons:

- Weak constraints.
- Harder indexing.
- Harder admin validation.
- Harder projection rebuilds.
- More bugs move from database validation into application code.

Use JSON for versioned structured body blocks and module config, not for every domain field.

### Fully Separate Tables Per Content Type

Example:

```text
news_article
legal_page
video_item
location
home_section
```

Pros:

- Strong domain modeling.
- Simple queries per module.

Cons:

- Duplicates lifecycle, translation, SEO, asset, audit, publish, preview, and archive logic.
- Makes generic admin lists harder.
- Makes cross-module projection/version logic less reusable.

Use module-specific tables only for module fields, with shared content lifecycle tables above them.

### Separate `cms-api` Schema

Do not split schema ownership in v1. `hhc-web-api` owns `hhc_web` because CMS writes and public website projections are one bounded context for the current website.

## Schema Ownership

Schema:

```sql
create schema if not exists hhc_web;
```

Owned by:

- `hhc-web-api`

Not owned by:

- `hhc-web`
- `api-gateway`
- `asset-api`
- `notification-api`
- `audit-log`
- `account-api`
- `hhc-line-function-bot`

Other services must not query `hhc_web` directly. They consume public/admin/internal APIs or events.

## Identifier Policy

Use UUID primary keys for internal rows.

Use stable public identifiers only where users or integrations depend on them:

| Concept | Public Identifier |
| --- | --- |
| content page | locale slug |
| news article | locale slug |
| legal page | fixed slug: `privacy-policy`, `terms-of-use` |
| weekly issue | issue date |
| weekly version | issue date + locale |
| location | stable location key |
| video | provider + provider video id or stable slug |
| public projection | projection key |

Do not expose raw UUIDs as public route identifiers unless there is no stable route concept.

## Common Statuses

Content lifecycle statuses:

- `draft`
- `published`
- `unpublished`
- `archived`

Translation statuses:

- `draft`
- `ready`
- `published`
- `unpublished`
- `archived`

Outbox statuses:

- `pending`
- `leased`
- `succeeded`
- `retry_scheduled`
- `dead_lettered`
- `cancelled`

Use text columns plus check constraints in migrations. This keeps values explicit while avoiding PostgreSQL enum migration friction.

## Common Columns

Domain tables should use:

```sql
id uuid primary key
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz null
```

Protected CMS records should also use:

```sql
created_by text not null
updated_by text not null
published_by text null
published_at timestamptz null
version bigint not null default 1
```

`created_by`, `updated_by`, and `published_by` store account user ids from gateway-trusted identity headers. They do not join to account tables.

`version` supports optimistic concurrency for admin update/publish/unpublish/archive flows.

## Table Groups

```text
hhc_web
  content_item
  content_translation
  content_asset_ref
  content_slug_redirect
  content_revision

  news_article
  page_content
  video_item
  location_item
  history_event
  home_section
  site_setting_set
  site_setting_locale
  site_navigation_item
  site_external_link

  bulletin_issue
  bulletin_version

  public_projection
  projection_build
  search_document

  publication_workflow
  outbox_event
  content_seed_run
  content_seed_source
```

## `content_item`

Owns shared lifecycle for CMS-managed website content.

```sql
create table hhc_web.content_item (
  id uuid primary key,
  content_type text not null,
  status text not null,
  translation_group_id uuid not null,
  canonical_slug text null,
  sort_order int not null default 0,
  visibility text not null default 'public',
  created_by text not null,
  updated_by text not null,
  published_by text null,
  published_at timestamptz null,
  version bigint not null default 1,
  seed_version text null,
  source_key text null,
  source_path text null,
  source_sha256 text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  constraint content_item_type_check check (
    content_type in (
      'news',
      'page',
      'video',
      'location',
      'history',
      'legal',
      'home_section'
    )
  ),
  constraint content_item_status_check check (
    status in ('draft', 'published', 'unpublished', 'archived')
  ),
  constraint content_item_visibility_check check (
    visibility in ('public', 'authenticated', 'restricted', 'private')
  )
);
```

Indexes:

```sql
create index content_item_type_status_idx
  on hhc_web.content_item(content_type, status)
  where deleted_at is null;

create index content_item_translation_group_idx
  on hhc_web.content_item(translation_group_id)
  where deleted_at is null;

create unique index content_item_source_key_uq
  on hhc_web.content_item(content_type, source_key)
  where source_key is not null and deleted_at is null;
```

Rules:

- `content_item.status='published'` means the aggregate is publishable publicly, but public route output still comes from `public_projection`.
- `canonical_slug` is a stable fallback, not necessarily the locale route slug.
- `visibility` is future-facing; v1 public website content should use `public`.
- Soft-delete is represented by `deleted_at`, but user-facing v1 delete should be archive, not hard delete.

## `content_translation`

Owns localized title/body/SEO/slug.

```sql
create table hhc_web.content_translation (
  id uuid primary key,
  content_item_id uuid not null references hhc_web.content_item(id),
  locale text not null,
  status text not null,
  slug_scope text not null,
  slug text null,
  title text not null,
  subtitle text null,
  summary text null,
  body_json jsonb not null,
  seo_json jsonb not null default '{}'::jsonb,
  published_snapshot_json jsonb null,
  created_by text not null,
  updated_by text not null,
  published_by text null,
  published_at timestamptz null,
  version bigint not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  constraint content_translation_locale_check check (
    locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint content_translation_status_check check (
    status in ('draft', 'ready', 'published', 'unpublished', 'archived')
  ),
  constraint content_translation_body_is_object check (jsonb_typeof(body_json) = 'object'),
  constraint content_translation_body_schema_version check (jsonb_typeof(body_json -> 'schemaVersion') = 'number'),
  constraint content_translation_body_blocks check (jsonb_typeof(body_json -> 'blocks') = 'array'),
  constraint content_translation_seo_is_object check (jsonb_typeof(seo_json) = 'object')
);
```

Indexes:

```sql
create unique index content_translation_item_locale_uq
  on hhc_web.content_translation(content_item_id, locale)
  where deleted_at is null;

create unique index content_translation_locale_scope_slug_uq
  on hhc_web.content_translation(locale, slug_scope, slug)
  where slug is not null and deleted_at is null;

create index content_translation_locale_status_idx
  on hhc_web.content_translation(locale, status)
  where deleted_at is null;
```

Rules:

- `slug` is locale-specific.
- Source locale, source-version-seen, stale translation, and fallback policy metadata follow the localization governance spec; add explicit columns before production if workflow metadata is not enough.
- `body_json` is the HHC versioned structured block AST. PostgreSQL validates the top-level shape; `hhc-web-api` validates block schemas, links, asset references, and schema-version compatibility.
- Body image blocks must be reflected in `content_asset_ref` rows so asset usage, grants, preview, cleanup, and projection rebuilds do not depend on ad hoc JSON scans.
- `slug_scope` is the route namespace, such as `news`, `page`, `legal`, or `home_section`.
- Legal slugs are fixed by validation: `privacy-policy`, `terms-of-use`.
- `published_snapshot_json` is optional v1 but recommended for preview/rollback. It stores the last published translation payload when drafts continue after publish.
- Public APIs read projections, not mutable draft translation rows.

## `content_asset_ref`

Owns the relationship between CMS records and `asset-api` asset ids.

```sql
create table hhc_web.content_asset_ref (
  id uuid primary key,
  content_item_id uuid not null references hhc_web.content_item(id),
  translation_id uuid null references hhc_web.content_translation(id),
  locale text null,
  asset_id text not null,
  purpose text not null,
  required_for_publish boolean not null default false,
  alt_text text null,
  caption text null,
  sort_order int not null default 0,
  created_by text not null,
  created_at timestamptz not null,
  deleted_at timestamptz null,
  constraint content_asset_ref_locale_check check (
    locale is null or locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint content_asset_ref_purpose_check check (
    purpose in ('cover', 'inline', 'thumbnail', 'attachment', 'open_graph')
  )
);
```

Indexes:

```sql
create index content_asset_ref_item_idx
  on hhc_web.content_asset_ref(content_item_id)
  where deleted_at is null;

create index content_asset_ref_asset_idx
  on hhc_web.content_asset_ref(asset_id)
  where deleted_at is null;

create unique index content_asset_ref_unique_purpose_locale_uq
  on hhc_web.content_asset_ref(content_item_id, locale, purpose, asset_id)
  where locale is not null and deleted_at is null;

create unique index content_asset_ref_unique_purpose_global_uq
  on hhc_web.content_asset_ref(content_item_id, purpose, asset_id)
  where locale is null and deleted_at is null;
```

Rules:

- `asset_id` is a stable id from `asset-api`.
- This table does not store Blob paths, SAS URLs, scan status, or grants.
- Before publish, `hhc-web-api` validates asset metadata through `asset-api`.
- Publish/unpublish side effects grant or revoke public read through outbox.

## `content_slug_redirect`

Stores redirects after published slug changes.

```sql
create table hhc_web.content_slug_redirect (
  id uuid primary key,
  locale text not null,
  from_path text not null,
  to_path text not null,
  status_code int not null default 301,
  content_item_id uuid null references hhc_web.content_item(id),
  created_by text not null,
  created_at timestamptz not null,
  deleted_at timestamptz null,
  constraint content_slug_redirect_locale_check check (
    locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint content_slug_redirect_status_check check (status_code in (301, 302, 308))
);
```

Indexes:

```sql
create unique index content_slug_redirect_from_uq
  on hhc_web.content_slug_redirect(locale, from_path)
  where deleted_at is null;
```

Rules:

- V1 can defer redirect admin UI.
- Schema exists so slug changes are not destructive.

## `content_revision`

Stores revision metadata and snapshots for recoverability.

```sql
create table hhc_web.content_revision (
  id uuid primary key,
  content_item_id uuid not null references hhc_web.content_item(id),
  translation_id uuid null references hhc_web.content_translation(id),
  revision_type text not null,
  version bigint not null,
  snapshot_json jsonb not null,
  actor_user_id text not null,
  reason text null,
  created_at timestamptz not null,
  constraint content_revision_type_check check (
    revision_type in (
      'draft_saved',
      'published',
      'unpublished',
      'archived',
      'seeded',
      'restored_to_draft',
      'rollback_published'
    )
  ),
  constraint content_revision_snapshot_is_object check (jsonb_typeof(snapshot_json) = 'object')
);
```

Indexes:

```sql
create index content_revision_item_created_idx
  on hhc_web.content_revision(content_item_id, created_at desc);
```

Rules:

- Store sanitized snapshots. Do not store access tokens, raw request headers, or provider secrets.
- Snapshots are CMS recovery state, not audit evidence.
- Restore to draft and rollback publish semantics follow the CMS content versioning and rollback design.
- Audit remains in `audit-log`; this table is for content recovery and editor history.

## Module Tables

### `news_article`

```sql
create table hhc_web.news_article (
  content_item_id uuid primary key references hhc_web.content_item(id),
  display_date date not null,
  pinned boolean not null default false,
  category text null,
  external_href text null,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index news_article_display_idx
  on hhc_web.news_article(pinned desc, display_date desc, sort_order asc);
```

Rules:

- News detail pages can be added without changing source ownership.
- `external_href` must be HTTPS if used.
- Cover image lives in `content_asset_ref` with `purpose='cover'`.

### `page_content`

Used for about, generic pages, legal pages, and future static CMS pages.

```sql
create table hhc_web.page_content (
  content_item_id uuid primary key references hhc_web.content_item(id),
  page_kind text not null,
  route_path text not null,
  show_in_sitemap boolean not null default true,
  no_index boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint page_content_kind_check check (
    page_kind in ('about', 'legal', 'generic')
  )
);

create unique index page_content_route_path_uq
  on hhc_web.page_content(route_path);
```

Rules:

- Legal pages use `page_kind='legal'`.
- `route_path` is canonical without locale prefix, such as `/privacy-policy`.
- Legal page slugs are validation-protected in `content_translation`.

### `video_item`

```sql
create table hhc_web.video_item (
  content_item_id uuid primary key references hhc_web.content_item(id),
  provider text not null,
  provider_video_id text null,
  external_url text not null,
  thumbnail_url text null,
  display_date date null,
  show_on_home boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint video_item_provider_check check (provider in ('youtube'))
);

create unique index video_item_provider_id_uq
  on hhc_web.video_item(provider, provider_video_id)
  where provider_video_id is not null;
```

Rules:

- Store canonical provider metadata, not arbitrary embed HTML.
- Custom thumbnails use `content_asset_ref` with `purpose='thumbnail'`.
- External URLs must be HTTPS.

### `location_item`

```sql
create table hhc_web.location_item (
  content_item_id uuid primary key references hhc_web.content_item(id),
  location_key text not null,
  map_url text not null,
  phone text null,
  email text null,
  service_times_json jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint location_service_times_is_array check (jsonb_typeof(service_times_json) = 'array')
);

create unique index location_item_key_uq
  on hhc_web.location_item(location_key);

create index location_item_active_sort_idx
  on hhc_web.location_item(active, sort_order);
```

Rules:

- Localized name/address live in `content_translation`.
- `map_url` must be HTTPS.

### `history_event`

```sql
create table hhc_web.history_event (
  content_item_id uuid primary key references hhc_web.content_item(id),
  event_key text not null,
  sort_date date null,
  display_order int not null,
  continued boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create unique index history_event_key_uq
  on hhc_web.history_event(event_key);

create index history_event_order_idx
  on hhc_web.history_event(display_order);
```

Rules:

- Localized date display text and body live in `content_translation`.
- `sort_date` can be null when historical date is approximate.

### `home_section`

```sql
create table hhc_web.home_section (
  content_item_id uuid primary key references hhc_web.content_item(id),
  section_key text not null,
  source_type text not null,
  source_ref text null,
  visible boolean not null default true,
  sort_order int not null default 0,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint home_section_source_type_check check (
    source_type in ('manual', 'news', 'bulletin', 'videos', 'locations', 'page')
  ),
  constraint home_section_config_is_object check (jsonb_typeof(config_json) = 'object')
);

create unique index home_section_key_uq
  on hhc_web.home_section(section_key);

create index home_section_visible_sort_idx
  on hhc_web.home_section(visible, sort_order);
```

Rules:

- Home is a composed projection.
- Do not duplicate source records into home sections unless a section is genuinely manual editorial content.

## Bulletin Tables

## Site Settings Tables

Site settings are CMS-managed public layout data. They are not deployment config and do not contain secrets.

### `site_setting_set`

```sql
create table hhc_web.site_setting_set (
  id uuid primary key,
  status text not null,
  version bigint not null default 1,
  created_by text not null,
  updated_by text not null,
  published_by text null,
  published_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  constraint site_setting_set_status_check check (
    status in ('draft', 'published', 'unpublished', 'archived')
  )
);

create index site_setting_set_status_idx
  on hhc_web.site_setting_set(status)
  where deleted_at is null;
```

Rules:

- V1 should maintain one active setting set, but the table remains versioned for revision and rollback support.
- Runtime config such as hostnames, OIDC, service URLs, and secrets must not be stored here.

### `site_setting_locale`

```sql
create table hhc_web.site_setting_locale (
  id uuid primary key,
  setting_set_id uuid not null references hhc_web.site_setting_set(id),
  locale text not null,
  site_name text not null,
  english_name text null,
  copyright_holder text null,
  seo_title_suffix text null,
  seo_description_fallback text null,
  contact_display_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint site_setting_locale_check check (
    locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint site_setting_contact_is_object check (jsonb_typeof(contact_display_json) = 'object')
);

create unique index site_setting_locale_set_locale_uq
  on hhc_web.site_setting_locale(setting_set_id, locale);
```

Rules:

- Contact display is public data only.
- Private routing, provider credentials, internal emails, and notification secrets belong elsewhere.

### `site_navigation_item`

```sql
create table hhc_web.site_navigation_item (
  id uuid primary key,
  setting_set_id uuid not null references hhc_web.site_setting_set(id),
  area text not null,
  locale text null,
  label text not null,
  href text not null,
  target text not null default '_self',
  rel text null,
  icon_key text null,
  sort_order int not null,
  visible boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint site_navigation_area_check check (
    area in ('header', 'footer_legal', 'footer_resource', 'social')
  ),
  constraint site_navigation_locale_check check (
    locale is null or locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint site_navigation_target_check check (
    target in ('_self', '_blank')
  )
);

create index site_navigation_set_area_sort_idx
  on hhc_web.site_navigation_item(setting_set_id, area, locale, visible, sort_order);
```

Rules:

- Internal links must be public UI routes, not `/api/*`, `/priv/*`, admin API routes, or internal service URLs.
- External links must use HTTPS and safe `rel` when opening new tabs.

### `site_external_link`

```sql
create table hhc_web.site_external_link (
  id uuid primary key,
  setting_set_id uuid not null references hhc_web.site_setting_set(id),
  key text not null,
  provider_id text null,
  integration_type text not null default 'external_link',
  url text not null,
  label text null,
  link_type text not null,
  consent_category text null,
  validation_status text not null default 'valid',
  visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  constraint site_external_link_type_check check (
    link_type in ('social', 'music', 'seo_asset', 'resource')
  ),
  constraint site_external_link_integration_check check (
    integration_type in ('external_link', 'embed_reference')
  ),
  constraint site_external_link_validation_check check (
    validation_status in ('valid', 'invalid', 'needs_review')
  )
);

create unique index site_external_link_set_key_uq
  on hhc_web.site_external_link(setting_set_id, key);
```

Initial keys:

- `church_youtube`
- `church_facebook`
- `music_youtube`
- `default_og_image`

Rules:

- `provider_id`, `integration_type`, and `consent_category` must match the third-party provider registry when present.
- Do not store Blob URLs, SAS URLs, localhost URLs, private IP URLs, tracking-only URLs, or provider admin URLs.
- Do not store raw iframe HTML, script tags, tag-manager snippets, tracking pixels, or provider API keys.
- Editable Open Graph images should normally reference `asset-api` through public-ready asset ids in the settings snapshot/projection.

## Bulletin Tables

Weekly bulletins are separate from generic `content_item` because they have issue-date, locale-version, PDF, publish, and download semantics.

### `bulletin_issue`

```sql
create table hhc_web.bulletin_issue (
  id uuid primary key,
  issue_date date not null,
  status text not null,
  created_by text not null,
  updated_by text not null,
  published_by text null,
  published_at timestamptz null,
  version bigint not null default 1,
  seed_version text null,
  source_key text null,
  source_path text null,
  source_sha256 text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  constraint bulletin_issue_status_check check (
    status in ('draft', 'published', 'unpublished', 'archived')
  )
);

create unique index bulletin_issue_date_uq
  on hhc_web.bulletin_issue(issue_date)
  where deleted_at is null;

create index bulletin_issue_status_date_idx
  on hhc_web.bulletin_issue(status, issue_date desc)
  where deleted_at is null;
```

### `bulletin_version`

```sql
create table hhc_web.bulletin_version (
  id uuid primary key,
  issue_id uuid not null references hhc_web.bulletin_issue(id),
  locale text not null,
  status text not null,
  title text not null,
  subtitle text null,
  pdf_asset_id text not null,
  file_name text not null,
  file_size_bytes bigint null,
  published_by text null,
  published_at timestamptz null,
  version bigint not null default 1,
  seed_version text null,
  source_key text null,
  source_path text null,
  source_sha256 text null,
  created_by text not null,
  updated_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  constraint bulletin_version_locale_check check (
    locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint bulletin_version_status_check check (
    status in ('draft', 'published', 'unpublished', 'archived')
  )
);

create unique index bulletin_version_issue_locale_uq
  on hhc_web.bulletin_version(issue_id, locale)
  where deleted_at is null;

create index bulletin_version_asset_idx
  on hhc_web.bulletin_version(pdf_asset_id)
  where deleted_at is null;
```

Rules:

- `pdf_asset_id` must refer to an `asset-api` asset in namespace `cms.weekly.pdf`.
- A version can publish only after asset scan/processing is acceptable.
- Public projection exposes download URL from `asset-api`, not `pdf_asset_id` alone.
- LINE bot consumes `hhc-web-api` public bulletin APIs.

## Public Projection Tables

Public APIs read from projections, not mutable source rows.

### `public_projection`

```sql
create table hhc_web.public_projection (
  key text primary key,
  locale text not null,
  resource_type text not null,
  resource_id text not null,
  route_path text null,
  version bigint not null,
  payload_json jsonb not null,
  etag text not null,
  published_at timestamptz not null,
  expires_at timestamptz null,
  updated_at timestamptz not null,
  constraint public_projection_locale_check check (
    locale in ('zh-Hant', 'zh-Hans', 'en')
  ),
  constraint public_projection_payload_is_object check (jsonb_typeof(payload_json) = 'object')
);

create index public_projection_resource_idx
  on hhc_web.public_projection(resource_type, resource_id, locale);

create index public_projection_route_idx
  on hhc_web.public_projection(locale, route_path)
  where route_path is not null;

create index public_projection_updated_idx
  on hhc_web.public_projection(updated_at desc);
```

Recommended keys:

```text
home:{locale}
site_layout:{locale}
news:list:{locale}:p{page}:s{pageSize}
news:detail:{locale}:{slug}
page:{locale}:{slug}
legal:{locale}:{slug}
videos:list:{locale}
locations:list:{locale}
history:{locale}
bulletins:latest:{locale}
bulletins:archive:{locale}:p{page}:s{pageSize}
bulletins:issue:{locale}:{issueDate}
sitemap:{locale}
```

Rules:

- `payload_json` is the API response `data`, not the full envelope.
- `etag` derives from canonical payload + projection version.
- Projection rebuilds are idempotent.
- Deleting a projection on unpublish is allowed, but projection invalidation must also clear Redis.
- Search document updates should follow `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`. Public search documents must be generated from public projections or the same public-safe render model, not directly from draft source rows.

### `projection_build`

Tracks rebuilds and failure reasons.

```sql
create table hhc_web.projection_build (
  id uuid primary key,
  projection_key text not null,
  resource_type text not null,
  resource_id text not null,
  locale text null,
  reason text not null,
  status text not null,
  started_at timestamptz not null,
  finished_at timestamptz null,
  error_message text null,
  created_at timestamptz not null,
  constraint projection_build_status_check check (
    status in ('started', 'succeeded', 'failed')
  )
);

create index projection_build_key_created_idx
  on hhc_web.projection_build(projection_key, created_at desc);
```

Rules:

- Keep error messages sanitized and short.
- Projection build failures should expose metrics and alerts.

## Search Document

Search documents support post-v1 public website search and admin CMS content search.

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
  constraint search_document_status_check check (
    status in ('draft', 'published', 'unpublished', 'archived')
  ),
  constraint search_document_metadata_is_object check (jsonb_typeof(metadata_json) = 'object')
);

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

Rules:

- `surface='public'` rows are generated from active public projections only.
- `surface='admin'` rows are generated from protected CMS source records and require admin APIs.
- Public rows must include `projection_key` and `projection_version` so query handlers can omit stale results.
- `body_text`, `search_text`, and snippets are plain text only.
- `search_tokens` stores application-generated CJK tokens when PostgreSQL tokenization is insufficient.
- Do not store raw structured block JSON, raw HTML, Blob/SAS URLs, admin URLs, internal URLs, `/priv/*`, or `/api/priv/*` in public search rows.

## Publication Workflow

Publication workflow rows track multi-step public visibility operations that cannot safely complete in one local transaction.

```sql
create table hhc_web.publication_workflow (
  id uuid primary key,
  workflow_type text not null,
  resource_type text not null,
  resource_id text not null,
  locale text null,
  aggregate_version bigint not null,
  status text not null,
  required_asset_ids text[] not null default '{}',
  optional_asset_ids text[] not null default '{}',
  projection_keys text[] not null default '{}',
  idempotency_key text not null,
  requested_by text not null,
  reason text null,
  last_error text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz null,
  constraint publication_workflow_type_check check (
    workflow_type in (
      'publish',
      'unpublish',
      'rollback_publish',
      'restore_to_draft',
      'emergency_takedown',
      'projection_rebuild'
    )
  ),
  constraint publication_workflow_status_check check (
    status in (
      'requested',
      'validating',
      'waiting_asset_grant',
      'projection_pending',
      'public_visible',
      'waiting_asset_revoke',
      'public_hidden',
      'failed_retryable',
      'failed_terminal',
      'cancelled'
    )
  )
);

create unique index publication_workflow_identity_uq
  on hhc_web.publication_workflow(workflow_type, resource_type, resource_id, coalesce(locale, ''), aggregate_version);

create index publication_workflow_status_idx
  on hhc_web.publication_workflow(status, updated_at);
```

Rules:

- Workflow rows do not replace `public_projection`; they track in-progress publication operations.
- Weekly bulletin publish uses `waiting_asset_grant` until the PDF public grant is active.
- Public routes do not read workflow rows.
- Workers must re-read current source version before moving a workflow to `public_visible`.
- Stale workflows are cancelled or compensated rather than retried forever.
- Emergency takedown workflows are high-priority and alert on grant revoke/deny failures.

## Outbox

Use the standard platform outbox in `hhc_web`.

```sql
create table hhc_web.outbox_event (
  id uuid primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version bigint null,
  destination text not null,
  idempotency_key text not null,
  payload_json jsonb not null,
  status text not null,
  attempts int not null default 0,
  max_attempts int not null default 12,
  next_attempt_at timestamptz not null,
  locked_by text null,
  locked_until timestamptz null,
  last_error text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  processed_at timestamptz null,
  dead_lettered_at timestamptz null,
  constraint outbox_event_status_check check (
    status in ('pending', 'leased', 'succeeded', 'retry_scheduled', 'dead_lettered', 'cancelled')
  ),
  constraint outbox_event_payload_is_object check (jsonb_typeof(payload_json) = 'object')
);

create unique index outbox_event_destination_idempotency_uq
  on hhc_web.outbox_event(destination, idempotency_key);

create index outbox_event_claim_idx
  on hhc_web.outbox_event(status, next_attempt_at, created_at)
  where status in ('pending', 'retry_scheduled');

create index outbox_event_aggregate_idx
  on hhc_web.outbox_event(aggregate_type, aggregate_id, aggregate_version);
```

Recommended destinations:

- `projection-worker`
- `asset-api`
- `audit-log`
- `notification-api`
- `search-worker`

Rules:

- Side effects are written in the same transaction as source state changes.
- Workers use `for update skip locked`.
- Idempotency keys must include aggregate id and version when stale side effects matter.
- Stale publish/unpublish side effects must re-check current source state before changing public exposure.

## Seed Tables

Seed tables support deterministic import of current `hhc-web` content.

### `content_seed_run`

```sql
create table hhc_web.content_seed_run (
  id uuid primary key,
  seed_version text not null,
  source_repo text not null,
  source_commit text not null,
  manifest_sha256 text not null,
  status text not null,
  warning_count int not null default 0,
  inserted_count int not null default 0,
  updated_count int not null default 0,
  skipped_count int not null default 0,
  created_by text not null,
  started_at timestamptz not null,
  finished_at timestamptz null,
  constraint content_seed_run_status_check check (
    status in ('started', 'succeeded', 'failed')
  )
);

create unique index content_seed_run_version_uq
  on hhc_web.content_seed_run(seed_version, manifest_sha256);
```

### `content_seed_source`

```sql
create table hhc_web.content_seed_source (
  id uuid primary key,
  seed_run_id uuid not null references hhc_web.content_seed_run(id),
  source_path text not null,
  source_key text not null,
  source_sha256 text not null,
  target_table text not null,
  target_id uuid null,
  status text not null,
  warning_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  constraint content_seed_source_status_check check (
    status in ('inserted', 'updated', 'skipped', 'warning', 'failed')
  ),
  constraint content_seed_source_warning_is_array check (jsonb_typeof(warning_json) = 'array')
);

create unique index content_seed_source_key_uq
  on hhc_web.content_seed_source(seed_run_id, source_path, source_key);
```

Rules:

- Seed runs are auditable and repeatable.
- Seed warnings must not be ignored in production.
- Do not seed corrupted text as canonical content.

## Optimistic Concurrency

Admin update, publish, unpublish, and archive commands should require one of:

- `If-Match` with current version/etag
- explicit `expectedVersion` in the command body

Rules:

- Version increments on any domain state change.
- Concurrent stale writes return `409 conflict`.
- Publish validates the latest source state in the same transaction.
- Side effect idempotency keys include aggregate version.

## Publish Transaction Pattern

Use one local transaction for projection-only publish:

```text
begin
  lock source row for update
  validate current version/status/locale/assets
  update source row and translations
  upsert public projection
  insert outbox row for audit append
  insert optional notification outbox row
  insert content revision
commit
```

Use a workflow transaction for required-public-asset publish:

```text
begin
  lock source row for update
  validate current version/status/locale/assets
  insert publication_workflow(status='waiting_asset_grant')
  insert outbox rows for versioned asset grant commands
  insert outbox row for audit publish_requested
  insert content revision
commit

worker:
  confirm public asset grants
  re-read source row and workflow version
  if current, update source status to published
  upsert public projection/search/sitemap rows
  update Redis pointers
  mark workflow public_visible
  emit audit publish_completed
```

Do not call `asset-api`, `audit-log`, or `notification-api` inside the transaction.

## Public Projection Rebuild Rules

Projection builders must:

- read only published/active source records
- exclude draft, archived, deleted, private, restricted, and infected asset references
- validate output shape against public API contracts
- include stable gateway asset URLs
- emit an `etag`
- update Redis after PostgreSQL projection commit or invalidate Redis before response

Projection rebuild should be callable for:

- one content item
- one bulletin issue
- one locale
- all content in one locale
- all public projections after seed import

## Migration Rules

Initial migration order:

1. Create schema.
2. Create content source tables.
3. Create module detail tables.
4. Create bulletin tables.
5. Create projection tables.
6. Create search document table when search is enabled.
7. Create outbox table.
8. Create seed tables.
9. Add indexes.
10. Add check constraints.
11. Add seed/import tooling.

Operational rules:

- Additive migrations first.
- Backfill before adding `not null` constraints when existing data exists.
- Create indexes concurrently for large production tables.
- Avoid destructive migrations in the same release as replacement code.
- Keep rollback notes for every production migration.

## Verification

Schema verification:

- `hhc_web` schema exists.
- Tables and indexes exist.
- Check constraints reject unsupported locale/status/type.
- Unique constraints reject duplicate slugs, bulletin issue dates, and locale versions.
- Soft-deleted rows do not block recreation where partial indexes allow it.

Domain verification:

- Draft content never appears in public projections.
- Legal slugs cannot be changed casually.
- Bulletin versions require `cms.weekly.pdf` assets before publish.
- Public asset grants are emitted through outbox.
- Required-public-asset publish creates a workflow and does not expose projection until grant confirmation.
- Unpublish removes projections and revokes public grants only when no other published content uses the asset.
- Stale publish side effects do not re-expose unpublished assets.
- Public search documents are generated from active public projections only.
- Admin search documents are separate from public search documents and require admin APIs.

Seed verification:

- Seed import is idempotent.
- Seed run records source commit, manifest checksum, row counts, and warnings.
- Seeded public fixtures match current frontend TypeScript shapes.

Projection verification:

- Public API responses match `docs/api/public-api.md`.
- ETags change when payload changes.
- Redis cache can be rebuilt from PostgreSQL.
- Sitemap includes only published indexable content.

## Implementation Notes

Recommended Go package ownership:

```text
internal/db/migrations/
internal/content/
internal/content/schema/
internal/news/
internal/pages/
internal/videos/
internal/locations/
internal/history/
internal/home/
internal/bulletins/
internal/projections/
internal/outbox/
internal/seed/
```

Keep SQL access behind module repositories. Route handlers should not compose arbitrary SQL across modules.

Use transaction boundaries at the domain command level, not per repository method.

## Open Extension Points

These are intentionally not v1 requirements:

- approval workflow
- scheduled publishing
- collaborative editing
- full text search table
- multi-site/multi-tenant content
- private member-only content
- external CMS API consumers

The schema leaves room for them through versioning, visibility, projections, and service split triggers without implementing them prematurely.
