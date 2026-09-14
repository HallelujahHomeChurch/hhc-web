# Operations Domain And Entitlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admit `operations-api`, move the existing operations kernel intact, and add organization membership, scoped roles, qualification, entitlements, and the shared access projection.

**Architecture:** Reuse the minimal Go/PostgreSQL/`net/http` shape already proven in `hhc-web-api`; do not build a generic authorization service or DSL. `operations-api` owns operations facts, exposes one subject access projection, and answers exact entitlement checks for allowlisted services.

**Tech Stack:** Go 1.25, PostgreSQL 17, `net/http`, OpenAPI, Dapr, Azure Container Apps.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- Creating a repository or cloud service is an external mutation and requires explicit authorization.
- Preserve existing operations IDs and history through counted export/import; do not use runtime cross-schema reads or dual-read.
- The service trusts only gateway/Dapr-injected identity and allowlisted service identity.
- No custom policy language, role inheritance, per-user-resource permission rows, or speculative workflow tables.

### Task 1: Admit The Minimal Service Foundation

**Files:**
- Create: `operations-api/AGENTS.md`
- Create: `operations-api/README.md`
- Create: `operations-api/go.mod`
- Create: `operations-api/cmd/server/main.go`
- Create: `operations-api/cmd/migrate/main.go`
- Create: `operations-api/internal/config/config.go`
- Create: `operations-api/internal/httpapi/handler.go`
- Create: `operations-api/internal/httpapi/handler_test.go`
- Create: `operations-api/internal/migrations/migrations.go`
- Create: `operations-api/internal/postgres/store.go`
- Create: `operations-api/openapi.yaml`
- Create: `operations-api/Dockerfile`
- Create: `operations-api/.github/workflows/ci.yml`
- Create: `operations-api/.github/workflows/release.yml`

- [ ] After explicit repository authorization, create an isolated repository from current organization defaults; copy only the minimal health/readiness, migration, correlation, release-policy, and trusted-caller patterns.
- [ ] Add failing tests for `/health`, `/ready`, public protected-header rejection, and private caller allowlisting.
- [ ] Implement only the foundation required by those tests.
- [ ] CI must lint OpenAPI, run migration policy, `go test -race ./... -count=1 -p=1`, `go vet ./...`, build/scan the image, and validate release policy.
- [ ] Commit: `chore: admit operations service foundation`

### Task 2: Move The Existing Operations Kernel

**Source files:**
- Source: `hhc-web-api/internal/operations/model.go`
- Source: `hhc-web-api/internal/operations/recurrence.go`
- Source: `hhc-web-api/internal/operations/recurrence_test.go`
- Source: `hhc-web-api/internal/operations/service.go`
- Source: `hhc-web-api/internal/operations/service_test.go`
- Source: `hhc-web-api/internal/postgres/operations_repository.go`
- Source: `hhc-web-api/internal/postgres/operations_repository_integration_test.go`
- Source: `hhc-web-api/internal/httpapi/operations_handlers.go`
- Source: `hhc-web-api/internal/httpapi/operations_handlers_test.go`
- Source: `hhc-web-api/internal/migrations/sql/032_operations_meetings.sql`

**Target files:**
- Create: `operations-api/internal/operations/model.go`
- Create: `operations-api/internal/operations/recurrence.go`
- Create: `operations-api/internal/operations/recurrence_test.go`
- Create: `operations-api/internal/operations/service.go`
- Create: `operations-api/internal/operations/service_test.go`
- Create: `operations-api/internal/postgres/operations_repository.go`
- Create: `operations-api/internal/postgres/operations_repository_integration_test.go`
- Create: `operations-api/internal/httpapi/operations_handlers.go`
- Create: `operations-api/internal/httpapi/operations_handlers_test.go`
- Create: `operations-api/internal/migrations/sql/001_operations_kernel.sql`

- [ ] Port behavior without changing public IDs, keys, recurrence semantics, optimistic concurrency, or collection bindings.
- [ ] Rename `ChurchUnit` to `OrgUnit` and add `kind` with the four canonical values.
- [ ] Add tests for the parent matrix, one root, cycle rejection, and paused/archived write restrictions.
- [ ] Use database constraints for unique root/key invariants and service validation for graph/cycle rules.
- [ ] Run focused operations and repository tests, then the full service suite.
- [ ] Commit: `feat: own church operations kernel`

### Task 3: Add Membership, Qualification, Roles, And Entitlements

**Files:**
- Create: `operations-api/internal/migrations/sql/002_membership_and_entitlements.sql`
- Create: `operations-api/internal/membership/model.go`
- Create: `operations-api/internal/membership/service.go`
- Create: `operations-api/internal/membership/service_test.go`
- Create: `operations-api/internal/postgres/membership_repository.go`
- Create: `operations-api/internal/postgres/membership_repository_integration_test.go`
- Create: `operations-api/internal/httpapi/membership_handlers.go`
- Create: `operations-api/internal/httpapi/membership_handlers_test.go`

- [ ] Add only `OrgMembership`, `OrgRoleAssignment`, `MembershipQualification`, and `EntitlementAssignment` from the spec.
- [ ] Enforce one active primary membership with a partial unique index.
- [ ] Enforce time bounds and status transitions; do not infer qualification from membership, staff role, or email verification.
- [ ] Seed exactly these entitlement definitions:

```text
bulletin.general.zh-Hant.access
bulletin.general.zh-Hans.access
bulletin.general.en.access
```

- [ ] Add Admin routes protected separately by `operations:*` and `memberships:*`.
- [ ] Test cross-OrgUnit denial and compiled descendant rules for leader roles.
- [ ] Write immutable audit rows for every membership, qualification, entitlement, OrgUnit, org-role, resource, meeting, occurrence, override, and binding mutation; preserve actor, request ID, before/after state, and stable resource ID.
- [ ] Commit: `feat: add membership qualification and entitlements`

### Task 4: Add Exact Entitlement Checks And Access Projection

**Files:**
- Create: `operations-api/internal/access/service.go`
- Create: `operations-api/internal/access/service_test.go`
- Create: `operations-api/internal/httpapi/access_handlers.go`
- Create: `operations-api/internal/httpapi/access_handlers_test.go`
- Modify: `operations-api/internal/httpapi/handler.go`
- Modify: `operations-api/openapi.yaml`

- [ ] Implement `POST /priv/operations/entitlement-checks` as one exact subject plus a bounded finite entitlement-code list, returning one decision/reason/version per code; accept only allowlisted callers.
- [ ] Implement `GET /api/operations/me/access` for the trusted authenticated subject.
- [ ] Do not accept email, role names, raw tokens, arbitrary queries, or resource policy expressions.
- [ ] Return stable internal denial reasons but keep public presentation non-disclosing.
- [ ] Return only presentation-safe organization, role, qualification, entitlement, and version data from `/api/operations/me/access`; do not copy Account staff permissions into Operations.
- [ ] Test expired/suspended qualification, entitlement expiry/revocation, unknown codes, dependency errors, and Admin-without-membership denial.
- [ ] Commit: `feat: expose operations access projection`

### Task 5: Add Governance And DSR Ownership

**Files:**
- Create: `operations-api/docs/data-governance.yaml`
- Create: `operations-api/docs/data-governance-scope.md`
- Create: `operations-api/internal/governance/inventory_test.go`
- Create: `operations-api/internal/governance/manifest_test.go`
- Create: `operations-api/internal/dsr/service.go`
- Create: `operations-api/internal/dsr/service_test.go`
- Create: `operations-api/internal/httpapi/dsr_handlers.go`
- Create: `operations-api/internal/httpapi/dsr_handlers_test.go`
- Modify: `operations-api/internal/httpapi/handler.go`
- Modify: `operations-api/openapi.yaml`

- [ ] Inventory every new personal-data field, purpose, class, retention, and DSR behavior.
- [ ] Add allowlisted Account-only `/priv/operations/dsr/exports` and `/priv/operations/dsr/actions` using the existing HHC DSR response contract.
- [ ] Export member-owned records; restriction must prevent new processing; erase/anonymize only where retention and audit rules permit.
- [ ] Never delete shared OrgUnit/Meeting records merely because one subject leaves; detach or redact the subject relationship according to the manifest.
- [ ] Test wrong caller, malformed subject, retry/idempotency, retained audit, and zero unrelated-record mutation.
- [ ] Commit: `feat: govern operations member data`

### Task 6: Counted Kernel Export And Import

**Files:**
- Create: `hhc-web-api/cmd/operations-export/main.go`
- Create: `hhc-web-api/cmd/operations-export/main_test.go`
- Create: `operations-api/cmd/import-hhc-web-operations/main.go`
- Create: `operations-api/cmd/import-hhc-web-operations/main_test.go`
- Create: `operations-api/docs/operations/kernel-migration.md`

- [ ] Export deterministic JSONL ordered by stable ID, with table counts and SHA-256 digest; exclude credentials and unrelated CMS data.
- [ ] Import transactionally and reject duplicates, missing parents, missing bindings, count drift, or digest mismatch.
- [ ] Dry-run against disposable copies and prove IDs, counts, parent links, occurrences, overrides, and bindings match.
- [ ] Do not remove source tables yet.
- [ ] Commit in each owned repository with a migration-specific message.

### Task 7: Remove The Source Kernel After Verified Import

**Files:**
- Modify: `hhc-web-api/cmd/server/main.go`
- Modify: `hhc-web-api/internal/httpapi/handler.go`
- Delete: `hhc-web-api/internal/httpapi/operations_handlers.go`
- Delete: `hhc-web-api/internal/operations/`
- Delete: `hhc-web-api/internal/postgres/operations_repository.go`
- Create: `hhc-web-api/internal/migrations/sql/048_remove_operations_kernel.sql`
- Modify: `hhc-web-api/openapi.yaml`

- [ ] Start only after the target import passes counts/digest and the Gateway route owner is staged.
- [ ] Remove runtime ownership and route definitions from `hhc-web-api`.
- [ ] Drop source tables only in the coordinated cutover after backup and import verification.
- [ ] Run `go test -race ./... -count=1 -p=1`, `go vet ./...`, OpenAPI lint, migration-policy tests, and image build.
- [ ] Commit: `refactor: complete operations kernel extraction`

### Task 8: PR And Release Stop Gate

- [ ] Keep the new service and `hhc-web-api` extraction PRs independently reviewable.
- [ ] Release `operations-api` dark first with no public Gateway ownership.
- [ ] Do not merge source-kernel removal until import, route switch, and rollback/roll-forward rehearsal are approved.
