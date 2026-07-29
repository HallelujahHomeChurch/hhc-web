# Office Compose Integration Environment Design

## Purpose

Run the current HHC web platform as a shared, production-like integration environment on one office Windows computer using Docker Desktop. It verifies browser SSO and CMS-to-public-site flows. It is not a replacement for single-repository, host-run development or Azure Container Apps.

## Scope

The Compose project lives in `hhc-web` as the office integration and platform
documentation home. It builds the sibling `account-fe` and `admin-fe`
repositories with explicit relative build contexts.

Default services:

- `caddy`: the only LAN-published HTTPS ingress.
- `api-gateway`: host routing and local JWT verifier.
- `web`, `account`, and `admin`: the three browser applications.
- `account-api`, `notification-api`, `hhc-web-api`, and `asset-api`.
- PostgreSQL and Redis.

Not included:

- Dapr sidecars. Compose uses direct Docker DNS upstreams; production Dapr behavior remains covered by deployment and staging tests.
- A local ClamAV container. `asset-api` continues to use the existing private `CLAMAV_HOST` and port `3310`.
- `audit-log`, which has not been implemented.
- LINE bot and Mailpit. They can be later optional profiles when their external credentials or user workflow need end-to-end testing.

## Network Topology

```text
Office browser
  -> Caddy :443
  -> api-gateway :10000
  -> frontend and API services on the Compose network
  -> PostgreSQL, Redis, and private ClamAV
```

Only Caddy publishes a host port. The gateway, applications, APIs, PostgreSQL, and Redis do not publish LAN ports. Caddy preserves the original `Host` and forwards `X-Forwarded-Proto: https` to the gateway.

For local Compose only, a gateway include replaces Dapr upstream bases with Docker DNS names such as `http://account-api:8080` and `http://hhc-web-api:8082`. The include configures Docker's embedded resolver (`127.0.0.11`) because Nginx resolves variable-based upstreams at runtime. Production gateway configuration remains unchanged.

## DNS And TLS

The Azure Public DNS zone contains exact A records, all pointing to the office computer's fixed RFC1918 address:

- `www-test.alive.org.tw`
- `account-test.alive.org.tw`
- `admin-test.alive.org.tw`

External clients can resolve these names but cannot route to the private address. Office-LAN clients can connect. There is no public IP record, router port forwarding, internal DNS zone, or split-horizon DNS requirement.

Caddy obtains publicly trusted certificates with Let's Encrypt DNS-01 through Azure DNS. DNS-01 does not require the ACME CA to reach the office computer. Windows Firewall permits TCP 443 on the Private profile only. Port 80 is not published or required.

Caddy uses a pinned custom image containing `github.com/caddy-dns/azure`. Its certificate and ACME-account storage are persistent named volumes.

The Azure credential is a dedicated service principal. It receives `DNS Zone Contributor` only on a dedicated `acme-test.alive.org.tw` validation zone. The parent zone delegates each `_acme-challenge` name by CNAME to a distinct target beneath that zone, and Caddy uses the matching DNS challenge override domain. This prevents certificate renewals from sharing a TXT record and prevents the office host from changing normal `alive.org.tw` DNS records.

The first certificate request uses the Let's Encrypt staging endpoint. Production issuance is enabled only after the three hostnames and CNAME delegation validate.

## Identity Contract

All browser origins are HTTPS and use the existing product boundaries:

- issuer: `https://account-test.alive.org.tw`
- public site: `https://www-test.alive.org.tw`
- admin callback: `https://admin-test.alive.org.tw/oauth/callback`
- web callback: `https://www-test.alive.org.tw/oauth/callback`
- shared non-auth cookie domain: `.alive.org.tw`

Refresh and authorization-session cookies remain host-only. The existing shared `hhc_device`, `hhc_sso_hint`, locale, and theme cookies use `.alive.org.tw` as designed.

## State, Migration, And Configuration

PostgreSQL uses one persistent local instance with separate databases and roles for Account, Website, and Asset ownership. Redis uses one persistent instance. Data is deliberately retained across `docker compose down`; reset is an explicit documented command.

`account-migrate` is a one-shot service. It must complete successfully before `account-api` starts. `hhc-web-api` and `asset-api` continue to run their own migrations at startup.

Committed files contain only defaults and placeholders:

- `compose.yaml`
- `compose/.env.example`
- `compose/caddy/Caddyfile`
- `compose/gateway/fqdn.local.conf`
- PostgreSQL initialization SQL
- a smoke-test script and runbook

`.env.compose.local` is ignored and contains generated Account cryptographic material, the initial local-admin password, Azure DNS service-principal credentials, and the private ClamAV endpoint. It is never copied into images or logged.

## Lifecycle

The normal command is `docker compose --env-file compose/.env.compose.local up --build -d`. Every container has a restart policy suitable for the office host. Caddy, PostgreSQL, Redis, and service data use named volumes. Docker Desktop starts after Windows login; the Compose project is started through a documented scheduled task or operator command, not an implicit application side effect.

The environment has no source bind mounts and no hot reload. Developers keep using each repository's existing scripts for focused work, then use Compose for integration verification.

## Verification

The implementation must provide repeatable checks for:

1. `docker compose config` succeeds with example configuration after secrets are supplied.
2. Caddy receives staging and then production DNS-01 certificates for all three hostnames.
3. Only TCP 443 is listening on the Windows LAN interface; data services are not reachable from LAN clients.
4. Account login, passive public SSO, Admin OAuth login, and current-device global logout work across the three hosts.
5. A CMS bulletin can be uploaded, scanned by private ClamAV, published, displayed by the public site, downloaded through its stable gateway URL, and revoked by unpublish.
6. A stop/start preserves databases, Redis state, Caddy certificates, and uploaded local assets.
7. An explicit reset removes only named Compose volumes after confirmation; it never targets repository directories.

## Operational Boundaries

The office machine is a shared test environment, not production. It may contain only test accounts, test content, and non-sensitive assets. Production remains Azure Container Apps with Dapr, managed identities, production secrets, and its own release controls.
