# Account Legal Operations Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and activate the minimal Account legal-operations baseline with visible notice, versioned acceptance, DSR, bounded manual retention, incident handling, and a processor register.

**Architecture:** Reuse the released Account policy and DSR contracts. Add only a small informational notice in Account FE, factual operational documents in HHC Web, versioned Account API production configuration, and the existing Asset manual retention apply gate. Each repository releases independently through its existing CI/CD workflow.

**Tech Stack:** React 19, TypeScript 6, Vitest, Go 1.25, Azure Bicep, Azure Container Apps, GitHub Actions, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-07-account-legal-operations-rebaseline-design.md`

**Status:** Tasks 1-5 record delivered runtime/documentation evidence. The
pre-launch program remains open for Tasks 6-8: permanent-deletion root cause,
new DSR owner integration, and external legal/retention closure.

## Global Constraints

- No new service, database, API, Admin screen, dependency, or global scheduler.
- Never send a policy acceptance payload while server enforcement is false.
- Never erase an existing member account for testing.
- Retention applies only to the existing `line.group.media-sync` and `hhc-line-function-bot` predicate; recurring scheduling remains false.
- Never print or commit the DSR subject-reference key.
- Every repository uses a separate branch, PR, required CI, squash merge, release, and live verification.
- DSR case management and permanent deletion may invoke the same owner erasure contract, but they remain separate workflows and audit records.
- A cleanup failure never deletes the Account. It must identify the failing owner/step internally without exposing personal data or downstream bodies to the browser.

---

### Task 1: Account collection notice

**Repository:** `account-fe`

**Files:**
- Modify: `src/components/LegalAcceptance.tsx`
- Modify: `src/components/LegalAcceptance.test.tsx`
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/RegisterPage.test.tsx`
- Modify: `src/pages/OAuthOnboardingPage.tsx`
- Modify: `src/pages/OAuthOnboardingPage.test.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `readRuntimeConfig().publicSiteUrl`, `useLocale()`, and existing capability policy response.
- Produces: `PrivacyCollectionNotice`, an informational localized link with no input and no API payload.

- [x] Add focused tests asserting the Privacy Notice link is present when `policy.enforced=false` on registration and OAuth onboarding, and that completion still omits `policy`.
- [x] Run the focused tests and confirm they fail because the link is absent.
- [x] Add the minimal localized `PrivacyCollectionNotice` and render it at both collection flows while preserving `LegalAcceptance` only for enforced policy.
- [x] Run focused tests, then `corepack pnpm test:run`, `corepack pnpm lint`, and `corepack pnpm build`.
- [x] Commit, push, open a PR, obtain review, wait for required CI, squash merge, wait for Production Release, and verify the live localized link.

### Task 2: Legal operations and counsel packet

**Repository:** `hhc-web`

**Files:**
- Modify: `docs/superpowers/specs/2026-09-07-account-legal-operations-rebaseline-design.md`
- Create: `docs/runbooks/privacy-requests.md`
- Modify: `docs/runbooks/platform-incident-command.md`
- Modify: `docs/runbooks/README.md`
- Create: `docs/governance/processor-register.md`
- Create: `docs/governance/account-legal-review-v1.md`
- Create: `docs/operations/account-legal-launch-evidence.md`

**Interfaces:**
- Consumes: current public Terms/Privacy URLs and publication versions, service-owned governance manifests, existing incident severity rules, and production provider configuration.
- Produces: operator-ready DSR intake, personal-data incident checklist/tabletop, factual processor register, counsel questions, and a launch evidence ledger.

- [x] Write the DSR runbook with intake, identity verification, statutory decision clocks, owner progress, refusal/exception, response, and escalation fields.
- [x] Add the incident checklist and a completed synthetic tabletop using no real personal data.
- [x] Add processor entries for Azure, Cloudflare Turnstile, Sentry, Google, Microsoft, LINE, Azure Communication Services email, and browser Web Push, marking unverified contractual facts `pending_external_review`.
- [x] Record the current legal draft versions, official Taiwan PDPA review basis, unresolved counsel questions, and live URLs without claiming legal approval.
- [x] Add the launch evidence ledger and run `git diff --check`, Markdown link/path checks, placeholder scan, `corepack pnpm test:run`, `corepack pnpm lint`, and `corepack pnpm build`.
- [x] Commit, push, open a docs PR, obtain review, wait for required CI, and squash merge. Confirm no runtime release is required for docs-only changes.

### Task 3: Account policy and DSR activation

**Repository:** `account-api`

**Files:**
- Modify: `infra/main.bicep`
- Modify: `scripts/test-release-policy.sh`
- Modify: `docs/DEPLOYMENT.md`

**Interfaces:**
- Consumes: Key Vault secret `account-dsr-subject-hmac-key`, current public Terms and Privacy versions, and the released DSR owner clients.
- Produces: production `POLICY_ACCEPTANCE_ENFORCED=true`, `DSR_ENABLED=true`, `TERMS_VERSION=terms-2026-09-07`, and `PRIVACY_NOTICE_VERSION=privacy-2026-09-11`.

- [x] Update the release-policy test first to require the enabled flags, exact versions, and a Key Vault-backed DSR secret reference; run it and confirm failure.
- [x] Add the smallest Bicep environment and secret wiring, update deployment documentation, then rerun the focused test.
- [x] Run `go test ./... -count=1`, `go vet ./...`, release-policy scripts, and `az bicep build --file infra/main.bicep --stdout`.
- [x] Generate and store the 32-byte-or-longer DSR key directly in Key Vault without printing it; verify only secret metadata.
- [x] Commit, push, open a PR, obtain review, wait for required CI, squash merge, and wait for Production Release.
- [x] Verify the immutable deployed revision, readiness, live capability response, public policy URLs, enforced registration behavior, and authenticated DSR navigation/API access.

### Task 4: Asset bounded manual retention activation

**Repository:** `asset-api`

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/test-release-workflow.sh`
- Modify: `infra/README.md`
- Modify: `docs/data-governance-scope.md`

**Interfaces:**
- Consumes: existing `asset-retention` job, fixed repository selection predicate, and dry-run output.
- Produces: `RETENTION_APPLY_ENABLED=true` with `RETENTION_SCHEDULE_ENABLED=false`.

- [x] Change the workflow-policy test first to require manual apply enabled and schedule disabled; run it and confirm failure.
- [x] Update workflow constants and factual documentation; do not change the worker selection predicate or schedule.
- [x] Run the release-policy test, `go test ./... -count=1` with repository-required PostgreSQL configuration, `go vet ./...`, and `az bicep build --file infra/main.bicep --stdout`.
- [x] Commit, push, open a PR, obtain review, wait for required CI, squash merge, and wait for Production Release.
- [x] Verify the job remains Manual and apply is true, start one bounded apply execution, and record selected/deleted/skipped/failed/backlog counts.
- [x] Do not enable recurring scheduling; if any failure or unexpected scope appears, stop and preserve the job and evidence for idempotent retry.

### Task 5: Final production reconciliation

**Repositories:** all four delivery repositories

**Files:**
- Modify: `hhc-web/docs/operations/account-legal-launch-evidence.md`

**Interfaces:**
- Consumes: PR URLs, merge SHAs, release run IDs, deployed revisions/images, live capability responses, DSR smoke, and retention result counts.
- Produces: one final evidence record separating code, CI, release, live, authenticated, and destructive-operation gates.

- [x] Record every PR, CI, merge, release, deployed revision/image, and smoke result without secrets or personal data.
- [x] Reconcile all checklist items against the spec; leave any unavailable authenticated or mailbox evidence explicitly open rather than calling it complete.
- [x] Commit the evidence update through a final HHC Web docs PR and required CI.

### Task 6: Diagnose And Fix Permanent-Deletion Cleanup

**Repository:** `account-api`

**Files:**
- Modify: `internal/services/user_service.go`
- Modify: `internal/services/user_service_test.go`
- Modify: `internal/handlers/admin_user_handler.go`
- Modify: `internal/handlers/admin_user_handler_test.go`
- Modify: `internal/engagementclient/client.go`
- Modify: `internal/engagementclient/client_test.go`
- Modify: `internal/services/avatar_service.go`
- Modify: `internal/services/avatar_service_test.go`

**Interfaces:**
- Consumes: existing session revoke, newsletter unsubscribe, push revoke, and avatar removal calls.
- Produces: one typed internal cleanup failure containing a fixed owner/step code, bounded failure category, downstream status when available, and request ID; public response remains non-sensitive.

- [ ] Write a table-driven failing test for each current cleanup step and assert no Account delete occurs after any failure. Require the internal error/log fields to name only `sessions`, `newsletter`, `push`, or `avatar`, never a URL, token, email, body, or asset key.
- [ ] Preserve the existing public `409 ACC_ACCOUNT_DELETE_CLEANUP` compatibility for this diagnostic release while emitting the typed internal step and request correlation. Do not guess the failing adapter from the generic status.
- [ ] Deploy the backward-safe diagnostic release, reproduce or correlate one authorized deletion attempt, and record only the step, category, status, request ID, revision, and time.
- [ ] Fix only the evidenced adapter/root cause, add its focused regression and sibling-caller test, then verify idempotent retry completes every cleanup before Account deletion.
- [ ] Run `go test -race ./... -count=1 -p=1`, `go vet ./...`, governance, migration, OpenAPI, and release-policy checks; release and live-smoke through the normal Account workflow.
- [ ] After the new owner-orchestration contract in Task 7 is active, replace the generic public response with its reviewed bounded owner-result model in one coordinated contract release; do not add ad-hoc per-owner response fields.

### Task 7: Register Every DSR And Erasure Owner

**Repositories:** `operations-api`, `account-api`, and each retained personal-data owner

**Files:**
- Create: `account-api/internal/operationsclient/client.go`
- Create: `account-api/internal/operationsclient/client_test.go`
- Modify: `account-api/internal/services/dsr_worker.go`
- Modify: `account-api/internal/services/dsr_worker_test.go`
- Modify: `account-api/internal/tests/dsr_integration_test.go`
- Modify: `account-api/internal/dsrcontract/validation.go`
- Modify: `account-api/docs/data-governance.yaml`

- [ ] Inventory the final owner registry from governance manifests; require export and supported action behavior for Account, Engagement, Asset, HHC Web, Operations, and any other owner that actually stores subject-linked data. Do not create a speculative owner.
- [ ] Add Operations only after its private DSR endpoints are deployed dark. Preserve partial-failure state and one result per owner; unknown/missing/malformed owner results fail closed.
- [ ] Make DSR erasure and permanent deletion reuse the same idempotent owner action client and bounded result type while retaining separate case/lifecycle orchestration.
- [ ] Verify zero-row and repeated erasure success, retention/anonymization exceptions, unavailable owner retry, no unrelated-record mutation, and no Account deletion before all required owner cleanups succeed.
- [ ] Emit central Audit events only for Admin DSR decisions/retries/resolution; owner export/action payload and personal data never enter central audit metadata.

### Task 8: Close External Legal And Retention Gates

**Repository:** `hhc-web`

**Files:**
- Modify: `docs/governance/account-legal-review-v1.md`
- Modify: `docs/governance/processor-register.md`
- Modify: `docs/operations/account-legal-launch-evidence.md`

- [ ] Obtain and record counsel disposition for controlling language, minors/guardian treatment, DSR timing/exceptions, policy-version binding, and retention/legal-hold rules without converting engineering notes into legal approval.
- [ ] Close or explicitly block every `pending_external_review` processor/DPA/region/subprocessor item with dated owner evidence.
- [ ] Reconcile governance manifests, actual retention jobs, DSR owner registry, deletion smoke, central Audit decision coverage, public policy versions, and live authenticated request behavior.
- [ ] Launch legal/DSR readiness requires every required external disposition and technical gate; delivered pages or enabled flags alone are insufficient.
