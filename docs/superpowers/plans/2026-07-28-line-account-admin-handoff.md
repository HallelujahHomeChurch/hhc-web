# LINE Account Administrator Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind a LINE user to an HHC account, authorize Bot administrators from the existing Account `admin` role, and retire the Bot-local administrator authority.

**Architecture:** Account API owns the LINE identity and answers a private, fixed-purpose administrator check. Account Console performs explicit browser confirmation, Admin Console uses its existing user inspector and role assignment, and the Bot calls Account API synchronously for administrator actions while retaining its existing non-admin user/group grants.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, Redis, React, TypeScript, Vitest, React Testing Library, Fastify, Dapr service invocation.

## Global Constraints

- Do not create `line-bot:*` roles, permissions, or a `line-bot.operator` role.
- Both existing Bot `auth: admin` and `auth: superadmin` actions require the Account `admin` role in phase one.
- Keep Bot user/group principals, function grants, role-capability bindings, and access audit records.
- Do not add manual LINE user ID input to Admin Console.
- LINE binding tokens are opaque, single-use, and expire after ten minutes.
- Private LINE endpoints are not exposed by API Gateway.
- Account authorization failure denies administrator actions and never falls back to Bot-local admin state.
- A permanent Account administrator must have MFA enabled.
- Do not allow disabling, demoting, or removing MFA from the last active administrator.

---

### Task 1: Account LINE Identity Constraints And Binding Service

**Files:**
- Create: `../account/account-api/migrations/000005_line_identity_constraints.up.sql`
- Create: `../account/account-api/migrations/000005_line_identity_constraints.down.sql`
- Create: `../account/account-api/internal/services/line_binding_service.go`
- Create: `../account/account-api/internal/services/line_binding_service_test.go`
- Modify: `../account/account-api/internal/security/token.go`
- Modify: `../account/account-api/internal/repository/interfaces.go`
- Modify: `../account/account-api/internal/repository/user_repo.go`
- Modify: `../account/account-api/internal/repository/mocks/mock_user_repo.go`

**Interfaces:**
- Produces: `security.TokenTypeLINEBinding`.
- Produces: `UserRepositoryInterface.FindIdentityByUserAndProvider(userID uuid.UUID, provider string)`.
- Produces: `LineBindingService.CreateIntent(ctx, lineUserID, profileName, ip, userAgent string) (*LineBindingIntent, error)`.
- Produces: `LineBindingService.Inspect(ctx, token string, userID uuid.UUID) (*LineBindingSummary, error)`.
- Produces: `LineBindingService.Confirm(ctx, token string, userID uuid.UUID) error`.

- [ ] **Step 1: Write migration and service tests**

  Add tests proving that invalid LINE IDs are rejected, intents expire after ten minutes, inspection does not return the LINE user ID, confirmation consumes the token once, matching confirmation is idempotent, and both ownership conflict directions return a typed conflict error.

- [ ] **Step 2: Run focused tests and verify failure**

  Run:

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/services -run LineBinding -count=1
  ```

  Expected: FAIL because `LineBindingService` and `TokenTypeLINEBinding` do not exist.

- [ ] **Step 3: Add database constraints**

  The up migration must first raise an exception when duplicate `(provider, provider_id)` or `(user_id, provider)` rows exist, then replace the non-unique provider index with:

  ```sql
  CREATE UNIQUE INDEX uq_federated_identities_provider_subject
    ON federated_identities(provider, provider_id);
  CREATE UNIQUE INDEX uq_federated_identities_user_provider
    ON federated_identities(user_id, provider);
  ```

  The down migration restores the existing non-unique provider index and removes only the two new unique indexes.

- [ ] **Step 4: Implement the minimum binding service**

  Reuse `security.TokenService` for generation, storage, validation, and atomic consume. Store only `line_user_id` and `profile_name` in Redis metadata. Validate LINE IDs as `U` followed by 32 lowercase hexadecimal characters and map unique-index violations to `ErrLineIdentityConflict`.

- [ ] **Step 5: Run focused and repository tests**

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/services ./internal/repository -count=1
  ```

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  cd ../account/account-api
  git add migrations internal/security internal/repository internal/services
  git commit -m "feat: add LINE account binding domain"
  ```

### Task 2: Account LINE HTTP Contract And Administrator Authorization

**Files:**
- Create: `../account/account-api/internal/handlers/line_handler.go`
- Create: `../account/account-api/internal/handlers/line_handler_test.go`
- Create: `../account/account-api/internal/middleware/internal_caller.go`
- Create: `../account/account-api/internal/middleware/internal_caller_test.go`
- Modify: `../account/account-api/internal/config/config.go`
- Modify: `../account/account-api/internal/config/config_test.go`
- Modify: `../account/account-api/internal/routes/routes.go`
- Modify: `../account/account-api/internal/routes/routes_test.go`
- Modify: `../account/account-api/cmd/main.go`

**Interfaces:**
- Consumes: `LineBindingService` from Task 1.
- Produces: `POST /priv/account/v1/line/bindings`.
- Produces: `POST /priv/account/v1/line/authorize`.
- Produces: `GET /api/account/v1/line/bindings/:token`.
- Produces: `POST /api/account/v1/line/bindings/:token/confirm`.
- Produces authorize response `{ "bound": boolean, "allowed": boolean, "user_id"?: string }`.

- [ ] **Step 1: Write handler and middleware tests**

  Cover invalid caller `403`, malformed body `400`, unbound `200`, inactive `200`, non-admin `200`, active admin `200`, authenticated inspection, CSRF-protected confirmation, consumed token, and conflict `409`. Assert authorize responses never expose roles or permissions.

- [ ] **Step 2: Run focused tests and verify failure**

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/handlers ./internal/middleware ./internal/routes -run 'Line|InternalCaller' -count=1
  ```

  Expected: FAIL because the handlers and routes do not exist.

- [ ] **Step 3: Implement fixed-purpose private authorization**

  Add `LINE_BOT_CALLER_APP_ID`, required outside local/test environments. The middleware compares `X-Internal-Caller-App-Id` using `subtle.ConstantTimeCompare`. The authorize handler accepts only:

  ```json
  { "line_user_id": "U0123..." }
  ```

  It resolves provider `line`, loads the active user with roles, and returns `allowed: true` only when role name `admin` is present. Do not accept a requested role or permission in the body.

- [ ] **Step 4: Wire public binding routes**

  Inspection and confirmation use the existing bearer authentication and CSRF middleware. Create-intent and authorize remain under `/priv/account/v1/line` with timeout and internal-caller middleware.

- [ ] **Step 5: Run API tests**

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/handlers ./internal/middleware ./internal/routes ./internal/services -count=1
  ```

  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  cd ../account/account-api
  git add cmd internal
  git commit -m "feat: expose LINE binding and admin authorization"
  ```

### Task 3: Seed Administrator Handoff And MFA Guards

**Files:**
- Modify: `../account/account-api/internal/services/auth_service.go`
- Modify: `../account/account-api/internal/services/auth_service_test.go`
- Modify: `../account/account-api/internal/services/rbac_service.go`
- Modify: `../account/account-api/internal/services/rbac_service_test.go`
- Modify: `../account/account-api/internal/repository/rbac_repo.go`
- Modify: `../account/account-api/internal/repository/user_mfa_repo.go`
- Modify: `../account/account-api/internal/handlers/mfa_handler.go`
- Modify: `../account/account-api/internal/handlers/admin_user_handler.go`
- Modify: `../account/account-api/internal/handlers/admin_user_handler_test.go`
- Modify: `../account/account-api/internal/routes/routes.go`
- Modify: `../account/account-api/internal/routes/routes_test.go`
- Modify: `apps/account/src/lib/api.ts`
- Modify: `apps/account/src/pages/LoginPage.tsx`
- Modify: `apps/account/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Produces: admin role assignment error `ACC_RBAC_ADMIN_MFA_REQUIRED`.
- Produces: last-admin protection error `ACC_RBAC_LAST_ADMIN_REQUIRED`.
- Produces: `PATCH /api/account/v1/admin/users/:user_id/status` with `{ "is_active": boolean }`.

- [ ] **Step 1: Write failing backend guard tests**

  Prove that an MFA-disabled user cannot receive `admin`, an MFA-enabled user can, the final active admin cannot be demoted or disabled, and an admin cannot disable MFA. Prove ordinary non-admin users can still enable and disable MFA.

- [ ] **Step 2: Write failing login regression tests**

  Replace seed-admin setup expectations with normal login token delivery when the seed account has no MFA. Assert the removed setup-token routes return `404`.

- [ ] **Step 3: Run focused tests and verify failure**

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/services ./internal/handlers ./internal/routes -run 'Admin|MFA|Login' -count=1
  ```

  Expected: FAIL on the new handoff behavior.

- [ ] **Step 4: Implement guards at service and transaction boundaries**

  Remove the email-equals-`admin` forced setup branch and the two unauthenticated setup-token handlers/routes. Add repository transaction methods that lock the affected user/role rows, count active admins, and perform assignment, removal, or deactivation atomically. Check MFA before admin assignment and before MFA removal.

- [ ] **Step 5: Remove obsolete Account frontend flow**

  Remove `setup_required`, `setupMfaWithToken`, and `verifyMfaSetupWithToken` from `apps/account/src/lib/api.ts`. Simplify `LoginPage` to support only normal success and `verification_required`.

- [ ] **Step 6: Run backend and Account frontend tests**

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./... -count=1
  cd ../../hhc-web
  pnpm --filter @hhc/account test:run
  pnpm --filter @hhc/account lint
  pnpm --filter @hhc/account build
  ```

  Expected: PASS.

- [ ] **Step 7: Commit each repository**

  ```bash
  cd ../account/account-api
  git add internal
  git commit -m "feat: guard administrator handoff"
  cd ../../hhc-web
  git add apps/account
  git commit -m "refactor: remove forced seed admin MFA flow"
  ```

### Task 4: Account Binding Page And Admin Linked LINE State

**Files:**
- Create: `apps/account/src/pages/LineBindingPage.tsx`
- Create: `apps/account/src/pages/LineBindingPage.test.tsx`
- Modify: `apps/account/src/lib/api.ts`
- Modify: `apps/account/src/lib/mock-account-api.ts`
- Modify: `apps/account/src/auth/auth-routes.ts`
- Modify: `apps/account/src/auth/redirects.ts`
- Modify: `apps/account/src/App.tsx`
- Modify: `apps/account/src/App.test.tsx`
- Modify: `apps/account/src/i18n/locales.ts`
- Modify: `apps/admin/src/pages/UsersPage.tsx`
- Modify: `apps/admin/src/App.test.tsx`
- Modify: `apps/admin/src/lib/mock-api.ts`

**Interfaces:**
- Consumes: binding HTTP routes from Task 2.
- Produces: Account route `/line/bind?token=<opaque>`.
- Produces: Admin user inspector row showing linked provider `LINE`.

- [ ] **Step 1: Write Account binding page tests**

  Cover preserving `/line/bind` through login and MFA, loading summary, explicit confirm, expired token, conflict, retry, success, and never rendering the LINE user ID.

- [ ] **Step 2: Write Admin inspector tests**

  Render a user with `linked_identities: [{ provider: "line" }]` and assert the inspector shows `LINE`. Render an unlinked user and assert no manual LINE ID input or separate LINE role control exists.

- [ ] **Step 3: Run focused tests and verify failure**

  ```bash
  pnpm --filter @hhc/account test:run -- LineBindingPage
  pnpm --filter @hhc/admin test:run -- App
  ```

  Expected: FAIL because the route/page and inspector row are absent.

- [ ] **Step 4: Implement the binding route**

  Add API methods `getLineBinding(token)` and `confirmLineBinding(token)`. Render the existing account auth shell with localized Bot/profile summary, Cancel, and Confirm actions. Keep the token in the URL only until confirmation and replace history with a token-free success state afterward.

- [ ] **Step 5: Extend the existing Admin user inspector**

  Reuse `linked_identities` already returned by `getUser`. Add one read-only linked-provider row and keep existing role assignment for `admin`; do not add a LINE-specific page, role, permission, or text field.

- [ ] **Step 6: Run frontend verification**

  ```bash
  pnpm --filter @hhc/account test:run
  pnpm --filter @hhc/account lint
  pnpm --filter @hhc/account build
  pnpm --filter @hhc/admin test:run
  pnpm --filter @hhc/admin lint
  pnpm --filter @hhc/admin build
  ```

  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/account apps/admin
  git commit -m "feat: add LINE account binding experience"
  ```

### Task 5: Bot Account Authorization Cutover

**Files:**
- Create: `../hhc-line-function-bot/src/account/account-admin-client.ts`
- Create: `../hhc-line-function-bot/src/__tests__/account-admin-client.test.ts`
- Modify: `../hhc-line-function-bot/src/actions/policy.ts`
- Modify: `../hhc-line-function-bot/src/application/turn/runtime.ts`
- Modify: `../hhc-line-function-bot/src/application/access/effective-access.ts`
- Modify: `../hhc-line-function-bot/src/transport/line/webhook-routes.ts`
- Modify: `../hhc-line-function-bot/src/transport/line/public-access-commands.ts`
- Modify: `../hhc-line-function-bot/src/access/types.ts`
- Modify: `../hhc-line-function-bot/src/config.ts`
- Modify: `../hhc-line-function-bot/src/types.ts`
- Modify: `../hhc-line-function-bot/config/profiles.json`
- Modify: `../hhc-line-function-bot/src/__tests__/action-policy.test.ts`
- Modify: `../hhc-line-function-bot/src/__tests__/entrance.test.ts`
- Modify: `../hhc-line-function-bot/src/__tests__/config.test.ts`
- Modify: `../hhc-line-function-bot/src/__tests__/effective-access.test.ts`
- Modify: `../hhc-line-function-bot/docs/rbac-capability-model.md`
- Modify: `../hhc-line-function-bot/docs/runbooks/production-operations.md`
- Modify: `../hhc-line-function-bot/docs/architecture-context.md`

**Interfaces:**
- Consumes: `POST /priv/account/v1/line/bindings` and `/authorize` from Task 2.
- Produces: `AccountAdminClient.createBinding(lineUserID, profileName)`.
- Produces: `AccountAdminClient.isAdministrator(lineUserID)`.

- [ ] **Step 1: Write native-fetch client tests**

  Use a stub `fetch` to prove Dapr URL construction, caller header, bounded timeout, response parsing, unbound handling, and failure-closed behavior. Do not add an HTTP client dependency.

- [ ] **Step 2: Write policy regression tests**

  Prove both `auth: admin` and `auth: superadmin` call `isAdministrator`, unbound users receive a binding URL in direct messages, unavailable Account authorization denies admin actions, and public commands remain available.

- [ ] **Step 3: Run focused tests and verify failure**

  ```bash
  cd ../hhc-line-function-bot
  pnpm test -- src/__tests__/account-admin-client.test.ts src/__tests__/action-policy.test.ts src/__tests__/entrance.test.ts
  ```

  Expected: FAIL because `AccountAdminClient` is absent and local admin paths still authorize.

- [ ] **Step 4: Add the Account client and one authorization dependency**

  Use native `fetch` and `AbortSignal.timeout`. Inject one `isAdministrator(lineUserID)` function into policy/runtime composition and route every existing administrator check through it. Do not cache decisions.

- [ ] **Step 5: Remove Bot-local human admin management**

  Remove `/admin-add`, `/admin-remove`, `adminUserId`, `adminUserIdEnv`, bootstrap checks, and `admin` as a newly accepted `AccessPrincipalType`. Preserve reading legacy admin rows only in the one-time migration/report command until production cutover is accepted; runtime authorization must not read them.

- [ ] **Step 6: Update operational documentation**

  Document that Account `admin` is the phase-one Bot administrator authority, binding happens through Account Console, and Bot-specific operation permissions are intentionally deferred.

- [ ] **Step 7: Run Bot verification**

  ```bash
  cd ../hhc-line-function-bot
  pnpm test
  pnpm typecheck
  pnpm lint
  pnpm architecture:check
  pnpm build
  ```

  Expected: PASS.

- [ ] **Step 8: Commit**

  ```bash
  cd ../hhc-line-function-bot
  git add src config docs
  git commit -m "feat: authorize LINE bot admins through account"
  ```

### Task 6: Integrated Handoff And Deployment Gate

**Files:**
- Modify: `docs/superpowers/plans/2026-07-08-hhc-web-platform-roadmap.md`
- Modify: `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`
- Modify: `docs/superpowers/specs/2026-07-28-line-account-rbac-integration-design.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a checked handoff sequence and rollback boundary.

- [ ] **Step 1: Add the deployment checklist**

  Record these required gates in order:

  1. Account migrations and private endpoints deployed.
  2. Account/Admin frontend binding UI deployed.
  3. Permanent user enables MFA and binds LINE.
  4. Seed admin grants that user `admin`.
  5. Private authorize returns `allowed: true`.
  6. Seed admin is disabled and at least one active admin remains.
  7. Bot revision switches to Account authorization.
  8. `LINE_HELPER_ADMIN_USER_ID` is removed only after Bot smoke tests pass.

- [ ] **Step 2: Run integrated local verification**

  Start only the required local backend dependencies, then verify:

  ```bash
  curl -fsS -X POST http://localhost:8080/priv/account/v1/line/authorize \
    -H 'Content-Type: application/json' \
    -H 'X-Internal-Caller-App-Id: hhc-line-function-bot' \
    -d '{"line_user_id":"U0123456789abcdef0123456789abcdef"}'
  ```

  Expected before binding: `{"bound":false,"allowed":false}`. After binding and assigning `admin`: `{"bound":true,"allowed":true,...}`. After revoking `admin`: `{"bound":true,"allowed":false,...}`.

- [ ] **Step 3: Run all repository verification**

  ```bash
  cd ../account/account-api
  GOCACHE=/private/tmp/account-api-go-build-cache go test ./... -count=1
  cd ../../hhc-web
  pnpm test
  pnpm lint
  pnpm build
  cd ../hhc-line-function-bot
  pnpm test
  pnpm typecheck
  pnpm lint
  pnpm architecture:check
  pnpm build
  ```

  Expected: PASS.

- [ ] **Step 4: Commit documentation**

  ```bash
  cd ../hhc-web
  git add docs/superpowers
  git commit -m "docs: add LINE administrator handoff runbook"
  ```

