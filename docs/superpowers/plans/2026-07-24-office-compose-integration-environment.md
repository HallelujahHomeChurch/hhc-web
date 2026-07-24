# Office Compose Integration Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a one-command, HTTPS-only office integration environment for HHC browser SSO and CMS publication flows on Windows Docker Desktop.

**Architecture:** Caddy is the only host-published service and obtains certificates through Azure DNS-01. It proxies the three `*-test.alive.org.tw` hosts to the existing gateway. Compose supplies a local gateway upstream mapping that uses Docker DNS instead of production Dapr invocation. Stateful services use named volumes; private ClamAV remains external.

**Tech Stack:** Docker Compose, Caddy with `caddy-dns/azure`, Nginx, Go services, Next.js/Vite images, PostgreSQL, Redis, Azure DNS, Let's Encrypt DNS-01.

## Global Constraints

- Store all Compose files in `/Users/rayselfs/Projects/hhc/hhc-web`.
- Publish only Caddy TCP 443. Do not publish gateway, APIs, PostgreSQL, or Redis.
- Use exact test hosts: `www-test.alive.org.tw`, `account-test.alive.org.tw`, and `admin-test.alive.org.tw`.
- Public Azure DNS A records resolve to the office host's fixed RFC1918 address. Do not configure router port forwarding.
- Use DNS-01 only; port 80 is not published.
- Production gateway/Dapr configuration remains unchanged.
- Do not commit credentials, generated keys, or local state.
- Use the existing external private ClamAV endpoint; do not add a ClamAV image.
- Keep the line bot and unimplemented audit-log outside the default stack.

---

### Task 1: Add the Compose project skeleton and persistent data bootstrap

**Files:**
- Create: `compose.yaml`
- Create: `compose/.env.example`
- Create: `compose/postgres/01-databases.sh`
- Modify: `.gitignore`

**Interfaces:**
- `compose/.env.compose.local` supplies all secrets and is ignored.
- `postgres` creates `account_db`, `hhc_web`, and `asset` databases with their isolated roles.
- Named volumes are `office-postgres`, `office-redis`, `office-assets`, `office-avatars`, `office-caddy-data`, and `office-caddy-config`.

- [ ] **Step 1: Verify the project has no Compose file**

Run: `test ! -e compose.yaml`

Expected: exit code `0` before creating the stack.

- [ ] **Step 2: Add the ignored local environment convention**

Add `compose/.env.compose.local` to `.gitignore`, and create `compose/.env.example` with every required non-secret key. Keep Azure client secret, Account key material, and test-admin password empty.

- [ ] **Step 3: Add PostgreSQL initialization**

Create an executable shell init script that uses `psql --set` variables from `POSTGRES_*`, `ACCOUNT_DB_*`, `WEB_DB_*`, and `ASSET_DB_*` values. It must create roles and databases only when absent, then grant each role only its own database.

- [ ] **Step 4: Add stateful Compose services first**

Define PostgreSQL 16 and Redis 7 with named volumes and health checks. Do not add host `ports` to either service. Mount the initialization script under `/docker-entrypoint-initdb.d/01-databases.sh`.

- [ ] **Step 5: Validate the configuration**

Run: `docker compose --env-file compose/.env.example config --quiet`

Expected: exit code `0`; no credential value appears in output.

- [ ] **Step 6: Commit**

```bash
git add compose.yaml compose/.env.example compose/postgres/01-databases.sh .gitignore
git commit -m "feat: add office compose stateful foundation"
```

### Task 2: Add Caddy Azure DNS-01 TLS ingress

**Files:**
- Create: `compose/caddy/Dockerfile`
- Create: `compose/caddy/Caddyfile`
- Modify: `compose.yaml`
- Modify: `compose/.env.example`

**Interfaces:**
- `caddy` publishes `443:443` and proxies all three test hosts to `api-gateway:10000`.
- It loads Azure credentials only from process environment.
- Caddy storage uses `office-caddy-data` and `office-caddy-config`.

- [ ] **Step 1: Add a failing module assertion command**

Run: `docker build -f compose/caddy/Dockerfile -t hhc-office-caddy:test compose/caddy`

Expected: it fails because the Dockerfile does not yet exist.

- [ ] **Step 2: Build a pinned Caddy image with the Azure DNS module**

Use the Caddy builder image and `xcaddy build --with github.com/caddy-dns/azure@v0.6.0`. Copy only the built binary into a pinned Caddy runtime image. The later verification command must show `dns.providers.azure` in `caddy list-modules`.

- [ ] **Step 3: Configure exact HTTPS host routing**

Create a Caddyfile with one site block for each test hostname, a shared `reverse_proxy api-gateway:10000`, Azure DNS challenge configuration, `acme_ca {$ACME_CA}`, and `dns_challenge_override_domain _acme-challenge.acme-test.alive.org.tw`.

- [ ] **Step 4: Add the Caddy service**

Use only `ports: ["443:443"]`, mount the Caddyfile read-only, attach persistent Caddy volumes, and set `restart: unless-stopped`. Add `ACME_CA` to the example environment with the Let’s Encrypt staging directory as its initial value.

- [ ] **Step 5: Verify module and configuration**

Run:

```bash
docker build -f compose/caddy/Dockerfile -t hhc-office-caddy:test compose/caddy
docker run --rm hhc-office-caddy:test list-modules | rg '^dns.providers.azure$'
docker run --rm -v "$PWD/compose/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" hhc-office-caddy:test caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```bash
git add compose/caddy compose.yaml compose/.env.example
git commit -m "feat: add Azure DNS TLS ingress for office compose"
```

### Task 3: Add the gateway local upstream overlay

**Files:**
- Create: `compose/gateway/fqdn.local.conf`
- Modify: `compose.yaml`
- Test: `scripts/test-office-compose-gateway.sh`

**Interfaces:**
- `fqdn.local.conf` defines the existing `$*_base` variables with Docker service names.
- The `api-gateway` image is unmodified and its production `fqdn.conf` remains the default outside Compose.

- [ ] **Step 1: Write the gateway configuration test**

Create `scripts/test-office-compose-gateway.sh` to render the Compose config, start only gateway dependencies, run `nginx -t` in the gateway container, and assert that `www-test.alive.org.tw`, `account-test.alive.org.tw`, and `admin-test.alive.org.tw` select distinct gateway server blocks using `curl --resolve`.

- [ ] **Step 2: Run it before the overlay exists**

Run: `bash scripts/test-office-compose-gateway.sh`

Expected: fail because Compose does not yet mount the local FQDN mapping.

- [ ] **Step 3: Add direct Docker DNS upstreams**

Define `$account_fe_base`, `$account_api_base`, `$admin_fe_base`, `$hhc_web_base`, `$hhc_web_api_base`, and `$asset_api_base` with their Compose service hostnames and ports. Add `resolver 127.0.0.11 valid=30s ipv6=off;` so Nginx can resolve variable-backed Docker upstreams.

- [ ] **Step 4: Mount the overlay only in Compose**

Bind mount `fqdn.local.conf` over `/etc/nginx/conf.d/common/fqdn.conf:ro` for the gateway service. Set gateway issuer/JWKS configuration to the HTTPS `account-test` host.

- [ ] **Step 5: Run the gateway test**

Run: `bash scripts/test-office-compose-gateway.sh`

Expected: exit `0`, with no gateway port published to the host.

- [ ] **Step 6: Commit**

```bash
git add compose/gateway/fqdn.local.conf compose.yaml scripts/test-office-compose-gateway.sh
git commit -m "feat: add direct gateway upstreams for office compose"
```

### Task 4: Compose application services and migration ordering

**Files:**
- Modify: `compose.yaml`
- Modify: `compose/.env.example`
- Create: `scripts/office-compose-init.sh`

**Interfaces:**
- `account-migrate` exits successfully before `account-api` starts.
- `account-api`, `hhc-web-api`, and `asset-api` receive database URLs/hosts matching the isolated databases.
- Browser apps use same-origin API paths and the three HTTPS `*-test` origins.

- [ ] **Step 1: Add a failing service inventory assertion**

Run: `docker compose --env-file compose/.env.example config --services | sort`

Expected: it does not yet contain all required service names.

- [ ] **Step 2: Add service definitions**

Add image builds for the three frontend apps, gateway, Account API, notification API, Website API, and Asset API. Use explicit sibling build contexts, internal `expose` ports, `restart: unless-stopped`, and database/Redis health dependencies.

- [ ] **Step 3: Add account migration ordering**

Run the existing Account API migration binary as `account-migrate` with `restart: "no"`; require `service_completed_successfully` before starting `account-api`.

- [ ] **Step 4: Add safe environment bootstrap**

Create `scripts/office-compose-init.sh` that copies `compose/.env.example` only when the local env file is absent, generates Account Ed25519/JWT/CSRF/MFA secrets by calling the existing Account key-generation script, and stops before writing Azure DNS credentials. It must refuse to overwrite an existing local env file.

- [ ] **Step 5: Validate the complete service graph**

Run:

```bash
bash scripts/office-compose-init.sh
docker compose --env-file compose/.env.compose.local config --services | sort
```

Expected services: `account`, `account-api`, `account-migrate`, `admin`, `api-gateway`, `asset-api`, `caddy`, `notification-api`, `postgres`, `redis`, `web`, `hhc-web-api`.

- [ ] **Step 6: Commit**

```bash
git add compose.yaml compose/.env.example scripts/office-compose-init.sh
git commit -m "feat: compose the HHC office integration stack"
```

### Task 5: Add the office operator runbook and end-to-end smoke test

**Files:**
- Create: `docs/runbooks/office-compose.md`
- Create: `scripts/office-compose-smoke.sh`
- Modify: `README.md`

**Interfaces:**
- The runbook documents Azure DNS records, `_acme-challenge` CNAME delegation, Windows Private-profile firewall rule, first staging certificate, production certificate switch, lifecycle commands, and explicit volume reset.
- The smoke script accepts no secrets and validates only through the Caddy/Gateway HTTPS path.

- [ ] **Step 1: Write the smoke test before documenting the happy path**

Create a shell script that waits for `https://www-test.alive.org.tw/health`, `https://account-test.alive.org.tw/health`, and `https://admin-test.alive.org.tw/health`, then asserts the public host rejects `/priv/` and the admin host rejects `/api/`.

- [ ] **Step 2: Run it before the stack is up**

Run: `bash scripts/office-compose-smoke.sh`

Expected: fail with a clear unavailable-host message.

- [ ] **Step 3: Add the operator runbook**

Document Windows Docker Desktop prerequisites, fixed RFC1918 IP, Azure DNS exact A records, dedicated ACME validation zone/CNAME delegation, DNS service-principal role scope, staging-to-production CA transition, firewall scope, startup, logs, shutdown, upgrade, and confirmed volume reset.

- [ ] **Step 4: Start and smoke the stack**

Run:

```bash
docker compose --env-file compose/.env.compose.local up --build -d
bash scripts/office-compose-smoke.sh
```

Expected: gateway health and host routing pass. Certificate issuance remains a manual Azure-DNS prerequisite and is recorded in the runbook.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/office-compose.md scripts/office-compose-smoke.sh README.md
git commit -m "docs: add office compose operations runbook"
```

### Task 6: Final configuration and regression verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-24-office-compose-integration-environment-design.md` only if verification exposes a design contradiction.

- [ ] **Step 1: Run Compose validation**

Run: `docker compose --env-file compose/.env.compose.local config --quiet`

Expected: exit `0`.

- [ ] **Step 2: Run application regressions**

Run: `pnpm test && pnpm lint && pnpm build`

Expected: all workspace tests, lint projects, and builds pass.

- [ ] **Step 3: Validate network exposure**

Run: `docker compose --env-file compose/.env.compose.local ps`

Expected: only Caddy publishes host port `443`; no database, Redis, gateway, or API port is mapped.

- [ ] **Step 4: Run gateway and production-image checks**

Run:

```bash
docker build -t hhc-api-gateway:office-check ../account/api-gateway
docker run --rm --entrypoint nginx hhc-api-gateway:office-check -t
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit final corrections if required**

```bash
git status --short
git add <only-files-corrected-by-verification>
git commit -m "fix: verify office compose integration"
```
