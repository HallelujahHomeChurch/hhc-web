# PR CI And Automatic Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require the documented branch/PR workflow, run CI on every pull request, and automatically build and deploy each production service after merge to `main`.

**Architecture:** Keep each repository's existing CI and production release implementation. Add only missing PR CI, update GitHub Actions to Node 24 runtimes, and add `push: main` to deployable release workflows while retaining `workflow_dispatch` for controlled redeploys. Deploy immutable ACR digests and preserve each repository's existing health checks and rollback behavior.

**Tech Stack:** GitHub Actions, Azure OIDC, Azure Container Apps, Azure Container Registry, Go, pnpm, Docker, Nginx.

## Global Constraints

- Do not push directly to `main`; use the existing `codex/ci-delivery-policy` PR in each repository.
- CI must pass before squash merge.
- Do not introduce a shared workflow framework in this change.
- `asset-api` production remains `ASSET_SCAN_DISPATCH_ENABLED=true` and `ASSET_EMBEDDED_SCAN_ENABLED=false`.
- `frontend-platform` remains a package repository: CI on PR/main and publishing only from version tags.
- Preserve immutable image resolution, health checks, and rollback steps already present in release workflows.

---

### Task 1: Complete Repository Policy Files

**Files:** `AGENTS.md` in all nine scoped repositories; existing `README.md` files remain unchanged.

- [x] Add the pull-request-only delivery policy without replacing repository-specific instructions.
- [x] Verify every scoped repository has both `README.md` and `AGENTS.md`.
- [x] Commit and push each change to `codex/ci-delivery-policy`, then open a PR.

### Task 2: Add Missing Pull Request CI

**Files:**
- Create: `notification-api/.github/workflows/ci.yml`
- Create: `api-gateway/.github/workflows/ci.yml`

- [ ] Copy only the existing release verification job into a `pull_request` CI workflow.
- [ ] For `notification-api`, run PostgreSQL-backed unit/integration tests, `go vet`, and `scripts/release-static.test.sh`.
- [ ] For `api-gateway`, run Go tests/vet, auth/www routing tests, release policy tests, and shell syntax checks.
- [ ] Parse both workflow files as YAML and run their verification commands locally where available.

### Task 3: Upgrade Remaining GitHub Actions

**Files:** `.github/workflows/*.yml` in `frontend-platform`, `account-api`, `asset-api`, `notification-api`, and any scoped workflow still using a Node 20 action.

- [ ] Pin `actions/checkout`, `actions/setup-node`, `actions/setup-go`, and `azure/login` to the already verified Node 24 release SHAs.
- [ ] Scan all scoped workflows and confirm no older reference remains.
- [ ] Parse every changed workflow and run `git diff --check`.

### Task 4: Enable Automatic Main Deployment

**Files:** `.github/workflows/release.yml` in `hhc-web`, `account-fe`, `admin-fe`, `hhc-web-api`, `account-api`, `asset-api`, and `api-gateway`; preserve the existing automatic `notification-api` workflow.

- [ ] Add `push` on `main` to each deployable release workflow.
- [ ] Preserve `workflow_dispatch` and its confirmation input for manual redeploys.
- [ ] On push events, derive the expected confirmation value internally; on manual events, require the operator-provided value.
- [ ] For `asset-api`, derive `ACTIVATE_QUEUE_SCANNING=true` on push while keeping an explicit manual boolean input.
- [ ] Keep production concurrency non-cancelling and retain all existing migration, smoke, and rollback jobs.

### Task 5: Validate And Update Pull Requests

- [ ] Run YAML parsing and repository-specific workflow policy tests.
- [ ] Confirm each branch is clean and tracks its remote branch.
- [ ] Commit focused workflow changes in each repository and push to the existing PR.
- [ ] Wait for every reported PR check; do not merge a failing or missing CI workflow.

### Task 6: Squash Merge And Production Verification

- [ ] Squash merge backend dependencies first: `asset-api`, `notification-api`, `account-api`, `hhc-web-api`, `api-gateway`.
- [ ] Squash merge frontend packages and apps: `frontend-platform`, `account-fe`, `admin-fe`, `hhc-web`.
- [ ] Watch every automatic production release to completion before advancing to the next dependent service.
- [ ] Verify local `main`, `origin/main`, release `head_sha`, ACA revision readiness, and production health routes.
- [ ] Confirm failed-release rollback paths remain skipped during successful releases.

### Task 7: Follow-up Operations

- [ ] After GitHub releases are proven, disable duplicate Azure DevOps triggers for `hhc-web-api` and `api-gateway`; retain pipeline definitions for one rollback window before deletion.
- [ ] Add a lightweight scheduled audit that reports scoped repos lacking PR CI or automatic main CD only if process drift becomes recurring.
- [ ] Revisit enforceable GitHub rulesets only if the organization plan changes; `AGENTS.md` remains the operational rule meanwhile.
