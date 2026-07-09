# HHC Account Admin Identity And RBAC Lifecycle Design

## Purpose

This spec defines how administrator identity, invitations, role assignment, session revocation, offboarding, emergency access removal, and account-domain audit should work for the HHC web platform.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/api/account-api.md`
- `docs/api/auth-headers.md`

## Core Decision

`account-api` owns the full account and administrator identity lifecycle.

That includes:

- user records
- admin invitations
- login sessions
- refresh token families
- role and scope assignment
- account disable, suspension, and lockout state
- emergency refresh-token revocation
- account-domain audit events
- account security notifications

`api-gateway` validates access JWTs locally from JWKS for non-account APIs. It does not call `account-api` per request.

`hhc-web-api`, `asset-api`, `notification-api`, and `audit-log` must not own account users or role assignment state. They consume trusted gateway headers for protected browser traffic and enforce domain-level authorization with those headers.

## Domains And Route Ownership

Account and user-management APIs stay on:

```text
https://account.alive.org.tw
```

Non-account platform APIs stay on:

```text
https://www.alive.org.tw/api/*
```

Admin UI lives on:

```text
https://admin.alive.org.tw
```

Rules:

- `admin.alive.org.tw` is UI only.
- Account-management APIs are not proxied through `admin.alive.org.tw/api/*`.
- If the admin console needs a user-management screen, it should link to account-owned UI on `account.alive.org.tw` or call account-domain APIs that are explicitly CORS-allowed for `https://admin.alive.org.tw`.
- `hhc-web-api` does not create users, issue invitations, reset passwords, or change roles.
- `account-api` may call `notification-api` and `audit-log` through internal `/priv/*` side-effect APIs.

## Why This Boundary Is Best Practice

Identity lifecycle changes are security-sensitive and cut across every current and future service. If CMS, asset, LINE bot, or future event/member services each manage users or roles, the platform gets duplicate security logic, inconsistent revocation, unclear audit, and hard-to-reason incident response.

Keeping identity in `account-api` gives the platform one source of truth for:

- who a user is
- whether the account is active
- which roles and scopes can appear in new access tokens
- which refresh token families are valid
- which role changes or security events must be audited

Feature services stay simpler. They only answer, "given this trusted user id and scope set, is this operation allowed for this resource?"

## Account Roles And Scopes

CMS roles and account-administration roles are separate.

| Role | Domain | Meaning |
| --- | --- | --- |
| `cms.viewer` | website CMS | Read admin CMS data and preview drafts |
| `cms.editor` | website CMS | Create and edit draft content |
| `cms.publisher` | website CMS | Publish and unpublish website content |
| `cms.admin` | website CMS | CMS settings and destructive CMS operations |
| `asset.viewer` | asset admin | Read admin asset metadata |
| `asset.manager` | asset admin | Upload, attach, grant, revoke, and delete assets when allowed |
| `audit.viewer` | audit | Read ordinary audit records |
| `audit.sensitive_reader` | audit | Read sensitive audit metadata when explicitly allowed |
| `notification.viewer` | notification | Read notification status |
| `notification.operator` | notification | Trigger approved previews or tests |
| `account.viewer` | account | Read account/admin-user records |
| `account.admin` | account | Invite users, assign roles, revoke sessions, suspend accounts, disable accounts |

Scopes:

| Scope | Meaning |
| --- | --- |
| `cms:read` | Read admin CMS data |
| `cms:write` | Create or update draft CMS data |
| `cms:publish` | Publish or unpublish CMS data |
| `cms:admin` | CMS settings and high-risk CMS operations |
| `assets:read` | Read admin asset metadata |
| `assets:write` | Upload or update assets |
| `assets:grant` | Create or revoke asset grants |
| `audit:read` | Read ordinary audit records |
| `audit:sensitive_read` | Read sensitive audit metadata |
| `notifications:read` | Read notification status |
| `notifications:send` | Trigger approved notification commands |
| `account:read` | Read account/admin-user records |
| `account:admin` | Manage account users, roles, invitations, sessions, suspend, and disable |

Rules:

- `cms.admin` does not automatically grant `account.admin`.
- `account.admin` does not automatically grant `cms.admin`.
- A small v1 team may assign both roles to the same person, but they remain separate grants in `account-api`.
- Code should check scopes for route authorization and domain rules for resource authorization.
- `audit:sensitive_read` should be separate from ordinary `audit:read` even if v1 has only a small administrator group.

## Administrator Lifecycle

### Invitation

1. An existing `account.admin` starts an invitation from account-owned UI or API.
2. `account-api` validates requested roles and scopes.
3. `account-api` creates an invitation with a hashed invitation token, expiry, requested role set, inviter id, and reason.
4. `account-api` calls `notification-api /priv/notifications/send` with an account invitation template.
5. `account-api` emits an audit event for `account.invitation.created`.

Invitation rules:

- Invitations expire.
- Invitation tokens are stored hashed.
- Re-sending an invitation creates a new notification attempt without exposing the token in logs.
- Invitation acceptance must bind to the same email or verified account identity that the invitation targets.
- Role assignment happens in `account-api`, not in `hhc-web-api`.

### Acceptance

1. Invitee opens the account-domain invitation link.
2. `account-api` verifies invitation token, expiry, target email, and current invitation state.
3. Invitee completes account setup or signs into an existing verified account.
4. `account-api` attaches approved roles/scopes.
5. `account-api` revokes the invitation token.
6. `account-api` emits `account.invitation.accepted` and `account.role.granted` audit events.

### Login And Admin API Use

1. Admin UI redirects to `account.alive.org.tw` OIDC authorization endpoint with PKCE.
2. `account-api` authenticates the user.
3. `account-api` issues a short-lived access token for `hhc-api` containing current roles/scopes.
4. Admin UI calls `https://www.alive.org.tw/api/admin/*` with the bearer access token.
5. `api-gateway` validates the access token locally from JWKS and injects trusted `X-HHC-*` headers.
6. `hhc-web-api` enforces CMS domain authorization from trusted headers and resource state.

### Role Upgrade

Role upgrade means adding a role or scope with greater privilege.

Rules:

- Requires `account.admin`.
- Requires actor id, target user id, requested role/scope delta, and reason.
- Emits `account.role.granted`.
- New privilege appears only in newly issued access tokens.
- Existing lower-privilege access tokens are not mutated.
- For high-risk roles such as `account.admin` or `audit.sensitive_reader`, v1 should require an explicit confirmation step in the account UI. MFA can be added later without changing service boundaries.

### Role Downgrade

Role downgrade means removing a role or scope.

Rules:

- Requires `account.admin`.
- `account-api` updates role assignment state.
- `account-api` revokes affected refresh token families.
- New access tokens reflect reduced roles/scopes.
- Existing access tokens expire naturally in 5-15 minutes.
- For high-risk cases, add access token `jti` values to the emergency denylist until natural expiry.
- Emits `account.role.revoked` and `account.session.revoked`.

This keeps gateway validation local while bounding privilege drift.

### Suspend, Disable, And Lock

Use distinct account states:

| State | Meaning | Token Behavior |
| --- | --- | --- |
| `active` | User can log in and receive tokens | Normal |
| `locked` | Temporary lock after suspicious activity or failed login threshold | No new login until unlocked or timeout |
| `suspended` | Administrative pause; expected to be reversible | Revoke refresh token families; no new tokens |
| `disabled` | Offboarded or permanently disabled account | Revoke refresh token families; no new tokens |

Rules:

- State changes require audit reason.
- Suspending or disabling an admin revokes all refresh token families.
- Existing access tokens expire naturally unless emergency denylist is used.
- Account state must be checked by `account-api` during login and refresh.
- Feature services must not query account state per request.

### Offboarding

Offboarding flow:

1. `account.admin` disables or suspends the account.
2. `account-api` revokes all refresh token families for the user.
3. `account-api` removes or expires role assignments.
4. `account-api` emits role/session/account state audit events.
5. `account-api` optionally sends a security notification if policy allows.
6. Audit records remain by stable user id; display names can be resolved through account audit views if permitted.

Offboarding must not delete audit records, content author ids, or publish history.

Disable, suspend, and lockout are access-control lifecycle states, not account deletion. They revoke refresh token families and stop new tokens, while existing access tokens expire naturally unless the emergency denylist is used.

Account deletion or anonymization is a separate privacy lifecycle procedure:

- It is not a normal CMS/admin offboarding action.
- It requires lifecycle ledger evidence, audit reason, and service-specific impact review.
- It must preserve referential integrity for audit events, published content history, and security records.
- Display names, emails, and external provider identifiers can be redacted or replaced with non-reversible hashes according to the data classification policy.
- The gateway still does not call `account-api`; after deletion/anonymization, current access is handled by refresh-token revocation, short access-token expiry, and any emergency denylist entries.

## Emergency Access Removal

Normal logout, role downgrade, suspension, and disable rely on refresh token revocation plus short-lived access tokens.

For high-risk incidents:

- Revoke refresh token families in `account-api`.
- Add active access token `jti` values to a gateway-owned Redis denylist until token expiry.
- Emit critical audit event.
- Rotate compromised credentials or signing keys only when the incident requires it.

The denylist is an exception path, not the normal session model. It must not become per-request account introspection.

V1 can manage denylist entries through an operations runbook or a narrowly scoped internal administrative command. Either way, the gateway reads the denylist locally and never calls `account-api` during request verification.

## Account API Contract

Account-owned JSON APIs should use account-domain routes such as:

```text
GET  /api/account/me
GET  /api/account/admin/users
GET  /api/account/admin/users/{userId}
GET  /api/account/admin/invitations
POST /api/account/admin/invitations
POST /api/account/admin/invitations/{invitationId}/resend
POST /api/account/admin/invitations/{invitationId}/revoke
POST /api/account/admin/users/{userId}/roles
DELETE /api/account/admin/users/{userId}/roles/{role}
POST /api/account/admin/users/{userId}/sessions/revoke
POST /api/account/admin/users/{userId}/suspend
POST /api/account/admin/users/{userId}/disable
POST /api/account/admin/users/{userId}/unlock
```

Account admin routes require an account-domain access token with `account:admin` or `account:read` as appropriate. These routes are validated by `account-api`, not by `hhc-web-api`.

If the same access token is used for both account APIs and non-account APIs, its `aud` claim must explicitly include the required audience for each target. Do not accept a token with an unrelated audience.

## Data Model

`account-api` owns the `account` PostgreSQL schema.

Minimum tables:

```sql
account_user(
  id text primary key,
  primary_email text not null,
  display_name text,
  status text not null,
  email_verified boolean not null,
  version bigint not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  locked_until timestamptz,
  suspended_at timestamptz,
  disabled_at timestamptz,
  status_reason text
)
```

```sql
account_role_assignment(
  id uuid primary key,
  user_id text not null,
  role text not null,
  scopes text[] not null,
  assigned_by text not null,
  assigned_reason text not null,
  assigned_at timestamptz not null,
  expires_at timestamptz,
  revoked_by text,
  revoked_reason text,
  revoked_at timestamptz
)
```

```sql
account_invitation(
  id uuid primary key,
  target_email text not null,
  token_hash text not null,
  requested_roles text[] not null,
  invited_by text not null,
  invite_reason text not null,
  status text not null,
  expires_at timestamptz not null,
  accepted_by text,
  accepted_at timestamptz,
  revoked_by text,
  revoked_at timestamptz,
  created_at timestamptz not null
)
```

```sql
account_session(
  id text primary key,
  user_id text not null,
  client_id text not null,
  refresh_token_family_id text not null,
  status text not null,
  issued_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text
)
```

Refresh token records follow the account token contract. Store only refresh token hashes.

## Token Freshness And Claim Rules

Access tokens issued for `hhc-api` should contain:

- `sub`
- `jti`
- `sid`
- `client_id`
- `roles`
- `scope`
- `typ=access`
- `iss=https://account.alive.org.tw`
- `aud=hhc-api`
- short `exp`

Optional but useful:

- `authz_version`: account authorization version at issue time for audit and debugging.

Do not require gateway to call `account-api` to compare `authz_version` on each request. If immediate revocation is required, use the emergency `jti` denylist.

## Internal Side Effects

`account-api` may call:

- `notification-api /priv/notifications/send` for invitation, password reset, account lock, suspicious refresh reuse, and security notices.
- `audit-log /priv/audit/events` or batch append route for identity and role events.

Allowed internal callers:

| Callee | Route | Caller |
| --- | --- | --- |
| `notification-api` | `/priv/notifications/*` | `account-api` |
| `audit-log` | `/priv/audit/*` | `account-api` |

`notification-api` must not decide account policy. It sends approved templates only.

`audit-log` must not become the source of truth for current role state. It records what happened.

## Audit Events

Account events should be emitted through the account outbox.

Required actions:

| Action | Severity | Notes |
| --- | --- | --- |
| `account.invitation.created` | info | Includes inviter, target hash or approved target identifier, requested roles |
| `account.invitation.resent` | info | No raw token |
| `account.invitation.revoked` | warning | Includes actor and reason |
| `account.invitation.accepted` | info | Includes accepted account id |
| `account.role.granted` | warning | Includes role/scope delta and reason |
| `account.role.revoked` | warning | Includes role/scope delta and reason |
| `account.session.revoked` | warning | Includes session or family id, not raw token |
| `account.refresh.reuse_detected` | critical | Indicates probable token theft |
| `account.user.locked` | warning | Temporary lock |
| `account.user.suspended` | warning | Administrative pause |
| `account.user.disabled` | warning | Offboarding or permanent disable |
| `account.emergency_access_denylisted` | critical | High-risk incident action |
| `account.signing_key.rotated` | warning | Security-sensitive key lifecycle |

Never log raw invitation tokens, access tokens, refresh tokens, authorization codes, cookies, provider secrets, or full request bodies.

## Notification Templates

Initial account templates:

- `account.admin-invitation`
- `account.invitation-accepted`
- `account.password-reset`
- `account.role-changed`
- `account.session-revoked`
- `account.security-alert`

Templates live in `notification-api`. The decision to send and the recipient are owned by `account-api`.

## Break-Glass Access

Break-glass access should be a rare operations path, not a normal shared admin account.

Rules:

- Prefer named emergency users with `account.admin` and explicit expiry.
- Avoid shared passwords.
- Store emergency credential material in the approved secret store, not in source code or docs.
- Require audit reason for activation.
- Revoke or expire emergency role assignments after the incident.
- Review audit records after use.

V1 can start with a small number of named admin users and a manual break-glass runbook. Do not build a separate break-glass service.

## Tests

Account lifecycle tests:

- Invitation creation stores hashed token and emits audit event.
- Invitation acceptance assigns requested roles and prevents token reuse.
- Expired invitation cannot be accepted.
- Revoked invitation cannot be accepted.
- Role upgrade emits audit and appears in newly issued access token.
- Role downgrade revokes refresh token families.
- Suspended user cannot refresh or log in.
- Disabled user cannot refresh or log in.
- Refresh token reuse revokes token family.
- Account admin APIs reject missing `account:admin`.
- `cms.admin` without `account:admin` cannot manage users.
- `account.admin` without `cms:publish` cannot publish CMS content.

Gateway and integration tests:

- Gateway validates `hhc-api` access tokens locally from JWKS.
- Gateway does not call `account-api` per request.
- Existing access token after role downgrade expires naturally.
- Emergency denylist blocks a specific `jti`.
- `hhc-web-api` rejects protected routes when trusted headers are missing.
- `hhc-web-api` does not query account tables for role checks.

Operational smoke tests:

- Admin invite email can be queued through `notification-api`.
- Account role change appears in `audit-log`.
- JWKS rotation keeps existing valid access tokens working until expiry.
- Account outage does not break already-issued access tokens while gateway has usable JWKS.

## Acceptance Criteria

- Account and role lifecycle is owned by `account-api`.
- `api-gateway` keeps local JWT validation and no per-request account introspection.
- CMS and account administration roles are separated.
- `hhc-web-api` does not own user records, invitations, sessions, refresh tokens, or role assignments.
- Role downgrade and account disable revoke refresh token families.
- Existing access tokens expire naturally unless emergency denylist is explicitly used.
- Account invitations, role changes, session revocation, and emergency actions emit audit events.
- Account notifications use internal `notification-api` commands and never expose provider credentials to account UI or CMS.
- Public and admin feature services can continue to enforce authorization from trusted gateway headers without cross-service account queries.
