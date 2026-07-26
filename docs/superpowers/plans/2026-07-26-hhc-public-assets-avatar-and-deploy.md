# HHC Public Assets, Avatar, And Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `asset-api` production-safe for shared public assets, correct weekly bulletin replacement/unpublish behavior, move account avatars to `asset-api`, and prepare `asset-api` for Azure deployment.

**Architecture:** Domain services retain business state and coordinate asynchronous replacement/publication. `asset-api` retains one Go process, PostgreSQL leases, ClamAV, and local/Azure storage adapters while gaining trusted caller identity, immutable committed bytes, exact namespace policy, scoped idempotency, lifecycle deletion, and namespace-specific cache policy.

**Tech Stack:** Go 1.24, PostgreSQL, Azure Blob Storage Go SDK, Dapr service invocation, ClamAV, React 19, TypeScript 6, Vitest, Nginx, Docker Compose, Azure Bicep.

## Global Constraints

- Do not add Service Bus, Event Grid, Defender for Storage, a workflow framework, or a separate worker service.
- Public bytes are immutable and versioned by asset ID.
- `account-api`, `hhc-web-api`, and future domain services retain business metadata.
- Production caller authorization derives from Dapr identity; custom caller headers are development-only.
- Account Avatar accepts only a canonical 512x512 JPEG no larger than 1 MiB.
- Weekly PDF accepts only `application/pdf` no larger than 20 MiB.
- Personal Drive and protected/resumable routes remain deferred.
- Use test-first RED/GREEN cycles and one task-scoped commit per repository change.

---

### Task 1: Asset Namespace Policy, Caller Identity, And Idempotency

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/policy.go`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/policy_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/httpapi/handler.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/httpapi/handler_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/config/config.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/config/config_test.go`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/migrations/sql/004_policy_and_idempotency.sql`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/postgres/store.go`

**Interfaces:**
- Produces: `assets.PolicyFor(namespace string) (NamespacePolicy, bool)`.
- Produces: `NamespacePolicy{OwnerService, MIME, MaxSizeBytes, Visibility, Processing, CacheControl}`.
- Produces: production caller resolution from `Dapr-Caller-App-Id`; development fallback enabled only by `ASSET_ALLOW_DEV_CALLER_HEADER=true`.
- Produces: caller- and operation-scoped idempotency with semantic request fingerprints.

- [ ] **Step 1: Write failing policy tests**

Add tests proving:

```go
policy, ok := PolicyFor("account.avatar")
require.True(t, ok)
require.Equal(t, "account-api", policy.OwnerService)
require.Equal(t, int64(1<<20), policy.MaxSizeBytes)
require.True(t, policy.AllowsMIME("image/jpeg"))
require.False(t, policy.AllowsMIME("image/png"))

_, ok = PolicyFor("desktop.cloud-folder.object")
require.False(t, ok)
```

Also test that a caller cannot request another owner's namespace, exceed the
namespace ceiling, use a disallowed visibility, or reuse one idempotency key
with different request semantics.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
go test ./internal/assets ./internal/httpapi ./internal/config
```

Expected: failure because `PolicyFor`, `account.avatar`, trusted caller mode,
and scoped request fingerprints do not exist.

- [ ] **Step 3: Implement the exact registry and caller resolution**

Use one static Go registry. Delete `namespaceMIMEs` and
`callerCanUseNamespace`. Do not introduce a policy interface or external policy
configuration.

Production resolution accepts only Dapr caller identity. The development header
is accepted only when explicitly enabled. Pass the resolved caller through the
request context so every owner check uses the same trusted value.

- [ ] **Step 4: Scope idempotency in PostgreSQL**

Add `caller_service`, `operation`, and `request_fingerprint` to upload session
and grant idempotency records. Unique constraints are:

```sql
UNIQUE (caller_service, operation, idempotency_key)
```

Return the original result only when the stored fingerprint equals the replayed
request. Otherwise return `ErrConflict`.

- [ ] **Step 5: Run verification and commit**

Run:

```bash
gofmt -w internal/assets internal/httpapi internal/config internal/postgres
go test ./...
go vet ./...
```

Commit:

```bash
git add .
git commit -m "feat: enforce asset namespace and caller policy"
```

### Task 2: Immutable Commit, ETag Binding, And Safe Image Decode

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/service_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/storage/local/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/storage/local/store_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/storage/azure/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/clamav/worker.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/clamav/worker_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/derivatives/worker.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/derivatives/worker_test.go`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/migrations/sql/005_immutable_object_commit.sql`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/postgres/store.go`

**Interfaces:**
- Produces: `BlobStore.Commit(ctx, stagingKey, finalKey string) (BlobProperties, error)`.
- Changes: `BlobStore.Open(ctx, key string, byteRange ByteRange, expectedETag string)`.
- Produces: upload sessions store a staging key; completed assets store a final key and committed ETag.

- [ ] **Step 1: Write failing adapter and service tests**

Tests must prove:

```go
target := createUpload()
put(target, firstBytes)
asset := completeUpload(firstBytes)
require.NotEmpty(t, asset.ETag)
require.Error(t, put(target, replacementBytes))
require.Equal(t, firstBytes, download(asset.ID))
```

Local adapter tests must prove `Commit` refuses an existing final key and removes
the staging key after success. Service tests must prove scan and download reject
an ETag mismatch.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
go test ./internal/assets ./internal/storage/local ./internal/clamav ./internal/derivatives
```

Expected: failure because immutable commit and expected-ETag reads do not exist.

- [ ] **Step 3: Implement immutable storage**

Issue create-only Azure SAS. Store uploads below a unique staging key, validate
them, then commit to the unique final key. Local uses no-replace rename. Azure
uses a conditional no-overwrite upload/copy and deletes staging best-effort.

Scan, derivative, and public download operations pass the committed ETag. State
updates use `WHERE etag = $expected` and the expected pending state.

- [ ] **Step 4: Guard image decoding**

Call `image.DecodeConfig` before `image.Decode`. Reject width or height above
8192 and total pixels above 40 million. Register every decoder allowed by the
namespace policy in the production package, including PNG.

- [ ] **Step 5: Run verification and commit**

Run:

```bash
gofmt -w internal
go test ./...
go vet ./...
```

Commit:

```bash
git add .
git commit -m "feat: commit immutable scanned asset bytes"
```

### Task 3: Asset Cache Policy, Soft Delete, Garbage Collection, And Operations

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/assets/service_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/httpapi/handler.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/httpapi/handler_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/clamav/worker.go`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/lifecycle/worker.go`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/lifecycle/worker_test.go`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/internal/migrations/sql/006_asset_lifecycle.sql`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/postgres/store.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/cmd/server/main.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/internal/migrations/migrations.go`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/README.md`

**Interfaces:**
- Produces: `DELETE /priv/assets/{assetID}` owner-only, idempotent soft delete.
- Produces: `POST /priv/assets/{assetID}/scan/requeue` for failed scans only.
- Produces: `BlobDownload.CacheControl`.
- Produces: lifecycle worker claims purge candidates using the existing database lease pattern.

- [ ] **Step 1: Write failing lifecycle and HTTP tests**

Prove:

- soft-deleted assets immediately return public `404`;
- Avatar responses use `public, max-age=300, must-revalidate`;
- weekly PDFs retain one-year immutable cache;
- expired staging uploads and owner-deleted assets are purged idempotently;
- failed scans may be requeued while infected scans may not;
- concurrent migration runners serialize through a PostgreSQL advisory lock.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
go test ./internal/assets ./internal/httpapi ./internal/lifecycle ./internal/migrations
```

Expected: failure because lifecycle endpoints, cache metadata, worker, and
migration lock do not exist.

- [ ] **Step 3: Implement lifecycle with the existing queue style**

Add tombstone and purge lease columns. The service soft-deletes first. The
worker deletes staging/original/derivative objects and records purge completion.
Blob failures release or reschedule the lease; no distributed transaction is
introduced.

- [ ] **Step 4: Add minimal operations**

Expose scan queue depth, oldest pending age, failed count, and lifecycle backlog
through structured health data or metrics already supported by the service.
Keep `/ready` dependent on PostgreSQL only.

- [ ] **Step 5: Run verification and commit**

Run:

```bash
gofmt -w .
go test ./...
go vet ./...
```

Commit:

```bash
git add .
git commit -m "feat: manage asset cache and deletion lifecycle"
```

### Task 4: Correct Weekly Bulletin Replacement And Publication State

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/postgres/repository.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/postgres/repository_integration_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/publication/types.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/publication/worker.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/publication/worker_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/bulletins/service.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/bulletins/service_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/httpapi/handler.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/httpapi/handler_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/assetclient/client.go`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web-api/openapi.yaml`
- Create: `/Users/rayselfs/Projects/hhc/hhc-web-api/internal/migrations/sql/005_bulletin_asset_replacement.sql`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/packages/hhc-web-client/src/client.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/admin/src/pages/CmsPage.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/web/src/features/weekly/public-api.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/web/src/features/weekly/public-api.test.ts`

**Interfaces:**
- Produces: issue-locale read model with `assetStatus` and `publicationWorkflow`.
- Produces: retry operation for terminal publish/unpublish workflow failure.
- Consumes: owner asset soft delete from Task 3.

- [ ] **Step 1: Write failing Go tests**

Prove that replacing a published locale:

1. leaves the current projection and grant active while the replacement scans;
2. switches projection only after the replacement grant exists;
3. revokes and soft-deletes the prior asset after the switch;
4. exposes failed workflow state and supports idempotent retry.

Prove unpublish removes discovery first and retains visible `revoke_pending` or
`failed` state until revocation completes.

- [ ] **Step 2: Verify Go tests fail**

Run:

```bash
go test ./internal/bulletins ./internal/publication ./internal/httpapi ./internal/postgres
```

- [ ] **Step 3: Implement the minimal domain workflow**

Keep the existing bulletin outbox. Add explicit pending asset/grant fields and
workflow status; do not introduce a generic cross-domain workflow engine.

- [ ] **Step 4: Write failing frontend tests**

Add tests proving Admin does not label a `202` command as published and public
archive pagination uses issue-based API metadata rather than merging three
independently paginated locale calls.

- [ ] **Step 5: Implement UI/client changes and verify**

Run:

```bash
go test ./...
go vet ./...
pnpm --filter @hhc/web test -- --run
pnpm --filter @hhc/admin test -- --run
pnpm --filter @hhc/web lint
pnpm --filter @hhc/admin lint
```

Commit in `hhc-web-api`:

```bash
git add .
git commit -m "fix: preserve bulletin asset publication lifecycle"
```

Commit in `hhc-web`:

```bash
git add .
git commit -m "fix: show reliable bulletin publication state"
```

### Task 5: Move Account Avatar Storage To Asset API

**Files:**
- Create: `/Users/rayselfs/Projects/hhc/account/account-api/internal/assetclient/client.go`
- Create: `/Users/rayselfs/Projects/hhc/account/account-api/internal/assetclient/client_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/services/avatar_service.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/services/avatar_service_test.go`
- Create: `/Users/rayselfs/Projects/hhc/account/account-api/internal/services/avatar_reconciler.go`
- Create: `/Users/rayselfs/Projects/hhc/account/account-api/internal/services/avatar_reconciler_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/auth_handler.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/avatar_handler_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/services/user_service.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/config/config.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/config/config_test.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/routes/routes.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/cmd/main.go`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/migrations/000001_initial_schema.up.sql`
- Delete: `/Users/rayselfs/Projects/hhc/account/account-api/migrations/000002_managed_avatars.up.sql`
- Delete: `/Users/rayselfs/Projects/hhc/account/account-api/migrations/000002_managed_avatars.down.sql`
- Delete: `/Users/rayselfs/Projects/hhc/account/account-api/internal/avatarstore/store.go`
- Delete: `/Users/rayselfs/Projects/hhc/account/account-api/internal/avatarstore/local.go`
- Delete: `/Users/rayselfs/Projects/hhc/account/account-api/internal/avatarstore/local_test.go`
- Delete: `/Users/rayselfs/Projects/hhc/account/account-api/internal/avatarstore/azure.go`

**Interfaces:**
- Produces profile fields: `avatar_url`, `avatar_source`, `avatar_status`.
- Keeps `POST /api/account/v1/profile/avatar` and `DELETE /api/account/v1/profile/avatar`.
- Removes `GET /api/account/v1/avatars/{file}`.
- Consumes private asset upload, status, grant, revoke, and soft-delete APIs.

- [ ] **Step 1: Write failing Avatar lifecycle tests**

Prove:

- a clean replacement switches atomically;
- an infected or failed replacement retains the active Avatar;
- only the newest concurrent replacement may switch;
- removal revokes/deletes custom Avatar and restores provider fallback;
- `avatar_source` prevents provider fallback from displaying a misleading
  remove action;
- returned URLs are absolute asset gateway URLs.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/services ./internal/handlers ./internal/config
```

- [ ] **Step 3: Implement the asset client and workflow**

Use one persisted pending replacement row and an `AvatarReconciler.Run(ctx)`
loop started by `cmd/main.go`, following the existing device cleanup loop's
context and ticker lifecycle. Do not introduce a generic workflow abstraction.

`account-api` validates auth, CSRF, multipart size, JPEG decode, and 512x512
dimensions, then proxies bytes through the signed target and returns `202`.

- [ ] **Step 4: Remove owned Avatar storage**

Fold unreleased Avatar columns into the initial schema, replace
`avatar_object_key` with active/pending asset identifiers and workflow state,
then delete the old storage adapter, configuration, and route.

- [ ] **Step 5: Run verification and commit**

Run:

```bash
gofmt -w .
GOCACHE=/private/tmp/account-api-go-build-cache go test ./...
go vet ./...
```

Commit:

```bash
git add -A
git commit -m "feat: manage profile avatars through asset api"
```

### Task 6: Add Asynchronous Avatar UI States

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/account/src/lib/api.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/account/src/lib/mock-account-api.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/account/src/components/ProfileAvatarEditor.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/account/src/lib/api.test.ts`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/apps/account/src/pages/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: `avatar_source` and `avatar_status` from Task 5.
- Produces: processing, ready, failed, retry, and source-aware remove UI.

- [ ] **Step 1: Write failing component/API tests**

Prove:

- `202` displays processing and keeps the prior image;
- polling stops at ready or failed;
- Remove appears only for `avatar_source == "custom"`;
- failed upload permits retry without clearing the current image.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
pnpm --filter @hhc/account test -- --run
```

- [ ] **Step 3: Implement the minimal UI state**

Use the existing Account API client and profile refresh path. Do not add a
global job framework; poll only while profile reports `processing`.

- [ ] **Step 4: Verify and commit**

Run:

```bash
pnpm --filter @hhc/account test -- --run
pnpm --filter @hhc/account lint
pnpm --filter @hhc/account build
```

Commit:

```bash
git add apps/account
git commit -m "feat: show profile avatar processing state"
```

### Task 7: Gateway, Compose, Infrastructure, And Asset Deployment Readiness

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/account/api-gateway/conf.d/default.conf`
- Modify: `/Users/rayselfs/Projects/hhc/account/api-gateway/scripts/test-www-routing.sh`
- Modify: `/Users/rayselfs/Projects/hhc/account/api-gateway/README.md`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/infra/main.bicep`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/infra/main.bicepparam.example`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/infra/README.md`
- Modify: `/Users/rayselfs/Projects/hhc/asset-api/README.md`
- Create: `/Users/rayselfs/Projects/hhc/asset-api/azure-pipelines.yml`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/compose.yaml`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/compose/.env.example`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/scripts/office-compose-smoke.sh`
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/docs/runbooks/asset-api.md`

**Interfaces:**
- Produces: only implemented public asset gateway routes.
- Produces: browser-reachable local signed upload URLs.
- Produces: ACA-ready image build/push/deploy pipeline and documented required
  Dapr ACL, managed identity, PostgreSQL, Blob, and ClamAV settings.

- [ ] **Step 1: Write failing route and Compose assertions**

Prove:

- removed `/api/assets/admin/*` and `/protected/*` routes return `404`;
- public asset route is available on required hosts;
- Compose signed target uses the office/test hostname rather than Docker DNS;
- custom internal caller identity cannot be supplied through public gateway.

- [ ] **Step 2: Verify route assertions fail**

Run:

```bash
./scripts/test-www-routing.sh
```

and:

```bash
docker compose config
./scripts/test-office-compose-gateway.sh
```

- [ ] **Step 3: Implement route and Compose corrections**

Remove unsupported routes. Configure local upload public base/origin through
environment values. Do not expose `asset-api` internal routes publicly.

- [ ] **Step 4: Prepare Azure deployment**

The pipeline must build and test the Go service, build the container, push to
ACR, and deploy a named ACA revision without automatically changing unrelated
services.

Bicep must:

- keep Defender for Storage disabled;
- disable Shared Key after compatibility verification;
- scope Blob data access to the asset container where Azure permits;
- configure private ClamAV host/port;
- keep `asset-api` ingress internal;
- enable Dapr with the production app ID;
- document the default-deny ACL deployment prerequisite.

- [ ] **Step 5: Verify and commit each repository**

Run:

```bash
docker build -t hhc-asset-api:verify .
go test ./...
az bicep build --file infra/main.bicep
```

In gateway:

```bash
docker build -t hhc-api-gateway:verify .
./scripts/test-auth-routing.sh
./scripts/test-www-routing.sh
```

In `hhc-web`:

```bash
docker compose config
./scripts/test-office-compose-gateway.sh
```

Commit `asset-api`:

```bash
git add .
git commit -m "build: prepare asset api azure deployment"
```

Commit gateway:

```bash
git add .
git commit -m "fix: expose only implemented asset routes"
```

Commit `hhc-web`:

```bash
git add .
git commit -m "fix: route office asset uploads through public host"
```

### Task 8: Cross-Service Acceptance

**Files:**
- Modify only test fixtures or runbooks when acceptance exposes a real mismatch.

**Interfaces:**
- Consumes all prior tasks.
- Produces deploy/no-deploy evidence for `asset-api`.

- [ ] **Step 1: Run all repository suites**

```bash
cd /Users/rayselfs/Projects/hhc/asset-api && go test ./... && go vet ./...
cd /Users/rayselfs/Projects/hhc/hhc-web-api && go test ./... && go vet ./...
cd /Users/rayselfs/Projects/hhc/account/account-api && GOCACHE=/private/tmp/account-api-go-build-cache go test ./... && go vet ./...
cd /Users/rayselfs/Projects/hhc/hhc-web && pnpm test && pnpm lint && pnpm build
cd /Users/rayselfs/Projects/hhc/account/api-gateway && ./scripts/test-auth-routing.sh && ./scripts/test-www-routing.sh
```

- [ ] **Step 2: Run local integration smoke**

Start only the backend/database stack required by the office Compose runbook,
then verify:

- clean Avatar replacement;
- infected Avatar rejection with old image retained;
- weekly PDF upload, scan, publish, replace, unpublish;
- old asset origin denial after revoke/delete;
- public URL works from Account, Admin, and Web hostnames.

- [ ] **Step 3: Produce deployment evidence**

Record:

- exact commits per repository;
- container image tag and digest;
- required Azure resources and configuration;
- Dapr ACL and ACA ingress state;
- Blob Shared Key and managed identity state;
- PostgreSQL migration order;
- ClamAV TCP and signature-age check;
- rollback revision and database compatibility.

Do not deploy until every production safety gate is confirmed.
