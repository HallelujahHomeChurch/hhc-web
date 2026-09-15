# Edge, Integration, And Coordinated Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Operations, Audit, and protected surfaces correctly, prove the full authorization/DSR matrix, then execute one authorized breaking production cutover without restoring public bulletin access.

**Architecture:** Gateway performs authentication, strips untrusted identity headers, injects trusted subject/service context, and routes by exact host/path/method. Feature services keep fine-grained authorization. Operations deploys dark before ownership switches; production changes happen in one controlled window after staging proof.

**Tech Stack:** Nginx, Go JWT verifier, Dapr, OpenAPI catalog, Azure Container Apps, Terraform, GitHub Actions.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- No Gateway route, infrastructure, merge, release, session reset, or production data mutation without explicit authorization.
- Gateway owns coarse authentication and routing only; it must not evaluate
  organization or entitlement policy. Operations administrative routes require
  authentication at the edge, not a global Operations scope, so scoped
  organization-role users can reach the owning API decision.
- Old public bulletin routes fail closed with no redirect or legacy upstream.
- Audit Browser query is exact authenticated GET traffic to `audit-log`; private append is never exposed and `hhc-web-api` is not an Audit BFF.
- Roll forward from immutable artifacts; rollback must never reopen bulletin public access.
- The release manifest also owns AuthN conformance evidence: token
  single-flight, stale-token fencing, one `401` refresh and retry, `403`
  no-refresh, `429 Retry-After`, hosted login, and Sentry redaction.

### Task 1: Add Exact Operations Routing Tests

**Files:**
- Modify: `api-gateway/nginx.conf`
- Modify: `api-gateway/docker-entrypoint-hhc.sh`
- Create: `api-gateway/scripts/test-operations-routing.sh`
- Modify: `api-gateway/scripts/test-auth-method-matrix.sh`
- Modify: `api-gateway/docs/route-policy-sources.md`
- Modify: `api-gateway/docs/openapi.yaml`
- Modify: `api-gateway/docs/openapi_test.go`

- [ ] First write tests for exact public, authenticated, Admin, and private Operations paths and methods.
- [ ] Prove client-supplied `X-HHC-*` and service identity headers are stripped.
- [ ] Prove verified access-token `scope` is the only staff-permission input
      rebuilt as `X-HHC-Scopes`; no `X-HHC-Permissions` path exists.
- [ ] Prove exact `/api/admin/operations/*` routes require authenticated trusted
  identity but do not require a global Operations scope at the edge; the
  verified scope header is still forwarded for the downstream union decision.
- [ ] Prove `/priv/*` remains unreachable from public hosts.
- [ ] Prove old `/api/bulletins*` routes have no upstream and protected `/api/member/bulletins*` requires authentication.
- [ ] Prove exact Audit list/detail GET routes require `audit:read`, all other methods fail, and `/priv/audit/*` has no public upstream.
- [ ] Run tests and confirm they fail against the current Gateway.
- [ ] Commit: `test: lock unified authorization route policy`

### Task 2: Route Operations And Protected Bulletin Surfaces

**Files:**
- Modify: `api-gateway/nginx.conf`
- Modify: `api-gateway/docker-entrypoint-hhc.sh`
- Modify: `api-gateway/scripts/test-operations-routing.sh`
- Modify: `api-gateway/scripts/test-www-routing.sh`
- Modify: `api-gateway/scripts/test-auth-routing.sh`
- Modify: `api-gateway/docs/openapi.yaml`

- [ ] Add the Operations Dapr app ID/upstream and route exact `/api/operations/*`, `/api/admin/operations/*`, meetings, and occurrence surfaces.
- [ ] Include exact self-service Resource availability/request/cancel and Admin
  Meeting/Resource/Reservation routes from the released Operations OpenAPI.
  Require authentication but no global Operations permission at the edge;
  `operations-api` enforces global permission OR matching scoped operational
  role for the target OrgUnit.
- [ ] Add only `GET /api/admin/audit/events` and `GET /api/admin/audit/events/{eventId}` to the Audit upstream.
- [ ] Route protected bulletin member endpoints to `hhc-web-api` with trusted subject context.
- [ ] Remove public bulletin and old member-access switch routes.
- [ ] Keep permission-specific or global-or-scoped owner-policy enforcement in
  downstream APIs.
- [ ] Run Gateway CI parity, image runtime route tests, and API catalog validation.
- [ ] Commit: `feat: route unified operations and member access`

### Task 3: Admit Operations Infrastructure

**Files:**
- Modify: `azure-infra/container_apps.tf`
- Modify: `azure-infra/postgresql.tf`
- Modify: `azure-infra/identity.tf`
- Modify: `azure-infra/key_vault.tf`
- Modify: `azure-infra/diagnostics.tf`
- Modify: `azure-infra/README.md`

- [ ] Use the existing flat Terraform root; do not add a module or a second deployment path.
- [ ] Provision private PostgreSQL connectivity, secrets by reference, Dapr app identity, internal ingress, health probes, logs, and least-privilege caller allowlists.
- [ ] Do not expose the database, internal entitlement route, Dapr token, or service URL to browsers.
- [ ] Run `terraform fmt -check`, `terraform validate`, and a reviewed saved `terraform plan`; save redacted output as evidence.
- [ ] Deploy dark only after explicit infrastructure authorization.
- [ ] Verify revision, readiness, Dapr invocation, and unallowlisted denial.
- [ ] Consume the already dark-deployed Audit owner and Gateway token reference from Audit Task 2; do not recreate Audit database, identity, caller secrets, image publication, or deployment in this task.

### Task 4: Build The Staging Authorization Harness

**Files:**
- Create: `api-gateway/scripts/test-unified-authorization-runtime.sh`
- Create: `api-gateway/docs/operations/unified-authorization-cutover.md`

- [ ] Use named synthetic principals created specifically for each authorization-matrix row; do not reuse real member data.
- [ ] Cover anonymous, authenticated non-member, active/suspended
  qualification, each locale entitlement, Admin-without-membership, every
  global Operations role, every scoped operational role, pastoral-only roles,
  descendant and sibling targets, expired/revoked assignments, wildcard, and
  unallowlisted service.
- [ ] Cover member list, metadata, PDF, derivative, ETag, Range, Resource request/cancel, each granular Operations Admin surface, Audit list/detail, direct Admin URL, and direct API paths. The post-launch structured reader is excluded.
- [ ] Force Account, Operations, Website, and Asset dependency failures and prove protected access fails closed.
- [ ] Cover available authenticated `permissions: []` separately from
      authenticated `permission_unavailable`; neither may become anonymous,
      and unavailable permission state must expose no global staff destination.
      A separately available scoped Operations assignment may expose only its
      matching Operations destination; Operations dependency failure closes
      only the scoped branch.
- [ ] Cover concurrent token issuance, stale 401 fencing, one refresh/one
      original retry, 403 no-refresh, 429 cooldown, hosted-login return, and
      sanitized telemetry for Website, Account, Admin, Presenter Web, and
      Presenter Desktop.
- [ ] Emit status, reason code, request correlation ID, and expected/actual result without tokens or personal data.
- [ ] Require every row pass; no ignored or quarantined authorization test.
- [ ] Commit: `test: add unified authorization staging matrix`

### Task 5: Activate And Verify The Final DSR Owner Registry

**Files:**
- Modify: `api-gateway/docs/operations/unified-authorization-cutover.md`

- [ ] Consume the already implemented and reviewed owner registry from Account Legal Tasks 6-7; do not reimplement its clients, worker, validation, or governance files here.
- [ ] Confirm every required owner endpoint, including Operations, is deployed dark and its allowlisted Account caller succeeds before Account activation.
- [ ] Run unavailable, malformed, wrong-owner, retry, zero-row, repeated-success, DSR erasure, and permanent-deletion smoke with the same bounded owner result and separate workflow state.
- [ ] Record owner/version/result evidence without subject data. Any required owner failure blocks deletion and cutover.

### Task 6: Rehearse Retained-Data And Grant Reconciliation

**Files:**
- Modify: `api-gateway/docs/operations/unified-authorization-cutover.md`

- [ ] Back up disposable staging copies before rehearsal.
- [ ] Record source operations counts/digest, target counts/digest, bulletin issue/version/revision counts, and Asset original/derivative counts.
- [ ] Import operations once and prove repeat attempts reject or remain idempotent without duplication.
- [ ] Run Asset bulletin grant revocation and require zero active public grants.
- [ ] Prove no Account role/member assignment translation occurred.
- [ ] Verify old public URLs fail closed and cache/CDN state no longer serves protected bytes.
- [ ] Document exact roll-forward actions for each failed gate.

### Task 7: Prepare The Coordinated Release Manifest

**Files:**
- Modify: `api-gateway/docs/operations/unified-authorization-cutover.md`

- [ ] Record immutable artifacts and release order:

```text
operations-api dark
audit-log dark
asset-api
engagement-api
account-api cleanup root-cause release, then final RBAC/DSR + hhc-web-api coordinated producer activation
operations-api Resource reservation activation with every Resource disabled
domain audit producers dispatch disabled
frontend-platform packages (already published; verify digest only)
admin-fe / hhc-web / account-fe / hhc-client-v2 / hhc-line-function-bot coordinated consumers
api-gateway Operations/Audit/protected-bulletin route switch
operations source-table removal after counted import
session invalidation and final grant/cache reconciliation
enable one test Resource and audit producers one owner at a time
```

`frontend-platform` is a build-time release and must be published before
consumer PR CI, not for the first time during the production window. The
production manifest verifies its immutable digest. `asset-api` and
`engagement-api` may release earlier only when their changes are backward-safe;
Account, Website API, consumers, and Gateway remain a coordinated incompatible
activation.

- [ ] For each repository record PR, CI, merge authorization, release workflow, deployed revision, health, and functional smoke separately.
- [ ] Confirm no consumer artifact references removed codes or routes.
- [ ] Confirm on-call owner, maintenance message if needed, and roll-forward artifacts are available.
- [ ] Obtain explicit production authorization.

### Task 8: Execute The Breaking Cutover

- [ ] Capture approved backups and pre-cutover counts.
- [ ] Deploy only the reviewed immutable artifacts in manifest order.
- [ ] Import and verify the operations kernel before switching route ownership.
- [ ] Revoke bulletin public grants and purge public cache/CDN entries before enabling protected member access.
- [ ] Switch Gateway routes and remove old public routes.
- [ ] Invalidate existing test sessions and sign in with newly assigned test roles/qualification/entitlements.
- [ ] Run the full runtime authorization matrix.
- [ ] Run permanent-deletion and DSR partial-owner/retry smoke before enabling any feature that introduces another subject-linked owner.
- [ ] Stop immediately on any count mismatch, public byte exposure, cross-scope allow, or non-fail-closed dependency behavior; use the documented roll-forward path.

### Task 9: Production Acceptance

- [ ] Verify deployed revisions and health independently for every service and frontend.
- [ ] Verify public old bulletin URLs from an unauthenticated network and browser cache state.
- [ ] Verify Bulletin Viewer/Editor Admin isolation with direct navigation and API calls.
- [ ] Verify entitlement revocation becomes effective on the next protected request.
- [ ] Verify global Meeting Editor, Resource Editor, and Reservation Approver
  church-wide behavior; scoped Meeting Manager, Resource Manager, and
  Reservation Approver descendant access and sibling denial; pastoral-only
  denial; and Membership Manager/Audit Reader sibling-route/API isolation.
- [ ] Verify an authenticated non-member cannot request a Resource, an eligible active member can request only in policy scope, and every real Resource remains disabled until explicitly approved.
- [ ] Verify Audit producer backlog/dead-letter state, representative owner events, DSR metadata minimization, query self-audit, and the separately required 24-hour observation gate.
- [ ] Verify real Website, Account, Admin, Presenter, and LINE-user behavior; synthetic probes do not substitute for these checks.
- [ ] Verify optional Website auth, required Account/Admin auth, Presenter Web
      callback, Presenter Desktop deep link, permission-unavailable recovery,
      401/403 behavior, 429 cooldown, sanitized Sentry events, and production
      token rates by host/client ID.
- [ ] Archive redacted evidence and record unresolved gaps. Completion requires no unresolved security, data, contract, release, or client-validation gap.
