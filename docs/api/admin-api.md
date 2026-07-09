# HHC Admin API Contract

Detailed role/scope rules are defined in `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`. This file lists the API contract and the minimum roles/scopes needed by the admin surface.

Detailed protected-route action metadata, resource-level checks, field-level response policy, and authorization drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Account user management, admin invitations, account roles, session revocation, suspend, disable, and offboarding are account-domain responsibilities defined in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md` and served from `https://account.alive.org.tw`, not from this admin API.

`hhc-web-api` admin route behavior, write model, outbox usage, and integration boundaries are defined in `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`.

CMS editorial workflow, admin console behavior, preview, publish/unpublish, localization, asset picker, and module-specific admin rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`.

CMS localization, source locale, translation status, stale translation warnings, fallback policy, per-locale publish, localized slugs, SEO alternates, and weekly bulletin locale consistency are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

CMS revision snapshots, restore to draft, rollback publish, and draft/published isolation are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

CMS admin preview, draft rendering, revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

Structured content block schema, renderer contract, inline link validation, body asset references, schema versioning, and no-raw-HTML rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Admin CMS search ownership, public/admin index separation, asset/audit search boundaries, and no-store behavior are defined in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

Site settings, navigation, footer links, social links, contact display, shared layout projection, and runtime-config separation are defined in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

Public third-party provider registry, CMS URL validation, embed guardrails, analytics defaults, consent rules, and no-arbitrary-script restrictions are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.

Publish/unpublish projection versioning, affected public cache keys, ETags, sitemap refresh, asset grant ordering, and LINE bot latest consistency are defined in `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.

Publication workflow consistency, `202 Accepted` publish responses, grant-before-visible behavior, emergency takedown, and reconciliation rules are defined in `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

Canonical URLs, slug validation, redirect behavior, sitemap ownership, locale alternates, and metadata rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.

Shared envelope, error, pagination, idempotency, optimistic concurrency, headers, and versioning rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

OpenAPI ownership, generated clients, compatibility checks, and consumer contract tests are defined in `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

## Base

Admin APIs are served from:

```text
https://www.alive.org.tw/api/admin
```

`admin.alive.org.tw` serves the admin UI only. It does not expose backend APIs directly.

## Auth

All admin APIs require bearer access JWT validated by `api-gateway`. Upstream services receive trusted identity headers from the gateway:

- `X-HHC-User-ID`
- `X-HHC-Roles`
- `X-HHC-Scopes`
- `X-HHC-Token-ID`
- `X-HHC-Session-ID`
- `X-HHC-Request-ID`

`hhc-web-api` must reject protected operations when trusted identity headers are missing.

## Roles And Scopes

Roles:

- `cms.viewer`: read admin content.
- `cms.editor`: create and edit drafts.
- `cms.publisher`: publish and unpublish.
- `cms.admin`: administer CMS settings and destructive operations.
- `account.admin`: manage account users only on `account.alive.org.tw`; it is not a `hhc-web-api` CMS route permission.

Scopes:

- `cms:read`
- `cms:write`
- `cms:publish`
- `assets:write`
- Account scopes such as `account:read` and `account:admin` belong to account-domain APIs.

## Content States

- `draft`: editable and previewable in admin only.
- `published`: visible in public APIs.
- `unpublished`: retained but hidden publicly.
- `archived`: retained for history and audit; not public.

## Mutation And Concurrency

Admin create, update, publish, unpublish, archive, asset attach, and asset detach routes should accept `Idempotency-Key` for retry-safe user actions.

Admin update, publish, unpublish, and archive routes should use resource version preconditions through `If-Match` or `expectedVersion` once versioned resources are implemented.

Rules:

- Same idempotency key and same canonical payload returns the original result or an accepted duplicate status.
- Same idempotency key and different canonical payload returns `idempotency_conflict`.
- Missing required version precondition returns `precondition_required`.
- Version mismatch returns `precondition_failed`.
- Publish, rollback publish, unpublish, and emergency takedown may return `202 Accepted` when a publication workflow must finish asynchronously.
- Public APIs do not expose the new version until the workflow makes a public projection visible.

Async publication response:

```json
{
  "data": {
    "workflowId": "workflow_123",
    "status": "waiting_asset_grant",
    "publicVisible": false,
    "resourceType": "bulletin",
    "resourceId": "bulletin_2026_07_12"
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

## Content Endpoints

```text
GET /api/admin/content?type=news&status=draft&page=1&pageSize=20
POST /api/admin/content
GET /api/admin/content/{id}
PATCH /api/admin/content/{id}
POST /api/admin/content/{id}/publish
POST /api/admin/content/{id}/unpublish
GET  /api/admin/content/{id}/revisions
GET  /api/admin/content/{id}/revisions/{revisionId}
POST /api/admin/content/{id}/revisions/{revisionId}/restore-draft
POST /api/admin/content/{id}/revisions/{revisionId}/rollback-publish
```

Post-v1 CMS content search:

```text
GET /api/admin/search/content?locale=zh-Hant&q=example&status=draft,published&type=news,page&page=1&pageSize=20
```

Rules:

- Requires `cms:read`.
- Uses admin search documents, not the public search index.
- Can include draft/unpublished/archived content only through protected admin routes.
- Returns admin resource links, not public URLs for draft records.
- Uses `Cache-Control: no-store`.
- Does not search asset metadata by cross-querying `asset-api`; asset manager search belongs to `asset-api`.
- Does not search audit records directly; audit query rules remain with `audit-log`.

Create request:

```json
{
  "type": "news",
  "slug": "sample-news",
  "translationGroupId": "group_123",
  "locales": [
    {
      "locale": "zh-Hant",
      "title": "消息標題",
      "summary": "摘要",
      "bodyJson": {
        "blocks": []
      },
      "seoJson": {
        "description": "SEO description"
      }
    }
  ],
  "assetRefs": [
    {
      "assetId": "asset_123",
      "purpose": "cover",
      "locale": "zh-Hant",
      "sortOrder": 0
    }
  ]
}
```

Publish rules:

- Caller must have `cms.publisher` or `cms.admin`.
- `bodyJson` must use the HHC structured block AST and pass publish validation.
- Raw HTML, raw Markdown, editor-library opaque JSON, arbitrary CSS classes, and unsafe link protocols are rejected.
- Referenced assets must belong to `hhc-web-api` or have a valid service grant.
- Referenced public assets must be scan-clean and ready.
- Projection-only publish creates/refreshes public projections immediately.
- Required-public-asset publish grants public read before public projection exposure and may return `202 Accepted`.
- Publish emits audit events.

Unpublish rules:

- Caller must have `cms.publisher` or `cms.admin`.
- Public projections are removed or refreshed.
- Public asset grants are revoked if no other published content references the asset.
- Unpublish emits audit events.

## Bulletin Endpoints

```text
GET /api/admin/bulletins?page=1&pageSize=20
POST /api/admin/bulletins
GET /api/admin/bulletins/{issueId}
POST /api/admin/bulletins/{issueId}/versions
PATCH /api/admin/bulletins/{issueId}/versions/{versionId}
POST /api/admin/bulletins/{issueId}/publish
POST /api/admin/bulletins/{issueId}/unpublish
GET  /api/admin/bulletins/{issueId}/revisions
GET  /api/admin/bulletins/{issueId}/revisions/{revisionId}
POST /api/admin/bulletins/{issueId}/revisions/{revisionId}/restore-draft
POST /api/admin/bulletins/{issueId}/revisions/{revisionId}/rollback-publish
```

Create issue:

```json
{
  "issueDate": "2026-07-12"
}
```

Add version:

```json
{
  "locale": "zh-Hant",
  "title": "2026-07-12 週報",
  "pdfAssetId": "asset_123",
  "fileName": "2026-07-12-bulletin.pdf"
}
```

Bulletin publish rules:

- PDF asset namespace must be `cms.weekly.pdf`.
- MIME type must be `application/pdf`.
- Scan status must be `clean`.
- Processing status must be `ready` or `not_required`.
- Public read grant is created through `asset-api` before the bulletin becomes latest/detail/archive visible.
- Publish may return `202 Accepted` with workflow id while the grant-before-visible workflow completes.
- Latest/archive/detail projections are refreshed only after public PDF grant is active.

## Site Settings Endpoints

```text
GET  /api/admin/site-settings
PATCH /api/admin/site-settings
POST /api/admin/site-settings/publish
POST /api/admin/site-settings/unpublish
GET  /api/admin/site-settings/revisions
GET  /api/admin/site-settings/revisions/{revisionId}
POST /api/admin/site-settings/revisions/{revisionId}/restore-draft
POST /api/admin/site-settings/revisions/{revisionId}/rollback-publish
```

Rules:

- Read requires `cms:read`.
- Save, publish, unpublish, restore, and rollback require `cms:admin`.
- Mutations require `Idempotency-Key` and version preconditions.
- Publish validates internal links, external HTTPS links, social URLs, third-party provider registry entries, Open Graph asset safety, locale completeness, and header navigation size.
- Publish rejects raw iframe HTML, script tags, tag-manager snippets, tracking pixels, Blob/SAS URLs, private hosts, internal/admin URLs, and unregistered providers.
- Runtime config such as hostnames, OIDC settings, service URLs, secrets, feature flags, and kill switches is not editable through these endpoints.

## Preview

Admin preview reads draft/revision content from admin endpoints. Public routes must never expose draft preview data.

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

Rules:

- Requires `cms:read`.
- Returns a render model, not raw database rows or arbitrary HTML.
- Responses are `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.
- Preview creates no public projection, sitemap entry, ETag pointer, or public asset grant.
- Preview asset URLs must be protected gateway URLs and must not expose Blob/SAS URLs.
- Infected, scan-failed, deleted, quarantined, or unrelated private assets are not rendered.

## Revisions And Rollback

Revision list/detail routes require `cms:read`.

Restore to draft:

- Requires `cms:write`.
- Requires `Idempotency-Key`.
- Requires `If-Match` or `expectedVersion`.
- Restores the selected revision into draft/source state.
- Does not update public projections, sitemap, or public asset grants.

Rollback publish:

- Requires `cms:publish`.
- Requires `Idempotency-Key`.
- Requires `If-Match` or `expectedVersion`.
- Requires a reason.
- Re-validates locale, slug, SEO, and asset eligibility.
- Publishes the selected prior published revision as a new current version.
- Refreshes public projections, sitemap, ETags, cache pointers, and asset grants.

## Audit

Every create, update, publish, unpublish, restore, rollback, asset attach/detach, permission denial, and validation failure should emit an audit event to `audit-log` through the service outbox. Audit event shape, metadata policy, and query authorization follow `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.
