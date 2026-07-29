# Office Compose Integration Environment

This is a shared test environment for Windows Docker Desktop, not production. Store only test accounts, content, and assets in it.

## Prerequisites

- Docker Desktop is running on the office computer, which has a fixed RFC1918 LAN IP.
- Azure Public DNS has `www-test.alive.org.tw`, `account-test.alive.org.tw`, and `admin-test.alive.org.tw` A records pointing to that LAN IP. They may resolve publicly; no router port-forwarding is configured.
- Windows Firewall permits inbound TCP 443 only on the Private profile.
- A dedicated `acme-test.alive.org.tw` Azure DNS zone exists. Create these CNAMEs: `_acme-challenge.www-test.alive.org.tw` to `_acme-challenge.www-test.acme-test.alive.org.tw`, `_acme-challenge.account-test.alive.org.tw` to `_acme-challenge.account-test.acme-test.alive.org.tw`, and `_acme-challenge.admin-test.alive.org.tw` to `_acme-challenge.admin-test.acme-test.alive.org.tw`. The Azure service principal has `DNS Zone Contributor` only on this validation zone.
- The office Docker network can reach the private ClamAV endpoint on `172.16.65.5:3310`.
- `hhc-web`, `account-fe`, and `admin-fe` are sibling directories.
- A dedicated npmrc outside the repositories contains a GitHub token with
  `read:packages`:

  ```text
  @hallelujahhomechurch:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=github_pat_REDACTED
  ```

## First Start

From the repository root:

```sh
./scripts/office-compose-init.sh
```

Fill `compose/.env.compose.local` with the Azure DNS service-principal fields,
`ACME_EMAIL`, and the absolute Windows `FRONTEND_NPMRC_FILE` path. Keep
`ACME_CA` on Let's Encrypt staging for the first successful issuance.

```sh
docker compose --env-file compose/.env.compose.local up --build -d
./scripts/office-compose-smoke.sh
```

After staging succeeds, set `ACME_CA=https://acme-v02.api.letsencrypt.org/directory` and restart only Caddy:

```sh
docker compose --env-file compose/.env.compose.local up -d --build caddy
```

## Operations

```sh
docker compose --env-file compose/.env.compose.local logs -f caddy api-gateway
docker compose --env-file compose/.env.compose.local ps
docker compose --env-file compose/.env.compose.local down
docker compose --env-file compose/.env.compose.local up --build -d
```

Only Caddy publishes a host port (`443`). PostgreSQL, Redis, the gateway, and all application services remain internal to Compose.

## Reset

This permanently removes only Compose-managed test state. It does not remove repository files:

```sh
docker compose --env-file compose/.env.compose.local down --volumes
```

Use a fresh `compose/.env.compose.local` only when rotating the integration environment's credentials.
