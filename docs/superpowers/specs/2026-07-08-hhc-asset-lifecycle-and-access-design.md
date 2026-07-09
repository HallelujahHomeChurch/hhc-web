# HHC Asset Lifecycle And Access Design

This spec defines how `asset-api` behaves as the reusable binary/object capability for weekly PDFs, news images, page images, LINE group files, desktop cloud-folder objects, and future ministry files.

## Purpose

`asset-api` is not a CMS attachment table. It is a platform service that owns upload sessions, storage keys, bytes, metadata, scan state, processing state, visibility, grants, stable download URLs, retention, and audit-relevant file transitions.

Consumer services own the business meaning of each asset. They decide why an asset exists and whether a domain action should make it public, restricted, private, or deleted.

Internal `/priv/assets/*` service identity, caller app-id allowlists, namespace restrictions, and confused-deputy controls are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Asset grant evaluation, object-level download authorization, route/action metadata, field-level response rules, and authorization drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Asset data classification, filename privacy, namespace retention, LINE group file privacy, and backup/delete rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Cross-service lifecycle ledger, legal hold, retention worker, privacy request, and restore reconciliation rules are defined in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

Upload target issuance, completion validation, scan workers, derivative generation, download streaming, range requests, and response headers are defined in `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`.

Asset namespace typed config, provider adapter selection, upload/download kill switches, and fake-provider production guards are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.

Asset upload-session limits, namespace quota, public download egress protection, hot asset metrics, and emergency abuse response are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

Public image accessibility metadata, dimensions, responsive derivative expectations, and performance delivery rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

CMS admin preview, protected draft asset preview, no public preview grants, and preview leak-prevention rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

CMS structured image blocks, body asset references, and render-ready image metadata rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Publication workflow consistency, grant-before-visible publish, stale side-effect cancellation, emergency takedown, and reconciliation rules are defined in `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.

## Core Decision

Expose all public asset access through stable gateway URLs. Keep cloud-provider URLs and Blob SAS tokens internal to `asset-api`.

```text
https://www.alive.org.tw/api/assets/public/{assetId}
https://www.alive.org.tw/api/assets/protected/{assetId}
```

This gives the platform one place to enforce scan status, grants, cache headers, throttling, logging, and future storage-provider changes.

## Ownership Boundary

`asset-api` owns:

- asset id generation
- upload session lifecycle
- object storage container/key
- file size, MIME type, checksum
- scan and processing state
- asset visibility
- grants
- download authorization
- stable URL generation
- derivative metadata
- retention and deletion mechanics
- asset audit event emission

Consumer services own:

- domain record and foreign key to `assetId`
- title, description, issue date, article slug, group id, event id, or folder path
- domain publish/unpublish decision
- domain-specific validation
- which asset purposes are allowed for that domain
- user-facing business errors

Consumer services must not:

- write directly to Blob Storage
- expose Blob or SAS URLs
- bypass scan/ready state
- infer public URLs without asking `asset-api`
- read another service's asset ownership metadata directly from the asset database

## Namespace Policy

Each namespace has explicit policy. Start with these:

| Namespace | Owner Service | Allowed MIME Types | Default Visibility | Max Size | Derivatives | Retention |
| --- | --- | --- | --- | --- | --- | --- |
| `cms.weekly.pdf` | `hhc-web-api` | `application/pdf` | `private` before publish, `public` after publish grant | 20 MB | none in v1 | keep while bulletin exists |
| `cms.news.cover` | `hhc-web-api` | `image/jpeg`, `image/png`, `image/webp` | `private` before publish, `public` after publish grant | 10 MB | thumbnails/web formats | keep while news exists |
| `cms.page.image` | `hhc-web-api` | `image/jpeg`, `image/png`, `image/webp` | `private` before publish, `public` after publish grant | 10 MB | thumbnails/web formats | keep while page/content exists |
| `line.group.file` | `hhc-line-function-bot` | configured safe document/image types | `restricted` | 25 MB default | image thumbnails optional | configurable per LINE group policy |
| `desktop.cloud-folder.object` | owning app service | configured per app | `private` | configured per app | optional | configurable per app/folder policy |

Namespace policy is configuration and should be loaded at startup. Unknown namespaces must be rejected.

`cms.news.cover` is for module cover images. Structured body image blocks should normally use `cms.page.image` unless a future namespace is added for a more specific content type. The consumer service records purpose such as `cover` or `inline` in its own `content_asset_ref` rows; `asset-api` does not interpret page layout meaning.

## Upload Session State Machine

Upload sessions are short-lived coordination records.

States:

- `created`: session exists and upload target has been issued.
- `uploading`: bytes may be arriving at storage.
- `completed`: caller reported uploaded bytes and checksum.
- `expired`: upload target expired before completion.
- `aborted`: owner service cancelled the session.
- `failed`: storage or validation failure occurred.

Rules:

- `created -> completed` is allowed only before `upload_url_expires_at`.
- `completed` is terminal for the session.
- `expired`, `aborted`, and `failed` are terminal.
- Expired sessions should be cleaned by worker.
- Completing the same session twice with the same checksum is idempotent.
- Completing the same session twice with different size/checksum must return conflict.

Recommended upload URL TTL:

- Admin CMS uploads: 10 minutes.
- LINE bot service upload: 5 minutes.
- Desktop app resumable upload: use a separate resumable policy when needed.

## Asset State Machine

An asset is created when an upload session is completed.

Primary asset fields:

- `visibility`: `private`, `restricted`, `authenticated`, `public`
- `scan_status`: `pending`, `clean`, `infected`, `failed`, `skipped`
- `processing_status`: `pending`, `ready`, `failed`, `not_required`
- `deleted_at`: soft-delete marker

### Scan Status

| Status | Meaning | Download Allowed |
| --- | --- | --- |
| `pending` | scan not complete | no public/protected download |
| `clean` | scan passed | allowed if visibility/grants also allow |
| `infected` | malware or blocked content detected | denied |
| `failed` | scan system failed | denied except internal owner diagnostics |
| `skipped` | namespace explicitly allows no scan | allowed only for low-risk namespace and internal policy |

For v1 public CMS files, do not use `skipped`. Public assets require `clean`.

### Processing Status

| Status | Meaning | Download Allowed |
| --- | --- | --- |
| `pending` | derivatives or validation not complete | original download allowed only if namespace permits |
| `ready` | processing complete | allowed if auth rules pass |
| `failed` | processing failed | original may be denied by namespace policy |
| `not_required` | no processing needed | allowed if auth rules pass |

Weekly PDFs can use `not_required` after scan. Images should use `ready` if thumbnails/metadata are required before publication.

## Visibility And Grants

Visibility is the coarse default. Grants are explicit permissions.

| Visibility | Public Route | Protected Route | Internal Route |
| --- | --- | --- | --- |
| `public` | requires public read grant, clean scan, ready/not_required processing | allowed for authenticated user if clean | allowed for owner/internal service |
| `authenticated` | denied | any valid account user if clean | allowed for owner/internal service |
| `restricted` | denied | matching grant required | matching service/owner grant required |
| `private` | denied | denied unless explicit grant exists | owner service only unless service grant exists |

CMS draft preview should use `restricted` or protected access, not `public`. A CMS preview grant is not a public publish grant.

### Grant Subject Types

Use these subject types:

- `public`
- `user`
- `role`
- `line_group`
- `line_room`
- `line_user`
- `service`
- `app_client`

Subject id conventions:

```text
public:*
user:{accountUserId}
role:{roleName}
line_group:{profileName}:{groupId}
line_room:{profileName}:{roomId}
line_user:{profileName}:{userId}
service:{daprAppId}
app_client:{clientId}
```

The `subject_type` column stores the category, and `subject_id` stores the full stable id.

### Permission Values

Start with:

- `read`
- `write_metadata`
- `manage_grants`
- `delete`

Public and protected download routes only honor `read`.

Owner services may have implicit internal ownership for metadata update and delete, but high-risk transitions still require service identity and audit.

## Authorization Evaluation Order

Every download request must evaluate in this order:

1. Asset exists and `deleted_at is null`.
2. Namespace policy allows the route.
3. Scan status allows download.
4. Processing status allows download.
5. Visibility allows route category.
6. Required grant exists and is not revoked or expired.
7. Caller identity matches the grant subject.
8. Rate limit and response policy allow streaming.

Fail closed. Return `404` for public route missing/denied assets to avoid exposing private asset ids. Protected/admin routes may return `403` when the caller is authenticated but lacks permission.

## Public URL Policy

Consumer services request URLs through:

```text
GET /priv/assets/{assetId}/public-url
```

Rules:

- Return a URL only if the asset can become public by policy.
- The URL itself can be stable even before public grant exists, but public download must still deny until grant/scan/processing pass.
- Consumer services should store `assetId`, not only `downloadUrl`.
- Public API responses may include `downloadUrl` generated from `assetId`.

Do not generate URLs in consumers by string concatenation. Central URL generation keeps future CDN or route changes isolated.

## Upload Patterns

### Service-Mediated Upload

Use when the caller is an internal service, such as LINE bot downloading a file from LINE and uploading it to asset storage.

Flow:

1. Internal service creates upload session.
2. Internal service uploads bytes to upload target.
3. Internal service completes upload with checksum.
4. `asset-api` validates and creates asset.

### Browser Direct Upload

Use for admin CMS files if file sizes make proxying through `hhc-web-api` inefficient.

Flow:

1. Admin UI requests upload session through `www.alive.org.tw/api/assets/admin/upload-sessions`.
2. Gateway verifies CMS asset scope.
3. `asset-api` issues short-lived upload target.
4. Browser uploads bytes directly to the upload target.
5. Admin UI calls complete endpoint through gateway.
6. `asset-api` scans/processes.
7. CMS editor attaches the ready asset to domain record.

The upload target may be provider-specific internally, but the browser must not receive long-lived broad SAS permissions.

### Small File Proxy Upload

Use only when simpler and safe:

- small CMS images
- low traffic
- no large file streaming requirement

Even when proxying, `asset-api` still owns storage and metadata.

## Derivatives

Images can have derivatives:

- `thumbnail`
- `card`
- `hero`
- `webp`
- future responsive sizes

Derivative rules:

- Derivatives belong to the original asset.
- Original asset permissions apply to derivatives.
- Derivative URLs must still go through gateway asset routes.
- Failed derivative creation should not make the original file public unless namespace policy allows original-only publishing.
- Derivatives are deleted when the original is hard-deleted.

Weekly PDFs do not need derivatives in v1.

## Deletion And Retention

Prefer soft delete first.

Delete states:

- active: `deleted_at is null`
- soft-deleted: hidden from downloads and admin default lists
- hard-deleted: bytes and metadata permanently removed after retention window

Rules:

- Public/protected downloads deny soft-deleted assets.
- Owner service can soft-delete only assets it owns or has `delete` grant for.
- Hard delete requires retention worker, namespace policy, no active legal hold, no active public/protected grants, and no active owner references from the owning service.
- Audit and lifecycle ledger events must be emitted for soft delete, restore, legal hold transitions, and hard delete.
- If a domain record is archived but retained, assets may remain private/restricted.
- A restored Blob object must not become downloadable until `asset-api` metadata, grants, scan state, deleted state, legal hold, and current owner references are reconciled.

Default retention guidance:

- Published CMS assets: retain while content exists and for a recovery window after unpublish/delete.
- LINE group files: retain according to bot/group policy.
- Desktop cloud-folder objects: retain according to app/folder policy.
- Infected files: quarantine or delete according to security policy; never grant public access.

Restore reconciliation:

1. Restore `asset-api` metadata before enabling public asset routes.
2. Reconcile Blob object existence, checksum, and version with `asset-api`.
3. Import lifecycle events newer than the restore point.
4. Re-apply soft deletes, hard-delete markers, legal holds, redactions, and grant revocations.
5. Ask owner services to confirm current active references for each restored public or protected asset.
6. Rebuild public URLs/projections only after grant checks pass.

## Idempotency And Concurrency

Use idempotency keys for:

- upload session creation from consumer services
- upload completion
- grant creation
- grant revocation
- delete requests

Grant uniqueness:

```text
asset_id + subject_type + subject_id + permission + revoked_at is null
```

If two publish workers grant public read to the same asset, the second should return the existing active grant.

If publish and unpublish race, the domain service owns the final desired state and should call `asset-api` with idempotency keys tied to the domain version.

## Namespace Examples

### Weekly Bulletin PDF

1. Admin uploads PDF as `cms.weekly.pdf`.
2. Asset starts as `private`.
3. Scan passes.
4. Bulletin publish workflow requests public read grant before public visibility.
5. After grant confirmation, `hhc-web-api` asks for public URL and stores it in projection.
6. Website and LINE bot use the same URL.
7. Unpublish removes projection and revokes public grant when no other published projection references it.

### News Cover Image

1. Admin uploads image as `cms.news.cover`.
2. Asset starts as `private`.
3. Asset scan and image derivative creation complete.
4. News publish grants public read.
5. Public news projection includes generated gateway image URL.
6. Unpublish revokes public grant.

### CMS Draft Preview Asset

1. Admin uploads image/PDF through a CMS namespace.
2. Asset starts as `private`.
3. `hhc-web-api` attaches the asset to a draft resource.
4. `hhc-web-api` may create or ensure a restricted preview grant for CMS viewers/editors.
5. Admin preview returns a protected gateway URL only when scan state permits preview.
6. Publish creates a separate public grant only if the content is published and the asset is public-eligible.
7. Removing the asset from the draft revokes or invalidates the preview grant when no other draft/published resource needs it.

Preview restrictions:

- `scan_pending` assets show preview warnings instead of bytes.
- `infected`, `scan_failed`, `deleted`, and `quarantined` assets never render in preview.
- Preview must not expose Blob/SAS URLs.
- Preview grants must not be accepted by public asset routes.

### LINE Group File

1. LINE bot downloads file from LINE content API.
2. Bot creates asset as `line.group.file`.
3. Asset visibility is `restricted`.
4. Bot stores line group metadata in bot database.
5. Bot grants read to `line_group:{profileName}:{groupId}`.
6. Retrieval checks bot-owned metadata and requests permitted download URL.

### Desktop Cloud Folder Object

1. Desktop app service creates object metadata in its own domain.
2. It uploads bytes through `asset-api` as `desktop.cloud-folder.object`.
3. Visibility defaults to `private`.
4. App service grants read/write only to authorized users or app clients.
5. Folder sync metadata stays in the app service, not in `asset-api`.

## Security Requirements

- Reject unsupported MIME types by namespace.
- Detect MIME type server-side; do not trust file extension.
- Enforce size limit before accepting completion.
- Compute SHA-256 checksum server-side when possible.
- Require scan-clean before public access.
- Keep upload URL TTL short.
- Strip or escape file names in logs and UI.
- Never log upload targets, SAS tokens, private URLs, or raw file bytes.
- Use per-namespace rate limits for upload and download.
- Audit high-risk transitions.

High-risk transitions:

- `private` or `restricted` to `public`
- public preview grant confusion
- grant create/revoke
- scan status override
- processing status override
- delete or restore
- owner metadata transfer

## Observability

Metrics:

- `asset.upload_session.created`
- `asset.upload_session.completed`
- `asset.upload_session.expired`
- `asset.scan.pending`
- `asset.scan.clean`
- `asset.scan.infected`
- `asset.processing.failed`
- `asset.download.allowed`
- `asset.download.denied`
- `asset.grant.created`
- `asset.grant.revoked`

Logs should include:

- `assetId`
- `namespace`
- `ownerService`
- `ownerType`
- `ownerId`
- `requestId`
- caller app id or user id hash
- status transition

Logs should not include:

- upload URLs
- Blob URLs
- SAS tokens
- file bytes
- raw sensitive file names when unnecessary

## Recovery And Backfill

Asset data must be rebuildable enough to recover from partial failures:

- An uploaded object without completed metadata should be cleaned after session expiry.
- Completed metadata without object bytes should be marked failed.
- Missing derivatives should be requeued.
- Failed scans can be retried by operator action or worker policy.
- Public projections can be rebuilt from domain records and `assetId`.
- `asset-api` should provide admin/internal diagnostics for orphan objects and orphan metadata.
- CMS preview grants can be rebuilt from current draft asset references if they are lost.

## API Additions To Consider

The first contract can stay small, but the service design should allow these routes:

```text
GET    /priv/assets/{assetId}
PATCH  /priv/assets/{assetId}/metadata
POST   /priv/assets/{assetId}/grants
DELETE /priv/assets/{assetId}/grants/{grantId}
POST   /priv/assets/{assetId}/delete
POST   /priv/assets/{assetId}/restore
POST   /priv/assets/{assetId}/rescan
GET    /priv/assets/{assetId}/public-url
GET    /api/assets/public/{assetId}
GET    /api/assets/protected/{assetId}
```

Add public/admin routes only when a real caller needs them.

## Acceptance Criteria

- Every asset has one owner service and namespace.
- Unknown namespaces are rejected.
- Public clients never receive Blob or SAS URLs.
- Public downloads require public visibility/grant, clean scan, and ready/not-required processing.
- Restricted downloads require matching grant.
- CMS preview grants remain restricted/protected and are never treated as public grants.
- Draft preview does not make private assets public.
- Consumer services store `assetId` and ask `asset-api` for URLs.
- Publish/unpublish flows create and revoke grants idempotently.
- LINE group files and desktop cloud-folder objects reuse the same primitives without adding website-specific logic to `asset-api`.
