# HHC First-Party Browser SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Deliver one-interaction HHC sign-in with isolated Account, Admin, and Web browser sessions plus current-device global sign-out.

**Architecture:** \`account-api\` remains the authorization server. Browser products exchange PKCE codes through same-origin gateway routes and receive host-only refresh cookies; native clients receive refresh tokens in the token response. A host-only Account SSO record makes first entry into another product a fast redirect, while a non-authoritative shared hint limits passive Web SSO to previously signed-in browsers.

**Tech Stack:** Go 1.24, Gin, Redis, PostgreSQL migrations, Nginx, React 19, TypeScript 6, Vite, Next.js 16, Vitest, Testing Library.

## Global Constraints

- Do not add a BFF or identity microservice.
- Never set an authentication cookie with \`Domain=.alive.org.tw\`.
- Keep access tokens in memory and refresh tokens out of browser JavaScript.
- Keep desktop PKCE and native refresh-token delivery working.
- Global sign-out revokes all HHC product sessions for the current device only.
- Do not render protected Account/Admin chrome before auth bootstrap resolves.
- Preserve exact registered redirect URI, state, S256 PKCE, CSRF, and Origin checks.
- Every behavior change starts with a failing test.
- Commit each task in the repository that owns it.

---

### Task 1: Isolate Account Browser Cookies

**Files:**
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/config/config.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/token_cookie.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/auth_handler.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/device_cookie.go\`
- Test: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/token_cookie_test.go\`
- Test: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/device_cookie_test.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/.env.example\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/.env.production\`

**Interfaces:**
- Produces: host-only refresh and SSO cookies, \`SharedCookieDomain\`, legacy-cookie cleanup, and shared device/hint cookie helpers.
- Consumes: \`Config.IsProduction()\` and Gin \`SetCookie\`.

- [ ] **Step 1: Write failing cookie tests**

Add table tests asserting production uses \`__Host-refresh_token\` and
\`__Host-hhc_sso\` with empty Domain, local HTTP uses unprefixed host-only names,
legacy parent-domain cookies are expired, and \`hhc_device\` alone uses
\`SharedCookieDomain\`.

\`\`\`go
func TestAuthCookiesAreAlwaysHostOnly(t *testing.T) {
    cfg := &config.Config{
        Environment: "production",
        SharedCookieDomain: ".alive.org.tw",
        ASSessionCookieName: "hhc_sso",
    }
    // Exercise setRefreshTokenCookie and setASSessionCookie and inspect Set-Cookie.
}
\`\`\`

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
go test ./internal/handlers -run 'Test(AuthCookiesAreAlwaysHostOnly|DeviceCookieUsesSharedDomain)' -count=1
\`\`\`

Expected: FAIL because \`CookieDomain\` still scopes refresh and SSO cookies.

- [ ] **Step 3: Implement the cookie policy**

Replace the single-purpose ambiguity with:

\`\`\`go
LegacyCookieDomain string \`env:"COOKIE_DOMAIN" envDefault:""\`
SharedCookieDomain string \`env:"SHARED_COOKIE_DOMAIN" envDefault:""\`
\`\`\`

Use host-only names selected by environment:

\`\`\`go
func authCookieName(cfg *config.Config, name string) string {
    if cfg.IsProduction() {
        return "__Host-" + name
    }
    return name
}
\`\`\`

Read the host-only name first and legacy \`refresh_token\`/configured SSO name
second. New issuance expires matching legacy parent-domain cookies. Device and
SSO-hint helpers use only \`SharedCookieDomain\`.

- [ ] **Step 4: Run handler and config tests**

\`\`\`bash
go test ./internal/handlers ./internal/config -count=1
\`\`\`

- [ ] **Step 5: Commit**

\`\`\`bash
git add internal/config internal/handlers .env.example .env.production
git commit -m "fix: isolate browser authentication cookies"
\`\`\`

### Task 2: Separate Browser And Native Refresh Delivery

**Files:**
- Create: \`/Users/rayselfs/Projects/hhc/account/account-api/migrations/000004_oauth_token_delivery.up.sql\`
- Create: \`/Users/rayselfs/Projects/hhc/account/account-api/migrations/000004_oauth_token_delivery.down.sql\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/models/oauth_client.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/services/oauth_client_service.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/admin_oauth_client_handler.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/handlers/oauth_handler.go\`
- Modify: \`/Users/rayselfs/Projects/hhc/account/account-api/internal/database/db.go\`
- Test: OAuth client model/service/handler tests.

**Interfaces:**
- Produces: \`OAuthTokenDeliveryBrowserCookie\`, \`OAuthTokenDeliveryNativeBody\`, and \`UsesBrowserCookie()\`.
- Consumes: the registered OAuth client after authorization-code validation.

- [ ] **Step 1: Write failing tests**

\`\`\`go
func TestBrowserOAuthClientOmitsRefreshTokenFromJSON(t *testing.T) {}
func TestNativeOAuthClientReturnsRefreshTokenWithoutCookie(t *testing.T) {}
\`\`\`

Assert no response delivers the same refresh token through both cookie and JSON.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
go test ./internal/models ./internal/handlers -run 'Test(BrowserOAuth|NativeOAuth|OAuthClientTokenDelivery)' -count=1
\`\`\`

- [ ] **Step 3: Add migration and model enum**

\`\`\`go
type OAuthTokenDelivery string

const (
    OAuthTokenDeliveryBrowserCookie OAuthTokenDelivery = "browser_cookie"
    OAuthTokenDeliveryNativeBody OAuthTokenDelivery = "native_body"
)
\`\`\`

Migration adds non-null \`token_delivery\`, sets \`admin-web\`, \`www-web\`, and
\`account-console\` to \`browser_cookie\`, keeps \`hhc-desktop\` as
\`native_body\`, and adds a check constraint.

- [ ] **Step 4: Apply delivery in OAuth token responses**

For \`browser_cookie\`, set the host-only refresh cookie and omit
\`refresh_token\` from JSON. For \`native_body\`, return the token in JSON and do
not emit \`Set-Cookie\`. Carry the field through OAuth client create/update APIs.

- [ ] **Step 5: Run tests and commit**

\`\`\`bash
go test ./internal/models ./internal/services ./internal/handlers -count=1
git add migrations internal
git commit -m "feat: separate browser and native token delivery"
\`\`\`

### Task 3: Add Device-Bound Silent SSO

**Files:**
- Modify: \`internal/models/as_session.go\`, \`internal/models/auth_code.go\`
- Modify: \`internal/repository/interfaces.go\`, \`internal/repository/as_session_repo.go\`
- Modify: \`internal/services/as_session_service.go\`, \`internal/services/authorization_service.go\`
- Modify: \`internal/handlers/oauth_handler.go\` and direct/social/MFA login call sites.
- Test: corresponding Account repository, service, and handler tests.

**Interfaces:**
- Produces: \`CreateSession(ctx, userID, deviceID, ip, userAgent)\`, \`DeleteDeviceSessions(ctx, userID, deviceID)\`, and OAuth \`prompt=none\`.
- Consumes: stable \`user_devices.id\` after successful authentication.

- [ ] **Step 1: Write failing tests**

\`\`\`go
func TestAuthorizePromptNoneReturnsLoginRequiredWithoutRenderingLogin(t *testing.T) {}
func TestASSessionDeleteForDeviceLeavesOtherDevicesSignedIn(t *testing.T) {}
\`\`\`

Also assert valid SSO immediately redirects with code/state and stale SSO is
cleared.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
go test ./internal/repository ./internal/services ./internal/handlers -run 'Test(AuthorizePromptNone|ASSession)' -count=1
\`\`\`

- [ ] **Step 3: Index SSO and implement prompt semantics**

Store records at \`as_session:{sessionID}\` and membership at
\`as_sessions:{userID}:{deviceID}\`. Persist \`Prompt\` in the auth request. A
missing SSO session with \`prompt=none\` redirects only to the prevalidated URI:

\`\`\`text
{redirect_uri}?error=login_required&state={state}
\`\`\`

Default requests continue to the Account login route.

- [ ] **Step 4: Run all Account tests and commit**

\`\`\`bash
go test ./... -count=1
git add internal
git commit -m "feat: add device-bound browser sso"
\`\`\`

### Task 4: Add Current-Device Global Sign-Out

**Files:**
- Modify: \`internal/services/token_service.go\`, \`internal/services/as_session_service.go\`
- Modify: \`internal/handlers/auth_handler.go\`, \`internal/routes/routes.go\`
- Test: token service, auth handler, and route tests.

**Interfaces:**
- Produces: \`POST /api/account/v1/session/logout-all\` and read-only refresh metadata lookup.
- Consumes: refresh metadata \`UserID\` and \`DeviceID\`, existing CSRF middleware, and \`RevokeDeviceSessions\`.

- [ ] **Step 1: Write failing global logout tests**

Create Account/Admin/Web sessions on one device and another session on a second
device. Assert logout-all removes only the first device's refresh and SSO
records, clears current-host refresh and shared hint cookies, and requires CSRF.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
go test ./internal/services ./internal/handlers ./internal/routes -run 'Test.*LogoutAll' -count=1
\`\`\`

- [ ] **Step 3: Implement and register logout-all**

Resolve refresh metadata, call \`RevokeDeviceSessions(userID, deviceID)\` and
SSO \`DeleteDeviceSessions(userID, deviceID)\`, then clear cookies. Register:

\`\`\`go
csrfProtected.POST("/session/logout-all", authHandler.LogoutAll)
\`\`\`

Invalid refresh is idempotently signed out; storage errors return 500 without
claiming success.

- [ ] **Step 4: Run all Account tests and commit**

\`\`\`bash
go test ./... -count=1
git add internal
git commit -m "feat: add current-device global logout"
\`\`\`

### Task 5: Expose Narrow Same-Origin Gateway Routes

**Files:**
- Modify: \`/Users/rayselfs/Projects/hhc/account/api-gateway/conf.d/default.conf\`
- Modify: gateway auth and www routing scripts.
- Modify: gateway CMS roadmap.

**Interfaces:**
- Produces: exact Admin/Web allowlists for token, refresh, summary, CSRF, and logout-all.
- Consumes: unchanged Account API paths and unmodified host-only \`Set-Cookie\`.

- [ ] **Step 1: Add failing route assertions**

Assert exact locations only, no broad Account prefix on Web/Admin, method
restrictions, and no \`proxy_cookie_domain\`.

- [ ] **Step 2: Verify scripts fail**

\`\`\`bash
sh scripts/test-auth-routing.sh
sh scripts/test-www-routing.sh
\`\`\`

- [ ] **Step 3: Add routes and verify**

Admin adds \`/session\` and \`/session/logout-all\`. Web adds \`/oauth/token\`,
\`/refresh\`, and \`/session/logout-all\`.

\`\`\`bash
sh scripts/test-auth-routing.sh
sh scripts/test-www-routing.sh
docker build -t hhc-api-gateway:sso .
docker run --rm hhc-api-gateway:sso nginx -t
\`\`\`

- [ ] **Step 4: Commit**

\`\`\`bash
git add conf.d scripts docs
git commit -m "feat: route isolated browser sso sessions"
\`\`\`

### Task 6: Share Browser OAuth And Logout Client Logic

**Files:**
- Create: \`packages/account-client/src/oauth.ts\`, \`packages/account-client/src/oauth.test.ts\`
- Modify: \`packages/account-client/src/index.ts\`, \`packages/account-client/src/index.test.ts\`
- Modify: \`apps/admin/src/auth/pkce.ts\` and tests.

**Interfaces:**
- Produces: PKCE transaction helpers, safe return-path validation, authorize URL building, and \`logoutAll()\`.
- Consumes: app-owned storage keys, navigation, labels, and runtime URLs; no router/UI dependency.

- [ ] **Step 1: Write failing package tests**

Assert S256 PKCE, \`pathname+search+hash\` preservation, transaction expiry,
state validation, \`prompt=none\`, and CSRF-before-logout-all.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
pnpm --filter @hhc/account-client test -- --run
\`\`\`

- [ ] **Step 3: Implement minimal helpers**

Move pure PKCE/storage behavior from Admin. Reject \`//\` and cross-origin return
values. Keep storage keys configurable. Add \`logoutAll()\` to the session client.

- [ ] **Step 4: Verify and commit**

\`\`\`bash
pnpm --filter @hhc/account-client test -- --run
pnpm --filter @hhc/admin test -- --run src/auth/pkce.test.ts
git add packages/account-client apps/admin/src/auth
git commit -m "feat: share browser sso client logic"
\`\`\`

### Task 7: Make Admin SSO Automatic And Loop-Safe

**Files:**
- Modify: \`apps/admin/src/auth/auth-context.tsx\`, \`apps/admin/src/lib/api.ts\`
- Modify: \`apps/admin/src/App.tsx\`, login/callback pages, and \`AppLayout.tsx\`
- Test: Admin app, context, and callback tests.

**Interfaces:**
- Produces: refresh-first bootstrap, automatic Account authorization, exact route restore, recoverable errors, and global logout.
- Consumes: Task 6 helpers and Task 5 routes.

- [ ] **Step 1: Write failing lifecycle tests**

Assert valid refresh causes no redirect; missing refresh starts one authorization
before protected UI renders; callback restores full route; failure does not
loop; logout-all succeeds before frontend state clears.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
pnpm --filter @hhc/admin test -- --run
\`\`\`

- [ ] **Step 3: Implement the UX**

Keep a neutral shared-canvas bootstrap. Save one attempt marker per return URL.
Only callback, forbidden, and recoverable login-error routes bypass automatic
authorization. On logout success, clear state and use \`location.replace\` to the
localized Account login page. On failure, retain the authenticated shell and
show a retryable error.

- [ ] **Step 4: Verify and commit**

\`\`\`bash
pnpm --filter @hhc/admin test -- --run
pnpm --filter @hhc/admin lint
pnpm --filter @hhc/admin build
git add apps/admin
git commit -m "feat: add seamless admin sso"
\`\`\`

### Task 8: Align Account Global Logout

**Files:**
- Modify: \`apps/account/src/lib/api.ts\`, \`apps/account/src/auth/auth-context.tsx\`
- Modify: \`apps/account/src/pages/LoginPage.tsx\` and localized messages.
- Test: Account API client, auth context, and login page tests.

**Interfaces:**
- Produces: Account menu global logout and localized signed-out feedback.
- Consumes: logout-all and existing CSRF request handling.

- [ ] **Step 1: Write failing tests**

Assert logout uses logout-all, retains auth state on failure, clears on success,
and renders a one-time non-error signed-out message.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
pnpm --filter @hhc/account test -- --run
\`\`\`

- [ ] **Step 3: Implement, verify, and commit**

Use the existing CSRF mechanism and replace history with
\`/login?signed_out=1\`. The public login route must not call refresh.

\`\`\`bash
pnpm --filter @hhc/account test -- --run
pnpm --filter @hhc/account lint
pnpm --filter @hhc/account build
git add apps/account
git commit -m "feat: align account global logout"
\`\`\`

### Task 9: Add Passive Public-Web SSO

**Files:**
- Create: \`apps/web/src/app/oauth/callback/page.tsx\`
- Create: \`apps/web/src/components/layout/WebOAuthCallback.tsx\` and test.
- Modify: \`apps/web/src/components/layout/AccountControl.tsx\` and test.

**Interfaces:**
- Produces: one-attempt \`prompt=none\` Web SSO, host-only \`www-web\` session, and in-place global logout.
- Consumes: shared OAuth helpers, \`hhc_sso_hint\`, and Web same-origin routes.

- [ ] **Step 1: Write failing Web tests**

Assert no hint means no redirect; hint means one attempt; \`login_required\`
does not loop; callback restores localized URL; global logout updates the header
only after success.

- [ ] **Step 2: Verify tests fail**

\`\`\`bash
pnpm --filter @hhc/web test:run
\`\`\`

- [ ] **Step 3: Implement passive SSO**

Read only the boolean hint, store suppression before redirect, use
\`client_id=www-web\` and \`prompt=none\`, and never make public content depend on
the auth result.

- [ ] **Step 4: Verify and commit**

\`\`\`bash
pnpm --filter @hhc/web test:run
pnpm --filter @hhc/web lint
pnpm --filter @hhc/web build
git add apps/web
git commit -m "feat: add passive public web sso"
\`\`\`

### Task 10: Document And Verify The Vertical Flow

**Files:**
- Create: \`docs/runbooks/browser-sso-local.md\`
- Modify: the existing Account token contract spec.
- Modify: Account API deployment docs and Gateway CMS roadmap.

- [ ] **Step 1: Write the local runbook**

Document distinct hostnames, startup order, seeded Admin/MFA path, cookie
inspection without logging values, and the expected redirect/cookie matrix.

- [ ] **Step 2: Run complete automated verification**

\`\`\`bash
cd /Users/rayselfs/Projects/hhc/account/account-api && go test ./... -count=1
cd /Users/rayselfs/Projects/hhc/account/api-gateway && sh scripts/test-auth-routing.sh && sh scripts/test-www-routing.sh
cd /Users/rayselfs/Projects/hhc/hhc-web && pnpm test && pnpm lint && pnpm build
\`\`\`

- [ ] **Step 3: Run browser QA**

Verify first Account login/MFA, first Admin redirect, second Admin load without
redirect, Web passive SSO, host cookie isolation, exact return route, current
device global logout, and another device remaining signed in.

- [ ] **Step 4: Commit docs in each owning repo**

\`\`\`bash
git commit -am "docs: document isolated browser sso"
\`\`\`

