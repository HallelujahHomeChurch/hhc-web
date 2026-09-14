# Edge, Integration, And Coordinated Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route the new service and protected surfaces correctly, prove the full authorization matrix, then execute one authorized breaking production cutover without restoring public bulletin access.

**Architecture:** Gateway performs authentication, strips untrusted identity headers, injects trusted subject/service context, and routes by exact host/path/method. Feature services keep fine-grained authorization. Operations deploys dark before ownership switches; production changes happen in one controlled window after staging proof.

**Tech Stack:** Nginx, Go JWT verifier, Dapr, OpenAPI catalog, Azure Container Apps, Terraform, GitHub Actions.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- No Gateway route, infrastructure, merge, release, session reset, or production data mutation without explicit authorization.
- Gateway owns coarse authentication and routing only; it must not evaluate organization or entitlement policy.
- Old public bulletin routes fail closed with no redirect or legacy upstream.
- Roll forward from immutable artifacts; rollback must never reopen bulletin public access.

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
- [ ] Prove `/priv/*` remains unreachable from public hosts.
- [ ] Prove old `/api/bulletins*` routes have no upstream and protected `/api/member/bulletins*` requires authentication.
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
- [ ] Route protected bulletin member endpoints to `hhc-web-api` with trusted subject context.
- [ ] Remove public bulletin and old member-access switch routes.
- [ ] Keep permission-specific Admin enforcement in downstream APIs.
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

### Task 4: Build The Staging Authorization Harness

**Files:**
- Create: `api-gateway/scripts/test-unified-authorization-runtime.sh`
- Create: `api-gateway/docs/operations/unified-authorization-cutover.md`

- [ ] Use named synthetic principals created specifically for each authorization-matrix row; do not reuse real member data.
- [ ] Cover anonymous, authenticated non-member, active/suspended qualification, each locale entitlement, Admin-without-membership, all scoped staff roles, leader cross-scope denial, expired operator, and unallowlisted service.
- [ ] Cover list, metadata, online-reader, PDF, derivative, ETag, Range, direct Admin URL, and direct API paths.
- [ ] Force Account, Operations, Website, and Asset dependency failures and prove protected access fails closed.
- [ ] Emit status, reason code, request correlation ID, and expected/actual result without tokens or personal data.
- [ ] Require every row pass; no ignored or quarantined authorization test.
- [ ] Commit: `test: add unified authorization staging matrix`

### Task 5: Register Operations As A DSR Owner

**Files:**
- Create: `account-api/internal/operationsclient/client.go`
- Create: `account-api/internal/operationsclient/client_test.go`
- Modify: `account-api/internal/services/dsr_worker.go`
- Modify: `account-api/internal/services/dsr_worker_test.go`
- Modify: `account-api/internal/tests/dsr_integration_test.go`
- Modify: `account-api/internal/dsrcontract/validation.go`
- Modify: `account-api/docs/data-governance.yaml`

- [ ] Add Operations export and action clients using the established owner contract and caller authentication.
- [ ] Include Operations in access export, correction/restriction where supported, and erasure orchestration without weakening partial-failure reporting.
- [ ] Test unavailable, malformed, wrong-owner, retry, and successful owner results.
- [ ] Release this Account integration only inside the coordinated window, after Operations DSR endpoints are deployed dark.
- [ ] Commit: `feat: include operations in account data requests`

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
account-api
hhc-web-api
asset-api
frontend-platform packages
admin-fe / hhc-web / account-fe / hhc-client-v2 / hhc-line-function-bot
api-gateway route switch
operations source-table removal after counted import
session invalidation and final grant/cache reconciliation
```

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
- [ ] Stop immediately on any count mismatch, public byte exposure, cross-scope allow, or non-fail-closed dependency behavior; use the documented roll-forward path.

### Task 9: Production Acceptance

- [ ] Verify deployed revisions and health independently for every service and frontend.
- [ ] Verify public old bulletin URLs from an unauthenticated network and browser cache state.
- [ ] Verify Bulletin Viewer/Editor Admin isolation with direct navigation and API calls.
- [ ] Verify entitlement revocation becomes effective on the next protected request.
- [ ] Verify Page Settings Editor, News Editor, Operations Editor, and Membership Manager separation.
- [ ] Verify real Website, Account, Admin, Presenter, and LINE-user behavior; synthetic probes do not substitute for these checks.
- [ ] Archive redacted evidence and record unresolved gaps. Completion requires no unresolved security, data, contract, release, or client-validation gap.
