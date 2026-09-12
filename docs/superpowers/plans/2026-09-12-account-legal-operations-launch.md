# Account Legal Operations Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and activate the minimal Account legal-operations baseline with visible notice, versioned acceptance, DSR, bounded manual retention, incident handling, and a processor register.

**Architecture:** Reuse the released Account policy and DSR contracts. Add only a small informational notice in Account FE, factual operational documents in HHC Web, versioned Account API production configuration, and the existing Asset manual retention apply gate. Each repository releases independently through its existing CI/CD workflow.

**Tech Stack:** React 19, TypeScript 6, Vitest, Go 1.25, Azure Bicep, Azure Container Apps, GitHub Actions, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-07-account-legal-operations-rebaseline-design.md`

## Global Constraints

- No new service, database, API, Admin screen, dependency, or global scheduler.
- Never send a policy acceptance payload while server enforcement is false.
- Never erase an existing member account for testing.
- Retention applies only to the existing `line.group.media-sync` and `hhc-line-function-bot` predicate; recurring scheduling remains false.
- Never print or commit the DSR subject-reference key.
- Every repository uses a separate branch, PR, required CI, squash merge, release, and live verification.

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
