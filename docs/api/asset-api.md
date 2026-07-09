# HHC Asset API Contract

Detailed lifecycle, permission, namespace, scan, derivative, retention, and recovery rules live in `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`.

Shared envelope, error, idempotency, headers, pagination, binary response, and versioning rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.

Internal service identity, caller app-id allowlists, namespace restrictions, and public URL rules live in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Asset grant evaluation, object-level download authorization, route/action metadata, and authorization drift checks live in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

Asset privacy, filename handling, namespace retention, LINE group file privacy, and backup/delete rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Cross-service lifecycle ledger, legal hold, retention worker, privacy request, and restore reconciliation rules live in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.

Upload target issuance, completion validation, scan workers, derivatives, download streaming, range requests, and response headers live in `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`.

## Public Base

Public asset routes are exposed only through:

```text
https://www.alive.org.tw/api/assets
```

Internal service routes use `/priv/assets/*` behind Dapr service invocation and are never public.

## Ownership

`asset-api` owns:

- Upload sessions.
- Blob storage keys.
- Asset metadata.
- MIME type and size.
- Checksums.
- Scan and processing status.
- Visibility and grants.
- Stable download URL policy.

Consumer services own:

- Business meaning.
- Domain validation.
- Domain record relationships.
- Publish/unpublish decisions.

## Namespaces

- `cms.weekly.pdf`
- `cms.news.cover`
- `cms.page.image`
- `line.group.file`
- `desktop.cloud-folder.object`

## Visibility

- `public`: downloadable through `/api/assets/public/{assetId}` if scan-clean and ready.
- `authenticated`: downloadable by any valid account user through protected route.
- `restricted`: downloadable only with matching grant.
- `private`: owner service only unless explicitly granted.

## Status Values

Upload session status:

- `created`
- `uploading`
- `completed`
- `expired`
- `aborted`
- `failed`

Scan status:

- `pending`
- `clean`
- `infected`
- `failed`
- `skipped`

Processing status:

- `pending`
- `ready`
- `failed`
- `not_required`

Public CMS assets must be `scan_status=clean` before public download. Public image assets should be `processing_status=ready` when derivatives are required; weekly PDFs can use `processing_status=not_required`.

## Upload Flow

1. Consumer service calls `POST /priv/assets/upload-sessions`.
2. `asset-api` returns upload session and short-lived upload target.
3. Client or service uploads the bytes.
4. Consumer service calls `POST /priv/assets/{assetId}/complete`.
5. `asset-api` records metadata, checksum, scan status, and processing status.
6. Worker scans/processes the asset.
7. Consumer service can reference the asset only after status is compatible with its domain rule.

Create upload session:

```text
POST /priv/assets/upload-sessions
```

```json
{
  "namespace": "cms.weekly.pdf",
  "ownerService": "hhc-web-api",
  "ownerType": "bulletin_version",
  "ownerId": "version_123",
  "purpose": "pdf",
  "locale": "zh-Hant",
  "originalFileName": "2026-07-12-bulletin.pdf",
  "expectedMimeType": "application/pdf",
  "maxSizeBytes": 20000000
}
```

Complete upload:

```text
POST /priv/assets/{assetId}/complete
```

```json
{
  "sizeBytes": 1234567,
  "checksumSha256": "abc123",
  "mimeType": "application/pdf"
}
```

## Grants

Create grant:

```text
POST /priv/assets/{assetId}/grants
```

```json
{
  "subjectType": "public",
  "subjectId": "*",
  "permission": "read",
  "expiresAt": null,
  "idempotencyKey": "bulletin_2026_07_12:asset_123:public-read"
}
```

Revoke grant:

```text
DELETE /priv/assets/{assetId}/grants/{grantId}
```

Grant subject types:

- `public`
- `user`
- `role`
- `line_group`
- `service`
- `app_client`

## Delete And Restore

Soft-delete asset:

```text
POST /priv/assets/{assetId}/delete
```

Restore soft-deleted asset:

```text
POST /priv/assets/{assetId}/restore
```

Rules:

- These routes are internal service routes, not browser routes.
- Caller must be the owner service or hold an explicit `delete`/restore-capable grant.
- Soft-deleted assets are denied by public and protected download routes.
- Hard delete is not a request/response route; it is performed by retention workers after namespace policy, legal hold, grants, and owner references are checked.
- Restore must not recreate public downloadability until scan status, processing status, legal hold, grants, and current owner references are reconciled.

## Download Routes

Public:

```text
GET /api/assets/public/{assetId}
```

Protected:

```text
GET /api/assets/protected/{assetId}
```

Rules:

- Public route allows only `visibility=public`, public read grant, `scan_status=clean`, and `processing_status=ready` or `processing_status=not_required`.
- Protected route requires gateway JWT and matching visibility/grant.
- Private assets are not downloadable by public/protected routes unless explicit grant exists.
- Response may stream bytes or redirect internally, but must not expose Blob URLs to clients.

## Public URL

Consumer services request public URLs through internal API:

```text
GET /priv/assets/{assetId}/public-url
```

Response:

```json
{
  "assetId": "asset_123",
  "downloadUrl": "https://www.alive.org.tw/api/assets/public/asset_123"
}
```

## Audit

`asset-api` emits audit events for upload session creation, upload completion, grant creation, grant revocation, delete, restore, hard delete, legal-hold transitions, infected scan result, scan failure, and download denial.
