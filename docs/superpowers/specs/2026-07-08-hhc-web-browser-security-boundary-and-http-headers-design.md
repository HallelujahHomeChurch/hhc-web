# HHC Web Browser Security Boundary And HTTP Headers Design

## Purpose

This spec defines the browser-facing security boundary for `www.alive.org.tw`, `admin.alive.org.tw`, and `account.alive.org.tw`. It turns scattered rules about CSP, CORS, CSRF, cookies, cache headers, and asset download headers into route-class profiles that can be implemented by `api-gateway`, `hhc-web`, `hhc-web-api`, `asset-api`, and `account-api`.

The goal is to make the website and CMS safe in both states:

- current `hhc-web` static export
- future Next.js server delivery behind `api-gateway`

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`

## External Alignment

- OWASP Content Security Policy Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html`
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html`
- OWASP HTTP Security Response Headers Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html`
- MDN Content Security Policy guide: `https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP`
- MDN `frame-ancestors`: `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors`
- MDN Strict-Transport-Security: `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security`

## Core Decision

Use route-class security header profiles enforced at the gateway and refined by the serving application. Do not create a `security-header-api`, `cors-api`, or shared middleware service.

Ownership:

| Owner | Responsibility |
| --- | --- |
| `api-gateway` | mandatory edge headers, host/path profile selection, CORS allowlist, blocked paths, header stripping, public/private route separation |
| `hhc-web` | HTML CSP nonce support after Next server cutover, admin/public HTML cache and robot headers, frontend external-resource inventory |
| `hhc-web-api` | public/admin API cache headers, ETags, `Vary`, no-store admin responses, origin checks for unsafe browser requests |
| `asset-api` | download headers, content type, disposition, cache policy, no raw Blob/SAS exposure |
| `account-api` | OIDC/session cookies, refresh cookie, CSRF/origin checks, account-domain CORS |

This keeps browser hardening close to the routes that need it while leaving `api-gateway` as the first public enforcement point.

## Browser-Facing Surfaces

| Surface | Host | Browser Role | Primary Risk |
| --- | --- | --- | --- |
| Public website HTML | `www.alive.org.tw` | public pages | XSS, stale public content, third-party resource drift |
| Public APIs | `www.alive.org.tw/api/*` | same-origin public data | stale projection, overbroad CORS, JSON sniffing |
| Admin UI | `admin.alive.org.tw` | CMS console only | token theft, clickjacking, cached admin state |
| Admin APIs | `www.alive.org.tw/api/admin/*` | protected CMS calls from admin UI | CORS mistakes, bearer token misuse, CSRF if cookies are later introduced |
| Account/OIDC | `account.alive.org.tw` | login, token, JWKS, account APIs | refresh token theft, CSRF, origin confusion |
| Public assets | `www.alive.org.tw/api/assets/public/*` | published files/images/PDFs | raw Blob leakage, MIME sniffing, stale public grant |
| Protected assets | `www.alive.org.tw/api/assets/protected/*` | authenticated file access | private file exposure, browser cache leakage |
| Webhooks | `www.alive.org.tw/api/line/webhook/*`, provider callbacks | provider-to-service calls | forged browser requests, permissive CORS |

## Header Profiles

### Shared Baseline

All browser-facing responses should include:

```http
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

After HTTPS and custom domains are stable, add:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Do not submit HSTS preload until all relevant subdomains are permanently HTTPS-ready, including `www`, `admin`, `account`, staging/test host decisions, and any apex redirect behavior.

### Public Website HTML

Public HTML should be cacheable only when it is derived from published public projections or static approved content.

Recommended headers:

```http
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60
X-Robots-Tag: index, follow
```

Third-party provider, analytics, embed, consent, and provider-scoped CSP expansion rules are specified in `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.

Initial CSP profile:

```http
Content-Security-Policy-Report-Only: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://account.alive.org.tw; img-src 'self' data: https://img.youtube.com; connect-src 'self' https://www.alive.org.tw; frame-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests
```

Enforced public CSP can be enabled after report-only violations are reviewed and Next.js/static export requirements are known. If the public site later needs to be embedded by an approved parent, add that parent to `frame-ancestors` explicitly. If the public site later embeds YouTube instead of linking out, add only the required YouTube frame domains to `frame-src`; do not broaden `default-src`.

Current `hhc-web` uses YouTube thumbnails and outbound links, so v1 does not need `frame-src` for YouTube embeds.

### Admin UI HTML

Admin HTML is never public-cacheable and must not be indexed or framed.

Required headers:

```http
Cache-Control: no-store
X-Robots-Tag: noindex, nofollow
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action https://account.alive.org.tw; img-src 'self' data: blob: https://www.alive.org.tw; connect-src 'self' https://www.alive.org.tw https://account.alive.org.tw; frame-src 'none'; script-src 'self' 'nonce-{per-response-nonce}'; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests
```

`script-src` nonce enforcement requires Next.js server delivery or a static-host mechanism that can generate per-response nonces. While `hhc-web` is static-exported, use report-only CSP for admin preview builds and enforce the full policy when the admin console is served by the Next server or another nonce-capable host.

### Public APIs

Public JSON APIs are same-origin by default. They should not need broad CORS.

Recommended headers:

```http
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff
Cache-Control: public, max-age=30, s-maxage=120
ETag: "<projection-version-or-hash>"
Vary: Accept-Language, Accept-Encoding
```

Rules:

- no `Access-Control-Allow-Origin: *` unless a route is intentionally public for third-party use
- no credentialed public CORS
- no cookies for public API authorization
- no draft, private, deleted, redacted, or legally held data in public API responses

### Admin APIs

Admin APIs are protected browser APIs under `www.alive.org.tw/api/admin/*` and are called by the admin UI on `admin.alive.org.tw`.

Required headers:

```http
Cache-Control: no-store
Content-Type: application/json; charset=utf-8
X-Content-Type-Options: nosniff
Vary: Origin
Access-Control-Allow-Origin: https://admin.alive.org.tw
Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key, If-Match, X-Request-Id
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

Rules:

- do not set `Access-Control-Allow-Credentials: true` for normal admin APIs
- require bearer access token in `Authorization`
- reject cookie-only authorization
- reject browser-supplied `X-HHC-*`, `X-Internal-*`, role, or scope headers
- require allowed `Origin` for unsafe browser methods as defense in depth
- include `Vary: Origin` when CORS is dynamic

### Account/OIDC And Refresh

`account-api` owns login, OIDC, token, refresh, account APIs, and JWKS.

Refresh token cookie rule:

```http
Set-Cookie: hhc_refresh=...; Path=/; HttpOnly; Secure; SameSite=Lax
```

The refresh cookie should be host-only on `account.alive.org.tw`. Do not use a domain-wide `.alive.org.tw` refresh cookie. Browser SSO across subdomains should happen through redirects to `account.alive.org.tw`, where the account-domain cookie is available.

Account CORS rules:

- allow `https://admin.alive.org.tw` only for account-domain browser flows that need it
- allow credentials only on endpoints that intentionally use account-domain cookies
- require CSRF token or equivalent account-domain anti-CSRF mechanism for cookie-authenticated unsafe methods
- check `Origin` and fallback `Referer` for cookie-authenticated unsafe methods
- OIDC authorization flow must use `state` and PKCE

JWKS is public but should be cached with explicit max age and must not require browser credentials.

### Public Asset Downloads

Public asset downloads are mediated by `asset-api`.

Required headers:

```http
X-Content-Type-Options: nosniff
Content-Type: <server-detected-type>
Content-Disposition: inline; filename="<sanitized-filename>"
Cache-Control: public, max-age=300
```

Rules:

- do not expose Blob URLs, SAS URLs, account names, container names, or raw object paths
- only public assets with clean scan state and active public grant are downloadable
- weekly bulletin PDFs may use `inline` or `attachment` based on product decision, but the filename must be sanitized
- revoked assets must stop being publicly downloadable even if old links are used

### Protected And Admin Asset Downloads

Protected/admin asset responses must prevent browser cache leakage.

Required headers:

```http
Cache-Control: no-store
X-Content-Type-Options: nosniff
Content-Disposition: attachment; filename="<sanitized-filename>"
```

Rules:

- require JWT and asset grant/resource authorization
- do not return raw Blob/SAS URLs
- preview asset routes are no-store and noindex
- draft assets must not create public asset grants

### Webhooks And Provider Callbacks

Webhook routes are not browser APIs.

Rules:

- do not emit CORS headers
- method-limit to provider-required methods
- body-size-limit at gateway and service
- signature-verify in the owning service
- use stable public errors without leaking provider secrets

## CORS Policy

Default CORS posture:

| Route Class | Browser Origin Allowed | Credentials |
| --- | --- | --- |
| Public website same-origin APIs | same-origin `www.alive.org.tw` | no |
| Public APIs for third-party use | none in v1 unless explicitly approved | no |
| Admin APIs | `https://admin.alive.org.tw` | no |
| Account browser APIs | `https://admin.alive.org.tw`, account-origin flows | endpoint-specific |
| Asset public downloads | normal navigation/download, no API credentials | no |
| Webhooks | no browser CORS | no |

Forbidden:

- wildcard CORS with credentials
- reflecting arbitrary `Origin`
- allowing `Authorization` from unapproved origins
- using CORS as authorization
- using environment defaults that silently open CORS in production

## CSRF Policy

Admin APIs use bearer access tokens and reject cookie-only authorization. This means the normal CMS API path is not cookie-authenticated and should not rely on CSRF tokens for primary protection.

Defense in depth for unsafe browser methods:

- require `Authorization: Bearer ...`
- require `Origin: https://admin.alive.org.tw`
- reject missing/foreign origin for browser-origin unsafe methods unless a documented non-browser client route exists
- use idempotency keys for side effects
- keep admin API responses `no-store`

Cookie-authenticated account endpoints require anti-CSRF protection:

- SameSite cookie
- CSRF token or equivalent account-domain mechanism
- `Origin`/`Referer` validation
- no wildcard credentialed CORS

If a future Next.js admin BFF uses an admin-host cookie, that BFF must add CSRF tokens and same-origin POST protections. It must not weaken the gateway-local JWT validation contract for backend APIs.

## Cookie Policy

| Cookie | Domain | Purpose | Attributes |
| --- | --- | --- | --- |
| account session | `account.alive.org.tw` | account login continuity | `HttpOnly; Secure; SameSite=Lax` |
| refresh token, if browser refresh is enabled | `account.alive.org.tw` | refresh token family | `HttpOnly; Secure; SameSite=Lax; Path=/` |
| locale preference | host or `.alive.org.tw` if product needs cross-subdomain language continuity | non-sensitive UI preference | `Secure; SameSite=Lax`; no auth or private data |
| admin BFF session, if introduced later | `admin.alive.org.tw` | server-side admin UI session | `HttpOnly; Secure; SameSite=Lax`; requires CSRF tokens |

Do not store access tokens or refresh tokens in `localStorage`. Do not put roles, scopes, private profile data, LINE ids, provider ids, or asset grants into readable cookies.

## CSP Rollout Strategy

Use a staged rollout because Next.js, fonts, generated scripts, and image domains can create noisy CSP violations.

1. Inventory current external resources: YouTube thumbnails, outbound YouTube links, map links, local fonts, future asset host routes.
2. Add report-only CSP to public HTML.
3. Add enforced CSP to admin HTML once nonce-capable serving is available.
4. Review violations and remove unnecessary external sources.
5. Enforce public CSP after expected public rendering and CMS media behavior is stable.

CSP violation reports should go to existing observability or log ingestion. Do not create a v1 `csp-report-api` unless violation volume and triage workflow justify it.

## Gateway Implementation Notes

`api-gateway` should select security profiles by host and route class:

- `www` public HTML
- `www` public API
- `www` admin API
- `www` public asset
- `www` protected/admin asset
- `admin` UI
- `account` pass-through/account profile
- webhook/provider callback

The gateway may set baseline headers and CORS. Applications should set route-specific `Cache-Control`, ETag, content type, and CSP nonce-dependent headers. If both set a header, the route-specific application value must be intentionally allowed by gateway policy and verified by tests.

## CI And Verification

Required checks before production promotion:

- header snapshot tests for public HTML, admin HTML, public API, admin API, public asset, protected asset, account refresh, and webhook routes
- CORS tests for allowed and disallowed origins
- credentialed wildcard CORS rejection test
- admin unsafe method origin check
- account refresh CSRF/origin test
- CSP report-only smoke for public HTML
- enforced admin CSP smoke when nonce-capable admin delivery is enabled
- asset download test proving no Blob/SAS URL exposure
- cache header test proving admin/preview/protected routes are `no-store`

Representative command shape:

```text
curl -I https://www.alive.org.tw/
curl -I https://admin.alive.org.tw/
curl -I -H "Origin: https://admin.alive.org.tw" https://www.alive.org.tw/api/admin/content
curl -I -H "Origin: https://evil.example" https://www.alive.org.tw/api/admin/content
curl -I https://www.alive.org.tw/api/assets/public/{assetId}
```

## Acceptance Criteria

- Browser-facing route classes have explicit security header profiles.
- Admin UI and admin APIs are no-store and noindex where applicable.
- Admin APIs allow `https://admin.alive.org.tw` without credentialed wildcard CORS.
- Account refresh cookies are host-only on `account.alive.org.tw` and protected by CSRF/origin checks.
- Public APIs remain same-origin by default and do not expose draft/private/deleted data.
- Public and protected asset downloads are mediated by `asset-api` and never expose Blob/SAS URLs.
- CSP rollout is staged so static export and Next server cutover both have a safe path.
- CI/rollout evidence includes header, CORS, CSRF, CSP, and cache behavior checks.
