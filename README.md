# HHC Frontend

HHC frontend monorepo for the public website, account console, and admin console.

## Applications

- `apps/web`: `www.alive.org.tw`
- `apps/account`: `account.alive.org.tw`
- `apps/admin`: `admin.alive.org.tw`

The apps share React Aria primitives, semantic theme tokens, preferences, and
typed API clients. They do not share business pages or deployment units.

## Packages

- `packages/ui`: unstyled React Aria interaction primitives and HHC tokens.
- `packages/preferences`: shared locale/theme cookie contracts and bootstrap.
- `packages/account-client`: public session summary and logout client.
- `packages/hhc-web-client`: generated `hhc-web-api` DTOs and client.

## Commands

```bash
pnpm install
pnpm dev:web
pnpm dev:account
pnpm dev:admin
pnpm test
pnpm lint
pnpm build
```

Build one deployable independently with `pnpm --filter @hhc/web build`,
`pnpm --filter @hhc/account build`, or `pnpm --filter @hhc/admin build`.

## Deployment

`azure-pipelines.yml` verifies the full workspace, then builds and deploys
three independent images to `hhc-web`, `account-fe`, and `admin-fe`. Docker
build context is always the monorepo root.
# HHC Frontend

## Office Integration Compose

The HTTPS-only Windows Docker Desktop integration stack is documented in [the office Compose runbook](docs/runbooks/office-compose.md). It builds the sibling HHC services without source mounts and publishes only Caddy on TCP 443.
