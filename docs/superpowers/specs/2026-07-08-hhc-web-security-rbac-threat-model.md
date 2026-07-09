# HHC Web Security, RBAC, And Threat Model

## Purpose

This spec defines authentication, authorization, service identity, route protection, admin roles, asset permissions, and threat mitigations for the HHC web platform.

It complements:

- `docs/api/auth-headers.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`

## Security Principles

- Gateway is the first public gate.
- Backend services still enforce protected-route requirements.
- Route-level scopes are not enough for object-level access; services enforce resource state, ownership, visibility, and field-level response rules.
- Fail closed for auth, JWKS, missing identity headers, and unknown service identity.
- No public access to `/priv/*` or `/api/priv/*`.
- Least privilege for user roles and service app ids.
- Rate limits and quotas reduce abuse impact but never replace auth, grants, signatures, or service identity checks.
- Short-lived access tokens; refresh token revocation stays in `account-api`.
- Never expose Blob URLs, SAS URLs, refresh tokens, provider secrets, or internal service URLs to browsers or LINE users.
- Security-sensitive feature flags and kill switches are server-side only; frontend flags never replace backend authorization.
- Audit every protected write, permission denial, asset grant change, and notification command.

## Identity Types

| Identity Type | Source | Used For |
| --- | --- | --- |
| Anonymous public user | no JWT | published public website content and public assets |
| Authenticated account user | access JWT from `account-api` | future protected assets/member content |
| CMS admin user | access JWT with CMS roles/scopes | admin console and CMS APIs |
| Internal service | Dapr/mTLS/app-id | `/priv/*` service-to-service commands |
| LINE platform | LINE signature | webhook source authenticity |
| LINE user/group | LINE event source id | bot behavior and future restricted grants |

## User Roles

| Role | Description |
| --- | --- |
| `cms.viewer` | Can read admin CMS data and preview drafts |
| `cms.editor` | Can create and edit draft content |
| `cms.publisher` | Can publish and unpublish content |
| `cms.admin` | Can manage CMS settings, destructive operations, and role-sensitive operations |
| `asset.viewer` | Can view admin asset metadata |
| `asset.manager` | Can upload, attach, grant, revoke, and delete assets when allowed by domain rules |
| `audit.viewer` | Can view audit records through admin UI |
| `audit.sensitive_reader` | Can view sensitive audit metadata when explicitly allowed |
| `notification.viewer` | Can view notification status |
| `notification.operator` | Can trigger approved notification previews/tests |
| `account.viewer` | Can read account/admin-user records on the account domain |
| `account.admin` | Can invite users, assign roles, revoke sessions, suspend accounts, and disable accounts on the account domain |

V1 can map `cms.admin` to all CMS/asset/audit read permissions for a small admin team, but code should still check explicit roles/scopes so permissions can be split later. `cms.admin` and `account.admin` remain separate grants.

## Scopes

| Scope | Meaning |
| --- | --- |
| `cms:read` | Read admin CMS data |
| `cms:write` | Create/update draft CMS data |
| `cms:publish` | Publish/unpublish CMS data |
| `cms:admin` | CMS settings and high-risk admin operations |
| `assets:read` | Read admin asset metadata |
| `assets:write` | Upload/attach/update assets |
| `assets:grant` | Create/revoke asset grants |
| `audit:read` | Read audit records |
| `audit:sensitive_read` | Read sensitive audit metadata |
| `notifications:read` | Read notification status |
| `notifications:send` | Trigger approved notification commands |
| `account:read` | Read account/admin-user records |
| `account:admin` | Manage account users, invitations, roles, sessions, suspend, and disable |

Gateway route checks should use scopes. Backend services should check both trusted headers and domain-level permissions. Canonical role bundles, scope catalog, permission naming, resource-level checks, field-level response policy, policy drift checks, and `authz_policy` release gates follow `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

## Admin Permission Matrix

| Operation | Required Role | Required Scope |
| --- | --- | --- |
| List CMS content | `cms.viewer` or above | `cms:read` |
| View draft/preview | `cms.viewer` or above | `cms:read` |
| Create draft | `cms.editor` or `cms.admin` | `cms:write` |
| Edit draft | `cms.editor` or `cms.admin` | `cms:write` |
| Attach asset to content | `cms.editor` + `asset.manager`, or `cms.admin` | `cms:write assets:write` |
| Publish content | `cms.publisher` or `cms.admin` | `cms:publish` |
| Unpublish content | `cms.publisher` or `cms.admin` | `cms:publish` |
| Archive content | `cms.admin` | `cms:admin` |
| Create bulletin issue | `cms.editor` or `cms.admin` | `cms:write` |
| Upload bulletin PDF | `cms.editor` + `asset.manager`, or `cms.admin` | `cms:write assets:write` |
| Publish bulletin | `cms.publisher` or `cms.admin` | `cms:publish assets:grant` |
| Manage site settings | `cms.admin` | `cms:admin` |
| View asset metadata | `asset.viewer` or `asset.manager` or `cms.admin` | `assets:read` |
| Create/revoke public asset grant | `asset.manager` or `cms.admin` | `assets:grant` |
| View audit records | `audit.viewer` or `cms.admin` | `audit:read` |
| View sensitive audit metadata | `audit.sensitive_reader` | `audit:sensitive_read` |
| Manage account users and roles | `account.admin` | `account:admin` |
| Preview notification template | `notification.operator` or `cms.admin` | `notifications:send` |

Account user and role management routes live on `account.alive.org.tw`, not `www.alive.org.tw/api/admin/*`. The row above defines the permission model; route ownership remains in `account-api`.

## Gateway Route Authorization

| Route Group | Auth | Required Scope |
| --- | --- | --- |
| `GET /api/home` | public | none |
| `GET /api/news*` | public | none |
| `GET /api/pages/*` | public | none |
| `GET /api/videos` | public | none |
| `GET /api/locations` | public | none |
| `GET /api/history` | public | none |
| `GET /api/legal/*` | public | none |
| `GET /api/site-layout` | public | none |
| `GET /api/bulletins*` | public | none |
| `GET /api/sitemap-data` | public | none |
| `GET /api/assets/public/*` | public | none |
| `GET /api/assets/protected/*` | JWT | route-specific, normally authenticated account |
| `/api/admin/*` read | JWT | `cms:read` |
| `/api/admin/*` write | JWT | `cms:write` or `cms:publish` |
| `/api/assets/admin/*` read | JWT | `assets:read` |
| `/api/assets/admin/*` write | JWT | `assets:write` or `assets:grant` |
| `POST /api/line/webhook/*` | LINE signature | none |
| `POST /api/notifications/provider-webhooks/*` | provider signature | none |
| `/priv/*` | blocked publicly | none |
| `/api/priv/*` | blocked publicly | none |

Gateway checks are not enough. Upstream services must validate expected trusted headers and domain-level state.

## Internal Service Authorization

Detailed `/priv/*` service identity, caller app-id, confused-deputy, idempotency, local-dev, and staging smoke-test rules are defined in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.

Internal `/priv/*` calls require:

- Dapr service invocation.
- mTLS where available.
- Caller app id in allowlist.
- Request id propagation.
- Idempotency key for side effects.

| Callee | Route Group | Allowed Callers |
| --- | --- | --- |
| `asset-api` | `/priv/assets/*` | `hhc-web-api`, `hhc-line-function-bot` |
| `notification-api` | `/priv/notifications/*` | `account-api`, `hhc-web-api` |
| `audit-log` | `/priv/audit/*` | `account-api`, `api-gateway`, `hhc-web-api`, `asset-api`, `notification-api` |
| `hhc-web-api` | `/priv/*` | none in v1 unless explicitly added |

Do not allow `api-gateway` to call arbitrary internal command routes unless a route-specific reason exists. Public user identity and internal service identity are different authorization domains.

## Admin Session And Token Handling

Recommended admin flow:

1. Admin UI redirects user to `account.alive.org.tw` OIDC authorization endpoint with PKCE.
2. `account-api` authenticates user and returns authorization code.
3. Admin UI exchanges code through an approved account-owned flow.
4. Admin UI receives a short-lived access token for `hhc-api`.
5. Refresh token remains account-owned and is revocable by `account-api`.

Rules:

- Access tokens should be kept in memory or an httpOnly secure admin session design, not localStorage.
- Refresh tokens must not be stored in browser localStorage.
- Admin logout revokes refresh token/account session.
- Account role downgrade, suspend, and disable revoke affected refresh token families in `account-api`.
- Admin APIs accept bearer access token only.
- Gateway validates JWT and injects trusted headers.

If a Next.js server-side admin session is added later, it must still call `www.alive.org.tw/api/admin/*` and must not become a separate public API surface.

## CSRF, XSS, And Browser Controls

Detailed HTTP security header profiles, CORS allowlists, CSRF rules, CSP rollout, cookie boundaries, and route-class cache headers are specified in `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`.

Admin APIs use bearer tokens and should reject cookie-only authentication. This reduces CSRF risk, but admin UI still needs browser protections:

- `Content-Security-Policy` with no inline scripts unless nonce-based.
- `X-Frame-Options` or CSP `frame-ancestors 'none'` for admin.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `X-Content-Type-Options: nosniff`.
- Escape/sanitize rendered rich content.
- Admin preview must render structured blocks, not arbitrary HTML.
- Public CMS rendering must use the structured block whitelist and must not use `dangerouslySetInnerHTML`.
- Upload file names must be escaped in UI and logs.

## Asset Security

Upload validation:

- Enforce size limits by namespace.
- Detect MIME type server-side.
- Reject unsupported file types.
- Compute SHA-256 checksum.
- Scan before public grant.
- Keep upload URL TTL short.
- Do not log upload URLs.

Download validation:

- Public route requires `visibility=public`, public read grant, `scan_status=clean`, and `processing_status=ready` or `processing_status=not_required`.
- Protected route requires JWT and matching grant.
- Restricted/private grants must be evaluated by subject.
- Blob URLs/SAS URLs must never be returned to public clients.

High-risk transitions:

- `private` to `public`
- grant create/revoke
- scan status override
- asset delete

All high-risk transitions require audit events.

## LINE Webhook Security

`/api/line/webhook/*` is not JWT-protected because LINE platform calls it. It must be protected by:

- POST only.
- LINE signature validation in `hhc-line-function-bot`.
- Gateway body size limit.
- Rate limiting by route/source IP.
- Replay tolerance based on request timestamp if LINE headers support it.
- Deduplication by LINE event id/message id where available.

The LINE bot weekly bulletin function reads only public `hhc-web-api` routes in v1. It must not receive asset service credentials for public weekly downloads.

## Threat Model

| Threat | Risk | Mitigation |
| --- | --- | --- |
| Spoofed identity headers | User bypasses auth | Gateway strips `X-HHC-*`; backend requires gateway headers only on protected routes |
| JWT with wrong issuer/audience | Foreign token accepted | Gateway validates `iss`, `aud`, `typ`, signature, expiry |
| JWKS unavailable | Auth behavior inconsistent | Gateway uses cached keys within max stale policy; protected routes fail closed without usable key |
| Stolen refresh token | Long-lived account compromise | Refresh token rotation/revocation in `account-api`; do not expose refresh token to JS |
| Stolen access token | Short-term admin access | 5-15 minute access token lifetime; audit sensitive actions; optional `jti` denylist for incidents |
| Incorrect role coupling | CMS admin gains account admin unintentionally | Keep `cms.admin` and `account.admin` as separate role assignments and scopes |
| CSRF on admin APIs | Unwanted writes | Admin APIs require bearer token, not cookie-only auth |
| XSS in admin/content preview | Token/content compromise | CSP, structured block AST, no arbitrary HTML, renderer whitelist, token not in localStorage |
| IDOR on content/assets | User reads hidden data | Backend checks status/visibility/grants; public APIs return published only |
| Public draft leak | Draft content indexed/exposed | Public routes read projections only; preview uses admin routes |
| Preview asset leak | Unpublished file becomes public through preview | Protected/restricted preview asset URLs only, no public grants, no Blob/SAS URLs |
| Asset malware | Infected file published | Scan before public grant; infected or failed scan prevents download |
| Blob URL leak | Bypass gateway policy | Never return Blob/SAS URL to clients; gateway URL only |
| Confused deputy internal call | Service performs action for untrusted caller | Internal routes check app id allowlist and domain ownership |
| Replay of internal side effect | Duplicate grants/sends/events | Idempotency keys and unique event ids |
| Cache poisoning/stale public data | Wrong content visible | Cache keys include env/locale/version; publish invalidates/version-bumps |
| Open redirect via CMS link | Phishing | Validate external URLs; restrict redirect records to owned paths |
| LINE signature spoof | Fake bot commands | LINE signature validation and POST-only route |
| Notification abuse | Spam or provider reputation damage | Internal-only notification API, template allowlist, rate/suppression |
| Audit tampering | Loss of accountability | Append-only audit service; no update/delete route |
| Site settings leak internal URLs/secrets | Public layout exposes private infrastructure | `cms:admin` only, link validation, deny Blob/SAS/internal/admin/private routes, projection leak tests |

## Security Test Requirements

Gateway:

- Missing token returns `401` for protected routes.
- Wrong issuer/audience returns `401`.
- Missing scope returns `403`.
- Spoofed `X-HHC-*` headers are stripped.
- Public `/priv/*` and `/api/priv/*` are blocked.

Backend:

- Protected route without trusted headers is rejected.
- Draft content never appears in public route.
- Publish requires `cms:publish`.
- Site settings mutation requires `cms:admin`.
- Public site layout does not expose secrets, Blob/SAS URLs, internal service URLs, admin URLs, or `/priv/*`.
- `cms.admin` without `account:admin` cannot manage account users.
- `account.admin` without CMS publish scope cannot publish CMS content.
- Asset grant requires `assets:grant`.
- Restricted asset cannot be downloaded without matching grant.
- Infected or scan-failed asset cannot be made public.

Admin UI:

- No refresh token in localStorage.
- Unauthorized state for missing token.
- Forbidden state for insufficient role/scope.
- Rich content preview escapes unsafe content.
- CMS body content rejects raw HTML, unsafe link protocols, editor-library opaque JSON, and arbitrary CSS classes.
- Preview routes use admin APIs only, `no-store`, and `noindex`.
- Preview assets never use public grants, Blob URLs, or SAS URLs.

LINE bot:

- Invalid LINE signature is rejected.
- Duplicate event is ignored or idempotent.
- Weekly bulletin function calls only public `hhc-web-api` routes.

## Incident Response Defaults

If admin token compromise is suspected:

1. Revoke refresh token/account session in `account-api`.
2. Optionally add access token `jti` to Redis denylist until natural expiry.
3. Rotate affected user roles/scopes if needed.
4. Review `audit-log` events for sensitive actions.

If asset leak is suspected:

1. Revoke public grant in `asset-api`.
2. Invalidate CDN/gateway cache.
3. Unpublish or update referencing content in `hhc-web-api`.
4. Review audit events for grant creation and downloads where available.

If gateway JWKS validation fails:

1. Keep public routes available.
2. Protected routes fail closed.
3. Verify account JWKS endpoint.
4. Roll back gateway revision only if verifier deployment caused the failure.
