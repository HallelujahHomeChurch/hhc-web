# LINE Bot Account Binding And Central RBAC Design

**Date:** 2026-07-28

## Goal

Make `account-api` the single source of truth for human identity and
administrator permissions across Account, Admin, and `hhc-line-function-bot`.
Remove LINE user IDs and the Bot database as independent administrator
authorities.

The Bot continues to own LINE group registration, profile configuration, and
Bot-specific group/user function grants. Those concepts do not belong in the
account domain.

## Decisions

- Use synchronous authorization against `account-api` for every Bot
  administrator operation.
- Do not cache administrator decisions or copy Account roles into the Bot
  database.
- Fail closed only for administrator operations when Account authorization is
  unavailable. Public and already-authorized non-admin Bot functions continue
  normally.
- Remove `/admin-add`, `/admin-remove`, `LINE_HELPER_ADMIN_USER_ID`, and active
  use of Bot `access_principals(type = 'admin')`.
- Do not let an administrator type or paste another person's LINE user ID into
  Admin Console to create a binding.
- Keep LINE Login and Messaging API channels under the same LINE Provider. The
  same person then has the same LINE user ID in both channel types.

## Account Identity Integrity

`federated_identities` must enforce:

```sql
unique (provider, provider_id)
unique (user_id, provider)
```

The first constraint prevents one LINE identity from belonging to multiple HHC
accounts. The second prevents one HHC account from accumulating multiple
identities from the same provider.

Creating or confirming an identity is idempotent when the existing row matches
the same user. A provider identity already owned by another user, or a user
already linked to another identity from that provider, returns `409 Conflict`.

Before applying the constraints, deployment validation must detect duplicates
and stop with a report containing database IDs only. It must not choose a
winner automatically.

## Permissions

Seed these Account permissions:

- `line-bot:operate`: run normal Bot administrator actions.
- `line-bot:configure`: run elevated provider and system configuration actions.

Seed `line-bot.operator` with `line-bot:operate`. Do not create another global
superadministrator role. The existing Account `admin` role has `*` and therefore
passes both permission checks.

Existing Bot action policy maps:

- `auth: admin` to `line-bot:operate`.
- `auth: superadmin` to `line-bot:configure`.

Admin Console remains the only management surface for assigning these Account
roles and permissions.

## LINE Binding Flow

### 1. Create intent

The Bot receives a direct-message login or binding request and invokes:

```http
POST /priv/account/v1/line/bindings
Content-Type: application/json
X-Internal-Caller-App-Id: hhc-line-function-bot

{
  "line_user_id": "U0123...",
  "profile_name": "helper"
}
```

The Account service validates the LINE user ID format and stores a random,
single-use binding token in Redis using the existing security-token mechanism.
The token expires after ten minutes.

Response:

```json
{
  "binding_url": "https://account.alive.org.tw/line/bind?token=...",
  "expires_at": "2026-07-28T12:10:00Z"
}
```

The browser URL contains only the opaque token, never the LINE user ID.

### 2. Authenticate and inspect

Account Console preserves the binding route while completing the normal HHC
login and MFA flow. Once authenticated it reads:

```http
GET /api/account/v1/line/bindings/{token}
Authorization: Bearer ...
```

The response only identifies the HHC LINE Bot/profile being connected and the
expiry. It does not expose the LINE user ID.

### 3. Confirm

The user explicitly confirms:

```http
POST /api/account/v1/line/bindings/{token}/confirm
Authorization: Bearer ...
X-CSRF-Token: ...
```

Account API atomically consumes the token and creates the `line` federated
identity. Reuse, expiry, ownership conflicts, inactive users, and invalid tokens
are rejected.

The UI displays success and instructs the user to return to LINE. The Bot does
not need a callback: its next authorization request resolves the newly linked
identity.

## Bot Authorization Contract

For each administrator action the Bot invokes:

```http
POST /priv/account/v1/line/authorize
Content-Type: application/json
X-Internal-Caller-App-Id: hhc-line-function-bot

{
  "line_user_id": "U0123...",
  "permission": "line-bot:operate"
}
```

Response for a linked and allowed user:

```json
{
  "bound": true,
  "allowed": true,
  "user_id": "019f..."
}
```

Unlinked users receive `200` with `bound: false, allowed: false`; inactive,
unlinked, or unauthorized users never receive permission details. Invalid
callers receive `403`.

The Bot records the HHC user ID as the administrator audit actor when available,
and may retain the LINE source ID only in its existing privacy-safe correlation
mechanism.

## Service Boundary

- ACA/Dapr access control permits only `hhc-line-function-bot` to invoke these
  private LINE endpoints.
- Account API also validates the configured internal caller ID as defense in
  depth.
- Public gateway routes never expose `/priv/account/v1/line/*`.
- The Bot uses Dapr service invocation and bounded request timeouts.
- Authorization errors and timeouts produce a generic Traditional Chinese
  denial message and never fall back to local administrator state.

## Bot Changes

- Add a small Account authorization client with two operations: create binding
  intent and authorize permission.
- Replace all duplicated `isAdminUser` checks with one injected authorizer.
- Remove `/admin-add` and `/admin-remove` from parsing, help, tests, and docs.
- Remove bootstrap-superadmin checks from action policy.
- Remove `adminUserId` and `adminUserIdEnv` from profile schema, production
  configuration, ACA secrets, assurance checks, and documentation.
- Remove `admin` from new `AccessPrincipalType` values and stop reading/writing
  admin principals.
- Keep user/group principals, registration codes, function grants, role
  capability bindings, and access audit records.

## Admin Console Changes

- Show linked providers in the selected user inspector, including LINE.
- Keep role and direct-permission assignment in the existing Users inspector.
- Label `line-bot.operator` as a scoped Bot role; global `admin` remains the
  highest Account role.
- Do not add a separate LINE admin page or a manual LINE-ID field.

## Production Migration

1. Deploy Account API identity constraints, binding endpoints, permissions, and
   authorization endpoint.
2. Deploy Account Console binding page and Admin Console linked-provider state.
3. Have every existing Bot administrator bind their LINE identity.
4. Assign the current bootstrap administrator the Account `admin` role. Assign
   other Bot administrators `line-bot.operator` or explicit permissions.
5. Verify private authorization for every current administrator.
6. Deploy the Bot version that removes local administrator authority.
7. Remove `LINE_HELPER_ADMIN_USER_ID` from ACA and Key Vault after the new Bot
   revision is ready.
8. Delete legacy Bot admin-principal rows only after comparing them with the
   accepted migration list. Preserve audit events.

The Bot deployment must not proceed if no bound Account user passes
`line-bot:configure`.

## Error And UX States

- Unbound: offer a fresh Account binding link.
- Expired intent: let the user request another link from LINE.
- Already linked to this account: return success idempotently.
- Identity belongs to another account: show a conflict without identifying that
  account.
- Account authorization unavailable: deny only the administrator operation and
  ask the user to retry later.
- Permission denied: state that the account lacks permission and direct the user
  to an HHC administrator.

## Tests

### account-api

- Migration rejects duplicate provider identities.
- Binding tokens expire and are consumed once.
- Confirmation requires authenticated active user and CSRF.
- Both identity conflict directions return `409`.
- Internal caller allowlist rejects unknown callers.
- Authorization handles unbound, inactive, allowed, denied, wildcard, and
  direct-permission users.

### account/admin frontend

- Binding route survives login and MFA redirects.
- Confirm, expired, conflict, and retry states are accessible.
- Admin user inspector displays linked LINE state.
- Existing role and direct-permission assignment remains functional.

### hhc-line-function-bot

- Admin and elevated actions request the correct Account permission.
- Unbound direct users receive a binding link.
- Denied and unavailable authorization fail closed without affecting public
  commands.
- `/admin-add` and `/admin-remove` are unavailable and absent from help.
- No runtime path reads bootstrap or Bot-database administrator state.

### Integration

- The LINE webhook user ID and LINE Login subject match under the configured
  Provider.
- Bind one test account, assign and revoke `line-bot.operator`, and observe
  immediate Bot authorization changes.
- Global Account logout does not remove the persistent LINE identity binding.
- Account deactivation and LINE unlink immediately deny Bot administration.

## Non-Goals

- Moving LINE group registration or function grants into Account API.
- Giving Admin Console access to LINE Official Account Manager roles.
- Issuing delegated user JWTs to the Bot.
- Caching Account authorization decisions in the Bot.
