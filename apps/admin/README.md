# HHC Admin Console

React/Vite admin console for `admin.alive.org.tw`.

## Local Development

Mock mode is the fastest way to review the UI without starting backend services:

```bash
pnpm --filter @hhc/admin dev:mock
```

Open:

```text
http://127.0.0.1:5175/
```

For real account-api integration, start account-api on `127.0.0.1:8080` and run:

```bash
pnpm --filter @hhc/admin dev
```

The Vite dev server proxies `/api/account/*` to `http://127.0.0.1:8080`.

## Runtime Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_ACCOUNT_API_BASE_URL` | `/api/account/v1` | API base for token exchange, refresh, `/me`, and admin APIs. |
| `VITE_ACCOUNT_AUTHORIZE_BASE_URL` | production account host on `admin.alive.org.tw`, otherwise API base | OAuth authorize base. Production should point to `https://account.alive.org.tw/api/account/v1` so relative login redirects land on the account host. |
| `VITE_ADMIN_CLIENT_ID` | `admin-web` | OAuth client id seeded by account-api. |
| `VITE_ADMIN_REDIRECT_URI` | `${window.location.origin}/oauth/callback` | OAuth callback URI. |
| `VITE_ADMIN_OAUTH_SCOPE` | CMS, asset, and audit scopes | Requested capabilities; account-api only issues scopes granted by the user's RBAC bundles. |
| `VITE_ACCOUNT_API_MOCK` | `false` | Enables in-memory mock account/admin data. |

## Verification

```bash
pnpm --filter @hhc/admin test -- --run
pnpm --filter @hhc/admin lint
pnpm --filter @hhc/admin build
```

## Scope

The console includes:

- OAuth Authorization Code + PKCE login flow.
- Protected admin route guard.
- User search/detail/role/direct-permission management.
- Role and permission management.
- OAuth client listing/creation/secret rotation.
- Website content workspaces for weekly bulletins, news, history, and videos.
- Typed draft, publish, unpublish, revision restore, and scanned asset upload flows through `hhc-web-api`.

`hhc-web-api` owns the website content lifecycle. `asset-api` owns bytes,
ClamAV scanning, derivatives, grants, and stable downloads. The browser never
operates Azure Blob credentials or asset grants directly.
