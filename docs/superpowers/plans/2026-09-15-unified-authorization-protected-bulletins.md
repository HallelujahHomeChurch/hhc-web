# Protected Bulletin And Asset Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every historical and future electronic bulletin member-only, authorize exact series/locale entitlements, and eliminate public routes, public grants, and human Asset-permission coupling.

**Architecture:** `hhc-web-api` authenticates the subject, obtains an exact entitlement result from `operations-api`, checks bulletin publication and asset lifecycle, then streams through `asset-api`'s private owner-authorized path. `asset-api` owns byte safety and permanently rejects public grants for protected bulletin namespaces.

**Tech Stack:** Go 1.25, PostgreSQL 17, `net/http`, Dapr service invocation, TypeScript/Fastify LINE bot.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- Begin only after the operations entitlement-check contract is frozen and the operations-kernel `hhc-web-api` owner has finished.
- Preserve bulletin issues, versions, PDFs, revisions, watermark evidence, scans, and audit data.
- Remove all public access state and compatibility behavior; do not redirect old public URLs.
- Authorize before returning existence, ETag, range metadata, derivative metadata, or bytes.
- `cms:bulletins:*` never satisfies member bulletin access.

### Task 1: Replace Staff Permission Gates And Asset Coupling

**Files:**
- Modify: `hhc-web-api/internal/httpapi/handler.go`
- Modify: `hhc-web-api/internal/httpapi/handler_test.go`
- Modify: `hhc-web-api/internal/httpapi/translation_handlers_test.go`
- Modify: `hhc-web-api/internal/httpapi/content_handlers.go`
- Modify: `hhc-web-api/internal/httpapi/content_handlers_test.go`
- Modify: `hhc-web-api/internal/httpapi/site_settings_handlers.go`
- Modify: `hhc-web-api/internal/httpapi/site_settings_handlers_test.go`
- Modify: `hhc-web-api/internal/httpapi/auth.go`

- [ ] First add route-table tests for exact Page Settings, News, Bulletin, and
  Campaign permissions, and assert the extracted Operations routes are absent
  from `hhc-web-api`.
- [ ] Require `cms:bulletins:read/write/publish/investigate` on bulletin routes.
- [ ] Require `cms:pages:*` for site settings, fixed pages, history, videos, and their embedded asset actions.
- [ ] Require `cms:news:*` for news and its embedded asset actions.
- [ ] Remove `assets:read/write` from embedded upload/status/retry/complete route requirements.
- [ ] Remove every Campaign fallback to `cms:*`.
- [ ] Keep owner ID, namespace, MIME, size, scan, and lifecycle validation before internal Asset calls.
- [ ] Run `go test ./internal/httpapi ./internal/publication -count=1`.
- [ ] Commit: `feat: enforce granular cms permissions`

### Task 2: Add The Operations Entitlement Client

**Files:**
- Create: `hhc-web-api/internal/operationsclient/client.go`
- Create: `hhc-web-api/internal/operationsclient/client_test.go`
- Modify: `hhc-web-api/internal/config/config.go`
- Modify: `hhc-web-api/internal/config/config_test.go`
- Modify: `hhc-web-api/cmd/server/main.go`

- [ ] Implement one method:

```go
type EntitlementChecker interface {
	CheckEntitlements(ctx context.Context, subjectID string, codes []string) ([]EntitlementDecision, error)
}
```

- [ ] Invoke `/priv/operations/entitlement-checks` through Dapr with service identity; enforce deadline, bounded body, exact response schema, and fail closed.
- [ ] Do not cache positive entitlement decisions across requests; revocation must not wait for JWT expiry.
- [ ] Test timeout, malformed response, denied subject, unknown code, and caller authentication failure.
- [ ] Commit: `feat: query member entitlement authority`

### Task 3: Replace Bulletin Access With Exact Protected Routes

**Files:**
- Modify: `hhc-web-api/internal/bulletins/access.go`
- Modify: `hhc-web-api/internal/bulletins/service.go`
- Modify: `hhc-web-api/internal/bulletins/service_test.go`
- Modify: `hhc-web-api/internal/httpapi/handler.go`
- Modify: `hhc-web-api/internal/httpapi/handler_test.go`
- Delete: `hhc-web-api/internal/httpapi/bulletin_access_handlers.go`
- Delete: `hhc-web-api/internal/httpapi/bulletin_access_handlers_test.go`
- Delete: `hhc-web-api/internal/publication/bulletin_access.go`
- Delete: `hhc-web-api/internal/publication/bulletin_access_test.go`
- Delete: `hhc-web-api/internal/postgres/bulletin_access.go`
- Delete: `hhc-web-api/internal/postgres/bulletin_access_integration_test.go`
- Create: `hhc-web-api/internal/migrations/sql/049_protect_all_bulletins.sql`

- [ ] Add a table mapping series + locale to exact entitlement code; unknown pairs deny.
- [ ] Register only protected list, latest, issue-version reader, and issue-version download routes under `/api/member/bulletins*`; issue-number lookup is a validated list filter for LINE and does not retain the old public by-number route.
- [ ] Delete public-open state, reopen/close/retry/member-transition endpoints, projections, and workers.
- [ ] Return `Cache-Control: private, no-store` on every protected response and denial.
- [ ] Tests must prove authentication and entitlement precede lookup, ETag, range parsing, and download.
- [ ] Add exact isolation tests for `zh-Hant`, `zh-Hans`, `en`, and an unknown/future series.
- [ ] Commit: `feat: protect all bulletin editions by entitlement`

### Task 4: Enforce Private Bulletin Asset Mechanics

**Files:**
- Modify: `asset-api/internal/assets/policy.go`
- Modify: `asset-api/internal/assets/policy_test.go`
- Modify: `asset-api/internal/assets/service.go`
- Modify: `asset-api/internal/assets/service_test.go`
- Modify: `asset-api/internal/httpapi/handler.go`
- Modify: `asset-api/internal/httpapi/handler_test.go`
- Create: `asset-api/internal/migrations/sql/022_revoke_bulletin_public_grants.sql`
- Modify: `asset-api/docs/openapi.yaml`
- Modify: `asset-api/docs/openapi_test.go`

- [ ] Classify `cms.weekly.pdf` originals and derivatives as protected/private.
- [ ] Reject creation of `SubjectPublic` grants for that namespace even from the owner service.
- [ ] Revoke every existing active public grant for bulletin originals and derivatives in the owner database; retain asset rows and scan evidence.
- [ ] Keep the private owner-authorized download endpoint and verify `Range`, `ETag`, and derivatives only after caller/owner authorization.
- [ ] Add a reconciliation query that emits counts only, no user or file data, and requires zero active public bulletin grants.
- [ ] Run Asset CI parity including migration, governance, OpenAPI, race, vet, and image checks.
- [ ] Commit: `feat: make bulletin assets permanently private`

### Task 5: Publish Website Contract And Remove Public Shapes

**Files:**
- Modify: `hhc-web-api/openapi.yaml`
- Modify: `hhc-web-api/openapi_test.go`
- Modify: `hhc-web-api/docs/bulletin-watermark-operations.md`

- [ ] Remove public access state, public route schemas, and old member-verification fields.
- [ ] Document protected list/read/download routes and non-disclosing errors.
- [ ] Change watermark authorization from `bulletin:trace` to `cms:bulletins:investigate`.
- [ ] Lint OpenAPI and run full `hhc-web-api` CI parity.
- [ ] Run a removed-contract scan across runtime code, OpenAPI, tests, and fixtures.
- [ ] Commit: `docs: publish protected bulletin contract`

### Task 6: Replace LINE Permission And Public Download

**Files:**
- Modify: `hhc-line-function-bot/src/capabilities/download-weekly-paper.ts`
- Modify: `hhc-line-function-bot/src/__tests__/download-weekly-paper.test.ts`
- Modify: `hhc-line-function-bot/src/bootstrap/compose-capabilities.ts`
- Modify: `hhc-line-function-bot/src/runtime/main-runtime.ts`
- Modify: `hhc-line-function-bot/src/__tests__/main-runtime.test.ts`
- Modify: `hhc-line-function-bot/src/__tests__/effective-access.test.ts`

- [ ] Keep `download_weekly_paper` as a product capability name, but remove its Account permission code and public-route assumption.
- [ ] Resolve the bound Account subject and call the protected member endpoint with trusted service context.
- [ ] Do not treat LINE group membership, bot profile enablement, or Admin
      status as active church membership.
- [ ] Add denial tests for unbound Account, inactive ChurchMembership, missing
      locale entitlement, revoked entitlement, and dependency failure.
- [ ] Run `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, targeted Vitest, `pnpm build`, and `pnpm architecture:check`.
- [ ] Commit: `feat: authorize weekly paper through member entitlement`

### Task 7: Replace Bulletin Notification Eligibility

**Files:**
- Modify: `engagement-api/internal/deliveryclient/client.go`
- Modify: `engagement-api/internal/deliveryclient/client_test.go`
- Modify: `engagement-api/internal/campaigns/store.go`
- Modify: `engagement-api/internal/campaigns/store_test.go`
- Modify: `engagement-api/internal/campaigns/bulletin_eligibility_test.go`
- Modify: `engagement-api/internal/campaigns/worker.go`
- Modify: `engagement-api/internal/campaigns/worker_test.go`
- Modify: `engagement-api/docs/openapi.yaml`
- Modify: `engagement-api/docs/openapi_test.go`

- [ ] Keep the immutable campaign delivery snapshot and channel consent/suppression behavior.
- [ ] Enumerate account-bound candidate subject IDs from Engagement-owned Email/Web Push consent and subscription state, batch each subject's published-locale entitlement codes through Operations, then use Account only to resolve delivery identity/contact data; do not use `bulletin:read`, `verified_member`, or Admin status.
- [ ] Persist only subjects that have active ChurchMembership and at least one
      matching entitlement for a published bulletin locale.
- [ ] Recheck eligibility before delivery so inactive ChurchMembership or
      revoked entitlement fails closed; dependency failure retries without
      sending.
- [ ] Remove `membersOnly`, public bulletin policy, and Account bulletin-permission calls.
- [ ] Run `go test -race ./... -count=1 -p=1`, `go vet ./...`, OpenAPI lint, migration/governance checks, and image build required by Engagement CI.
- [ ] Commit: `feat: target bulletin notifications by entitlement`

### Task 8: Cross-Service Stop Gate

- [ ] Verify one positive and all negative bulletin matrix rows.
- [ ] Verify human Bulletin Editor can upload through `hhc-web-api` without `assets:*` and cannot write the generic Asset Library.
- [ ] Verify unallowlisted services cannot use Operations checks or Asset private downloads.
- [ ] Keep all PRs unmerged until the coordinated cutover is authorized.
