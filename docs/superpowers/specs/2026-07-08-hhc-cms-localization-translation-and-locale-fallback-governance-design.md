# HHC CMS Localization, Translation, And Locale Fallback Governance Design

## Purpose

This spec defines how `hhc-web-api` should manage multilingual CMS content for `zh-Hant`, `zh-Hans`, and `en`. It covers source locale, translation status, locale completeness, fallback rules, localized slugs, SEO alternates, weekly bulletin PDF versions, public projections, admin workflow, and future locale expansion.

The goal is to keep localization reliable without introducing a v1 `translation-api`, `localization-api`, or external translation-management system.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`

## External Alignment

- W3C Language Tags and Locale Identifiers: `https://www.w3.org/TR/ltli/`
- W3C Internationalization Best Practices: `https://www.w3.org/TR/international-specs/`
- Google Search Central localized versions: `https://developers.google.com/search/docs/specialty/international/localized-versions`
- Microsoft standard locale names / BCP 47 overview: `https://learn.microsoft.com/en-us/globalization/locale/standard-locale-names`

## Core Decision

Keep localization inside `hhc-web-api` for v1.

Reasoning:

- localized content, localized slug, SEO, public projection, cache invalidation, sitemap, and publish workflow are one bounded context
- translations are low-volume church editorial work, not a separate high-scale workflow
- separating a translation service now would add contracts, events, queues, ownership, and operational cost without independent scaling or ownership

Rejected v1 services:

- `translation-api`
- `localization-api`
- `locale-api`
- `tms-api`

Future integration with a translation-management system can be added as an adapter or import/export workflow after the CMS source model is stable.

## Locale Registry

V1 supported locale tags:

| Locale | Meaning | Role |
| --- | --- | --- |
| `zh-Hant` | Traditional Chinese | default/source locale |
| `zh-Hans` | Simplified Chinese | translated locale |
| `en` | English | translated locale |

Rules:

- Use BCP 47 style tags consistently in frontend routes, API params, database rows, cache keys, events, and SEO metadata.
- `zh-Hant` is the default source locale unless a content type explicitly overrides it.
- Do not add a locale by only adding CMS rows. A new locale requires frontend route registry, i18n messages, CMS validation, admin UI labels, API fixtures, sitemap alternates, cache keys, and rollout evidence.
- Locale tags are case-sensitive in application contracts even though BCP 47 matching can be case-insensitive. Store canonical casing only.

## Source Locale And Translation Groups

Every translatable aggregate has:

- `translationGroupId`
- `sourceLocale`
- one or more localized records
- per-locale status
- per-locale version
- per-locale published snapshot

`translationGroupId` groups localized variants of the same logical content. It is not a public route id.

`sourceLocale` is used for:

- determining required publish baseline
- marking translations stale when source changes
- generating translation work items
- explaining fallback decisions
- determining `x-default` or default alternate behavior

V1 default:

```text
sourceLocale = zh-Hant
```

## Translation Status Model

Each localized record uses one of these statuses.

| Status | Meaning | Publicly Visible |
| --- | --- | --- |
| `missing` | locale row does not exist or has no meaningful content | no |
| `draft` | editable translation not ready for public review | no |
| `needs_translation` | source changed and translation needs work | no unless old published snapshot remains active |
| `needs_review` | translated but not approved for publish | no |
| `ready` | can be published | no until publish |
| `published` | current public locale projection exists | yes |
| `unpublished` | intentionally removed from public output | no |
| `archived` | retained for history only | no |

Database v1 can keep the current `draft`, `ready`, `published`, `unpublished`, `archived` check constraint and represent `missing`, `needs_translation`, and `needs_review` in workflow metadata if changing the schema is not part of the current migration. The domain model should still use the full status vocabulary in admin UI and validation.

## Staleness Rules

When source locale content changes:

- source locale version increments
- affected translated locales are marked stale if the changed fields affect visible meaning
- stale locales keep their last published projection until unpublished or replaced
- stale locales must show a warning in admin lists and editor tabs
- stale locale projections must not be rebuilt from the new source automatically

Fields that mark translations stale:

- title
- summary
- body blocks
- legal text
- weekly bulletin title/subtitle/PDF
- location name/address when meaning changes
- video title/description when display text changes
- SEO title/description if not auto-derived

Fields that do not automatically mark translations stale:

- sort order
- display date
- shared cover asset when alt text is locale-specific and unchanged
- internal notes
- analytics metadata

## Fallback Policy

Fallback is a product and SEO decision, not an implementation convenience.

| Surface | Default Fallback | Reason |
| --- | --- | --- |
| Public home composed sections | allowed only for explicitly marked section snippets | homepage can tolerate limited fallback with clear metadata |
| News list cards | allowed only when card text has a published fallback policy | lists can show fewer items instead |
| News detail | no silent fallback | wrong-language detail pages hurt trust and SEO |
| Generic pages | no silent fallback unless page is explicitly configured as shared-language | page content is user-visible editorial content |
| Legal pages | no fallback | legal text must match requested locale or return 404 |
| Weekly bulletin latest/specific issue | no fallback for PDF version | a PDF in the wrong language is a wrong document |
| Videos | display metadata may fallback; provider link is shared | video itself may be language-neutral |
| Locations | address/name may fallback only with `meta.fallbackLocale` | users need accurate local display |
| Site layout/navigation | no silent fallback for labels; hide missing optional links | navigation language mismatch is jarring |
| Admin UI chrome | frontend i18n fallback allowed | chrome is product UI, not CMS content |

Public APIs must not silently fallback detail responses. If fallback is intentionally used:

- response includes `meta.locale` requested locale
- response includes `meta.contentLocale` actual content locale
- response includes `meta.fallbackLocale`
- route metadata uses actual content language
- alternates do not claim a missing translation exists
- cache key includes requested locale and actual content locale marker

## Publish Policy

V1 supports per-locale publish, but `zh-Hant` is required before translated locales can become public unless a content type explicitly allows otherwise.

Per-locale publish is allowed because:

- translations may be completed at different times
- English may lag behind Chinese without blocking the church website
- public alternates can include only published/indexable locales

Rules:

- Publishing `zh-Hant` creates or updates the default public projection.
- Publishing `zh-Hans` or `en` creates or updates only that locale's public projection.
- Publishing a translated locale requires its source locale to be published unless the module is language-independent.
- Unpublishing a source locale should warn about translated locales and may block if it would leave orphan alternates.
- Rollback publish is per locale unless the admin explicitly chooses an all-locale rollback.

## Locale Completeness Requirements

Required fields by content type:

| Content Type | Required Default Locale | Required Translated Locale Before Publish |
| --- | --- | --- |
| News | title, summary, slug, body if detail enabled, SEO fallback | title, summary, slug, body if detail enabled |
| Generic/page/about | title, slug, body, SEO fallback | title, slug, body |
| Legal | title, body, effective date if used | title, body |
| Weekly bulletin | issue date, title, subtitle, clean PDF asset | title, subtitle, clean PDF asset |
| Video | provider id/url, title, thumbnail alt | title if locale-specific display is enabled |
| Location | stable key, name, address, map link | name and address unless shared-language configured |
| Site settings | navigation labels, footer labels, SEO defaults | navigation labels and footer labels for visible links |

Missing non-required translated content should hide that locale variant or show an explicit admin warning; it should not create public empty pages.

## Slug And Redirect Rules

Localized slugs are independent per locale.

Rules:

- slug uniqueness is scoped by `locale + slugScope`
- source locale slug changes create a source-locale redirect only
- translated locale slug changes create redirects only for that locale
- system/legal slugs remain fixed across locales unless a route registry change is approved
- translation status changes do not delete redirects
- fallback responses must not create redirects from missing-locale paths to source-locale paths unless this is an explicit product decision

When a translated slug is missing:

- admin UI should ask for a locale slug before publish
- backend should not auto-generate non-Latin slugs from title
- backend may suggest a slug, but editor approval is required

## SEO And Locale Alternates

`hhc-web-api` owns alternate route metadata in public projections.

Rules:

- generate `hreflang` only for published/indexable locale variants
- each variant includes itself and all other published variants
- `x-default` points to `zh-Hant` for general public pages unless a language selector page exists later
- missing or stale translations do not appear as alternates
- alternate URLs use locale-specific slugs
- canonical URL always matches the current locale variant being rendered
- fallback content must not claim to be a fully translated alternate

PDF weekly bulletin files can use HTTP `Link` headers for locale alternates later, but v1 can rely on the bulletin page/API to expose available locale versions.

## Weekly Bulletin Localization

Weekly bulletins are stricter than general content.

Issue model:

- `bulletin_issue`: issue date and lifecycle
- `bulletin_version`: one row per locale with title, subtitle, PDF asset, status, and published snapshot

Rules:

- latest by locale means latest published issue that has a published version in that requested locale
- latest must not return a different-locale PDF unless the API explicitly returns a fallback response and the caller requested fallback-capable behavior
- LINE bot should request the user's preferred locale or default `zh-Hant`
- LINE bot selected issue should return not found for missing locale by default
- admin UI should show issue-level completeness across all three locales
- publishing a bulletin locale must verify PDF asset scan/processing/grant readiness for that locale

This keeps LINE bot, website archive, and direct downloads consistent.

## Admin UI Requirements

Admin localization UI should provide:

- locale tabs with status badges
- source locale marker
- stale translation warning
- missing required field list per locale
- compare source vs translated fields view
- publish per-locale action
- all-locale readiness summary
- warning when source changes will mark translations stale
- warning when slug change creates redirect
- alternate preview for published locales

V1 does not require machine translation, side-by-side rich diff, or approval workflow. It should still store enough metadata to add them later.

## API Behavior

Public request:

```text
GET /api/news/{slug}?locale=en
```

Default behavior:

- return published English projection if present
- return `404` if missing/unpublished
- do not return `zh-Hant` content silently

Optional explicit fallback request can be added later:

```text
GET /api/news/{slug}?locale=en&fallback=source
```

Fallback response must include:

```json
{
  "meta": {
    "locale": "en",
    "contentLocale": "zh-Hant",
    "fallbackLocale": "zh-Hant"
  }
}
```

Admin request:

```text
GET /api/admin/content/{id}/translations
```

Response should include per-locale:

- status
- version
- sourceVersionSeen
- stale flag
- slug
- SEO completeness
- required asset readiness
- last published time

## Projection And Cache Rules

Projection keys include locale:

```text
{env}:hhc-web-api:public:{locale}:{resource}:{versionOrQueryHash}
```

Additional metadata in projection payload:

- requested locale
- content locale
- translation group id
- source locale
- published locale variants
- alternate route metadata
- translation version
- source version seen

Invalidation rules:

- source locale publish invalidates source locale projections and alternate metadata for all published locale variants in the translation group
- translated locale publish invalidates that locale and alternate metadata for sibling published variants
- unpublish removes the locale projection and updates alternates for siblings
- slug change updates route projection, redirect projection, sitemap, and alternates for the affected locale
- stale translation state does not automatically invalidate public output unless public metadata changes

## Schema Additions

Current `content_translation` can support v1, but the implementation should add explicit metadata before production if possible:

```sql
source_locale text not null default 'zh-Hant'
source_version_seen bigint null
translation_status text not null default 'draft'
translation_stale boolean not null default false
fallback_allowed boolean not null default false
fallback_policy text not null default 'none'
```

If these fields are not added immediately, store equivalent metadata in a structured workflow metadata column and keep public API behavior the same.

Recommended constraints:

- `source_locale` in supported locales
- `translation_status` in `draft`, `needs_translation`, `needs_review`, `ready`, `published`, `unpublished`, `archived`
- `fallback_policy` in `none`, `source_locale`, `hide_if_missing`

## Events And Audit

Audit events:

- `cms.translation.create`
- `cms.translation.update`
- `cms.translation.mark_stale`
- `cms.translation.ready`
- `cms.translation.publish`
- `cms.translation.unpublish`
- `cms.translation.rollback_publish`

Integration events should follow the canonical event governance document if emitted outside `hhc-web-api`.

Event payloads should include:

- content id
- translation group id
- locale
- source locale
- source version seen
- translation version
- public projection version when applicable

Do not include full content body in integration events unless a consumer contract explicitly requires it.

## Future Locale Expansion

Adding a new locale requires:

- frontend locale registry update
- route generation and redirects
- message catalog for UI chrome
- database check constraint or reference-table migration
- admin locale tab support
- seed/import fixture updates
- public API fixtures
- sitemap alternate tests
- public route smoke tests
- font/rendering review
- search analyzer/tokenization review if search is enabled
- LINE bot locale selection update if relevant

Use a reference table for locales if locale additions become frequent. V1 fixed check constraints are acceptable for a three-locale system.

## Acceptance Criteria

- `hhc-web-api` remains the localization owner for v1; no standalone translation/localization service is introduced.
- `zh-Hant`, `zh-Hans`, and `en` are the only v1 CMS locales.
- Source locale, translation status, stale translation behavior, and per-locale publish rules are explicit.
- Public detail APIs do not silently fallback to another locale.
- Weekly bulletin latest/specific issue APIs do not return a different-locale PDF by default.
- SEO alternates include only published/indexable locale variants.
- Slug redirects are locale-specific.
- Admin UI requirements show locale status, staleness, completeness, slug impact, and publish readiness.
- Rollout verification includes locale completeness, fallback, alternates, sitemap, cache, and LINE bot weekly bulletin locale tests.
