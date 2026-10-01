# HHC Public Web

Next.js public website for `www.alive.org.tw`.

## License

The source and first-party content are publicly visible but remain all rights
reserved. See [LICENSE](LICENSE) and [ASSET_RIGHTS.md](ASSET_RIGHTS.md).

## Local development

```sh
NODE_AUTH_TOKEN="$(gh auth token)" corepack pnpm install
corepack pnpm dev
```

Environment:

```dotenv
HHC_WEB_API_BASE_URL=http://127.0.0.1:8081/api
ACCOUNT_API_PROXY_TARGET=http://127.0.0.1:8080
NEXT_PUBLIC_WEEKLY_READER_ENABLED=false
NEXT_PUBLIC_ACCOUNT_SITE_URL=http://account.hhc.test:5173
NEXT_PUBLIC_ACCOUNT_AUTHORIZE_BASE_URL=http://account.hhc.test:5173/api/account/v1
```

`HHC_WEB_API_BASE_URL` is server-only. `ACCOUNT_API_PROXY_TARGET` is only for
local same-origin Account API proxying; production routing belongs to
`api-gateway`.

Online bulletin reading is disabled by default. Set the build-time
`NEXT_PUBLIC_WEEKLY_READER_ENABLED=true` only after private-interaction/offline
acceptance and human approval of watermark readability. This gate does not grant
member access and does not disable the existing PDF download workflow.

Explicit offline saves use account-bound IndexedDB with the server's seven-day
receipt, hash-verified resources and an atomic active-revision pointer. Native
Web Locks and logout epochs reject stale cross-tab writes. Clock rollback,
expiry and unmarked 404s lock retained data; only the owner's marked unavailable
response purges it. Logout/account change removes local copies. Cache Storage
contains only code-owned public assets and a generic, content-free reader shell;
member APIs and Authorization-bearing requests remain network-only. An offline
installed launch opens the saved-content list, never cached personalized HTML.
Unsupported browsers keep online reading; storage failure never deletes an
existing download to make room. Pinned renderer v1 and its immutable assets must
remain available across app upgrades for retained saves.

## Verification

```sh
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
docker build --secret id=npmrc,src="$HOME/.npmrc" -t hhc-web:local .
```

The runtime serves `GET /health` on port `10000`.

## Office integration

The HTTPS-only Windows Docker Desktop stack is documented in
[the office Compose runbook](docs/runbooks/office-compose.md).
