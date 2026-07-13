# HHC Account FE And Gateway Login Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `account.alive.org.tw` as a real account login/profile/security frontend in a new `account-fe` project, wire it through `api-gateway`, and leave the auth contract ready for `admin.alive.org.tw` and the future desktop app.

**Architecture:** `account-fe` owns the browser account console. `account-api` owns account APIs, OAuth/OIDC, token issuance, refresh/session behavior, MFA, roles/scopes, and JWKS. `api-gateway` routes account host traffic to the correct upstreams and later validates access JWTs locally for protected non-account APIs.

**Tech Stack:** Vite, React, TypeScript, HeroUI v3, Tailwind CSS v4, Vitest, Testing Library, existing Go `account-api`, existing Nginx `api-gateway`, Dapr service invocation.

## Global Constraints

- Create `account-fe` at `/Users/rayselfs/Projects/hhc/account/account-fe`.
- Remove the accidental `account-api` embedded console work before implementing this plan.
- Do not put the account console inside `account-api`.
- Do not create `api.alive.org.tw`.
- `account.alive.org.tw` serves account UI plus account-owned API/OAuth/JWKS paths only.
- `admin.alive.org.tw` must not implement its own login form; it uses account OAuth/OIDC.
- Future desktop login must keep using its own OAuth client with PKCE; do not make account flow admin-only.
- Use native `fetch` first; do not add axios unless a concrete need appears.

---

## Task 0: Clean Up The Wrong Account API Console Diff

**Repo:** `/Users/rayselfs/Projects/hhc/account/account-api`

**Files:**
- Delete: `internal/console/`
- Modify: `internal/routes/routes.go`

**Steps:**
- [ ] Remove `console.RegisterRoutes(r)` from `internal/routes/routes.go`.
- [ ] Remove the `internal/console` package and embedded assets.
- [ ] Run `gofmt` only on modified Go files.
- [ ] Run `GOCACHE=/private/tmp/account-api-go-build-cache go test ./...`.

## Task 1: Create Account FE Project

**Repo:** `/Users/rayselfs/Projects/hhc/account/account-fe`

**Interfaces:**
- `VITE_ACCOUNT_API_BASE_URL=/api/account/v1`
- `VITE_ALLOWED_REDIRECT_ORIGINS=https://admin.alive.org.tw,https://admin-test.alive.org.tw,https://www.alive.org.tw,https://www-test.alive.org.tw,http://localhost:5173,http://localhost:3000`
- `VITE_ALLOWED_REDIRECT_SCHEMES=hhc`

**Behavior:**
- Build a Vite React app with HeroUI v3 and Tailwind v4.
- Use a small typed fetch client with `credentials: "include"`, CSRF header support, API error normalization, and one refresh retry on `401`.
- Keep access token in React memory state only; recover page reloads through `/refresh` and the `account-api` HttpOnly refresh cookie.
- Do not store refresh tokens in browser JavaScript storage.

**Routes:**
- `/login`
- `/profile`
- `/security`
- `/reset-password`
- `/oauth/callback`

**Steps:**
- [ ] Scaffold Vite React TypeScript app.
- [ ] Install HeroUI v3, Tailwind v4, Vitest, Testing Library, and jsdom.
- [ ] Add typed env parsing for API base URL and redirect allowlists.
- [ ] Add account API client for CSRF, login, refresh, logout, profile, password, MFA, devices, linked accounts, forgot/reset password, and OAuth providers.
- [ ] Add auth state provider with memory access token and refresh-on-load.

## Task 2: Implement Login, MFA, Profile, And Security Console

**Account FE Behavior:**
- `/login` supports direct login and OAuth login continuation.
- If URL contains `auth_request_id`, every login/MFA request passes it to `account-api`.
- If login response has `redirect_type: "oauth"`, redirect only after validating `redirect_uri` against configured web origins or `hhc://` scheme.
- `mfa_type: "setup_required"` opens forced setup flow using `/mfa/setup-with-token` and `/mfa/verify-setup-with-token`.
- `mfa_type: "verification_required"` uses `/mfa/verify`.
- Social login buttons are shown only when `auth_request_id` exists because current social callback requires an OAuth auth request.
- `/profile` edits names/avatar and displays email, roles, and account state.
- `/security` supports change password, MFA setup/disable/backup codes, device list/logout, and linked account unlink.

**Tests:**
- [ ] API client attaches CSRF token on mutations.
- [ ] API client refreshes once after `401`.
- [ ] Direct login stores access token in memory and loads profile.
- [ ] OAuth login with `auth_request_id` redirects to allowed `admin.alive.org.tw` callback.
- [ ] OAuth login blocks unsafe redirect URI.
- [ ] Desktop `hhc://callback` redirect remains allowed.
- [ ] MFA setup-required flow completes login.
- [ ] MFA verification-required flow completes login.
- [ ] Profile and security forms call expected account API endpoints.

## Task 3: Route Account Host Through API Gateway

**Repo:** `/Users/rayselfs/Projects/hhc/account/api-gateway`

**Current State To Preserve:**
- Gateway is currently `nginx:1.30.3-alpine-slim`.
- It routes through Dapr service invocation.
- It currently has no JWT verifier.

**Gateway Upstreams:**
- Add `account_fe_app="account-fe${env_suffix}"`.
- Add `account_api_app="account-api${env_suffix}"`.
- Add corresponding Dapr bases in `conf.d/common/fqdn.conf`.

**Account Host Routing:**
- `account.alive.org.tw/`, `/login`, `/profile`, `/security`, `/reset-password`, `/oauth/callback`, and static assets route to `account-fe`.
- `account.alive.org.tw/api/account/v1/*` routes to `account-api`.
- `account.alive.org.tw/.well-known/jwks.json` routes to `account-api`.
- If account-api later exposes OIDC discovery metadata, route `/.well-known/openid-configuration` to `account-api`.
- `account.alive.org.tw/priv/*`, `/api/priv/*`, `/api/admin/*`, and CMS/public website APIs return `404` or `403`.

**Admin Prep:**
- Keep `admin.alive.org.tw` UI-only.
- Reject `admin.alive.org.tw/api/*`.
- Admin will start OAuth Authorization Code + PKCE at `https://account.alive.org.tw/api/account/v1/oauth/authorize`.
- Account FE must support `/login?auth_request_id=...` so account-api can complete the admin auth request after login/MFA.
- Register/verify `admin-web` or `hhc-admin` OAuth client redirect URI as `https://admin.alive.org.tw/oauth/callback`.

**Gateway Tests:**
- [ ] `Host: account.alive.org.tw GET /login` proxies to `account-fe`.
- [ ] `Host: account.alive.org.tw GET /api/account/v1/csrf-token` proxies to `account-api`.
- [ ] `Host: account.alive.org.tw GET /.well-known/jwks.json` proxies to `account-api`.
- [ ] `Host: account.alive.org.tw GET /api/admin/pages` is rejected.
- [ ] `Host: admin.alive.org.tw GET /api/account/v1/me` is rejected.
- [ ] Existing LINE and Bible routes still work.

## Task 4: Decide Gateway JWT Implementation Before Protected Admin APIs

**Decision:** Do not add JWT verification for the first account-fe smoke if only account host routing is needed. Add it before any protected `www.alive.org.tw/api/admin/*`, asset protected/admin route, or admin UI production flow is enabled.

**Preferred v1:** keep Nginx base and add a local Go verifier sidecar or second process. This is the chosen direction.

**Why:** `account-api` signs with EdDSA/Ed25519 today; stock Nginx has no native JWT validation and NGINX Plus is not available. Third-party JWT modules are not a v1 dependency, and writing a custom Nginx module is unnecessary ownership risk. A small Go verifier can use maintained Go JWT/JWKS libraries and keep Nginx route config simple.

**Rejected v1 options:**
- NGINX Plus `auth_jwt`, because the deployment does not have NGINX Plus.
- Third-party Nginx JWT modules, including `kjdev/nginx-auth-jwt`, because dependency confidence is not high enough for this auth boundary.
- Custom Nginx C module, because it adds build, ABI, security-review, and operations burden for logic Go can own cleanly.
- OpenResty/Lua, unless the Go verifier fails a concrete requirement.

**JWT Verifier Contract:**
- Listens on `127.0.0.1:10001`.
- Nginx calls it through `auth_request`.
- Fetches JWKS from `https://account.alive.org.tw/.well-known/jwks.json`.
- Supports the active account-api signing algorithm, including EdDSA/Ed25519.
- Validates issuer, audience, token type, expiry, `nbf`, `kid`, roles, and scopes.
- Returns trusted headers only on success:
  - `X-HHC-User-ID`
  - `X-HHC-Roles`
  - `X-HHC-Scopes`
  - `X-HHC-Token-ID`
  - `X-HHC-Session-ID`
- Gateway strips client-supplied `X-HHC-*`, `X-User-ID`, `X-Roles`, and `X-Permissions` before proxying.

**Base Image Choice:**
- Keep `nginx:1.30.3-alpine-slim` for routing-only account-fe phase.
- For JWT phase, either:
  - ACA multi-container: Nginx container + `jwt-verifier` Go container, preferred if available.
  - Single image: multi-stage build copies `jwt-verifier` binary and starts Nginx plus verifier with a minimal entrypoint.
- Do not switch away from the Go verifier approach unless it fails a concrete requirement.

**JWT Tests:**
- [ ] Valid EdDSA token reaches protected test upstream.
- [ ] Missing token returns `401`.
- [ ] Expired token returns `401`.
- [ ] Wrong issuer returns `401`.
- [ ] Wrong audience returns `401`.
- [ ] Missing CMS scope returns `403`.
- [ ] Unknown `kid` triggers one JWKS refresh and then fails closed.

## Task 5: Admin Login Readiness Gate

**Admin must not start until all are true:**
- `account-fe /login` works through `account.alive.org.tw`.
- Direct login, MFA setup-required, MFA verification-required, profile, refresh, and logout pass through gateway.
- OAuth `auth_request_id` login flow returns to an allowed `admin.alive.org.tw/oauth/callback`.
- Future desktop `hhc://callback` remains allowed and tested.
- Gateway rejects account-host CMS/admin APIs and admin-host API paths.
- Gateway JWT verifier plan is implemented or explicitly queued before protected admin APIs.

**Admin Prep Contract:**
- Admin frontend will not store refresh tokens.
- Admin uses Authorization Code with PKCE.
- Admin starts login by redirecting to account-api authorize endpoint on account host.
- Admin receives callback at `/oauth/callback`, exchanges code through account-api token endpoint if its architecture supports browser public client flow, then calls protected APIs under `www.alive.org.tw/api/admin/*`.
- Missing/expired admin access token redirects back to account login; it never shows a local admin login form.
