# HHC Public Asset Platform And Avatar Design

## Status

Approved direction for implementation planning.

This design narrows the existing platform asset specifications to the next
production milestone:

- harden `asset-api` as the shared public-byte service;
- correct the weekly bulletin asset lifecycle;
- move account avatars from `account-api` storage to `asset-api`;
- preserve the service boundary required by a future personal Drive feature.

There is no production avatar data to migrate. The avatar storage change is a
clean cut.

Where an older asset specification describes a conflicting milestone behavior,
this document governs the public-asset and Avatar implementation. Broader
future-domain requirements remain deferred until their owner service exists.

## Decisions

1. `asset-api` remains one Go service with PostgreSQL-backed workers and the
   existing local/Azure Blob adapters.
2. No Service Bus, Event Grid, second malware scanner, workflow framework, or
   separate worker deployment is added.
3. Domain services own business metadata and publication/replacement decisions.
   `asset-api` owns immutable bytes, upload mechanics, scan state, grants,
   download delivery, and deletion mechanics.
4. Public assets use versioned asset IDs. Bytes are never replaced in place
   after upload completion.
5. Account avatars use `asset-api`; `account-api` no longer owns Blob or local
   avatar storage.
6. Personal Drive is not implemented in this milestone. Its domain boundary is
   fixed now so it does not distort the public-asset API.

## Service Boundaries

| Use case | Domain owner | `asset-api` responsibility |
| --- | --- | --- |
| Account avatar | `account-api` | canonical JPEG bytes, scan, public grant, stable delivery, deletion |
| Weekly bulletin PDF | `hhc-web-api` | PDF bytes, scan, public grant, stable delivery, deletion |
| Future personal Drive | future `desktop-file-api` | private immutable bytes, scan, user grants, range delivery |

`asset-api` must not own:

- account profile state or provider-avatar fallback;
- bulletin issue date, locale, publish state, or public projections;
- file display names, folders, current-version pointers, trash, quota, or sync
  conflict state.

## Namespace Registry

Replace the duplicated namespace MIME map and caller-prefix switch with one
typed in-process registry. It is code, not a generic database or remote policy
engine.

Each entry defines:

- exact namespace;
- owner service;
- allowed MIME types;
- hard maximum size;
- allowed visibility;
- processing profile;
- public cache policy.

Initial entries required by this milestone:

| Namespace | Owner | MIME | Size | Processing | Cache |
| --- | --- | --- | --- | --- | --- |
| `account.avatar` | `account-api` | `image/jpeg` | 1 MiB | validate canonical 512x512 JPEG | short, revalidated |
| `cms.weekly.pdf` | `hhc-web-api` | `application/pdf` | 20 MiB | none | immutable, versioned |
| Existing CMS image namespaces | `hhc-web-api` | existing image set | existing limits | existing derivatives | versioned |
| Existing LINE namespace | `hhc-line-function-bot` | existing safe set | existing limit | existing policy | non-public |

Unknown namespaces, callers, MIME types, visibility values, and values above
the namespace size ceiling are rejected before issuing an upload target.

`desktop.cloud-folder.object` is removed from the active registry until a real
owner service and protected-download contract exist.

## Internal Service Identity

### Production

- `asset-api` has no direct public ingress.
- Internal calls use Dapr service invocation.
- A default-deny Dapr ACL explicitly permits approved caller app IDs.
- `asset-api` derives the caller from Dapr-authenticated caller identity and
  namespace headers.
- `X-Internal-Caller-App-Id` is not an authentication credential.

The API gateway continues stripping internal identity headers as defense in
depth, but header stripping does not replace workload identity.

### Local Development

Local Compose may use an explicit development-only caller header because Dapr
is optional locally. The application must reject this mode unless an explicit
development setting is enabled.

Tests must prove production mode does not accept the development identity path.

## Immutable Upload Contract

### Object Keys

Uploads write to a unique staging key. Completion validates the staged object,
then commits it to a unique final key. A completed asset's final key is never
writable through its upload credential.

If Azure promotion is implemented as a copy:

1. read and validate staged bytes;
2. copy to the unique final key;
3. persist the final ETag and metadata;
4. enqueue scan work for that exact ETag;
5. delete the staging object best-effort.

The local adapter provides equivalent semantics with an atomic rename.

### Signed Targets

- Azure upload SAS is create-only.
- The token cannot overwrite an existing staging or final object.
- Signed targets expire after ten minutes.
- Direct-upload size cannot be enforced by SAS itself, so namespace issuance
  limits, completion validation, quotas, and expired-session cleanup are all
  required.

### ETag Consistency

Completion stores the committed ETag. Scan, derivative generation, and download
open the object with that ETag as a precondition.

Worker state changes use conditional database transitions. A scan result is
accepted only when:

- the asset still expects the same ETag;
- scan status is still `pending`;
- the lease belongs to the current worker.

An ETag mismatch fails closed and never preserves an earlier clean result.

## Validation And Processing

Completion verifies:

- observed MIME equals the namespace policy and the expected MIME;
- observed size is within the namespace ceiling and equals the completed size;
- SHA-256 equals the completed checksum;
- the object ETag is captured for all later operations.

Image processing must call `image.DecodeConfig` before full decode and reject
configured dimension or total-pixel limits. JPEG, PNG, and WebP support must be
registered by the production binary when their namespaces allow them.

`account.avatar` accepts only the already-cropped 512x512 JPEG. `asset-api`
decodes and validates it as a trust-boundary check; it does not crop or infer a
crop. No general avatar derivative pipeline is required.

## Scan And Recovery

The existing private ClamAV service remains the only malware scanner.

- `pending`, `infected`, and `failed` assets cannot be downloaded publicly.
- Scan retries remain bounded.
- A controlled internal requeue operation may retry terminal `failed` scans.
- Requeue is idempotent and unavailable for `infected` assets without an
  explicit administrative incident decision.
- Queue depth, oldest pending age, failure count, and ClamAV signature age are
  observable.
- Database readiness does not depend on ClamAV availability; upload admission
  may be throttled when the scan backlog exceeds an operational limit.

Infected bytes remain inaccessible and are removed according to their retention
policy.

## Idempotency

Idempotency is scoped by authenticated caller and operation.

For upload sessions and grants, persist a fingerprint of the semantic request.
A replay:

- returns the original result when the fingerprint matches;
- returns conflict when the same key is reused with different semantics.

A grant idempotency key can never resolve to another asset's grant.

## Public Delivery And Cache Policy

### Immutable Versioned Assets

Weekly PDFs and CMS media use a new asset ID for every replacement:

```http
Cache-Control: public, max-age=31536000, immutable
```

Removing a domain reference prevents new discovery but does not promise recall
of already downloaded public bytes. Emergency takedown requires origin denial
and CDN purge where a CDN is configured.

### Revocable Profile Assets

Avatars use:

```http
Cache-Control: public, max-age=300, must-revalidate
ETag: "<committed-etag>"
```

This gives useful caching without claiming immediate recall of bytes already
downloaded by a client.

Public routes return `404` when the asset is missing, deleted, not clean, not
ready, or lacks an active public-read grant.

Public URLs are absolute gateway URLs so they work from `www`, `account`,
`admin`, and desktop clients.

## Deletion And Garbage Collection

Add owner-authorized soft deletion and one idempotent PostgreSQL-backed purge
worker using the existing lease pattern.

The worker handles:

- expired or aborted upload sessions and staging objects;
- rejected completion objects;
- infected and terminal failed assets after retention;
- owner-deleted assets;
- replaced avatars and bulletin assets;
- partial derivatives.

Soft deletion immediately blocks new downloads. Hard deletion removes original
and derivative objects, then records completion. Blob deletion failure is
retried; no database/Blob distributed transaction is introduced.

Public asset IDs are never reused.

## Avatar Flow

### Upload

The frontend keeps the existing crop UI and submits a 512x512 JPEG to
`account-api`.

Because the result is at most 1 MiB, `account-api` proxies the bytes through the
`asset-api` upload target. This avoids account-site Blob CORS and exposes no
multi-step storage workflow to the browser.

Sequence:

1. `account-fe` sends the cropped JPEG to `POST /profile/avatar`.
2. `account-api` authenticates the user and validates CSRF and request size.
3. `account-api` creates an `account.avatar` upload session.
4. `account-api` uploads the bytes and completes the session.
5. `account-api` records a pending replacement and returns `202`.
6. An account-owned outbox/reconciler polls the asset state.
7. When clean and ready, it creates an idempotent public-read grant.
8. In one database transaction it switches the active `avatar_asset_id` and
   `avatar_grant_id`.
9. It revokes and soft-deletes the previous managed avatar best-effort.

The current avatar remains visible while the replacement is pending. Infected
or failed replacements never replace it.

Only one pending replacement per user is active. A newer replacement supersedes
an older pending one; stale workflow work must not switch the profile.

### Account Data

Replace account-owned storage data with:

- nullable `avatar_asset_id`;
- nullable `avatar_grant_id`;
- pending replacement workflow state;
- existing provider `avatar_url` fallback.

The profile contract adds:

- `avatar_url`: absolute active URL or provider fallback;
- `avatar_source`: `custom`, `provider`, or `none`;
- `avatar_status`: `ready`, `processing`, `failed`, or `none`.

`DELETE /profile/avatar` clears the active custom-avatar reference, revokes its
grant, soft-deletes the asset, and falls back to the provider avatar if one
exists.

The UI shows "Remove" only when `avatar_source == custom`.

### Clean Cut

There is no migration or backfill:

- remove `avatar_object_key`;
- remove `account-api` Azure/local avatar storage adapters and configuration;
- remove `/api/account/v1/avatars/*`;
- use a fresh schema migration appropriate for an unreleased system.

## Weekly Bulletin Corrections

The existing direct browser upload through `hhc-web-api` remains.

Required corrections:

1. Replacing a published locale creates a new asset version. It must not mutate
   the active public projection before the replacement is clean and granted.
2. After atomic projection replacement, revoke and soft-delete the old asset.
3. Unpublish removes the projection first and exposes a workflow status until
   grant revocation completes.
4. Terminal publication or revocation failure is visible and retryable.
5. Admin does not report "Published" solely because the command returned `202`.
6. Bulletin asset and publication workflow status are readable by Admin.
7. Public archive pagination is issue-based; it does not merge three separately
   paginated locale result sets.

The `hhc-web-api` publication worker remains domain-specific. It is not moved
into `asset-api` or generalized for Avatar.

## Gateway And Local Environment

- Keep only asset routes implemented by the service.
- Remove advertised `/api/assets/admin/*` and `/api/assets/protected/*` routes
  until their handlers and authorization contracts exist.
- Public asset routes remain reachable from all required public hosts.
- Compose returns a browser-reachable upload target, never
  `http://asset-api:8080`.
- Local upload CORS is configuration, not a hard-coded Vite port.
- Production Azure Blob CORS remains limited to consumers that perform direct
  browser uploads; account avatar proxying does not require account-origin Blob
  CORS.

## Future Personal Drive Boundary

Personal Drive requires a future `desktop-file-api`:

```text
hhc-client-v2
  -> api-gateway with HHC user token
  -> desktop-file-api
  -> asset-api private service API
```

`desktop-file-api` will own folders, display names, versions, current pointers,
trash/restore, quota, user authorization, and sync conflict state.

Only when that service is scheduled should `asset-api` add:

- Azure Block Blob resumable upload;
- protected `HEAD` and single-range `GET`;
- user read grants;
- `If-Range` and interrupted-transfer support;
- Drive-specific size and retention policies.

The desktop client must never call `/priv/assets/*` or assert service identity.

## Verification

### `asset-api`

- caller identity and namespace ownership;
- overwrite attempts before and after completion;
- ETag mutation during scan and download;
- extreme image dimensions before decode;
- scoped idempotency and mismatched replay;
- concurrent completion and worker state transitions;
- ClamAV unavailable, retry, requeue, infected denial;
- expired session and deletion GC;
- local/Azure adapter contract for create-only writes, ranges, and deletion.

### Avatar

- old avatar remains until replacement is clean;
- infected and failed uploads never replace the active avatar;
- concurrent replacements allow only the newest workflow to switch;
- removal revokes, soft-deletes, and restores provider fallback;
- absolute avatar URL renders on Account, Admin, and Web;
- UI removal depends on `avatar_source`.

### Weekly Bulletin

- replacing a published PDF preserves the old projection until the new asset is
  ready;
- old grant is revoked after replacement;
- unpublish terminal failures are visible and retryable;
- Admin reflects workflow state rather than command acceptance;
- public archive pagination remains issue-correct;
- revoked public routes deny origin access;
- Compose upload targets are browser reachable.

### Infrastructure

- `asset-api` direct ingress is disabled;
- Dapr default-deny ACL permits only declared owner services;
- custom identity headers cannot bypass production authorization;
- Blob Shared Key access is disabled after compatibility verification;
- storage data-plane roles are scoped to the asset container where supported;
- queue and ClamAV health metrics are observable.

## Implementation Order

1. `asset-api`: trusted service identity, immutable upload/ETag, image limits.
2. `asset-api`: namespace registry, scoped idempotency, lifecycle GC, cache
   policy.
3. `hhc-web-api` and Admin: bulletin replacement, unpublish recovery, workflow
   status, pagination.
4. `account-api`: clean-cut Avatar integration and removal of owned storage.
5. `account-fe`: asynchronous Avatar states and source-aware removal.
6. `api-gateway`, Compose, and infrastructure: route cleanup, reachable upload
   targets, Dapr ACL, identity and storage settings.

Each repository receives task-scoped commits. No implementation commit spans
independent repositories.
