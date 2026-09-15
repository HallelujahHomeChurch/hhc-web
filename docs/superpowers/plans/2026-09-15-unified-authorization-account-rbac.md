# Account Staff RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `account-api` issue only the canonical granular staff permissions and default roles, with no bulletin-member derivation or legacy aliases.

**Architecture:** Keep the existing Account role/permission tables and effective-permission expansion. Replace seed/catalog rows in place through a breaking migration, remove derived member grants, separate IAM from DSR, and bump active sessions so stale scopes cannot survive cutover.

**Tech Stack:** Go 1.25, GORM, PostgreSQL 17, Gin, OpenAPI.

**Spec:** [2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md](../specs/2026-09-15-hhc-unified-authorization-membership-and-entitlement-design.md)

## Global Constraints

- Work from fresh `account-api/origin/main` in an isolated worktree.
- Do not map or backfill `website_editor`, `website_reader`, `verified_member`, or direct removed grants.
- Preserve `*` as staff-only wildcard; it must not imply qualification or entitlement.
- Keep direct `assets:*` roles only for generic Asset Library administration.
- Keep `campaigns:*`, Presenter, DSR, OAuth, user, and RBAC permissions independent.
- The six `operations:*` permissions and their Account default roles are
  church-wide. Do not add OrgUnit ids, scoped-role names, or organization facts
  to Account roles, sessions, or token scopes; `operations-api` owns the
  alternative scoped branch.

## Frozen AuthN/AuthZ Consumer Contract

This plan is the authority consumed by the authentication convergence plan:

- The session wire response keeps `user` identity-only and contains top-level
  opaque `permissions: string[]` plus
  `permissionAvailability: {status: 'available'} | {status: 'unavailable',
  code: 'permission_unavailable', requestId?, retryAt?}`.
- `permissions: []` with available status is authenticated with no staff
  permissions. Unavailable resolution remains authenticated, clears the
  permission list, and fails permission-gated UX closed without refresh,
  logout, or login restart.
- Access tokens carry requested and granted permissions in `scope`; Gateway
  forwards verified space-delimited values through `X-HHC-Scopes`. No second
  permission header or product capability claim is introduced.
- `hasPermission()` supports only exact list membership and the staff `*`
  wildcard. Product capability compilation is domain-owned.
- The permission compatibility map is `{}`. Every removed code is rejected;
  there are no runtime aliases or fallback scopes.
- `401` permits one coordinated refresh and one retry of the original request.
  `403` permits neither and cannot mutate authentication state.

The canonical capability identifiers consumed by Admin authorization code are
`pageSettings`, `news`, `bulletins`, `meetings`, `resources`, `reservations`,
`memberships`, `campaigns`, `users`, `rbac`, `oauth`, `assets`,
`presenterCloud`, `presenterLine`, `dsr`, and `auditLog`. They expand only
inside the domain AuthZ adapter; authentication runtime files must not import
them.

### Task 1: Lock The Canonical Catalog With Failing Tests

**Files:**
- Modify: `account-api/internal/database/migration_integration_test.go`
- Modify: `account-api/internal/services/user_service_test.go`
- Modify: `account-api/internal/repository/rbac_repo_integration_test.go`

- [ ] Add a table-driven catalog assertion for the exact canonical permission codes and 20 new default role bundles.
- [ ] Use this exact new-role bundle fixture; append the unaffected existing roles from the spec without changing their boundaries:

```go
var granularRolePermissions = map[string][]string{
	"page_settings_viewer":    {"cms:pages:read"},
	"page_settings_editor":    {"cms:pages:read", "cms:pages:write"},
	"page_settings_publisher": {"cms:pages:read", "cms:pages:write", "cms:pages:publish"},
	"news_viewer":             {"cms:news:read"},
	"news_editor":             {"cms:news:read", "cms:news:write"},
	"news_publisher":          {"cms:news:read", "cms:news:write", "cms:news:publish"},
	"bulletin_viewer":         {"cms:bulletins:read"},
	"bulletin_editor":         {"cms:bulletins:read", "cms:bulletins:write"},
	"bulletin_publisher":      {"cms:bulletins:read", "cms:bulletins:write", "cms:bulletins:publish"},
	"bulletin_investigator":   {"cms:bulletins:read", "cms:bulletins:investigate"},
	"meeting_viewer":          {"operations:meetings:read"},
	"meeting_editor":          {"operations:meetings:read", "operations:meetings:write"},
	"resource_viewer":         {"operations:resources:read"},
	"resource_editor":         {"operations:resources:read", "operations:resources:write"},
	"reservation_viewer":      {"operations:reservations:read"},
	"reservation_approver":    {"operations:reservations:read", "operations:reservations:approve"},
	"operations_manager":      {"operations:meetings:read", "operations:meetings:write", "operations:resources:read", "operations:resources:write", "operations:reservations:read", "operations:reservations:approve"},
	"membership_viewer":       {"memberships:read"},
	"membership_manager":      {"memberships:read", "memberships:manage"},
	"audit_reader":            {"audit:read"},
}
```

- [ ] Assert the removed codes and roles are absent after migration.
- [ ] Assert the unreleased draft codes `operations:read`, `operations:write`, `resources:approve`, and `resources:manage` are absent with no compatibility mapping.
- [ ] Assert `iam_reader`/`iam_editor` do not contain `dsr:*` or `audit:read`, and CMS roles do not contain `assets:*`.
- [ ] Replace derived-member tests with this invariant:

```go
func TestEffectivePermissionCodesDoesNotDeriveMemberBenefits(t *testing.T) {
	user := models.User{Roles: []models.Role{{Name: "bulletin_editor", Permissions: []models.Permission{{Code: "cms:bulletins:write"}}}}}
	assert.Equal(t, []string{"cms:bulletins:write"}, EffectivePermissionCodes(&user))
}
```

- [ ] Run `go test ./internal/database ./internal/repository ./internal/services -count=1` and confirm failures name the old catalog and derived grants.
- [ ] Commit: `test: lock granular staff rbac contract`

### Task 2: Replace Seed And Migration Catalog

**Files:**
- Create: `account-api/migrations/000026_granular_staff_rbac.up.sql`
- Create: `account-api/migrations/000026_granular_staff_rbac.down.sql`
- Modify: `account-api/internal/database/db.go`

- [ ] Add the granular CMS, Meetings, Resources, Reservations, Membership, and Audit permissions from the spec.
- [ ] Add the 20 stable default roles and exact bundles.
- [ ] Delete join rows for removed permissions and roles, then delete their catalog rows. Do not translate assignments.
- [ ] Remove DSR permissions from IAM role bundles.
- [ ] Remove retired codes from the HHC Presenter OAuth client's allowed scopes and add only scopes actually consumed by that client.
- [ ] Bump `auth_version` for active test users in the breaking migration so existing sessions fail after cutover.
- [ ] Make the down migration fail loudly if safe reversal would recreate ambiguous assignments; it may restore catalog definitions but must not fabricate assignments.
- [ ] Run `./scripts/test-migration-policy-test.sh` and `./scripts/test-migration-policy.sh`.
- [ ] Run `go test ./internal/database ./internal/repository -count=1` and confirm pass.
- [ ] Commit: `feat: replace broad cms permission catalog`

### Task 3: Remove Derived Membership And Legacy Codes

**Files:**
- Modify: `account-api/internal/services/user_service.go`
- Modify: `account-api/internal/services/user_service_test.go`
- Modify: `account-api/internal/handlers/internal_permission_handler_test.go`
- Modify: `account-api/internal/handlers/internal_permission_handler.go`
- Modify: `account-api/internal/handlers/notification_target_handler.go`
- Modify: `account-api/internal/handlers/notification_target_handler_test.go`
- Modify: `account-api/internal/routes/routes.go`
- Modify: `account-api/internal/routes/routes_test.go`

- [ ] Delete `bulletinReadPermission`, `bulletinTracePermission`, `weeklyPaperLinePermission`, `adminConsolePermissions`, `hasAdminConsoleAccess`, and `isEffectiveVerifiedMember`.
- [ ] Keep `EffectivePermissionCodes` as sorted union of direct and role permissions only.
- [ ] Remove any profile field whose meaning was derived member qualification; do not replace it with another Account-owned member Boolean.
- [ ] Remove Account's bulletin-access and bulletin-trace private endpoints, `verified_member`/`bulletin:read` audience selectors, and `ResolveBulletinAudience`; retain only generic explicit role-ID/user-ID notification target resolution.
- [ ] Make internal Presenter permission verification accept only `presenter:line:manage`, with no `media-sync:manage` fallback.
- [ ] Add tests proving Admin, email verification, and wildcard never create member entitlements.
- [ ] Run `go test ./internal/services ./internal/handlers -count=1`.
- [ ] Commit: `refactor: remove account-owned member authorization`

### Task 4: Publish The Breaking Account Contract

**Files:**
- Modify: `account-api/docs/openapi.yaml`
- Modify: `account-api/docs/openapi_test.go`
- Modify: `account-api/internal/routes/routes_test.go`
- Modify: `account-api/README.md`

- [ ] Replace permission examples and enums with the canonical catalog.
- [ ] Freeze the session `permissions` and `permissionAvailability` response,
      access-token `scope`, Gateway `X-HHC-Scopes`, empty compatibility map,
      and `permission_unavailable` behavior exactly as stated above.
- [ ] Remove permissions from the wire `user` object; publish top-level
      `permissions` and snake-case `permission_availability`, which
      `account-client` normalizes to `permissionAvailability`.
- [ ] Add tests proving empty permissions remain authenticated, unavailable
      resolution cannot reuse stale permissions, and AuthN does not import a
      capability catalog.
- [ ] Document `401`, `403`, and `429 Retry-After` for all current browser and
      Presenter callers; fold the former auth-convergence service-documentation
      task into this Account contract PR.
- [ ] Remove member-verification and removed-permission response examples.
- [ ] Document that organization, scoped pastoral/operational roles,
      qualification, and entitlement are owned by `operations-api`. State that
      the existing Operations scopes are global and no additional Account
      permission code is introduced for scoped access.
- [ ] Run `npx --yes @redocly/cli@2.47.0 lint docs/openapi.yaml`.
- [ ] Run full local CI parity:

```bash
go test -race ./... -count=1 -p=1
go vet ./...
./scripts/test-migration-policy-test.sh
./scripts/test-migration-policy.sh
./scripts/bootstrap-migration-role.test.sh
./scripts/test-release-policy.sh
```

- [ ] Run `rg -n 'cms:(read|write|publish)|media-sync:manage|bulletin:(read|trace)|line:main:function:download_weekly_paper:execute|website_(editor|reader)|verified_member' . --glob '!docs/superpowers/**'` and require zero runtime/catalog hits.
- [ ] Commit: `docs: publish granular staff authorization contract`

### Task 5: PR And Release Stop Gate

- [ ] Open the Account PR only with explicit authorization; do not merge it independently during the incompatible window.
- [ ] Record CI, immutable artifact, migration preview, and session-invalidation counts.
- [ ] Block consumers until the OpenAPI contract is frozen.
- [ ] Merge/release only in the coordinated cutover authorized by the master plan.
