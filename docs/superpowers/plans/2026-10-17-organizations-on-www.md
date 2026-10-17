# Organizations on WWW Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; one fresh whole-branch review at completion.

**Goal:** Move delegated small-group management to WWW with its existing behavior and UI.

**Architecture:** WWW owns the feature and adapts its existing Account runtime to the moved Operations/notification clients. Account keeps only safe legacy redirects. Gateway adds explicit WWW routes; business APIs remain unchanged.

**Tech Stack:** TypeScript, React, Next.js App Router, existing HHC UI/client packages, Nginx, Go policy tests.

**Spec:** ../specs/2026-10-17-organizations-on-www-design.md

## Global Constraints
- Title 小家管理; subtitle 陪人是一生最高的成就.
- Preserve prior unmerged PRs and primary checkouts. No merge/release.
- No new package or API contract. Preserve server ownership, request validation, idempotency and owner isolation.
- WWW nav obeys current management permission. Mobile management precedes My.
- Banner on root only; unit/member pages retain compact management UI.
- Member pagination remains 50; archive/restore remain unavailable.

## Review Focus
- Identity switch, revoked membership and a failing permission lookup must never retain another owner's management data.
- Invalid legacy URLs must not become open redirects or carry tokens/query data to WWW.
- Unit/member deep links must preserve locale, route identity and nested authorization.
- Mobile search and toolbar must retain stable dimensions, debounce/abort and page resets.
- WWW host must allow only the explicit authenticated management methods, excluding lifecycle/private/admin paths.

### Task 1: WWW management feature and access runtime
**Files:** src/features/organizations/{OrganizationRootsPage,OrganizationUnitPage,OrganizationMemberPage,OrganizationNotificationDialog,organization-state}.tsx/ts and tests; {api,notifications-api,messages,context}.ts/tsx; src/components/layout/AccountControl.tsx.
**Interfaces:** Consume existing account token/refresh runtime; produce useOrganizationsAccess() with loading/allowed/denied/unavailable and retry; moved clients retain their original method signatures.
- [ ] Add failing access tests for delegation, denial, retry, revocation and account changes.
- [ ] Observe expected failures; migrate feature/tests/client validation and adapt Next links/params/router plus local feature messages/context.
- [ ] Run moved client/component tests and AccountControl tests; preserve all existing mutation/error behavior.
- [ ] Commit feature and runtime integration.

### Task 2: WWW routes, header search/navigation, banner/styles
**Files:** src/app/[locale]/organizations/{page,layout,[unitId]/page,[unitId]/members/[memberId]/page}.tsx; src/features/organizations/{OrganizationsPage,OrganizationsSearch,organizations.css}; SiteHeader.tsx/tests; locales; next.config.ts; fonts/subset tests.
**Interfaces:** Consume feature/context and useOrganizationsAccess; expose localized routes and header member search via shared query state.
- [ ] Add failing tests for nav ordering/permission, absence from avatar menu, root-only banner/subtitle, localized deep links, unavailable retry, private-data gating, member search reset/abort.
- [ ] Observe failures, then wire routes/header/banner. Keep shared search component, scoped feature CSS and existing local image/banner typography.
- [ ] Run focused tests, update only needed five-locale banner font subsets, and verify noindex/cache policy.
- [ ] Commit shell integration.

### Task 3: Account removal and legacy redirects
**Files:** src/App.tsx/tests; src/pages/organizations (delete); src/lib/operations-api.ts/tests; src/lib/unit-notifications-api.ts/tests; src/lib/organization-redirect.ts/tests; account-shell.css/index.css; i18n/messages.ts; review fixture/readme.
**Interfaces:** Consume fixed WWW origin from existing runtime config; redirect recognized /organizations routes only, preserving locale and IDs without query/hash.
- [ ] Add failing redirect tests and update App expectations: no management links/search results or management data fetches.
- [ ] Observe failures; remove moved pages/clients/messages/styles and retire the old review fixture. Retain Operations access/resources needed by member details and reservations.
- [ ] Run Account full tests/lint/build/release policy and commit removal.

### Task 4: Gateway WWW allowlist
**Files:** conf.d/api/www/75-unit-management.conf; docs/openapi.yaml/openapi_test.go; scripts/test-www-unit-management.sh; existing policy/runtime tests; README/CI.
**Interfaces:** Same existing /api/operations/manage and /api/engagement/unit-notifications contracts; add WWW and test host coverage without changing owning APIs.
- [ ] Add failing host/method/auth/lifecycle/private denial tests.
- [ ] Observe failures; add exact WWW routes preserving JWT protections/rate/body/no-store policy, document host availability and add bounded runtime matrix.
- [ ] Run Go tests/vet, policy scripts/OpenAPI lint and local synthetic Docker runtime tests; commit routes.

### Task 5: Verify and deliver
- [ ] Run full WWW/Account suites, lint, builds, static budgets/release policy and all Gateway required checks appropriate to scope.
- [ ] Batch browser QA at desktop/mobile, authenticated/ordinary/anonymous states, root/unit/member routes, menu/search, long lists and bottom spacing; verify mocked mutations only.
- [ ] Obtain one fresh reviewer for all three diffs, fix significant findings with regression tests.
- [ ] Open and attach three PRs, retain dependency context from #118/#221, confirm required CI. Do not merge or deploy.
