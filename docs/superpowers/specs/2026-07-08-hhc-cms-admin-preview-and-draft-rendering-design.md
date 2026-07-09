# HHC CMS Admin Preview And Draft Rendering Design

## Purpose

This spec defines how CMS draft preview works across `hhc-web`, `hhc-web-api`, `asset-api`, `api-gateway`, cache policy, SEO/noindex behavior, and admin UI routing.

Preview is a high-risk feature because it intentionally renders unpublished data. The design must make draft preview convenient for editors without creating a public bypass around the publish workflow.

This spec complements:

- `docs/api/admin-api.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`

## Core Decision

V1 preview is authenticated admin preview only.

Do not create public preview tokens, public share links, or public preview routes in v1. A public preview sharing workflow can be added later only when there is a real reviewer workflow, explicit expiry, revocation, audit, and leak-response design.

V1 preview reads saved draft, published, or revision snapshots through admin APIs. It does not read public projections and does not write public projections.

## Non-Goals

- Public draft sharing.
- Anonymous reviewer links.
- Search-engine-visible preview pages.
- Preview through `www.alive.org.tw/{locale}/...` public routes.
- Next.js API routes for preview.
- Rendering arbitrary HTML from CMS body fields.
- Autosave as source of truth.

## Preview Modes

| Mode | Source | Public Effect | Use Case |
| --- | --- | --- | --- |
| Draft preview | current saved draft/source record | none | editor checks unpublished work |
| Published preview | current published source/projection-equivalent render model | none | compare current public version inside admin |
| Revision preview | immutable revision snapshot | none | review restore/rollback target |
| Local unsaved preview | browser form state only | none | optional instant visual feedback before saving |

V1 server preview requires saved data. If the editor has unsaved changes, the UI should either prompt Save Draft before server preview or render a clearly labeled local-only preview from form state.

Do not send large unsaved CMS payloads to a generic server preview endpoint in v1. It increases logging, validation, and data-leak risk without solving the core publish workflow.

## Admin UI Routes

Preview UI routes live under the admin host:

```text
https://admin.alive.org.tw/{locale}/admin/preview/content/{id}
https://admin.alive.org.tw/{locale}/admin/preview/bulletins/{issueId}
https://admin.alive.org.tw/{locale}/admin/preview/site-settings
```

These are UI routes only. They must:

- require admin auth state
- fetch `www.alive.org.tw/api/admin/preview/*`
- use `Cache-Control: no-store`
- use `X-Robots-Tag: noindex`
- not appear in sitemap
- not call public APIs for draft content

Preview can also render inline inside `PreviewPane` without changing the browser route. The same API rules apply.

## Admin API Routes

Preview API routes live under the protected admin API namespace:

```text
GET /api/admin/preview/content/{id}?locale=zh-Hant&mode=draft
GET /api/admin/preview/content/{id}?locale=zh-Hant&mode=published
GET /api/admin/preview/content/{id}?locale=zh-Hant&mode=revision&revisionId=rev_123

GET /api/admin/preview/bulletins/{issueId}?locale=zh-Hant&mode=draft
GET /api/admin/preview/bulletins/{issueId}?locale=zh-Hant&mode=published
GET /api/admin/preview/bulletins/{issueId}?locale=zh-Hant&mode=revision&revisionId=rev_123

GET /api/admin/preview/site-settings?locale=zh-Hant&mode=draft
GET /api/admin/preview/site-settings?locale=zh-Hant&mode=published
GET /api/admin/preview/site-settings?locale=zh-Hant&mode=revision&revisionId=rev_123
```

Required auth:

- `cms:read` for content, bulletin, and site-settings preview reads.
- `assets:read` is not required for a normal content preview when the asset is referenced by the previewed CMS resource and the viewer has `cms:read`.
- Backend services still validate asset reference ownership and eligibility before returning preview asset URLs.

Preview routes return `404` for missing resources and `403` for insufficient permissions. They should not reveal whether a resource exists to users without `cms:read`.

## Response Shape

Preview returns a render model, not raw database rows and not arbitrary HTML.

Example:

```json
{
  "data": {
    "resource": {
      "id": "content_123",
      "type": "news",
      "status": "draft",
      "locale": "zh-Hant",
      "version": 12
    },
    "preview": {
      "mode": "draft",
      "renderedAt": "2026-07-08T12:00:00Z",
      "sourceVersion": 12,
      "warnings": [
        {
          "code": "asset_processing",
          "message": "Cover image is not ready for public publish."
        }
      ]
    },
    "page": {
      "title": "Example title",
      "summary": "Example summary",
      "bodyBlocks": [],
      "seoPreview": {
        "title": "Example title - HHC",
        "description": "Example summary",
        "canonicalUrl": null,
        "noindex": true
      },
      "assetRefs": [
        {
          "assetId": "asset_123",
          "purpose": "cover",
          "previewUrl": "https://www.alive.org.tw/api/assets/protected/asset_123",
          "status": "ready"
        }
      ]
    }
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Rules:

- `seoPreview.noindex` is always `true` for preview.
- `canonicalUrl` is `null` or an admin-only preview URL; it must not claim the public canonical URL unless it is only displayed as text in an SEO preview panel.
- `bodyBlocks` are structured blocks validated by `hhc-web-api`.
- `bodyBlocks` must follow the HHC render model; preview must not return raw HTML, raw Markdown, editor-library opaque JSON, arbitrary CSS classes, or component props from CMS content.
- Preview payload must not include draft records for unrelated locales or resources.
- Preview payload must not include Blob URLs, SAS URLs, internal service URLs, `/priv/*` routes, or provider secrets.

## Asset Preview Policy

Preview must not grant public read.

CMS draft assets can be previewed only when all are true:

- asset belongs to `hhc-web-api` or has an explicit owner-service grant for `hhc-web-api`
- asset is referenced by the previewed resource or is selected in the editor session
- viewer has `cms:read` for the resource context
- asset is not infected, scan-failed, deleted, or quarantined

Recommended asset states:

| Asset State | Preview Behavior |
| --- | --- |
| `clean` and `ready` | return protected gateway preview/download URL |
| `clean` and derivative pending | return original protected URL only if namespace allows original preview; otherwise placeholder |
| `scan_pending` | show placeholder and warning; do not render bytes |
| `scan_failed` or `infected` | show blocked warning; do not render bytes |
| `deleted` or `quarantined` | show missing/blocked warning; do not render bytes |
| private asset not referenced by this resource | deny |

Use stable gateway URLs only:

```text
GET /api/assets/protected/{assetId}
```

`asset-api` may enforce role/scope grants directly, or `hhc-web-api` may return preview URLs only for assets that already have CMS-preview restricted grants. In both cases the browser must never receive Blob/SAS URLs.

For CMS-owned draft assets, `hhc-web-api` should create or ensure restricted preview grants for CMS roles during attach/upload completion. Publishing later creates a separate public grant only when the content is published.

## Bulletin Preview

Bulletin preview should show:

- issue date
- locale version title/subtitle
- PDF filename
- scan/processing status
- protected download URL only when the PDF is clean and preview-eligible
- publish blockers

If PDF scan is pending or failed, preview displays metadata and blocking status, not the PDF bytes.

LINE bot must never use preview routes. It reads only published public bulletin routes.

## Site Settings Preview

Site settings preview should render:

- draft or revision header navigation
- draft or revision footer links
- social/music links
- public contact display
- site SEO defaults
- validation warnings

It must use the same public-safety validators as publish:

- no Blob/SAS URLs
- no internal service URLs
- no admin URLs in public layout links
- no `/priv/*` or `/api/priv/*`
- external links use `https`
- internal links match allowed route policy

Site settings preview does not update `site_layout:{locale}`.

## Rendering Responsibility

`hhc-web-api` owns:

- loading draft/published/revision source data
- validating locale and mode
- producing public-page-compatible render models
- adding preview warnings and publish blockers
- returning protected asset references only after validation

`hhc-web` owns:

- rendering preview inside admin UI
- showing unsaved-change warnings
- using the same presentation components where practical
- visually labeling preview mode
- preventing accidental navigation from preview to public draft routes

`asset-api` owns:

- protected asset download checks
- scan/deleted/quarantine enforcement
- range/download headers
- no Blob/SAS exposure

## Cache, SEO, And Headers

Preview API responses:

```text
Cache-Control: no-store
X-Robots-Tag: noindex, nofollow
```

Preview UI responses:

```text
Cache-Control: no-store
X-Robots-Tag: noindex, nofollow
```

Rules:

- Do not write preview payloads to public projection tables.
- Do not write preview payloads to public Redis keys.
- Do not include preview routes in sitemap.
- Do not emit public route metadata from preview.
- Do not let browser/CDN cache preview API responses.
- Do not run public analytics events for preview page views unless clearly marked as admin preview telemetry.

## Validation And Warnings

Preview should be more permissive than publish for incomplete drafts, but it must not be unsafe.

Allowed in preview:

- missing SEO description
- incomplete non-default locale
- unpublished slug
- draft status
- asset processing warning placeholders

Blocked in preview:

- invalid locale
- unsupported content type
- unsafe structured block
- arbitrary HTML/script
- Blob/SAS/internal URLs in fields that render as links/images
- infected, scan-failed, deleted, or quarantined assets
- path traversal or reserved route paths

Preview response should include warnings rather than failing when the issue is a publish blocker but safe to display.

## Error Behavior

| Case | Response |
| --- | --- |
| Missing/invalid token | `401 unauthorized` |
| Missing `cms:read` | `403 forbidden` |
| Missing resource | `404 not_found` |
| Invalid mode or locale | `400 validation_failed` |
| Revision does not belong to resource | `404 not_found` |
| Unsafe block or unsafe URL | `400 validation_failed` |
| Asset blocked by scan/delete/quarantine | preview succeeds with warning and no asset URL when the content itself is otherwise safe |
| Backend dependency unavailable | `503 dependency_unavailable` |

Do not return draft content in error metadata.

## Observability

Metrics:

- preview request count by resource type/mode/status
- preview latency by resource type
- preview validation warning count by code
- preview denied count by reason
- preview blocked asset count by asset state

Logs:

- request id
- user id
- resource type/id
- locale
- preview mode
- status code
- warning codes

Do not log full draft body, tokens, asset URLs, provider secrets, or raw structured blocks.

Normal preview reads do not need append-only audit events in v1 because that would create high-noise audit logs. Permission denials, unsafe-content validation failures, future public preview token creation, and future external share access should be audit events.

## Frontend Component Impact

Admin components:

- `PreviewPane`
- `PreviewToolbar`
- `PreviewWarnings`
- `SeoPreviewPanel`
- `RevisionPreview`
- `BulletinPreview`
- `SiteSettingsPreview`

Rules:

- Preview label must be visible in admin UI.
- Opening preview with unsaved changes prompts Save Draft or uses local-only preview.
- Revision preview must not imply that rollback has happened.
- Links inside preview should open safely and should not navigate the admin app into a public draft URL.
- Preview should use the same typography/layout primitives as public pages where practical to catch real rendering issues.

## Tests

Backend tests:

- preview requires trusted identity headers
- `cms:read` can preview draft content
- missing `cms:read` returns `403`
- public routes cannot access draft preview data
- draft preview does not update public projection tables
- draft preview does not update Redis public keys
- revision preview only loads revisions belonging to the resource
- unsafe block/URL is rejected
- infected/scan-failed/deleted asset is not returned as a preview URL
- scan-pending asset produces warning and placeholder
- site settings preview rejects internal/admin/private URLs
- preview responses are `Cache-Control: no-store`

Frontend tests:

- preview pane handles loading, forbidden, validation warning, dependency failure, and success states
- preview label is visible
- unsaved changes prompt Save Draft before server preview
- revision preview is read-only
- preview never calls public APIs for draft content
- preview never renders Blob/SAS URLs

End-to-end smoke tests:

- admin user previews a draft news item
- admin user previews a selected revision
- admin user previews a draft bulletin with clean PDF
- scan-pending asset shows warning instead of bytes
- public route still returns `404` for the same draft
- sitemap excludes preview routes
- browser/network cache does not store preview API responses

## Acceptance Criteria

- V1 preview is authenticated admin-only.
- Preview uses admin APIs under `www.alive.org.tw/api/admin/preview/*`.
- Preview UI lives under `admin.alive.org.tw` or inside admin UI, never as a public page.
- Public routes never read draft source tables or preview payloads.
- Preview creates no public projection, sitemap, route metadata, ETag pointer, or public asset grant.
- Draft assets use protected/restricted preview access and never Blob/SAS URLs.
- Infected, scan-failed, deleted, or quarantined assets are not rendered.
- Preview responses are `no-store` and `noindex`.
- Revision preview is read-only and separate from restore/rollback.
- Tests prove draft preview does not leak to public APIs, sitemap, cache, assets, or browser storage.
