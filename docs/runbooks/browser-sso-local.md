# Browser SSO Local Verification

Use distinct local hosts. Different `localhost` ports share one cookie jar and
cannot prove host-only refresh-cookie isolation.

## Hosts

Add these entries to `/etc/hosts`:

```text
127.0.0.1 account.hhc.test admin.hhc.test www.hhc.test
```

Local HTTP uses `refresh_token` and `as_session`. Production HTTPS adds the
`__Host-` prefix and `Secure`; the ownership model is otherwise the same.

## Account API

From `/Users/rayselfs/Projects/hhc/account/account-api`:

```bash
./scripts/setup-local.sh
```

Confirm these non-secret settings in `.env`:

```dotenv
ENVIRONMENT=development
COOKIE_DOMAIN=
SHARED_COOKIE_DOMAIN=.hhc.test
FRONTEND_URL=http://account.hhc.test:5173
```

Register local public-client callbacks in the local database. These commands
replace callbacks only in the disposable local database:

```bash
container exec account-api-postgres psql -U postgres -d account_db -c \
  "UPDATE oauth_clients SET redirect_uris = ARRAY['http://admin.hhc.test:5175/oauth/callback'] WHERE client_id = 'admin-web';"
container exec account-api-postgres psql -U postgres -d account_db -c \
  "UPDATE oauth_clients SET redirect_uris = ARRAY['http://www.hhc.test:3000/oauth/callback'] WHERE client_id = 'www-web';"
```

Start the API:

```bash
./scripts/local-api.sh serve
```

The seeded account is `admin`. Read its generated password locally without
putting it in shell history or logs:

```bash
grep '^ADMIN_INIT_PASSWORD=' .env
```

## Frontends

Run each frontend from its repository in a separate terminal after installing
dependencies with a GitHub token that has `read:packages`.

Account:

```bash
cd /Users/rayselfs/Projects/hhc/account-fe
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=account.hhc.test \
  corepack pnpm dev -- --host 0.0.0.0 --port 5173
```

Admin:

```bash
cd /Users/rayselfs/Projects/hhc/admin-fe
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=admin.hhc.test \
VITE_ACCOUNT_AUTHORIZE_BASE_URL=http://account.hhc.test:5173/api/account/v1 \
VITE_ACCOUNT_SITE_URL=http://account.hhc.test:5173 \
VITE_ADMIN_REDIRECT_URI=http://admin.hhc.test:5175/oauth/callback \
  corepack pnpm dev -- --host 0.0.0.0 --port 5175
```

Public Web:

```bash
cd /Users/rayselfs/Projects/hhc/hhc-web
ACCOUNT_API_PROXY_TARGET=http://127.0.0.1:8080 \
NEXT_PUBLIC_ACCOUNT_SITE_URL=http://account.hhc.test:5173 \
NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL=http://account.hhc.test:5173/api/account/v1 \
  corepack pnpm dev -- --hostname 0.0.0.0 --port 3000
```

Open these browser URLs, not `localhost`:

```text
http://account.hhc.test:5173/login
http://admin.hhc.test:5175/
http://www.hhc.test:3000/zh-Hant
```

## Flow

1. Open Account and sign in as `admin`. A fresh admin completes QR-code MFA
   setup; an existing admin enters the six-digit authenticator code.
2. Open Admin at a URL containing query and hash state. The first visit may
   make a fast Account authorization round trip, then must restore the exact
   Admin URL. A reload must use the Admin refresh cookie without another
   authorization redirect.
3. Open Web. With `hhc_sso_hint=1`, the account control makes one
   `prompt=none` authorization attempt and returns to the exact localized URL.
   Public content remains usable if passive SSO fails.
4. Sign out from Web, Admin, or Account. The current browser profile becomes
   signed out of all three products. The UI changes only after the global
   revocation request succeeds.
5. Repeat sign-in in a private window before step 4. The regular window's
   global sign-out must not revoke the private window because it has a
   different `hhc_device` value.

## Cookie Matrix

Inspect cookie names, host/domain, flags, and expiry in browser DevTools. Do
not copy, log, or screenshot cookie values.

| Cookie | Account | Admin | Web |
| --- | --- | --- | --- |
| `refresh_token` | host-only | host-only after OAuth exchange | host-only after OAuth exchange |
| `as_session` | host-only | absent | absent |
| `hhc_device` | `.hhc.test` | shared | shared |
| `hhc_sso_hint` | `.hhc.test` | shared | shared |
| `hhc_locale`, `hhc_theme` | `.hhc.test` | shared | shared |

After global sign-out, other hosts may still display an opaque
`refresh_token` cookie until their next request. It is already revoked and
must not restore a session.

## Gateway Boundary

The Vite/Next proxies above are only for local browser iteration. Verify the
production route boundary separately in `api-gateway`:

```bash
sh scripts/test-auth-routing.sh
sh scripts/test-www-routing.sh
```

The Gateway must expose exact Account routes only; it must not expose a broad
`/api/account/v1/` prefix on Admin or Web.
