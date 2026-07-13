# HHC First-Party Browser SSO Design

## Purpose

This spec defines browser authentication across `account.alive.org.tw`,
`admin.alive.org.tw`, and `www.alive.org.tw`. The goal is one interactive
sign-in, fast product entry, isolated credentials, and an unambiguous global
sign-out.

It supersedes parent-domain refresh-cookie guidance in
`2026-07-08-hhc-account-token-contract-design.md`. Locale, theme, and the
non-authoritative sign-in hint may be shared across subdomains; authentication
credentials must not be.

## Core Decision

Use the existing `account-api` authorization server and Authorization Code with
PKCE. Do not add a BFF service in this phase.

- `account-api` owns the central SSO record, OAuth authorization codes, access
  tokens, refresh rotation, and global revocation.
- Each browser product owns an independent host-only refresh cookie.
- Access tokens remain short-lived and in memory.
- A user authenticates with password, social login, and MFA only when the
  central Account SSO record is absent or policy requires reauthentication.
- Entering a new product may perform a fast redirect through Account once.
  Subsequent visits and reloads use that product's local session without a
  redirect.

SSO means one interactive authentication followed by separate product
sessions. It does not mean one shared refresh token.

## Cookie Contract

| Cookie | Scope | Security role |
| --- | --- | --- |
| `__Host-hhc_sso` | `account.alive.org.tw` only | Central authorization-server session |
| `__Host-refresh_token` | Current product host only | Product-specific refresh session |
| `hhc_device` | `.alive.org.tw` | Stable non-authentication device identifier |
| `hhc_sso_hint` | `.alive.org.tw` | Boolean performance hint only |
| `hhc_locale` | `.alive.org.tw` | Shared locale preference |
| `hhc_theme` | `.alive.org.tw` | Shared theme preference |

Production authentication cookies use `Secure`, `HttpOnly`, `Path=/`, and
`SameSite=Lax`. `__Host-` cookies never include `Domain`. The refresh cookie may
use the same name on Account, Admin, and Web because host-only cookies are
isolated by host.

`hhc_sso_hint` contains no user id, profile data, token, or authorization
claim. It is never accepted as proof of authentication. It only avoids passive
SSO attempts for browsers that have never signed in. A stale or forged hint
must produce an unauthenticated result without exposing data or creating a
redirect loop.

Configuration must separate these concerns. One `COOKIE_DOMAIN` setting must
not control refresh, central SSO, and device cookies.

## Product Login Flows

### Account Console

Account login completes password/social authentication and MFA, then creates:

1. A host-only central SSO session.
2. An `account-console` refresh session and host-only refresh cookie.
3. The shared non-authoritative sign-in hint.

Protected Account routes restore the access token from the Account refresh
cookie. Public Account auth routes do not call refresh before a cookie-backed
session is expected.

### Admin Console

Admin remains a public OAuth client using PKCE.

1. Admin bootstrap attempts same-origin refresh through the gateway.
2. If refresh succeeds, Admin restores the access token and profile without a
   redirect.
3. If refresh is absent or invalid, Admin saves the exact return URL and starts
   authorization before protected UI is rendered.
4. Account immediately returns an authorization code when central SSO is
   valid. No Account page is rendered in this case.
5. Otherwise Account shows login and MFA, then continues the existing request.
6. Admin exchanges the code through its same-origin gateway route. The response
   creates an `admin-web` refresh session and host-only Admin refresh cookie.
7. Admin replaces callback history and restores the original route.

The bootstrap screen uses the shared canvas and a restrained progress state.
It must not flash the Admin shell, login form, or an error before the auth
decision completes.

OAuth state, PKCE verifier, return URL, and a single-attempt marker stay in
`sessionStorage`. Invalid state, expired code, or repeated callback failure
shows a recoverable Account sign-in action instead of automatically looping.

### Public Website

The public website must never redirect anonymous users merely to render its
header.

1. It first checks its own host-only session through the existing same-origin
   session-summary endpoint.
2. If no Web session exists and `hhc_sso_hint` is absent, it renders the signed
   out account control.
3. If the hint exists, it may perform one passive authorization request with
   `prompt=none` before committing the account-control state.
4. A valid central SSO session returns a code and creates a host-only `hhc-web`
   refresh session through the Web same-origin token route.
5. `login_required` renders the signed-out state and suppresses another passive
   attempt for the current page session.

The public route and content remain usable throughout. Passive SSO is an
account-control enhancement, not a dependency for rendering public content.

## Authorization Endpoint Behavior

`GET /oauth/authorize` keeps the existing registered-client, redirect URI,
state, scope, and PKCE validation.

- Default behavior: show Account login when central SSO is unavailable.
- `prompt=none`: never render login or MFA. Return `error=login_required` to the
  registered redirect URI when SSO cannot complete silently.
- Valid SSO: create a one-time authorization code and redirect immediately.
- Invalid or expired SSO cookie: clear it when Account is the response host.

OAuth error redirects include the original state. Errors are sent only to a
redirect URI that passed registered-client validation.

## Global Sign-Out

The visible `Sign out` action in all three products means global sign-out for
the current browser device. It signs that browser out of every HHC product but
does not sign out the user's phone, another computer, or another browser
profile. `Sign out all devices` remains a separate, explicit Security action.

The product sends one same-origin, CSRF-protected request using its own refresh
cookie. `account-api` then:

1. Resolves the user and device from the active refresh session.
2. Revokes every refresh family for that user and device across all clients.
3. Deletes central SSO records for that user and device.
4. Clears the refresh cookie on the current response host.
5. Expires `hhc_sso_hint` on `.alive.org.tw`.
6. Returns success only after revocation state is durable.

Other hosts may retain an opaque cookie value that the current response cannot
physically clear. It is already invalid; the next refresh attempt clears that
host's cookie and renders the signed-out state. This must not cause an OAuth
loop.

Global sign-out does not require a visible redirect through Account. After the
request succeeds, Account and Admin navigate with `location.replace` to the
localized Account login page with a signed-out status; Web updates its header
in place.

If global revocation fails, the UI keeps the current authenticated state and
shows a retryable error. It must not claim that sign-out succeeded after only
clearing frontend memory.

## API And Gateway Changes

Account API adds or refines:

```text
GET  /api/account/v1/oauth/authorize?prompt=none
POST /api/account/v1/session/logout-all
```

`POST /session/logout-all` is CSRF protected and accepts a refresh cookie; it
does not require a bearer access token. Existing app-local logout remains an
internal lifecycle primitive but is not exposed by the shared product menu.

Admin and Web gateway hosts expose only the account routes needed by their
browser flow:

```text
GET  /api/account/v1/csrf-token
POST /api/account/v1/oauth/token
POST /api/account/v1/refresh
GET  /api/account/v1/session
POST /api/account/v1/session/logout-all
GET  /api/account/v1/me       # Admin only
```

All token, refresh, summary, and logout calls are same-origin from the browser.
The gateway forwards `Set-Cookie` without rewriting a host-only cookie to a
parent domain.

OAuth client registration gains an explicit token-delivery mode:

- `browser_cookie`: set the host-only refresh cookie and omit `refresh_token`
  from the JSON response.
- `native_body`: return the refresh token in the token response and do not set a
  browser cookie.

`admin-web` and `hhc-web` use `browser_cookie`. Native and desktop clients use
`native_body` and secure OS storage. Browser versus native delivery must not be
inferred from redirect URI shape because native loopback redirects can also use
HTTP. Existing clients are migrated explicitly, with no response that delivers
the same refresh token through both channels.

## Data And Revocation

Refresh metadata remains keyed by session, device, and client. Global sign-out
uses a user-and-device-to-refresh-session index or the existing token-service
equivalent; it must not scan Redis keys in a request.

Authorization-server sessions record the stable device id and gain a
user-and-device index so the current browser's SSO records can be deleted
atomically or idempotently. Creating, expiring, and deleting an SSO record keeps
the index consistent. Stale index members are harmless and cleaned
opportunistically.

## Local Development

Different ports on `localhost` do not isolate cookies. Full browser tests use
distinct local hostnames for Account, Admin, and Web through the local gateway.

Development cookie names remain host-only without the `__Host-` prefix when
local HTTPS is unavailable. Production uses the `__Host-` prefix and Secure
cookies. Unit and gateway tests assert both profiles.

## Verification

- Account login and MFA create Account refresh, SSO, device, and hint state.
- First Admin entry performs the authorization redirect and restores the exact
  requested route.
- Admin entry with a valid local refresh cookie performs no redirect.
- Admin entry with valid central SSO renders no Account login UI.
- Refresh cookies on Account, Admin, and Web do not overwrite one another.
- Public Web never redirects a browser without the sign-in hint.
- Passive Web SSO handles `login_required` once without looping.
- OAuth callback rejects mismatched state and expired/replayed code.
- Global sign-out revokes every client refresh family and central SSO record for
  the current browser device before reporting success, without affecting other
  devices.
- Reloading any product after global sign-out clears stale local state and stays
  signed out.
- CSRF, registered redirect URI, Origin, and PKCE checks remain enforced.

## Non-Goals

- No new BFF or identity microservice.
- No shared refresh token or parent-domain authentication cookie.
- No third-party iframe-based silent authentication.
- No desktop-app cookie dependency; native clients keep their own PKCE and
  secure-storage flow.
