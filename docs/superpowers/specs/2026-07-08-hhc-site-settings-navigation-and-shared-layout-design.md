# HHC Site Settings, Navigation, And Shared Layout Design

## Purpose

This spec defines how the HHC platform should manage site-wide settings, navigation, footer links, external links, contact display data, social links, shared layout metadata, and public layout projections.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`
- `docs/api/public-api.md`
- `docs/api/admin-api.md`

## Core Decision

Use a `site-settings` module inside `hhc-web-api`.

Do not create a standalone `site-config-api` or `settings-api` in v1. Site navigation and shared layout settings are part of the public website bounded context. They share CMS roles, localization, public projection, SEO, cache invalidation, and rollback requirements with the rest of `hhc-web-api`.

Separate three categories:

| Category | Owner | Examples | Change Mechanism |
| --- | --- | --- | --- |
| Runtime config | deployment/platform | hostnames, OIDC issuer, DB URL, feature flags, provider secrets | typed env, Key Vault, release controls |
| Editorial site settings | `hhc-web-api` CMS | nav items, footer links, social URLs, music channel URL, contact display, public layout text | admin CMS publish workflow |
| Frontend UI chrome | `hhc-web` i18n/code | menu button labels, language label, generic loading/error text | frontend release |

This prevents two common failures:

- putting public editorial settings into environment variables, which makes every content change a deployment
- putting secrets or release controls into CMS, which makes security depend on editorial workflows

## Current Code Surface

Current `hhc-web` has shared layout data in several places:

- `src/lib/site.ts`: site name, canonical URL, Open Graph image path, YouTube/Facebook/music URLs
- `SiteHeader`: navigation items are hard-coded in the component
- `SiteFooter`: social links and legal links are built from `siteConfig` and i18n
- locale JSON: nav labels, legal link labels, social aria labels, copyright text
- `sitemap.ts` and route metadata: route list and `siteConfig.url`
- locations feature: address, map URL, and future service times/contact display

The migration should preserve current routes while moving editable public layout data behind `hhc-web-api` projections.

## Ownership Boundary

`hhc-web-api` owns:

- published navigation model
- footer link model
- public social/external links
- music channel link used by current home video section
- public contact display fields
- public layout projection
- site-wide public SEO defaults when editable
- revision/rollback for editable site settings

`hhc-web` owns:

- layout rendering
- responsive behavior
- accessibility behavior
- generic UI labels
- language-switcher UI behavior
- fallback route registry during migration

Platform typed config owns:

- canonical host and environment hostnames
- OIDC/account endpoints
- service URLs and app ids
- feature flags and kill switches
- secrets and provider credentials
- production safety guards

## What Is Editable In V1

Editable through CMS:

- Header navigation items.
- Footer legal/resource links.
- Social links such as YouTube and Facebook.
- Music channel link.
- Public contact display text and links.
- Optional service-time display blocks if they are not part of a location record.
- Site-wide default SEO title suffix, description fallback, and Open Graph image asset.
- Registry-approved external links and provider metadata that pass third-party governance validation.

Not editable through CMS in v1:

- `www.alive.org.tw`, `admin.alive.org.tw`, or `account.alive.org.tw` hostnames.
- API base paths.
- OIDC issuer, audience, client ids, and JWKS URL.
- Blob containers, Redis keys, DB URLs, or service app ids.
- Feature flags and kill switches.
- Analytics providers, tag managers, third-party scripts, iframe HTML, and CSP allowlists.
- Admin route list and backend authorization policy.
- Locale registry. Adding a locale remains a coordinated frontend/backend change.

## Data Model

Use `hhc_web` tables owned by `hhc-web-api`.

### `site_setting_set`

Represents one versioned set of site-wide settings.

```sql
site_setting_set(
  id uuid primary key,
  status text not null,
  version bigint not null,
  created_by text not null,
  updated_by text not null,
  published_by text,
  published_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

Status values:

- `draft`
- `published`
- `unpublished`
- `archived`

V1 can maintain one active setting set. The table still uses versioning because it follows normal CMS concurrency and rollback rules.

### `site_setting_locale`

Localized labels and display text.

```sql
site_setting_locale(
  id uuid primary key,
  setting_set_id uuid not null,
  locale text not null,
  site_name text not null,
  english_name text,
  copyright_holder text,
  seo_title_suffix text,
  seo_description_fallback text,
  contact_display_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(setting_set_id, locale)
)
```

Rules:

- `locale` is one of `zh-Hant`, `zh-Hans`, `en`.
- `contact_display_json` is public display data only. Do not store private contact routing, internal emails, or notification provider credentials here.

### `site_navigation_item`

Header and footer navigation.

```sql
site_navigation_item(
  id uuid primary key,
  setting_set_id uuid not null,
  area text not null,
  locale text,
  label text not null,
  href text not null,
  target text not null default '_self',
  rel text,
  icon_key text,
  sort_order int not null,
  visible boolean not null default true,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

`area` values:

- `header`
- `footer_legal`
- `footer_resource`
- `social`

Rules:

- Internal links must use owned route paths, not full internal service URLs.
- External links must use `https`.
- `target='_blank'` requires safe `rel` such as `noopener noreferrer`.
- Header navigation should remain short enough to fit mobile and desktop layouts.

### `site_external_link`

Named reusable public links.

```sql
site_external_link(
  id uuid primary key,
  setting_set_id uuid not null,
  key text not null,
  url text not null,
  label text,
  link_type text not null,
  visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(setting_set_id, key)
)
```

Initial keys:

- `church_youtube`
- `church_facebook`
- `music_youtube`
- `default_og_image`

Rules:

- External URLs must pass allowlist/validation policy.
- Do not store secrets, tokens, tracking-only URLs, or provider admin URLs.

## Public Projection

Add a public projection:

```text
site_layout:{locale}
```

Public API route:

```text
GET /api/site-layout?locale=zh-Hant
```

Response data:

```json
{
  "siteName": "Hallelujah Home Church",
  "englishName": "Hallelujah Home Church",
  "header": {
    "items": [
      {
        "label": "About",
        "href": "/en/about",
        "target": "_self"
      }
    ]
  },
  "footer": {
    "legal": [],
    "resources": [],
    "social": []
  },
  "links": {
    "churchYoutube": "https://youtube.com/...",
    "churchFacebook": "https://www.facebook.com/...",
    "musicYoutube": "https://youtube.com/..."
  },
  "seoDefaults": {
    "titleSuffix": "Hallelujah Home Church",
    "descriptionFallback": "...",
    "openGraphImageUrl": "https://www.alive.org.tw/api/assets/public/asset_123"
  },
  "publishedAt": "2026-07-12T00:00:00Z"
}
```

Rules:

- The projection is public-safe and contains no secrets.
- Public pages can fetch this once per render and pass it into layout components.
- Redis and HTTP cache follow public projection rules.
- `hhc-web` can keep local fallback layout data during migration, but production should use the public projection after parity is proven.

## Admin API

Admin routes:

```text
GET  /api/admin/site-settings
PATCH /api/admin/site-settings
POST /api/admin/site-settings/publish
POST /api/admin/site-settings/unpublish
GET  /api/admin/site-settings/revisions
GET  /api/admin/site-settings/revisions/{revisionId}
POST /api/admin/site-settings/revisions/{revisionId}/restore-draft
POST /api/admin/site-settings/revisions/{revisionId}/rollback-publish
GET  /api/admin/preview/site-settings
```

Permissions:

| Operation | Required Scope |
| --- | --- |
| read settings | `cms:read` |
| save draft | `cms:admin` |
| publish/unpublish | `cms:admin` |
| restore draft | `cms:admin` |
| rollback publish | `cms:admin` |
| preview draft/revision | `cms:read` |

Reasoning:

- Site settings affect every public page, SEO, legal links, and external links.
- V1 keeps these operations under `cms:admin`, not ordinary `cms:write`.
- Preview is read-only and must not update `site_layout:{locale}`.

## Validation Rules

General:

- V1 locales only: `zh-Hant`, `zh-Hans`, `en`.
- Required default locale: `zh-Hant`.
- Every visible navigation item needs a label and href.
- Header nav item count has a configured max, recommended 5.
- Sort order must be deterministic.

Internal links:

- Must start with `/`.
- Must not start with `/api`, `/priv`, or `/admin/api`.
- Must resolve to an allowed public route or published CMS route.
- Must include locale handling through the projection builder or frontend mapper.

External links:

- Must use `https`.
- Must not point to admin consoles, storage URLs, SAS URLs, localhost, private IP ranges, or internal service hosts.
- Social links should use an allowed provider class when possible.
- Query params are allowed only if they are part of the public channel URL; avoid campaign/tracking params unless explicitly approved.

SEO defaults:

- Open Graph image must be a public-ready asset or a static frontend route.
- Description fallback must be localized.
- Title suffix must not include environment names such as staging/prod.

## Publish Flow

1. Admin saves draft settings.
2. Backend validates route, locale, social, external link, SEO, and asset rules.
3. Backend creates revision snapshot.
4. Admin publishes with `cms:admin`.
5. Backend validates the draft again.
6. Backend creates public asset grant for editable Open Graph image if needed.
7. Backend generates `site_layout:{locale}` projections.
8. Backend refreshes affected page projections if SEO defaults changed.
9. Backend invalidates Redis/gateway/Next layout cache paths.
10. Backend emits audit events.

Site settings publish affects:

- `site_layout:{locale}`
- `home:{locale}` when shared layout or SEO defaults affect home metadata
- `sitemap:{locale}` when navigation exposes or hides public routes
- page metadata that depends on site-wide SEO defaults

## Rollback And Revision

Site settings follow the CMS versioning/rollback design.

Rules:

- Restore to draft changes admin settings only.
- Rollback publish changes public layout projection.
- Rollback publish must revalidate every link and asset.
- If an old social link is now disallowed, rollback publish fails until edited.
- Audit metadata should include affected setting keys, link keys, locales, and source revision id.

## Frontend Integration

Recommended migration:

1. Keep `src/lib/site.ts` as local/test fallback.
2. Add typed public layout client.
3. Change layout components to accept `siteLayout` props instead of importing mutable public links directly.
4. Keep UI-only labels in i18n, such as menu open/close, language label, and generic aria labels.
5. Move nav item labels, footer link labels, social URLs, music URL, and copyright holder to site layout projection.
6. Keep route helpers and locale registry in code.
7. Remove production dependency on hard-coded `example.com` canonical config after public projection and environment host config are ready.

`siteConfig.url` should be replaced by environment-aware canonical host config for runtime metadata, while public layout projection owns editable display and link data.

## Security And Privacy

- Site settings are public data after publish.
- Do not store private emails, internal phone trees, staff-only contact routing, provider credentials, or API keys.
- Public contact display can include public address, public phone, public email alias, and map links.
- Contact forms or private inquiry routing belong to a future `engagement-api` when the workflow becomes more than display data.
- External links must protect against open redirect, private-network URLs, and storage URL leakage.

## Observability

Metrics:

- site layout projection build count/failure
- site settings publish count/failure
- invalid external link validation count
- layout projection cache hit/miss
- active header nav item count

Logs:

- request id
- actor id
- setting set id
- version
- affected locales
- changed key names
- validation failure reason

Do not log full contact text or entire settings payload when not needed.

## Tests

Unit tests:

- internal link validation blocks `/api`, `/priv`, admin API, absolute internal service URLs, localhost, private IP ranges
- external link validation requires `https`
- header nav item max is enforced
- site layout projection localizes labels
- UI labels remain frontend i18n-owned
- SEO defaults require localized fallback values

Integration tests:

- save draft creates revision
- publish creates `site_layout:{locale}` projection
- publish with invalid external link fails
- publish with private Open Graph asset fails
- rollback publish revalidates old links and assets
- sitemap/home metadata projections refresh when site settings affect them

Frontend tests:

- header renders projected nav items
- footer renders projected legal/social links
- social links never expose Blob/SAS/internal URLs
- missing projection uses local/test fallback only outside production
- layout remains usable in all v1 locales

## Acceptance Criteria

- Site settings stay inside `hhc-web-api`; no v1 `site-config-api` exists.
- Runtime config, editorial site settings, and frontend UI chrome have separate ownership.
- Public layout data is served through `GET /api/site-layout`.
- Admin settings use `cms:admin`, version preconditions, idempotency, revisions, restore, rollback, audit, and public projection invalidation.
- External links are validated before publish and rollback.
- `hhc-web` can migrate away from hard-coded nav/social/footer data without moving secrets or route policy into CMS.
