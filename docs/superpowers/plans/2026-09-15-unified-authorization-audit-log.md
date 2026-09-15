# Central Admin Audit Log Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the reviewed central Admin audit implementation without reintroducing legacy permissions, CMS ownership, or an audit BFF, then prove durable owner events and `audit:read` isolation before launch.

**Architecture:** `audit-log` owns an append-only event catalog and bounded query API. Domain services commit business state and a minimal audit outbox in the same database transaction, then deliver privately and idempotently. Admin Browser queries `audit-log` through one exact authenticated Gateway route; `hhc-web-api` is not an append/query BFF. Audit records DSR Admin decisions, while Account/DSR remains the case and erasure orchestrator.

**Tech Stack:** Go 1.25, PostgreSQL 17, Dapr, Azure Container Apps, Nginx, OpenAPI, TypeScript, React, Vitest.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- The 37-commit `feat/admin-audit-log` branch is salvage input, not a merge-ready release. Rebase reviewed commits onto fresh `origin/main`; do not merge stale producer branches wholesale.
- Resolve the paused Gitleaks baseline through the required dual review before any push or PR. Never weaken secret detection to admit historical findings.
- `audit:read` is the only human Audit permission and `audit_reader` is its default role. Append credentials are private service identity, never a human permission or capability-table choice.
- Business mutation success must not depend on synchronous Audit availability. The owning transaction commits its outbox; delivery retries later. Audit query may return `503` when unavailable.
- Do not log tokens, cookies, contact identifiers, request bodies, file content, DSR exports, private URLs, raw query values, or unrestricted metadata.
- Existing local audit tables/history remain. Do not dual-read or migrate them into the new service during this breaking RBAC cutover.
- Each repository retains an independent branch, PR, CI, merge, release, revision, and live verification gate.

### Task 1: Rebase And Reverify The Audit Owner

**Files:**
- Reuse from `feat/admin-audit-log`: `cmd/audit-log/`, `cmd/migrate/`, `cmd/catalog/`, `internal/audit/`, `internal/httpapi/`, `internal/migrations/`, `internal/postgres/`, `docs/openapi.yaml`, `docs/v1-event-catalog.json`, `Dockerfile`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- Modify after rebase only where current APIs or security policy require it.

**Interfaces:**
- Produces: `POST /priv/audit/events`, `GET /api/admin/audit/events`, `GET /api/admin/audit/events/{eventId}`, immutable v1 event catalog artifact and SHA-256.

- [ ] Create a fresh Audit worktree from current `origin/main`, cherry-pick/rebase only the central storage, validation, query, catalog, CI, and release commits; leave producer/BFF assumptions behind.
- [ ] Complete two independent Gitleaks-baseline reviews, record both results, and require no unreviewed credential candidate.
- [ ] Run catalog drift, OpenAPI, migration, auth, redaction, duplicate/conflict, query-limit, retention, PostgreSQL integration, race, vet, image, and release-policy checks.
- [ ] Prove same `eventId` plus canonical payload is duplicate, different payload is conflict, unknown action/metadata fails closed, and no update/delete event API exists.
- [ ] Commit the rebased owner as one reviewable Audit foundation series; do not push or create the repository without explicit authorization.

### Task 2: Publish The Final Audit Contract

**Files:**
- Modify: `audit-log/internal/audit/catalog.go`
- Modify: `audit-log/internal/audit/catalog_test.go`
- Modify: `audit-log/docs/v1-event-catalog.json`
- Modify: `audit-log/docs/openapi.yaml`
- Modify: `audit-log/docs/openapi_test.go`

- [ ] Rename Operations actions from `cms.operation.*` to owner-correct `operations.meeting.*`, `operations.resource.*`, `operations.reservation.*`, `operations.maintenance.*`, `operations.membership.*`, and `operations.entitlement.*` before any producer pins the catalog.
- [ ] Keep DSR actions limited to Admin list/read/approve/reject/retry/resolve decisions. User intake, export content, and owner execution payloads remain outside central event metadata.
- [ ] Generate the immutable catalog artifact and checksum; every producer vendors only its exact released subset fixture and checksum for contract tests.
- [ ] Release `audit-log` dark before enabling any producer dispatch or public query route.

### Task 3: Rebase Domain Producers On Their New Owners

**Repositories:** `account-api`, `operations-api`, `hhc-web-api`, `engagement-api`, `asset-api`, `hhc-line-function-bot`

**Files:** each owner's existing mutation transaction/repository, one minimal `audit_outbox` migration only when no reusable generic outbox exists, dispatcher, typed catalog fixture, configuration, governance manifest, and focused tests.

- [ ] Reimplement or selectively port producer changes from fresh `origin/main`; never merge the stale Account, HHC Web, Gateway, or frontend Audit branches wholesale.
- [ ] Account owns authentication, IAM, RBAC, and DSR Admin-decision events. Operations owns OrgUnit, Meeting, Resource, reservation, maintenance, membership, qualification, and entitlement events. HHC Web owns pages/news/bulletins. Engagement owns direct campaign/schedule administration. Asset/LINE own only their direct Asset Library and Media Sync mutations.
- [ ] For each committed mutation, write business state and exactly one deterministic outbox event in the same PostgreSQL transaction. Reads that policy requires auditing must durably enqueue before returning success; fixed exclusions must have zero-event tests.
- [ ] Dispatch with bounded retry for network/429/5xx, terminal handling for validated 4xx, idempotent replay, oldest-pending/dead-letter metrics, and no payloads in operational logs.
- [ ] Keep Gateway permission-denial emission best effort with its existing structured security log as outage fallback; Gateway has no durable store.
- [ ] Run each repository's complete required CI parity and keep dispatch disabled until the dark Audit endpoint, caller token, catalog checksum, and Dapr allowlist are verified.

### Task 4: Expose The Exact Audit Query Contract

**Files:**
- Modify: `api-gateway/nginx.conf`
- Modify: `api-gateway/docker-entrypoint-hhc.sh`
- Modify: `api-gateway/docs/openapi.yaml`
- Modify: `api-gateway/docs/openapi_test.go`
- Modify: `api-gateway/scripts/test-auth-method-matrix.sh`

- [ ] Add only exact Admin-host GET routes `/api/admin/audit/events` and `/api/admin/audit/events/{eventId}` to the Audit upstream. Require verified `audit:read`; reject all other methods and keep `/priv/audit/*` unreachable.
- [ ] Require `audit-log` to recheck trusted Gateway scope and `audit:read`; Gateway UX/coarse denial never replaces owner enforcement.
- [ ] Freeze list/detail/filter/cursor/error schemas for the Frontend plan. The Admin implementation, `auditLog -> audit:read` capability, redirect, page, and accessibility tests are owned once by Frontend Tasks 2-3; do not duplicate them here.
- [ ] Verify querying Audit creates one `audit.query.read` self-event without recursive event generation.

### Task 5: Stage, Release, And Observe

- [ ] Prove positive `audit_reader`, negative no-permission, wildcard, direct-route, forged-header, wrong-caller, and Audit-unavailable cases in staging.
- [ ] Enable producer dispatch one owner at a time after its catalog fixture and outbox backlog checks pass; do not enable all producers as one opaque switch.
- [ ] Verify one representative event and one denial per owner, DSR decision events without case content, query self-audit, retry without duplicates, zero dead letters, and no legacy `cms.operation.*` event.
- [ ] Require a continuous 24-hour reviewed observation window with no release/config churn, dead letter, catalog conflict, missing telemetry, query failure, or accepted forged provenance.
- [ ] Record PR/CI/merge/release/revision/live evidence per repository. Hide the Audit UI route first on rollback; preserve Audit rows and producer outboxes.
