# Five-Locale Backend Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every backend contract, database constraint, notification template, and generated client safely accept Japanese and Korean before product frontends send them.

**Architecture:** Each service retains an explicit five-value trust-boundary allowlist and forward-only constraint migration. Notification templates remain immutable and source-controlled; engagement owns exact-to-English campaign fallback; account only validates and propagates locale. Generated clients are republished after deployed OpenAPI contracts become authoritative.

**Tech Stack:** Go 1.25, PostgreSQL, OpenAPI, TypeScript code generation, GitHub Actions

## Global Constraints

- Backend releases remain compatible with existing three-locale consumers.
- Do not remove `ja`/`ko` constraints during rollback after new rows exist.
- Notification and engagement logs contain no addresses, endpoints, tokens, or provider payloads.
- Security templates are reviewed source, never LLM output.
- `api-gateway` remains a read-only verification target unless an actual route mismatch appears.

---

### Task 1: Expand `hhc-web-api` content, bulletin, projection, and notification locales

**Files:**
- Modify: `hhc-web-api/internal/content/service.go`
- Modify: `hhc-web-api/internal/content/service_test.go`
- Modify: `hhc-web-api/internal/httpapi/handler.go`
- Modify: `hhc-web-api/internal/postgres/repository.go`
- Modify: `hhc-web-api/internal/postgres/repository_integration_test.go`
- Create: `hhc-web-api/internal/migrations/sql/022_five_content_locales.sql`
- Modify: `hhc-web-api/internal/migrations/migrations.go`
- Modify: `hhc-web-api/internal/migrations/migrations_test.go`
- Modify: `hhc-web-api/openapi.yaml`

**Interfaces:**
- Produces: `Locale` enum `zh-Hant | zh-Hans | en | ja | ko` and five-locale bulletin notification translations.

- [ ] **Step 1: Add failing locale and migration tests**

Test `ja`/`ko` content create/update/publish/public projection and bulletin version lifecycle. Assert the new migration replaces every three-value locale check without rewriting rows.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `go test ./internal/content ./internal/httpapi ./internal/migrations ./internal/postgres`

Expected: FAIL because allowlists and constraints reject `ja`/`ko`.

- [ ] **Step 3: Expand validation and write the forward migration**

Use explicit `switch locale { case "zh-Hant", "zh-Hans", "en", "ja", "ko": }`. Drop/recreate only named locale check constraints in migration 022; do not modify historical migration files.

- [ ] **Step 4: Generate five-locale bulletin notification copy**

Update `buildBulletinNotification` to emit exact reviewed subject/body for every published locale and use English as the fallback body when a locale version is absent. Keep action URLs locale-specific.

- [ ] **Step 5: Expand OpenAPI structural limits**

Update every `Locale` enum and any `maxItems`/`maxProperties` value that encodes three locales.

- [ ] **Step 6: Run full verification and commit**

Run: `go test ./...`

```bash
git add internal openapi.yaml
git commit -m "feat: support five website content locales"
```

Merge, release, smoke `ja`/`ko` draft/public/bulletin contracts, and record the first compatible deployed revision.

### Task 2: Expand engagement locale persistence and delivery fallback

**Repository:** `engagement-api`

**Files:**
- Modify: `internal/subscriptions/store.go`
- Modify: `internal/subscriptions/store_test.go`
- Modify: `internal/push/store.go`
- Modify: `internal/push/store_test.go`
- Modify: `internal/campaigns/store.go`
- Modify: `internal/campaigns/store_test.go`
- Modify: `internal/campaigns/worker.go`
- Modify: `internal/campaigns/worker_test.go`
- Create: `internal/migrations/sql/013_five_locales.sql`
- Modify: `internal/migrations/migrations.go`
- Modify: `internal/migrations/migrations_test.go`
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Produces: five-locale newsletter/Web Push/campaign schemas and `campaignTranslation(exact, en)` behavior.

- [ ] **Step 1: Add failing validation, migration, and fallback tests**

Test `ja` and `ko` subscription/push writes; five campaign translation properties; exact Japanese/Korean selection; missing exact locale uses English; missing both exact and English returns the bounded localization error without enqueueing delivery.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `go test ./internal/subscriptions ./internal/push ./internal/campaigns ./internal/migrations`

Expected: FAIL on current three-locale validation and `zh-Hant` fallback.

- [ ] **Step 3: Implement explicit allowlists and migration 013**

Replace the locale checks for newsletter subscriptions, web-push subscriptions, campaigns, schedules, deliveries, and recipient locale fields. Preserve consent, suppression, idempotency, and audit behavior.

- [ ] **Step 4: Update OpenAPI enums and `maxProperties`**

Change locale enums/property names to five and `maxProperties: 5`; retain required channel/audience validation.

- [ ] **Step 5: Run all tests and commit**

Run: `go test ./...`

```bash
git add internal docs/openapi.yaml
git commit -m "feat: support five engagement locales"
```

Merge, release, and smoke consent, subscription, exact delivery, English fallback, suppression, and retry behavior.

### Task 3: Add immutable Japanese and Korean notification template versions

**Repository:** `notification-api`

**Files:**
- Modify: `internal/templates/registry.go`
- Modify: `internal/templates/registry_test.go`
- Modify: `internal/templates/render.go`
- Modify: `internal/templates/render_test.go`

**Interfaces:**
- Consumes: existing template name/version/locale registry.
- Produces: new version identifiers whose supported locales include `ja` and `ko`; historical versions remain byte-for-byte renderable.

- [ ] **Step 1: Add failing registry/render tests**

For email verification, password reset, OAuth link confirmation, first-time third-party-login verification, newsletter/unsubscribe, and Web Push wrapper copy, assert reviewed Japanese/Korean subject/body/CTA output. Assert an old queued version still renders its historical three-locale output.

- [ ] **Step 2: Run tests and confirm failure**

Run: `go test ./internal/templates`

Expected: FAIL because new versions/locales do not exist.

- [ ] **Step 3: Add new immutable versions and locale-aware wrappers**

Do not edit the locale support or output of existing version constants. Add Japanese/Korean cases only under new versions. Use safe email system-font stacks; do not embed website fonts.

- [ ] **Step 4: Run full verification and commit**

Run: `go test ./...`

```bash
git add internal/templates
git commit -m "feat: add Japanese and Korean notification templates"
```

Merge, release, and render smoke every new security template without sending to real users.

### Task 4: Accept and propagate Japanese/Korean locale in account flows

**Repository:** `account-api`

**Files:**
- Modify: `internal/handlers/auth_handler.go`
- Modify: `internal/handlers/auth_handler_test.go`
- Modify: `internal/services/mail_service.go`
- Modify: `internal/services/mail_service_test.go`
- Modify: `internal/engagementclient/client_test.go`

**Interfaces:**
- Produces: `notificationLocale`/`validOAuthLocale` acceptance for `ja` and `ko`; unchanged calls into notification/engagement clients.

- [ ] **Step 1: Add failing end-to-end handler tests**

Cover registration, OAuth state/onboarding, email verification, password reset, linked-account confirmation, first-time third-party-login code, and newsletter opt-in with `ja` and `ko`. Assert the downstream locale exactly matches the request/cookie and unknown locale still falls back defensively.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `go test ./internal/handlers ./internal/services ./internal/engagementclient`

Expected: FAIL because locale validators accept only three values.

- [ ] **Step 3: Expand only the shared validators**

Update the root validation helpers used by all sibling flows; do not add per-handler special cases, mail rendering, JWT validation, or service rate limiting.

- [ ] **Step 4: Run repository verification and commit**

Run: `make test && make build`

```bash
git add internal/handlers internal/services internal/engagementclient
git commit -m "feat: propagate Japanese and Korean account locales"
```

Merge, release, and smoke against already-released notification and engagement revisions.

### Task 5: Regenerate and publish authoritative frontend clients

**Repository:** `frontend-platform`

**Files:**
- Replace: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`

**Interfaces:**
- Consumes: deployed `hhc-web-api/openapi.yaml` from Tasks 1–2 of the contract plans.
- Produces: generated `ContentLocale`, `resolvedLocale`, `availableLocales`, `deleteLocales`, and typed error contract for frontend consumers.

- [ ] **Step 1: Sync the exact deployed OpenAPI file**

Copy from the released `hhc-web-api` main commit recorded in evidence; do not hand-edit generated enums.

- [ ] **Step 2: Run generation and inspect the diff**

Run: `pnpm --filter @hallelujahhomechurch/hhc-web-client generate`

Then verify:

```bash
rg -n "resolvedLocale|availableLocales|deleteLocales|'ja'|'ko'" packages/hhc-web-client/src/generated.ts
```

Expected: all five contract elements are present.

- [ ] **Step 3: Add a contract test for the five canonical locale values**

Assert generated `ContentLocale` matches the shared `contentLocales` registry exactly.

- [ ] **Step 4: Run package and packed-consumer checks**

Run: `pnpm test && pnpm build && pnpm lint && pnpm check:packages && pnpm pack:packages && pnpm test:consumers`

Expected: PASS.

- [ ] **Step 5: Commit and publish the second package release**

```bash
git add packages/hhc-web-client packages/preferences
git commit -m "feat: publish five-locale website client"
```

Record the immutable package versions and do not begin Admin/product consumer PRs until publication is complete.

### Task 6: Verify gateway compatibility without changing it

**Repository:** `api-gateway`

**Files:**
- Verify only: `conf.d/common/proxy.conf`
- Verify only: Admin routing under `conf.d/`

**Interfaces:**
- Consumes: translation-preview paths and existing trusted identity headers.
- Produces: evidence that routing accepts the endpoints and `proxy_read_timeout` remains 60 seconds.

- [ ] **Step 1: Run gateway configuration tests**

Run: `docker build -t hhc-api-gateway:five-locale-check .`

Run the repository's existing container/config validation so `nginx -t` passes.

- [ ] **Step 2: Record the read-only result**

Expected: no gateway PR. Open a focused gateway PR only if the exact new translation path is blocked or the verified timeout differs from 60 seconds.
