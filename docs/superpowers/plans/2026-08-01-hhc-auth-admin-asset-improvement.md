# HHC Auth, Admin CMS, And Asset Scanning Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan one task at a time. Every behavior change starts with a failing focused test.

**Goal:** Make HHC sign-in reliable across all first-party products, finish the approved Admin CMS interaction model, clean up the CMS API contract, and remove the production dependency on the office ClamAV host.

**Architecture:** `account-api` remains the authorization server, each browser product keeps its own host-only refresh session, and silent PKCE SSO supplies a session to another HHC product without sharing authentication cookies across subdomains. `hhc-web-api` owns content workflow and public projections. `asset-api` owns Blob objects, grants, stable downloads, and asset scan state. ClamAV runs inside queue-triggered ACA Jobs using one shared signature volume; it is not a network microservice. `api-gateway` only routes, validates JWTs, restricts methods, and injects trusted identity headers.

**Repos:**

- `/Users/rayselfs/Projects/hhc/frontend-platform`
- `/Users/rayselfs/Projects/hhc/account/account-api`
- `/Users/rayselfs/Projects/hhc/account/account-fe`
- `/Users/rayselfs/Projects/hhc/account/admin-fe`
- `/Users/rayselfs/Projects/hhc/account/api-gateway`
- `/Users/rayselfs/Projects/hhc/hhc-web`
- `/Users/rayselfs/Projects/hhc/hhc-web-api`
- `/Users/rayselfs/Projects/hhc/asset-api`
- `/Users/rayselfs/Projects/hhc/hhc-line-function-bot`

**Tech Stack:** React 19, TypeScript 6, React Aria Components, Vite, Next.js 16, Go, PostgreSQL, Redis, Nginx, Azure Blob Storage, Azure Storage Queue, Azure Container Apps Jobs, ClamAV, Azure DevOps.

## Fixed Decisions

- Do not share refresh, access, or authorization-session cookies with `Domain=.alive.org.tw`.
- Keep access tokens in memory and refresh tokens HttpOnly and host-only.
- Keep silent OAuth Authorization Code + PKCE redirects; optimize them so a signed-in user does not see an intermediate login screen.
- Do not create another identity service, BFF, ClamAV API, WebSocket service, or generic CMS form framework.
- Keep CMS draft, publish, unpublish, revisions, and rollback. Remove archive/restore from product UI and API.
- Permanent delete requires an explicit confirmation and cannot delete currently published content.
- Keep bounded polling for one asset scan. Revisit SSE only when many simultaneous long-running jobs make polling measurably expensive.
- Use the approved A visual direction: warm paper in light mode, warm charcoal in dark mode, coral primary, teal semantic success.
- Reuse React Aria and the existing `frontend-platform`; do not add another component library.
- Use server authorization as the security boundary. Hidden navigation and buttons improve UX but never replace API authorization.
- Use immutable Git short-SHA image tags for deployment.

## Release Strategy

The dependency order is intentional:

1. Stabilize shared session behavior and package contracts.
2. Fix Account API token/session lifecycle and gateway route policy.
3. Upgrade Account, Admin, and Web consumers.
4. Cut asset scanning over to cloud-only queue jobs.
5. Clean up CMS API contracts and database schema.
6. Implement shared Admin primitives and the approved Admin layout.
7. Perform focused integration tests, then one full release verification per repo.
8. Deploy backend dependencies first, then frontend consumers, and run live smoke tests.

Do not merge a dependent consumer before the package/API version it requires is available. Do not deploy a schema-dependent service before its migration dry run passes.

---

## Phase 0: Baseline And Work Isolation

### Task 0.1: Record the release baseline

**Files:**

- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/docs/superpowers/plans/2026-08-01-hhc-auth-admin-asset-improvement.md`
- Modify only when implementation starts: repo-specific release notes or runbooks listed below.

- [ ] Fetch every repo and record `origin/main`, current branch, worktree status, package version, deployed image, migration version, and pipeline definition.
- [ ] Preserve existing dirty work. Never reset or overwrite unrelated user changes.
- [ ] Create one `codex/...` branch per repo only when that repo's first task starts.
- [ ] Confirm production secrets and current ACA configuration by read-only inventory before any mutation.
- [ ] Capture rollback targets: current image digest, app revision, gateway image, and database backup/PITR timestamp.

**Gate:** All repos have an explicit baseline and rollback target. No implementation starts from an unknown dirty tree.

---

## Phase 1: Shared Session And UI Contracts

### Task 1.1: Publish one authoritative frontend package version

**Repo:** `/Users/rayselfs/Projects/hhc/frontend-platform`

**Files:**

- Modify: `packages/account-client/src/index.ts`
- Modify: `packages/account-client/src/index.test.ts`
- Modify: `packages/account-client/src/oauth.ts`
- Modify: `packages/account-client/src/oauth.test.ts`
- Modify: `packages/account-client/package.json`
- Modify: `packages/ui/package.json`
- Modify: root workspace/package metadata as required by the existing release workflow.

**Contract:**

- Add a small auth result model that distinguishes `authenticated`, `anonymous`, and `unavailable`.
- Add a same-origin refresh coordinator using the native Web Locks API when available.
- Keep one in-memory promise as the fallback for browsers without Web Locks.
- Add a bounded retry helper for `ACC_AUTH_REFRESH_SUPERSEDED`; never retry arbitrary `401`, `403`, or network failures indefinitely.
- Keep OAuth transaction helpers responsible for `state`, PKCE, `returnTo`, single-flight start, and one recovery attempt.
- Do not put React context, router behavior, or translated strings in `account-client`.

- [ ] Write failing tests for two simulated tabs coordinating one refresh.
- [ ] Write failing tests for superseded refresh retry, transient failure propagation, terminal anonymous state, duplicate OAuth start, and recovery-loop prevention.
- [ ] Implement the minimum coordinator and state mapping.
- [ ] Publish one new minor version and upgrade every consumer to that exact version. Do not leave `0.1.x`, `0.2.1`, and `0.2.2` mixed.

**Focused verification:**

```bash
pnpm --filter @hallelujahhomechurch/account-client test -- --run
pnpm --filter @hallelujahhomechurch/account-client build
```

**Commit:** `fix: coordinate browser auth lifecycle`

### Task 1.2: Add only the shared primitives needed by the approved Admin UI

**Repo:** `/Users/rayselfs/Projects/hhc/frontend-platform`

**Files:**

- Modify: `packages/ui/src/controls.tsx`
- Modify: `packages/ui/src/data.tsx`
- Modify: `packages/ui/src/forms.tsx`
- Modify: `packages/ui/src/overlays.tsx`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/ui/src/primitives.stories.tsx`
- Modify: `packages/ui/src/styles.css`

**Components:**

- `ExpandableSearchField`: circular outline trigger expanding left into a pill, modeled on `hhc-client-v2` without copying product state.
- `Select`: one shared menu surface, option, focus, hover, selected, and disabled treatment matching the account menu.
- `DatePicker`: React Aria calendar interaction and HHC field/menu styling; localized labels come from the app.
- `ToastProvider`: queued success/error notifications, accessible live region, dismiss, and bounded lifetime. If the installed React Aria release does not provide a stable toast API, keep one minimal local queue instead of adding a dependency.
- `DataTableFrame`, `StatusBadge`, `PaginationBar`, and icon-only row actions.

- [ ] Write interaction tests for outside click, Esc, focus restore, keyboard navigation, reduced motion, and search expansion without layout shift.
- [ ] Add light/dark and three-locale stories.
- [ ] Keep the package presentation-only: no fetch, router, permission, or CMS logic.

**Focused verification:**

```bash
pnpm --filter @hallelujahhomechurch/ui test -- --run
pnpm --filter @hallelujahhomechurch/ui build
pnpm --filter @hallelujahhomechurch/ui storybook:build
```

**Commit:** `feat: add admin interaction primitives`

**Phase gate:** The packages are published and their generated `dist` matches source. Consumers can upgrade without adapter CSS or duplicate implementations.

---

## Phase 2: Account API Session Correctness

### Task 2.1: Make refresh rotation tolerate benign same-device concurrency

**Repo:** `/Users/rayselfs/Projects/hhc/account/account-api`

**Files:**

- Modify: `internal/services/token_service.go`
- Modify: `internal/services/token_service_test.go`
- Modify: `internal/services/auth_service.go`
- Modify: `internal/services/auth_service_test.go`
- Modify only if metadata needs extension: `internal/models/token.go`

**Behavior:**

- Preserve strict replay revocation for tokens reused outside a short, same-device, same-client concurrency window.
- Return `409 ACC_AUTH_REFRESH_SUPERSEDED` for an immediate benign replay after rotation instead of revoking the successor family.
- Never store or return the raw successor refresh token from Redis metadata.
- Keep atomic active-session checks in Redis/Lua and preserve desktop/native delivery behavior.

- [ ] Replace the test that expects every immediate replay to revoke the successor with separate benign-concurrency and malicious-replay cases.
- [ ] Verify two concurrent refreshes leave exactly one valid successor session.
- [ ] Verify replay after the grace boundary, wrong device, or wrong client revokes the family.

**Focused verification:**

```bash
GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/services -run 'Test.*Refresh' -count=1
```

**Commit:** `fix: distinguish concurrent refresh from replay`

### Task 2.2: Complete logout, password-change, and authorization-session semantics

**Files:**

- Modify: `internal/services/as_session_service.go`
- Modify: `internal/services/as_session_service_test.go`
- Modify: `internal/handlers/auth_handler.go`
- Modify: `internal/handlers/auth_handler_test.go`
- Modify: `internal/handlers/oauth_handler.go`
- Modify: `internal/handlers/oauth_handler_test.go`
- Modify only if required: `internal/models/as_session.go`

**Behavior:**

- Password change revokes sessions, clears current-host cookies, and returns a contract that requires sign-in again.
- Logout clears current-host cookies on every terminal logout path where the request can be safely completed.
- Authorization sessions use a sliding idle lifetime with an absolute cap. Default: 30-day sliding SSO, 90-day absolute cap; sensitive account actions still require fresh authentication.
- Global sign-out remains current-device global sign-out across HHC products.
- Existing access JWTs remain valid until the current 15-minute expiry because gateway validation stays offline. Document this bounded revocation delay; do not add per-request Redis introspection or client-specific TTL complexity without a strict revocation requirement.

- [ ] Add tests for password-change cookie clearing, current-device revocation, other-device preservation, sliding renewal, and absolute expiry.
- [ ] Add audit events for password change, logout, and session expiration reason.

**Focused verification:**

```bash
GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/handlers ./internal/services -run 'Test.*(Logout|Password|ASSession)' -count=1
```

**Commit:** `fix: complete account session termination`

### Task 2.3: Restrict gateway methods for browser auth routes

**Repo:** `/Users/rayselfs/Projects/hhc/account/api-gateway`

**Files:**

- Modify the existing Account/Admin/WWW host route files under `conf.d/` that own OAuth, refresh, session, and logout paths.
- Modify corresponding gateway route tests/scripts and `docs/runbooks/api-gateway.md` in `/Users/rayselfs/Projects/hhc/hhc-web` if the public contract changes.

**Required methods:**

- OAuth token exchange: `POST` only.
- Refresh and logout: `POST` only.
- `/me` and session summary: `GET` only.
- CSRF token: `GET` only.
- WWW exposes only session summary, CSRF, authorize/callback support, and logout required by public account control; it does not expose general account-management APIs.

- [ ] Add host/method matrix tests for allowed and rejected methods.
- [ ] Run `nginx -t` in the actual container image.

**Commit:** `fix: restrict browser authentication routes`

**Phase gate:** Full Account API tests pass once, gateway host/method matrix passes, and staging proves concurrent-tab refresh does not revoke the active session.

---

## Phase 3: Frontend Authentication Lifecycle

### Task 3.1: Fix Account bootstrap and atomic auth state

**Repo:** `/Users/rayselfs/Projects/hhc/account/account-fe`

**Files:**

- Modify: `src/auth/auth-context.tsx`
- Modify: `src/auth/auth-context.test.tsx`
- Modify API wrapper files used by the context.
- Upgrade: `@hallelujahhomechurch/account-client`.

**Behavior:**

- Apply bootstrap exactly once; route changes never reapply an old refresh result over a newer token.
- Capture the initial `returnTo` once.
- Treat token, profile, MFA state, and error as one atomic auth state.
- Terminal invalid refresh clears token and profile together.
- Network, Redis, 5xx, and CSRF failures become `unavailable`, not anonymous.
- Password-change success clears local state and routes to sign-in.
- On focus/pageshow/visible, perform a debounced session revalidation.

- [ ] Add regression tests for stale-bootstrap overwrite, transient outage, terminal invalid refresh, password change, and focus revalidation.

**Commit:** `fix: make account auth bootstrap atomic`

### Task 3.2: Fix Admin OAuth recovery and session revalidation

**Repo:** `/Users/rayselfs/Projects/hhc/account/admin-fe`

**Files:**

- Modify: `src/auth/auth-context.tsx`
- Modify/add: auth context tests.
- Modify: `src/pages/OAuthCallbackPage.tsx`
- Modify/add: OAuth callback tests.
- Upgrade: `@hallelujahhomechurch/account-client`.

**Behavior:**

- Preserve `returnTo` through silent SSO, interactive SSO, and one automatic state-mismatch recovery.
- Recovery happens at most once per transaction; then show a localized retry state.
- Focus/pageshow/visible session validation clears stale profile on terminal auth failure and preserves the current UI on transient failure.
- Opening Admin while already signed in goes directly to the requested Admin route without rendering `Loading admin console` or an avoidable error screen.
- Use a shell skeleton only during the first unresolved bootstrap; do not show product copy as a loading page.

- [ ] Add tests for direct signed-in entry, state mismatch recovery, preserved return route, stale-session clearing, and transient failure.

**Commit:** `fix: recover admin sso without losing context`

### Task 3.3: Fix public Web account control and OAuth callback

**Repo:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**

- Modify: `src/components/layout/AccountControl.tsx`
- Modify/add: `src/components/layout/AccountControl.test.tsx`
- Modify: `src/components/layout/WebOAuthCallback.tsx`
- Modify: `src/components/layout/WebOAuthCallback.test.tsx`
- Upgrade: `@hallelujahhomechurch/account-client`.

**Behavior:**

- Model `loading`, `authenticated`, `anonymous`, and `unavailable` explicitly.
- OAuth exchange failure does not navigate to `returnTo`; it shows a localized retry path and keeps the transaction recoverable.
- Starting OAuth is single-flight so double click cannot overwrite state.
- Revalidate on focus/pageshow/visible so global logout and account changes appear without a full browser restart.
- Broadcast only non-secret same-origin events such as sign-out/profile-changed. Cross-origin products always revalidate against their own server session.

- [ ] Replace the existing callback test that codifies navigation after failed exchange.
- [ ] Add session unavailable, double-click, focus revalidation, and logout-event tests.

**Commit:** `fix: keep public account state authoritative`

**Cross-product E2E gate:**

- Sign into Account, open Admin, and reach the original Admin URL without visible login UI.
- From Admin, open Manage Account and arrive authenticated.
- Open Web and receive the avatar through silent SSO.
- Sign out globally and verify all three products become anonymous after focus/revalidation.
- Run the flow in two tabs and verify refresh rotation stays valid.

---

## Phase 4: Cloud-Only Asset Scanning

### Task 4.1: Add a durable Asset scan outbox and Azure Queue producer

**Repo:** `/Users/rayselfs/Projects/hhc/asset-api`

**Files:**

- Modify: `internal/assets/service.go`
- Modify: `internal/assets/service_test.go`
- Add the next outbox migration under `internal/migrations/sql/`.
- Add queue event/producer/dispatcher packages under the existing internal boundaries.
- Add a dispatcher command only if the current server process cannot safely host the lightweight outbox publisher.
- Modify: `infra/main.bicep`
- Modify: `infra/main.bicepparam.example`
- Modify: `infra/README.md`
- Modify: `.github/workflows/release.yml` or the active Azure DevOps pipeline, not both.
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/docs/runbooks/asset-api.md`

**Architecture:**

1. Upload completion writes `pending` scan state and an outbox row in one DB transaction.
2. Dispatcher sends `asset.scan.requested.v1` to Azure Storage Queue with `version`, `eventId`, `assetId`, and immutable asset `etag`.
3. Outbox publishing is at-least-once; worker deduplication makes delivery idempotent.
4. The existing PostgreSQL scan lease remains a worker claim mechanism, not the external queue.

**Safety:**

- Queue message contains no SAS URL, file name, PII, Blob key, or Azure credential.
- Asset API identity receives Queue Message Sender and only its existing Blob responsibilities.
- The dispatcher records send attempts and does not mark an outbox row delivered until Azure accepts the message.
- Keep the embedded scanner working during this task; it is removed only after the ACA Job smoke gate.

- [ ] Start with tests proving transaction coupling, outbox idempotency, duplicate dispatch, and send retry.
- [ ] Use a short-SHA image tag and managed identity.

**Commit:** `feat: enqueue durable asset scans`

### Task 4.2: Run Asset ClamAV scans as queue-triggered ACA Jobs

**Repo:** `/Users/rayselfs/Projects/hhc/asset-api`

**Files:**

- Add: `cmd/scan-worker/main.go`
- Replace/refactor: `internal/clamav/client.go`
- Replace/refactor tests: `internal/clamav/client_test.go`
- Modify: `internal/clamav/worker.go`
- Modify: `internal/clamav/worker_test.go`
- Add queue consumer/poison/replay code and tests under the smallest existing internal packages.
- Modify: `infra/main.bicep`
- Modify: `infra/main.bicepparam.example`
- Modify: `infra/README.md`

**Worker lifecycle:**

1. Queue-triggered ACA Job claims the asset with a DB lease and verifies message `etag`.
2. It downloads the private Blob to bounded temporary storage.
3. It validates size, MIME, checksum, and runs local `clamscan` against the current immutable signature snapshot.
4. It writes `clean`, `infected`, `retrying`, or `failed`, including signature version and failure category.
5. Derivatives and publication grants remain blocked until `clean`.

**Retry and poison policy:**

- Terminal/already-processed messages are acknowledged.
- `infected` is terminal and never retried.
- Transient failures use capped exponential visibility delay.
- After five dequeues, mark the asset `failed`, copy the event to `asset-scan-poison`, and acknowledge the source message.
- Invalid payload goes directly to poison.
- Manual replay creates a new event ID, preserves the poison record, and writes an audit event.

**Azure resources:**

- `asset-scan` and `asset-scan-poison` Storage Queues.
- Event-triggered ACA Job with `minExecutions=0` and bounded max executions.
- Scheduled Asset-owned signature refresh Job with atomic manifest and previous-known-good rollback.
- Immutable signature generations in Azure Files or Blob; mount/read them without embedding long-lived credentials.
- Job managed identity with Queue Message Processor, Blob Data Reader, ACR Pull, and only required secret/database access.
- Enable 30-day Blob soft delete before lifecycle cleanup is activated. Keep Blob versioning disabled because object keys are immutable and are never overwritten.

Reference: Azure Container Apps event jobs support queue-driven executions with zero minimum executions, and Azure resource scale rules support managed identity authentication: [Jobs in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/jobs), [Scaling in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/scale-app).

- [ ] Add duplicate delivery, stale `etag`, lease expiry, transient retry, fifth-attempt poison, manual replay, infected, stale-signature, and fail-closed tests.
- [ ] Build a worker image that contains ClamAV but not the Asset HTTP server runtime.
- [ ] Deploy queue/job while the embedded scanner remains available.
- [ ] Send an isolated clean fixture and EICAR fixture through the new queue path.
- [ ] After the queue path passes, switch upload completion to queue dispatch, drain pending legacy work, then disable the embedded scanner.
- [ ] Only after cutover, remove `CLAMAV_HOST`, `CLAMAV_PORT`, office IP, Tailscale route, and related NSG rules.

**Commits:**

- `feat: run clamav scans as azure jobs`
- Cleanup after live smoke: `chore: remove office clamav dependency`

### Task 4.3: Make Asset the single malware-scan owner and migrate LINE attachments

**Repos:**

- `/Users/rayselfs/Projects/hhc/asset-api`
- `/Users/rayselfs/Projects/hhc/hhc-line-function-bot`

**Existing LINE files to retire after cutover:**

- `src/attachments/clamav-signature-policy.ts`
- `src/attachments/clamav-cli.ts`
- `src/tools/refresh-clamav-signatures.ts`
- `aca.clamav-signature-refresh-job.yaml`
- `aca.attachment-scan-job.yaml`

**Final ownership:**

- `asset-api` alone owns quarantine Blob storage, ClamAV, signatures, scan state, grants, lifecycle, and stable download.
- The LINE job keeps LINE download, business state, Graph/OneDrive publication, and catalog behavior, but it no longer scans files itself.
- LINE creates an Asset upload session, uploads to the signed private target, completes the upload, stores `assetId`, waits for `clean`, and only then publishes to Graph/OneDrive.
- The Asset signature-refresh job preserves the existing atomic manifest and previous-known-good snapshot policy already proven in LINE.
- Do not create a malware-scan microservice. The scan ACA Job is an `asset-api` background execution component.
- ACA Jobs do not have Dapr support. LINE jobs call Asset over private ACA ingress with an Entra token obtained from their managed identity; Asset validates tenant, issuer, audience, calling service principal, and assigned app role. Existing Container Apps continue using authenticated Dapr invocation. No public gateway route, client secret, storage key, queue connection string, or long-lived SAS is introduced.

Reference: Microsoft explicitly lists Container Apps Jobs as unsupported by managed Dapr sidecars: [Dapr limitations in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/dapr-overview#limitations).

- [x] Extend Asset's `line.group.file` policy to the Office, PowerPoint, and text formats that LINE already accepts, with per-type limits and content detection.
- [x] Add a production-only Entra workload-auth branch to Asset private-route middleware while preserving Dapr caller authentication and keeping the development caller header disabled in production.
- [x] Add a narrow Asset client to LINE and preserve existing requester/group authorization before creating an upload.
- [x] Persist `assetId` in LINE work state and make restart/retry idempotent.
- [x] Wait through the Asset status contract with a workflow deadline; `pending` does not consume a publication failure attempt.
- [ ] Deploy and verify the Asset path before removing LINE's scanner, signature job, Azure Files mount, storage keys, queue connection string, and scan image.
- [x] Keep rollback to the previous valid signature snapshot.
- [ ] Add a smoke test that succeeds with the office computer off and no Tailscale route.

Implementation evidence: Asset `3cc65a0`; LINE `205049c`. Production cutover and rollback cleanup remain deferred until live proof.

**Commits:**

- Asset: `build: own clamav scan infrastructure`
- LINE: `feat: route attachments through asset service`
- LINE cleanup after smoke: `chore: retire line-owned clamav jobs`

### Task 4.4: Replace broad publication polling with bounded asset-status polling

**Repos:**

- `/Users/rayselfs/Projects/hhc/hhc-web-api`
- `/Users/rayselfs/Projects/hhc/account/admin-fe`

**Contract:**

- Add or reuse one protected status endpoint owned by `hhc-web-api` that returns the CMS-safe subset of asset scan state.
- Poll only while `pending`, `scanning`, or retrying; use `2s`, then `5s`, then `10s`, pause while the page is hidden, and stop on terminal state, navigation, workflow deadline, or timeout.
- Show retry only for retryable failed states and authorized users.
- Do not expose Asset internal grant or Blob details to the browser.
- Publication workflow waiting for a pending scan does not consume failure retries; only terminal/transient failures do.

**Commits:**

- `hhc-web-api`: `feat: expose consistent asset processing status`
- `hhc-web-api`: `fix: bound publication wait for asset readiness`
- `admin-fe`: `fix: poll only active asset scans`

### Task 4.5: Lock down stable download routes

**Repo:** `/Users/rayselfs/Projects/hhc/account/api-gateway`

- [ ] Assert only intended public stable-download paths are exposed.
- [ ] Permit required `GET`, `HEAD`, and Range behavior; reject upload, scan, grant, replay, and `/priv` paths.
- [ ] Verify immutable cache headers for versioned public objects and no caching for protected/error responses.

**Commit:** `test: lock down stable asset downloads`

**Phase gate:** A 5 MiB PDF uploads, scans, and becomes publishable entirely in Azure with the office computer unavailable. Infected and poison-path test objects remain unpublishable and auditable.

---

## Phase 5: CMS API And Database Contract Cleanup

### Task 5.1: Replace archive/restore with unpublish and permanent delete

**Repo:** `/Users/rayselfs/Projects/hhc/hhc-web-api`

**Files:**

- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`
- Modify: `internal/bulletins/types.go`
- Modify: `internal/bulletins/service.go`
- Modify: `internal/bulletins/service_test.go`
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`
- Modify: `internal/postgres/content_repository.go`
- Add: next migration under `internal/migrations/sql/`.
- Modify OpenAPI source used by `/Users/rayselfs/Projects/hhc/frontend-platform/packages/hhc-web-client/openapi/hhc-web-api.yaml`.

**Contract:**

- `DELETE /api/admin/content/{module}/{id}` with `If-Match` and `cms:write`.
- `DELETE /api/admin/bulletins/{id}` with `If-Match` and `cms:write`.
- Published/publishing/unpublishing content must be unpublished first.
- Delete transaction removes the aggregate, translations, revisions, and public projection, records an audit event, and enqueues idempotent asset grant/object cleanup.
- Map existing `archived` rows to `draft` during migration, matching the current restore behavior, then remove `archived` from allowed statuses. Do not silently delete existing data.
- On aggregate deletion, the `hhc-web-api` transaction records every referenced asset in its outbox before cascading content rows. The outbox worker calls the existing owner-authorized `DELETE /priv/assets/{assetId}` idempotently; `asset-api` immediately revokes access through soft delete and lets its existing lifecycle worker remove Blob objects after retention.
- Replaced bulletin PDFs and news covers remain owner-held while a live revision can restore them. Aggregate deletion releases every current or revision-referenced asset exactly once.

- [ ] Add delete authorization, stale-version, published-conflict, cascade, audit, and asset-cleanup tests.
- [ ] Remove archive/restore handlers only after the Admin consumer is ready in the same release train.

**Commit:** `feat: replace content archive with delete`

### Task 5.2: Make history date-driven without inventing fake dates

**Files:** same content service/repository/types plus migration and tests.

**Model:**

- Add canonical `eventDate` accepting `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`.
- Store the validated ISO partial date as text so lexical ordering preserves chronology without inventing missing month/day values.
- Keep localized `dateLabel` for display.
- Remove editor-facing `sortOrder`.
- Default list order is canonical event date descending, null last, then updated time/id for deterministic pagination.
- Public history projection renders the same records oldest to newest for the timeline.
- Add an index matching the actual module/status/event-date list query. Do not add speculative trigram or full-text indexes without an observed query plan.

- [ ] Migrate existing history rows from trusted source data where possible; leave unknown canonical dates null rather than fabricating day/month.
- [ ] Add validation and deterministic-order tests.

**Commit:** `feat: order history by event date`

### Task 5.3: Return bulletin version summaries without N+1 queries

**Files:**

- Modify: `internal/bulletins/types.go`
- Modify bulletin repository/service files and tests.

**Contract:**

- Bulletin list response includes version summaries for `zh-Hant`, `zh-Hans`, and `en` using one batch query for the page.
- Admin derives the table title from `zh-Hant`; leave it blank if absent.
- Available-language display is based only on uploaded/valid version records.
- Public weekly fallback remains separate: requested locale falls back to `zh-Hant`; missing download variants are not rendered.

**Commit:** `fix: include bulletin version summaries`

### Task 5.4: Add bulletin revision history and restore

**Files:**

- Modify: `internal/bulletins/types.go`
- Modify: `internal/bulletins/service.go`
- Modify: `internal/bulletins/service_test.go`
- Modify bulletin repository and HTTP handler files/tests.
- Modify: `openapi.yaml`
- Add the next bulletin revision migration under `internal/migrations/sql/` when the existing content revision table cannot safely represent bulletin snapshots.

**Contract:**

- `GET /api/admin/bulletins/{issueId}/revisions`.
- `POST /api/admin/bulletins/{issueId}/revisions/{revision}/restore` with `If-Match`.
- Snapshot issue date and all three locale-version records, including asset IDs and scan/publication metadata required to recreate a draft.
- Restore always creates a new draft revision; it never silently republishes.
- Assets referenced only by revisions stay retained until the owning bulletin is deleted.

- [ ] Add snapshot, stale-version, missing-asset, restore-to-draft, and public-projection isolation tests.

**Commit:** `feat: add bulletin revision restore`

### Task 5.5: Verify indexes and pagination against real queries

**Files:**

- Modify/add the next SQL migration only for indexes proven useful by current list/filter/sort SQL.
- Add query-plan assertions or repository benchmarks only where the existing test harness supports them cheaply.

- [ ] Review filters, sorts, unique constraints, FKs, and pagination cursors for content, bulletins, translations, revisions, and public projections.
- [ ] Use `EXPLAIN (ANALYZE, BUFFERS)` on staging-sized fixtures.
- [ ] Keep server pagination metadata authoritative; never infer total pages from current rows.
- [ ] Avoid adding GIN/trigram indexes until search volume/query plans justify the write cost.

**Commit:** `perf: align cms indexes with list queries`

### Task 5.6: Regenerate and publish the CMS client contract

**Repo:** `/Users/rayselfs/Projects/hhc/frontend-platform`

**Files:**

- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`
- Modify: `packages/hhc-web-client/package.json`

- [ ] Copy from the accepted `hhc-web-api` OpenAPI source; never hand-maintain divergent DTOs.
- [ ] Add client coverage for delete conflicts, bulletin revision restore, history partial dates, list metadata, and asset scan status.
- [ ] Publish the next minor version and upgrade Admin and Web together where their DTOs are affected.

**Commit:** `feat: update cms client contracts`

**Phase gate:** Migration up/down tests pass, OpenAPI contract is regenerated, Admin client compiles against it, and old archived data is preserved as draft.

---

## Phase 6: Admin CMS Final UI

### Task 6.1: Finish the shell, navigation, search, locale, and RBAC presentation

**Repo:** `/Users/rayselfs/Projects/hhc/account/admin-fe`

**Files:**

- Modify: `src/components/AppLayout.tsx`
- Modify/add: App layout tests.
- Modify: `src/preferences/locale-context.tsx`
- Modify: locale message files/constants owned by the app.
- Modify: `src/lib/access-control.ts`
- Modify: `src/index.css`
- Upgrade: `@hallelujahhomechurch/ui`, `preferences`, and `account-client`.

**Layout:**

- Sticky same-canvas header with expandable search immediately left of avatar.
- Sidebar groups: Overview; Website Content; Accounts And Access. Add only implemented routes.
- Website Content children: News, Bulletins, History, Kingdom Music.
- Hide routes and actions the current scopes do not permit; route guards still return Forbidden and backend remains authoritative.
- Mobile uses the shared Drawer with the same groups and legal links.
- Remove redundant page titles when selected navigation already names the view.
- Set localized document title and metadata; never display `admin-fe`.

**Search:**

- Trigger is a 40px outline circle/pill and expands left without moving the avatar.
- Query lives in URL search params.
- Debounce, `AbortController`, and latest-request-wins prevent stale results.
- Esc/outside click collapses; keyboard and screen-reader labels are complete.

**Commit:** `feat: finish admin shell and navigation`

### Task 6.2: Replace every split inspector with full-width list pages

**Files:**

- Modify: `src/pages/content/ContentModulePage.tsx`
- Modify/add: content module page tests.
- Modify: `src/pages/UsersPage.tsx`
- Modify: `src/pages/AccessPage.tsx`
- Modify: `src/pages/OAuthClientsPage.tsx`
- Modify/add tests for each affected page.
- Modify: `src/components/StatusBadge.tsx`

**List contract:**

- One toolbar row: filters/status/sort left, create right. Search stays in the header.
- Keep one `sr-only` page heading for document structure even though the visual heading is removed.
- One full-width table; no permanent right inspector.
- Table frame consumes available viewport height, scrolls internally, and has a sticky header on desktop.
- Row hover is a single subtle full-row state. Edit/delete icon buttons have their own non-conflicting hover state.
- Status badge uses intrinsic width and centered content.
- Footer left shows item count; footer right shows `current / total` with previous/next icon buttons.
- Preserve old rows while refetching. Skeleton only the first load; use shared empty/error/retry states.
- Filters, sort, page, and page size stay in URL parameters.

**Required columns:**

- News: title, languages, status, display date, updated, actions.
- Bulletins: issue date, Traditional Chinese title or blank, available versions, status, updated, actions.
- History: event, event date, languages, status, updated, actions. No display-order column.
- Videos: title, YouTube ID, languages, home eligibility, status, updated, actions.
- Users/Roles/OAuth clients: domain-specific columns and row actions, with detail route/dialog instead of a split pane.

**Commit:** `feat: standardize admin list workspaces`

### Task 6.3: Standardize editors and fix dirty-state behavior

**Files:**

- Modify: `src/pages/content/ContentEditorPage.tsx`
- Modify: `src/pages/content/ContentEditorPage.test.tsx`
- Modify: `src/pages/BulletinDetailPage.tsx`
- Modify: `src/pages/BulletinDetailPage.test.tsx`
- Modify: `src/pages/UserDetailPage.tsx`
- Modify: `src/pages/RoleDetailPage.tsx`
- Modify corresponding tests.

**Editor layout:**

- Back navigation at upper left on every editor, including Bulletin.
- Identity/status/update metadata left; revision, unpublish/publish, and save actions right.
- Keep Save Draft visible but disabled until the form is dirty, valid, and not saving; this avoids layout jumps.
- Use one level of form sections. Inputs and textareas use a distinct semantic field surface in light and dark; no card inside card.
- Delete is a standalone danger action at the bottom right with no permanent explanatory sentence. The AlertDialog explains impact and requires explicit confirmation.
- Published items offer Unpublish. No Archive action.
- Success/error operations use Toast; field validation remains inline.
- Success Toasts default to four seconds and never replace persistent loading or field-error states.
- On mobile, keep the primary Save action visible; place Revisions, Unpublish, and Delete in one accessible overflow menu.

**Dirty-state fix:**

- A successful save replaces the form baseline and clears dirty state before any navigation blocker runs.
- A failed save retains edits and does not show success.
- Browser navigation, Back, and route changes prompt only when real unsaved changes remain.

**Bulletin editor:**

- Always show three rows: `zh-Hant`, `zh-Hans`, and `en`.
- Each row has localized version name, title, status, PDF selection, upload/replace/remove action, and scan state.
- UI labels, status text, placeholders, and button text follow the Admin interface locale; only the version content differs by locale.
- Missing versions remain optional and are not rendered as public download choices.

**Commit:** `feat: standardize admin editors`

### Task 6.4: Complete Admin i18n, light/dark, responsive, and accessibility QA

**Files:** app locale resources, shared tokens only when a token is genuinely shared, and page tests.

- [ ] Complete `zh-Hant`, `zh-Hans`, and `en` for all Admin chrome, dialogs, errors, toasts, table labels, dates, status, and actions.
- [ ] Verify locale-specific content labels do not accidentally switch the surrounding UI language.
- [ ] Validate selected A light/dark palette at 375, 768, 1024, and 1440 px.
- [ ] Verify no button text wraps (`+ 建立` remains one line); use icon-only actions when width is constrained.
- [ ] Verify keyboard-only flows, visible internal focus state, focus restore, outside click, Esc, screen-reader labels, and WCAG AA contrast.

**Commit:** `fix: complete admin localization and states`

**Admin focused verification during iteration:**

```bash
npm test -- --run <changed-test-files>
npm run lint -- <changed-files-if-supported>
```

**Admin full verification once before release:**

```bash
npm test -- --run
npm run lint
npm run build
```

---

## Phase 7: Release Verification And Deployment

### Task 7.1: Run one full verification pass per changed repo

**Frontend:**

```bash
# frontend-platform
pnpm test -- --run
pnpm lint
pnpm build

# account-fe / admin-fe
npm test -- --run
npm run lint
npm run build

# hhc-web
npm run test:run
npm run lint
npm run build
```

**Go services:**

```bash
GOCACHE=/private/tmp/account-api-go-build-cache go test ./...
GOCACHE=/private/tmp/hhc-web-api-go-build-cache go test ./...
GOCACHE=/private/tmp/asset-api-go-build-cache go test ./...
```

**LINE:**

```bash
pnpm test -- --run
pnpm lint
pnpm build
```

**Gateway/infra:**

- Build the exact gateway and worker images.
- Run `nginx -t` inside the built gateway image.
- Run Bicep lint/build and `az deployment group what-if`.
- Validate migrations against an isolated database, including rollback where supported.

### Task 7.2: Deploy in dependency order

1. `frontend-platform` package release.
2. `account-api` migration/config/image.
3. `api-gateway` auth route policy.
4. `account-fe`, `admin-fe`, and `hhc-web` auth consumers.
5. Shared ClamAV signature storage/refresh job.
6. `asset-api` queue, poison queue, identity, scan job, API image.
7. `hhc-line-function-bot` shared-signature consumer update.
8. `hhc-web-api` migrations and contract release.
9. `frontend-platform` regenerated CMS client release.
10. Final `admin-fe` and affected `hhc-web` consumer releases.

For each deployment:

- [ ] Use the existing Azure DevOps service connection/client where its scope is already sufficient; do not create another identity by default.
- [ ] Push immutable short-SHA image tags.
- [ ] Wait for healthy ACA revision/job execution before advancing.
- [ ] Record image digest, revision, migration version, and smoke evidence.
- [ ] Roll back immediately on auth-loop, data-loss, scan bypass, or public projection regression.

### Task 7.3: Live smoke matrix

**Auth:**

- Account password + MFA login.
- Account to Admin and Admin to Account silent SSO.
- Web avatar session acquisition.
- Two-tab refresh concurrency.
- Expired/revoked/temporarily unavailable session behavior.
- Password change and current-device global logout.

**CMS:**

- List/filter/sort/paginate/search every module.
- Create, save draft, leave/re-enter, publish, unpublish, revise, rollback, and delete.
- Verify save never opens the unsaved-changes dialog after success.
- Verify RBAC hides controls and direct protected routes still return `403`.
- Verify Traditional/Simplified/English UI and content-version separation.

**Assets:**

- Upload clean 5 MiB PDF, observe bounded polling, publish, and download stable URL.
- Upload EICAR test object in a non-production-safe fixture path and verify infected/quarantine behavior.
- Force transient job failure, retry, poison, and operator requeue.
- Confirm all tests pass with the office computer and Tailscale route unavailable.

**Visual/accessibility:**

- Desktop/mobile, light/dark, three locales.
- Search expansion, Select, DatePicker, account menu, Drawer, Dialog, Toast, table scroll, and focus behavior.

---

## Observability And Rollback Requirements

- Auth metrics: refresh success, benign superseded conflict, replay revocation, OAuth state mismatch, silent SSO latency/failure, logout outcome.
- Asset metrics: queue depth/age, scan duration, clean/infected/failed counts, poison count, signature age/version, job startup failures.
- CMS metrics: save/publish/unpublish/delete conflicts, projection lag, asset-blocked publish count, list latency.
- Never log refresh tokens, authorization codes, PKCE verifier, SAS URLs, file contents, or secrets.
- Alerts should page only on sustained auth outage, scan backlog/signature expiry, publication failure, or data-integrity risk; ordinary user validation errors remain dashboard events.
- Rollback never reverses a destructive delete. Database PITR and Blob retention remain the recovery mechanism after confirmed accidental deletion.

## Explicitly Deferred

- WebSocket asset status transport.
- A network-accessible ClamAV service.
- Migrating every LINE attachment into `asset-api`.
- Generic CMS schema/form engine.
- Approval workflow beyond draft/publish.
- Real-time cross-origin browser event broadcasting.
- Full-text/trigram search indexes without measured demand.
- Instant invalidation of already-issued access JWTs through per-request Redis introspection.

## Plan Self-Review

| Risk | Resolution in this plan |
| --- | --- |
| Cross-tab refresh revokes the valid successor | Browser Web Locks plus a backend same-device/client superseded response; malicious replay remains revoking. |
| Frontend shows stale authenticated profile | One atomic auth state and terminal failure clears token/profile/MFA together. |
| Temporary Account/Redis outage appears as logout | `unavailable` is separate from `anonymous`; retryable state is preserved. |
| OAuth state mismatch loops or loses destination | Single-flight OAuth start, one recovery attempt, and preserved `returnTo`. |
| Shared parent-domain auth cookie expands blast radius | Explicitly forbidden; each product keeps a host-only session and uses silent PKCE SSO. |
| Asset cutover creates a scanning gap | Queue/job is deployed and smoke-tested before dispatcher switch; embedded worker is removed last. |
| LINE and Asset retain duplicate ClamAV stacks | Asset is the sole scan owner; LINE becomes a client and deletes its scanner after live proof. |
| ACA Job assumes Dapr | Explicitly avoided because Jobs do not support Dapr; managed identity authenticates private Job-to-Asset calls. |
| Delete removes files needed by revisions | Revision-referenced assets stay owner-held; aggregate delete snapshots asset IDs into an outbox before DB cascade. |
| Removing archive loses existing records | Existing archived rows migrate to draft, matching current restore semantics. |
| History partial dates become false exact dates | ISO partial date is stored without fabricating missing values; localized label remains separate. |
| UI-only RBAC can be bypassed | UI hides unavailable navigation/actions, but gateway/backend scopes remain authoritative. |
| Shared package and generated client drift | Two explicit package release gates: auth/UI first, CMS client after accepted OpenAPI changes. |
| Long full suites slow iteration | Focused tests run per task; each repo runs one full verification pass before deployment. |

No additional product decision is required before execution. The two runtime defaults that matter are fixed here: 15-minute bounded access-token revocation and polling rather than WebSocket/SSE for a single active asset.

## Completion Definition

This plan is complete only when:

- Auth state is consistent across Account, Admin, and Web, including two tabs, transient outages, password change, and global logout.
- Asset scans run entirely in Azure and weekly PDF publication no longer depends on the office computer.
- Admin lists and editors match the approved full-width workflow in all supported locales and themes.
- Archive is removed, unpublish remains, permanent delete is guarded and audited, history is date-driven, and bulletin version summaries are correct.
- All changed repos have task-scoped commits, remote main contains the accepted changes, pipelines use immutable artifacts, and live smoke evidence is recorded.
