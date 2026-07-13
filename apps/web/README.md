# HHC public web

Next.js public website for `www.alive.org.tw`. The app is part of the
`hhc-frontend` workspace and is deployed independently from Account and Admin.

## Environment

```dotenv
HHC_WEB_API_BASE_URL=http://127.0.0.1:8081/api
ACCOUNT_API_PROXY_TARGET=http://127.0.0.1:8080
NEXT_PUBLIC_ACCOUNT_SITE_URL=http://account.hhc.test:5173
NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL=http://account.hhc.test:5173/api/account/v1
```

`HHC_WEB_API_BASE_URL` is server-only and should point to `hhc-web-api` in
production. Public content failures render an explicit unavailable state; the
app never substitutes test fixtures in production.

`ACCOUNT_API_PROXY_TARGET` enables the same-origin Account proxy for local
Next development only. Production leaves it unset because `api-gateway` owns
those routes. See [browser-sso-local.md](../../docs/runbooks/browser-sso-local.md).

## Commands

Run these from the repository root:

```bash
pnpm --filter @hhc/web dev
pnpm --filter @hhc/web test -- --run
pnpm --filter @hhc/web lint
pnpm --filter @hhc/web build
```

The CMS-backed home and history pages render on request and cache projection
fetches for 60 seconds. Legal and other static pages remain pre-rendered.

## Container

The Docker build context must be the monorepo root:

```bash
docker build -f apps/web/Dockerfile -t hhc-web:local .
docker run --rm -p 10000:10000 \
  -e HHC_WEB_API_BASE_URL=http://host.docker.internal:8081/api \
  hhc-web:local
```

The runtime exposes `GET /health` on port `10000`.
