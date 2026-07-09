# HHC CMS Editorial Workflow Design

## Purpose

This spec defines how the CMS admin console should work for the current HHC website surface: news, pages, weekly bulletins, videos, locations, history, legal pages, home composition, assets, preview, publish, unpublish, and audit.

It bridges three layers:

- Admin UI components in `hhc-web`.
- Admin APIs in `hhc-web-api`.
- Reusable platform services such as `asset-api`, `audit-log`, and `notification-api`.

The goal is a practical church CMS, not a generic CMS product.

Accessibility metadata, image dimensions, derivative readiness, public performance checks, and admin keyboard-flow expectations are specified in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

Content revision snapshots, restore to draft, rollback publish, published/draft isolation, and rollback verification are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

CMS admin preview, draft rendering, revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

Structured content block schema, renderer contract, inline link validation, body asset references, schema versioning, and no-raw-HTML rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Site settings, navigation, footer links, social links, public contact display, shared layout projection, and runtime-config separation are specified in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

CMS localization, source locale, translation status, stale translation warnings, per-locale publish, fallback policy, and weekly bulletin locale rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

## Core Decision

Use a simple editorial workflow in v1:

```text
Create draft -> Save draft -> Preview -> Publish -> Unpublish/Archive
```

Rejected v1 complexity:

- Approval workflow.
- Scheduled publishing.
- Real-time collaborative editing.
- Autosave as source of truth.
- Arbitrary custom fields managed by admins.
- Raw HTML editing.

These can be added later only when there is a real operational need. V1 should make the common publishing path reliable and auditable.

## Admin Host And API Boundary

Admin UI:

```text
https://admin.alive.org.tw
```

Admin APIs:

```text
https://www.alive.org.tw/api/admin/*
```

Rules:

- `admin.alive.org.tw` is UI only.
- Admin UI never calls backend routes on `admin.alive.org.tw/api/*`.
- Admin UI never calls public APIs to read drafts.
- Admin UI never receives Blob URLs or SAS URLs.
- Admin UI uses account-issued access tokens validated by `api-gateway`.
- Admin API responses follow `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

## Navigation

V1 admin navigation:

| Section | Purpose |
| --- | --- |
| Dashboard | operational summary and pending work |
| News | news list, draft editing, publish/unpublish |
| Pages | about, vision, generic pages |
| Weekly Bulletins | issue/date/PDF version management |
| Videos | external YouTube metadata |
| Locations | church location cards |
| History | timeline events |
| Legal | privacy policy and terms |
| Assets | asset library, usage, scan state, public URL state |
| Audit | protected action history |
| Settings | site navigation, footer links, social links, public contact display, and shared public layout settings |

Do not add broad admin areas such as members, donations, groups, pastoral care, or events until their owning domain is designed.

## Roles And Capabilities

| Capability | Minimum scope | Typical role |
| --- | --- | --- |
| Read CMS lists/details | `cms:read` | `cms.viewer` |
| Save draft | `cms:write` | `cms.editor` |
| Upload/attach assets | `cms:write assets:write` | `cms.editor` + `asset.manager` |
| Publish/unpublish | `cms:publish` | `cms.publisher` |
| Archive/destructive operations | `cms:admin` | `cms.admin` |
| View audit | `audit:read` | `audit.viewer` |
| Grant/revoke public asset read | `assets:grant` | `asset.manager` or `cms.admin` |
| Manage site settings | `cms:admin` | `cms.admin` |

The UI should hide unavailable actions, but backend APIs must enforce scopes independently.

## Content State Model

V1 states:

```text
draft -> published -> unpublished -> archived
```

Rules:

- `draft` is editable and visible only through admin APIs.
- `published` appears in public projections.
- `unpublished` is retained but hidden from public APIs.
- `archived` is retained for history and audit but removed from normal editing lists.
- Delete is not a v1 user-facing operation for CMS records; archive instead.

Published content should not be changed directly by public reads. Admin edits update the source record, and public projection changes only after publish.

If a module needs separate draft and published snapshots during implementation, model that explicitly with versions. Do not let public APIs read mutable draft rows.

## Common Editorial Flow

### Create Draft

1. Admin chooses content type.
2. Backend creates source record with `status=draft`.
3. Backend records `createdBy` from trusted gateway header.
4. Backend emits `cms.content.create` audit event.

### Save Draft

1. Admin edits fields.
2. UI sends `PATCH /api/admin/content/{id}` with `Idempotency-Key`.
3. Backend validates fields, locale keys, structured blocks, slugs, SEO, and asset references.
4. Backend checks `If-Match` or `expectedVersion`.
5. Backend persists source changes.
6. Backend emits `cms.content.update` audit event for meaningful changes.

No public projection is refreshed on draft save.

### Preview

1. Admin opens preview from editor.
2. UI prompts Save Draft first when there are unsaved changes.
3. UI calls `GET /api/admin/preview/*` with the desired locale and preview mode.
4. Backend renders a draft/revision render model from admin source data.
5. Preview is shown inside admin UI or an authenticated admin preview route.

Preview rules:

- Preview requires `cms:read`.
- Preview must not use public API routes.
- Preview must not write public projections, sitemap data, route metadata, ETag pointers, or public Redis keys.
- Preview must not create public asset grants.
- Draft assets render only through protected/restricted gateway URLs and only when scan state allows preview.
- Preview responses are `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`.
- Public preview tokens and anonymous share links are not v1 features.

### Publish

1. Admin clicks explicit Publish.
2. UI sends publish request with `Idempotency-Key` and version precondition.
3. Backend checks `cms:publish`.
4. Backend validates publish requirements.
5. Backend writes source state and outbox rows in one transaction.
6. Outbox refreshes public projection.
7. Outbox creates public asset grants where needed.
8. Outbox emits audit event.
9. Redis/CDN cache keys are invalidated or version-bumped.

Publish is the only moment draft content becomes public.

### Unpublish

1. Admin clicks explicit Unpublish.
2. Backend checks `cms:publish`.
3. Backend marks content `unpublished`.
4. Backend removes or refreshes public projection.
5. Backend revokes public asset grants only when no other published record still uses the asset.
6. Backend emits audit event.

### Archive

1. Admin with `cms:admin` archives old content.
2. Backend ensures public projection is removed.
3. Backend keeps record and audit history.
4. Backend applies retention rules later if defined.

### Restore To Draft

1. Admin selects a prior revision.
2. Backend checks `cms:write`.
3. Backend restores the sanitized revision snapshot into current draft/source rows.
4. Backend increments version and emits a restore audit event.
5. Public projection, sitemap, and public asset grants remain unchanged.

Restore to draft is the preferred recovery path when the editor wants to inspect or adjust old content before publishing it again.

### Rollback Publish

1. Admin selects a prior published revision.
2. Backend checks `cms:publish`.
3. Backend re-validates locale, slug, SEO, and asset eligibility.
4. Backend creates or confirms public asset grants.
5. Backend publishes the old snapshot as a new current version.
6. Backend refreshes projections, sitemap, ETags, cache pointers, and audit events.

Rollback publish is a new publish action, not a database rewind. It must pass the same safety checks as normal publish.

## Localization Workflow

Detailed localization governance is specified in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`. This section summarizes the editor-facing v1 behavior.

V1 locales:

- `zh-Hant`
- `zh-Hans`
- `en`

Rules:

- `zh-Hant` is default and required for publishing unless a module explicitly allows otherwise.
- Admin editor uses locale tabs.
- Each locale has independent title, summary, body, and SEO fields.
- Missing non-default locales can be saved as draft.
- Public detail endpoints should not silently fallback unless `meta.fallbackLocale` is present.
- Locale validation is backend-owned.

UI behavior:

- Show completion state per locale.
- Show missing required fields before publish.
- Prevent accidental publishing when default locale is incomplete.
- Keep UI chrome labels in frontend i18n, not CMS.

## Structured Content Editing

Allowed v1 blocks:

- paragraph
- heading
- image
- quote
- buttonLink
- divider
- callout
- list

Rules:

- No raw HTML, raw Markdown, editor-library opaque JSON, arbitrary CSS classes, or arbitrary component props in v1.
- Unknown block type fails validation.
- Image blocks reference `assetId`, not Blob URLs.
- External links must use `https`.
- YouTube embeds use video module metadata, not arbitrary embed HTML.
- Body block JSON uses the HHC versioned block AST and should be validated by backend and frontend helper schemas.

## Asset Picker And Upload Flow

Admin upload paths:

1. UI requests upload session through gateway.
2. `asset-api` creates upload session and returns upload target.
3. UI uploads bytes.
4. UI completes upload.
5. `asset-api` records scan/processing state.
6. Editor attaches `assetId` to content through `hhc-web-api`.

Ownership:

- `asset-api` owns file bytes, scan state, visibility, grants, derivatives, and stable asset URLs.
- `hhc-web-api` owns content-to-asset relationships and publish decisions.

UI rules:

- Never show Blob or SAS URLs.
- Show scan status clearly.
- Disable publish when required assets are not clean/ready.
- Show asset usage before grant revoke or archive.
- Show public gateway URL only when public grant exists.

## Module Workflows

### News

Fields:

- slug
- localized title
- localized summary
- localized body blocks
- cover asset
- display date
- optional pinned/category/tag metadata
- SEO fields

Publish requirements:

- default locale title and summary
- valid slug
- cover asset clean/ready if cover is required by design
- body blocks valid
- SEO defaults available

Public effects:

- news list projection refresh
- news detail projection refresh when detail route exists
- home featured news projection refresh if selected
- cover asset public grant

### Pages And About

Fields:

- stable slug
- localized title/summary/body
- page type such as `about`, `vision`, or generic page
- SEO fields
- optional cover/inline assets

Rules:

- System page slugs such as `about` should not be casually changed.
- Site navigation and footer labels are managed by the site settings module. Generic UI labels remain frontend i18n.

### Legal Pages

Fields:

- stable slug: `privacy-policy`, `terms-of-use`
- localized title/body
- effective date if needed
- published version history

Rules:

- Legal page slugs are protected.
- Publish should preserve previous published version for audit/review.
- Legal pages should show last published timestamp and editor in admin.

### Weekly Bulletins

Fields:

- issue date
- one localized PDF version per locale
- localized title/subtitle
- PDF asset
- status

Flow:

1. Create issue by `YYYY-MM-DD`.
2. Upload PDF under namespace `cms.weekly.pdf`.
3. Wait for scan clean and processing ready/not required.
4. Add localized title/subtitle.
5. Publish issue/version.
6. Create public asset grant.
7. Refresh latest/archive/detail projections.

Rules:

- No duplicate issue date.
- PDF MIME type must be `application/pdf`.
- Latest is computed from newest published issue for requested locale.
- LINE bot consumes the same public bulletin API as website.

### Videos

Fields:

- provider: `youtube`
- external id or canonical URL
- localized title
- localized image alt
- optional thumbnail asset
- display order/date
- home visibility

Rules:

- Store provider metadata instead of arbitrary embed HTML.
- Validate external URL.
- Uploaded thumbnail uses `asset-api`; provider thumbnail can remain external URL.

### Locations

Fields:

- stable location key
- localized name
- localized address
- map URL
- service times
- contact display data
- active flag
- sort order

Rules:

- Validate map URL.
- Inactive locations disappear from public projections.
- Home and locations projections refresh after publish/activation changes.

### History Timeline

Fields:

- display date text
- sort date when available
- localized body
- continued flag
- sort order

Rules:

- Timeline order is explicit.
- Public projection returns only published timeline events.
- Editors can reorder without changing event ids.

### Home Composition

Home is a composed projection.

Admin controls:

- hero content
- selected featured news
- latest bulletin inclusion
- selected videos
- about teaser
- location section visibility/order

Rules:

- Do not duplicate source content into a monolithic home blob.
- Home projection references published source records where possible.
- Draft source records should not appear on public home.

### Site Settings

Site settings are editorial public layout data owned by `hhc-web-api`, not runtime configuration.

Editable fields:

- localized public site name and SEO defaults
- header navigation items
- footer legal/resource links
- social links and music channel URL
- public contact display fields
- optional shared OG image asset

Rules:

- Editing and publishing site settings requires `cms:admin`.
- Runtime config, secrets, feature flags, service URLs, OIDC settings, and storage provider details are not editable here.
- Header/footer links may point only to approved public internal routes or `https` external URLs.
- Site settings must never store Blob URLs, SAS URLs, private admin URLs, internal service hostnames, or `/priv/*` routes.
- Publish refreshes `site_layout:{locale}` projections and any affected metadata, sitemap, and home projections.
- Restore to draft and rollback publish follow the same revision model as other CMS content.

## Validation

Common publish validation:

- supported locale
- default locale complete
- slug valid and unique where needed
- structured blocks valid
- required assets clean and ready
- no private/infected/scan-failed assets in public content
- external URLs use `https`
- site settings links are public-safe and allowed by route policy
- required SEO fallback exists
- user has required scope
- version precondition passes

Validation response uses `validation_failed` with field-level details from `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

## Audit Events

Required audit actions:

- `cms.content.create`
- `cms.content.update`
- `cms.content.publish`
- `cms.content.unpublish`
- `cms.content.archive`
- `cms.content.revision.created`
- `cms.content.restore_to_draft`
- `cms.content.rollback_publish`
- `cms.bulletin.create`
- `cms.bulletin.version.create`
- `cms.bulletin.publish`
- `cms.bulletin.unpublish`
- `cms.bulletin.revision.created`
- `cms.bulletin.restore_to_draft`
- `cms.bulletin.rollback_publish`
- `cms.site_settings.update`
- `cms.site_settings.publish`
- `cms.site_settings.rollback_publish`
- `asset.grant.create`
- `asset.grant.revoke`
- `auth.permission.denied`

Audit metadata must not include raw request bodies, tokens, Blob URLs, provider secrets, or sensitive narrative text.

## Notification Hooks

V1 does not send notifications for every publish by default.

Allowed notification cases:

- optional admin publish summary
- future contact/event workflows
- future security/admin notices through account workflow

Notification request is owned by the domain workflow. `notification-api` only sends approved messages.

## UI Component Responsibilities

Shared admin components:

| Component | Responsibility |
| --- | --- |
| `AdminShell` | navigation, auth state, layout, route guards |
| `ContentList` | filter, pagination, status badges, row actions |
| `ContentEditor` | structured content editing for common content |
| `LocaleTabs` | locale completion state and switching |
| `SeoPanel` | SEO fields and previews |
| `PublishControls` | save, preview, publish, unpublish, archive actions |
| `AssetUploadField` | upload session, status, attach/detach |
| `AssetPicker` | browse existing assets and attach |
| `PreviewPane` | authenticated admin preview |
| `ValidationSummary` | field and workflow errors |
| `RevisionTimeline` | revision list, selected revision preview, restore, and rollback entry points |
| `AuditTimeline` | resource-scoped audit view |

Specialized components:

- `BulletinIssueList`
- `BulletinIssueEditor`
- `BulletinVersionUploader`
- `BulletinPublishPanel`
- `LocationEditor`
- `VideoEditor`
- `HistoryTimelineEditor`
- `HomeComposer`
- `SiteSettingsEditor`

## Admin API Client Behavior

Admin client must:

- call `www.alive.org.tw/api/admin/*`
- attach bearer access token
- include request id when available
- parse envelope errors
- handle `401` by redirecting/login prompt
- handle `403` as insufficient permission
- show `validation_failed` field errors inline
- use `Idempotency-Key` for mutating actions
- use version preconditions for updates/publish/unpublish
- never call public APIs for draft content

## Operational Rules

- Admin APIs use `Cache-Control: no-store`.
- Admin UI should warn about unsaved changes.
- Draft save failures must not partially publish content.
- Publish side effects are outbox-backed and retry-safe.
- Public cache invalidation failures must be observable.
- Asset grant failures after publish must be retried and visible in operations metrics.

## Testing

Frontend tests:

- auth states: loading, login needed, forbidden
- content list empty/loading/error states
- locale tab validation
- structured block validation
- save draft success/failure
- publish/unpublish role gating
- field-level validation display
- no draft fetch through public APIs
- no Blob/SAS URL rendered

Backend tests:

- draft create/update
- publish validation
- unpublish projection removal
- archive behavior
- revision creation
- restore to draft without public projection changes
- rollback publish with projection, asset grant, and ETag updates
- idempotency retry
- version conflict
- asset eligibility checks
- audit event outbox
- public projection refresh

End-to-end smoke tests:

- create draft news
- preview draft
- publish news
- public API returns published content
- unpublish news
- public API hides content
- restore prior revision to draft and verify public content is unchanged
- rollback prior published revision and verify public content updates
- create bulletin issue
- upload clean PDF
- publish bulletin
- latest bulletin API returns stable asset URL
- publish site settings
- site layout API returns updated navigation, footer, social links, and contact display data
