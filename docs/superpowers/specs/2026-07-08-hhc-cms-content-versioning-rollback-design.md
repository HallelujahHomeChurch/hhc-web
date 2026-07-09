# HHC CMS Content Versioning And Rollback Design

## Purpose

This spec defines how `hhc-web-api` should manage CMS revisions, published snapshots, restore, rollback, preview history, and public projection consistency.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/api/admin-api.md`

## Core Decision

Use revision snapshots inside `hhc-web-api`, not a new service and not full event sourcing.

`hhc-web-api` already owns CMS source state, public projections, module rules, and publish/unpublish workflows. Content versioning belongs in that same bounded context. The `audit-log` service records accountability, but it should not be used as the source for restoring content.

The v1 model is:

- every meaningful draft save can create a recoverable revision
- every publish creates an immutable published revision
- public APIs read public projections, not draft source rows
- rollback is a new CMS command that restores a prior revision into a new draft or publishes a prior published revision under normal publish rules
- audit events record who restored or rolled back, but the recoverable content snapshot lives in `hhc_web.content_revision`

## Rejected Alternatives

### No Version History

This is simpler, but unsafe. A mistaken legal-page edit, deleted bulletin metadata, or bad home composition would require manual database repair.

### Audit Log As Content History

Audit is append-only evidence. It is not optimized for full content recovery, module validation, asset reference checks, or editor preview. Using audit as restore state would couple operational evidence to business state.

### Full Event Sourcing

Event sourcing would make every CMS state a replay of events. It is too heavy for this v1 website CMS and would add complexity before there is a team or scale reason.

### Separate Versioning Service

Versioning is not a reusable infrastructure capability like assets or notification. It is tightly coupled to CMS validation, module state, locale rules, asset references, and public projection generation.

## Concepts

| Concept | Meaning |
| --- | --- |
| Source row | Mutable admin-owned CMS record in `hhc_web` |
| Revision | Sanitized snapshot of a source aggregate at a meaningful point in time |
| Draft revision | Snapshot created from save/import/edit state |
| Published revision | Snapshot that successfully generated public projection state |
| Restore to draft | Copy a prior revision into current draft state without changing public projections |
| Rollback publish | Publish a prior published revision as the new public state |
| Public projection | Public read model generated from current published state |

Revision history is not an approval workflow. It is recoverability and traceability.

## Revision Scope

Revisions are aggregate snapshots. They should capture enough data to restore the CMS record without reconstructing from many tables.

For generic content, a revision includes:

- `content_item` lifecycle fields relevant to editing
- module detail fields
- translations for all locales in the aggregate
- SEO fields
- structured body blocks
- content asset references
- slug and route metadata
- home composition config when applicable

For weekly bulletins, a revision includes:

- issue date
- issue status
- per-locale bulletin version metadata
- PDF asset ids
- file names
- title/subtitle
- publish status per version

Do not store:

- access tokens
- refresh tokens
- request headers
- provider secrets
- Blob URLs or SAS URLs
- raw audit event payloads
- raw upload URLs

## Revision Types

Use these `content_revision.revision_type` values:

| Type | Created When | Public Effect |
| --- | --- | --- |
| `draft_saved` | meaningful draft save | none |
| `published` | publish succeeds | public projection updated |
| `unpublished` | unpublish succeeds | public projection removed/refreshed |
| `archived` | archive succeeds | public projection removed/refreshed |
| `seeded` | deterministic seed/import creates or updates content | depends on seed command |
| `restored_to_draft` | a prior revision is copied into draft state | none |
| `rollback_published` | a prior published revision is republished | public projection updated |

The PostgreSQL schema check constraint should include all of these values before rollback endpoints are enabled.

## Snapshot Shape

Snapshots should use a versioned envelope:

```json
{
  "schemaVersion": 1,
  "aggregateType": "content_item",
  "aggregateId": "content_123",
  "contentType": "news",
  "version": 12,
  "status": "published",
  "capturedAt": "2026-07-12T10:00:00Z",
  "source": {
    "contentItem": {},
    "module": {},
    "translations": [],
    "assetRefs": [],
    "routeMetadata": {}
  }
}
```

Bulletin snapshot:

```json
{
  "schemaVersion": 1,
  "aggregateType": "bulletin_issue",
  "aggregateId": "issue_2026_07_12",
  "version": 4,
  "status": "published",
  "source": {
    "issue": {},
    "versions": []
  }
}
```

Rules:

- Snapshot JSON is generated by server-side serializers, not by storing raw request bodies.
- Snapshot schema changes are additive. If a breaking snapshot change is needed, increment `schemaVersion` and keep a reader for old versions until retention expires.
- Snapshots must be canonicalized before payload hashing for idempotency and integrity checks.

## When To Create Revisions

Create revisions for:

- seed/import create or update
- explicit Save Draft when canonical content changes
- publish
- unpublish
- archive
- restore to draft
- rollback publish

Do not create revisions for:

- read-only admin views
- validation failures with no state change
- idempotent duplicate commands with the same canonical payload
- autosave drafts in v1, because autosave is out of scope

Draft save can throttle revisions if editors save repeatedly without meaningful changes. The service can keep every material save in v1 because traffic is small, but it should deduplicate identical canonical snapshots.

## Draft And Published Isolation

Public reads must never depend on mutable draft rows.

Rules:

- Draft save updates source rows only.
- Publish validates the current source aggregate and writes a published revision.
- Projection builders use the validated published state to create public projection rows.
- `content_translation.published_snapshot_json` can store the last published translation payload for quick admin comparison, but public APIs still read `public_projection`.
- Editing after publish creates new draft state without mutating the active public projection.
- Preview uses admin routes and draft source data; public routes never serve preview.

## Restore To Draft

Restore to draft is the safest recovery action.

Flow:

1. Admin selects a prior revision.
2. `hhc-web-api` checks `cms:write`.
3. Service loads revision snapshot.
4. Service validates snapshot schema and module compatibility.
5. Service validates referenced assets still exist and are not deleted.
6. Service copies snapshot into current draft/source rows.
7. Service increments aggregate version.
8. Service inserts `restored_to_draft` revision.
9. Service emits audit event `cms.content.restore_to_draft` or `cms.bulletin.restore_to_draft`.

Public effect:

- no public projection changes
- no asset grant changes
- no sitemap changes

The admin can preview and publish after restoring.

## Rollback Publish

Rollback publish changes the public site and must be treated like publishing.

Flow:

1. Admin selects a prior `published` revision.
2. `hhc-web-api` checks `cms:publish`.
3. Service loads revision snapshot.
4. Service validates snapshot schema, module rules, locale rules, slugs, SEO, and route metadata.
5. Service validates referenced assets through `asset-api`.
6. Service classifies the rollback as projection-only, optional-asset, or required-public-asset.
7. Required-public-asset rollback creates a publication workflow and confirms grants before exposing projection.
8. Service writes source rows to match the rollback revision or creates a new draft/published pair according to module rules.
9. Service inserts a new `rollback_published` revision.
10. Service refreshes public projections and projection pointers only after required grants are active.
11. Service revokes now-unused public asset grants after projections no longer reference them.
12. Service emits audit event `cms.content.rollback_publish` or `cms.bulletin.rollback_publish`.

Rollback is not a time machine. It creates a new current version whose content matches an older revision. The old revision id is recorded as metadata.

## Asset Handling During Restore And Rollback

Asset references in revisions point to `assetId`, not storage paths.

Restore to draft:

- validates asset id exists and is readable to `hhc-web-api`
- does not create public grants
- warns if an asset is deleted, infected, scan-failed, or no longer in an allowed namespace

Rollback publish:

- requires all public assets to be clean and ready
- requires namespace to still be allowed for the module
- creates missing public read grants before projection pointer changes, using publication workflow when required assets are involved
- revokes unused old grants after the public projection no longer references those assets
- fails with `validation_failed` if required assets cannot be made public safely

If a prior revision references an asset that was permanently deleted, restore to draft can succeed with a validation warning only if the asset is optional. Rollback publish must fail until the editor replaces the asset.

## Slug And Redirect Handling

Rollback can affect public URLs.

Rules:

- Restoring to draft does not create redirects.
- Rollback publish must validate current slug uniqueness.
- If rollback changes a published slug, create a redirect from the previous public path to the restored path unless the operation explicitly keeps the current slug.
- Legal page slugs stay fixed and should not change through rollback.
- Sitemap projection must refresh after rollback publish.

Admin UI should show whether rollback will change public URLs before confirmation.

## Admin API Contract

Add admin routes:

```text
GET  /api/admin/content/{id}/revisions
GET  /api/admin/content/{id}/revisions/{revisionId}
POST /api/admin/content/{id}/revisions/{revisionId}/restore-draft
POST /api/admin/content/{id}/revisions/{revisionId}/rollback-publish

GET  /api/admin/bulletins/{issueId}/revisions
GET  /api/admin/bulletins/{issueId}/revisions/{revisionId}
POST /api/admin/bulletins/{issueId}/revisions/{revisionId}/restore-draft
POST /api/admin/bulletins/{issueId}/revisions/{revisionId}/rollback-publish
```

Rules:

- Revision list/detail requires `cms:read`.
- Restore to draft requires `cms:write`.
- Rollback publish requires `cms:publish`.
- Mutating revision commands require `Idempotency-Key`.
- Mutating revision commands require `If-Match` or `expectedVersion` for the current aggregate, not the old revision.
- Revision detail responses must redact fields that are not editor-visible.

Example rollback request:

```json
{
  "expectedVersion": 18,
  "reason": "Restore the previous bulletin PDF after an incorrect upload",
  "slugBehavior": "keep_current"
}
```

Allowed `slugBehavior`:

- `keep_current`
- `restore_revision_slug`

## UI Responsibilities

Admin UI should expose:

- revision list with time, actor id, type, reason, and version
- diff view for structured fields where practical
- preview selected revision
- restore to draft action for editors
- rollback publish action for publishers
- warnings for asset issues, slug changes, and locale changes
- confirmation for public-impacting rollback

Do not show raw snapshot JSON as the main user interface. It can be a developer/debug view only when gated.

## Audit Events

`hhc-web-api` emits audit events through outbox.

Required actions:

| Action | When |
| --- | --- |
| `cms.content.revision.created` | revision row created |
| `cms.content.restore_to_draft` | restore draft command succeeds |
| `cms.content.rollback_publish` | rollback publish succeeds |
| `cms.bulletin.revision.created` | bulletin revision row created |
| `cms.bulletin.restore_to_draft` | bulletin restore draft succeeds |
| `cms.bulletin.rollback_publish` | bulletin rollback publish succeeds |

Metadata should include:

- aggregate type
- aggregate id
- new version
- source revision id
- revision type
- reason
- affected locales
- affected asset ids
- slug behavior when relevant

Do not include full snapshot payload in audit metadata.

## Retention

Revision retention should be longer than normal operational logs because it protects content recovery.

Recommended v1 retention:

| Revision Class | Retention |
| --- | --- |
| `published`, `rollback_published` | indefinite unless storage policy changes |
| `unpublished`, `archived` | 7 years |
| `seeded` | keep while seed provenance is relevant, minimum 7 years |
| `draft_saved`, `restored_to_draft` | 2 years, or compact after a storage review |

Do not hard-delete revisions through admin UI. Retention cleanup is an operator/maintenance job and must emit audit events.

## Error Handling

| Case | Response |
| --- | --- |
| Missing revision | `404 not_found` |
| Revision belongs to a different aggregate | `404 not_found` |
| Unsupported snapshot schema | `409 conflict` or `422 validation_failed` |
| Current aggregate version mismatch | `409 precondition_failed` |
| Missing idempotency key | `400 idempotency_required` |
| Missing reason for rollback publish | `422 validation_failed` |
| Required asset missing/deleted/infected | `422 validation_failed` |
| Slug conflict | `409 conflict` |
| Missing `cms:write` for restore | `403 forbidden` |
| Missing `cms:publish` for rollback publish | `403 forbidden` |

## Observability

Metrics:

- revision created count by type
- restore to draft count/failure
- rollback publish count/failure
- rollback validation failure count by reason
- snapshot serialization failure count
- revision payload size percentiles
- revision retention cleanup count

Logs:

- request id
- correlation id
- aggregate type/id
- revision id
- revision type
- actor id
- reason hash or short reason category
- outcome

Never log full snapshots.

## Tests

Unit tests:

- snapshot serializer excludes forbidden fields
- identical canonical snapshots deduplicate where configured
- snapshot schema version reader supports v1
- restore to draft validates module rules
- rollback publish validates asset eligibility
- slug behavior rules create or skip redirect as expected

Integration tests:

- save draft creates `draft_saved` revision
- publish creates `published` revision and public projection
- draft edit after publish does not change public projection
- restore to draft changes admin source but not public projection
- rollback publish updates public projection and ETag
- rollback publish creates required asset grants before projection pointer changes
- rollback publish revokes unused grants after projection changes
- stale expected version rejects restore/rollback
- duplicate idempotency key returns original result

End-to-end smoke tests:

- publish a news item, edit draft, confirm public still shows old published version
- restore an older draft, preview it, and publish it
- publish a bulletin, rollback to prior PDF revision, and confirm website and LINE bot latest point to the restored asset URL
- rollback a legal page and confirm sitemap/metadata still use published projections only

## Acceptance Criteria

- `hhc-web-api` owns revision snapshots and rollback logic.
- `audit-log` records restore/rollback accountability but is not used as restore state.
- Public routes read only projections, never mutable draft rows or revision snapshots directly.
- Restore to draft has no public effect.
- Rollback publish follows the same validation, asset grant, projection, cache, sitemap, and audit rules as normal publish.
- Version preconditions and idempotency are required for restore and rollback commands.
- Revision snapshots exclude secrets, tokens, raw request bodies, Blob URLs, and SAS URLs.
- Weekly bulletin rollback can support website and LINE bot consistency through the same public projection contract.
