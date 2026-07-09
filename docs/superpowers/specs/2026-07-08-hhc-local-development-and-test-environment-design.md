# HHC Local Development And Test Environment Design

This spec defines how HHC platform services should run locally, in CI, and in staging without production secrets or production data.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## Purpose

The architecture has multiple services, PostgreSQL, Redis, Blob storage, Dapr-style service invocation, account/JWKS validation, asset scanning, notification providers, audit append, and LINE bot consumers.

If every repo invents its own local setup, the platform will drift quickly. This design creates one repeatable mental model:

- local development runs enough real dependencies to catch integration bugs
- CI runs deterministic tests without cloud secrets
- staging is the first production-like environment
- production smoke tests prove the already-reviewed rollout, not basic correctness for the first time

## Core Decision

Use three test environment layers:

| Layer | Purpose | Dependencies |
| --- | --- | --- |
| Local dev | fast manual development and debugging | Docker Compose or equivalent local services, local env files, fake providers |
| CI | deterministic automated verification | Testcontainers or ephemeral containers, generated fixtures, no cloud secrets |
| Staging | production-like route, auth, Dapr, storage, and deployment verification | Azure Container Apps, staging PostgreSQL/Redis/Blob/Key Vault |

Do not use production data, production secrets, production Blob containers, or production account signing keys in local or CI.

## Local Profiles

Use explicit profiles instead of one heavy command for everything.

| Profile | Purpose | Runs |
| --- | --- | --- |
| `frontend-only` | current `hhc-web` UI work with mock/API fixtures | Next.js, fixture files |
| `web-api` | website backend and CMS work | PostgreSQL, Redis, `hhc-web-api`, fake `asset-api`, fake `audit-log` optional |
| `asset` | asset service work | PostgreSQL, Azurite/local Blob, fake scanner, fake derivative worker |
| `gateway-auth` | gateway/JWT route policy work | `api-gateway`, local JWKS server, upstream echo service |
| `bot-weekly` | LINE weekly bulletin integration | bot, `hhc-web-api` fixture/server, no asset credentials |
| `full-platform` | end-to-end local smoke | gateway, web, web-api, account fake, asset, audit, notification fake, PostgreSQL, Redis, local Blob |

Recommended script names:

```text
scripts/dev/up.ps1
scripts/dev/down.ps1
scripts/dev/reset.ps1
scripts/dev/seed.ps1
scripts/dev/smoke.ps1
```

Linux/macOS shell wrappers can be added later, but PowerShell scripts should be first-class for this workstation.

## Local Dependency Strategy

| Dependency | Local Strategy | CI Strategy | Staging Strategy |
| --- | --- | --- | --- |
| PostgreSQL | Docker container, one DB with schemas | Testcontainers or ephemeral container | Azure PostgreSQL staging |
| Redis | Docker container | Testcontainers or ephemeral container | Azure Cache staging |
| Blob | Azurite or filesystem adapter | Azurite/Testcontainers or fake adapter | Azure Blob staging |
| Dapr invocation | local direct URLs or local Dapr sidecars by profile | direct URLs unless testing invocation policy | Dapr in ACA |
| Account/JWKS | local fake issuer and generated keys | generated test keys | staging `account-api` |
| Notification provider | fake provider | fake provider | provider test credentials |
| Asset scanner | fake scanner with clean/infected/failed modes | fake scanner with deterministic modes | staging scanner adapter |
| LINE webhook | signature fixtures and local webhook tests | signature fixtures | staging bot channel/test webhook |

Fakes must be explicit. A fake provider should not silently run in staging or production.

## Environment Files

Use environment-specific examples:

```text
.env.example
.env.local.example
.env.test.example
.env.staging.example
```

Rules:

- Real `.env.local` and `.env.test` are ignored by Git.
- Example files contain safe sample values only.
- Production/staging secrets live in Key Vault/ACA secrets, not repo files.
- Service startup validates required variables and fails fast.
- Environment names are explicit: `local`, `test`, `staging`, `prod`.

Local defaults should never point to production hosts.

## Port And Host Registry

Use a stable local port registry.

| Component | Local URL |
| --- | --- |
| `hhc-web` | `http://localhost:3000` |
| `api-gateway` | `http://localhost:8080` |
| `account-api` fake/local | `http://localhost:8081` |
| `hhc-web-api` | `http://localhost:8082` |
| `asset-api` | `http://localhost:8083` |
| `notification-api` fake/local | `http://localhost:8084` |
| `audit-log` | `http://localhost:8085` |
| `hhc-line-function-bot` | `http://localhost:7071` or repo default |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Azurite Blob | `localhost:10000` |

Local host-header testing can use configured hostnames only when needed:

```text
www.local.alive.org.tw
admin.local.alive.org.tw
account.local.alive.org.tw
```

Do not require editing system hosts for ordinary unit/integration tests.

## Local Account And JWT

Protected route development needs stable local tokens.

Local account/JWKS rules:

- Generate local signing keys into ignored dev storage.
- Serve OIDC metadata and JWKS from a local fake issuer.
- Provide a script to mint test access JWTs for personas.
- Do not reuse staging or production signing keys.
- Use the same claim names as staging/prod.
- Keep access token TTL short enough to catch expiry handling.

Required personas:

| Persona | Roles | Scopes |
| --- | --- | --- |
| public anonymous | none | none |
| cms editor | `cms.editor` | `cms:read`, `cms:write` |
| cms publisher | `cms.publisher` | `cms:read`, `cms:write`, `cms:publish` |
| asset manager | `asset.manager` | `assets:read`, `assets:write`, `assets:grant` |
| audit reader | `audit.reader` | `audit:read` |
| audit sensitive reader | `audit.sensitive_reader` | `audit:read`, `audit:sensitive_read` |
| admin | `cms.admin` | all v1 admin scopes |

## Internal Service Identity In Local Dev

Local internal auth should stay explicit.

Rules:

- Default local profile keeps internal auth enabled.
- Local middleware can derive caller app id from explicit local configuration or a dev-only header.
- Dev-only internal headers are accepted only when `ENVIRONMENT=local`.
- CI must include tests proving dev-only headers are rejected outside local/test.
- Staging uses real Dapr/app-id behavior, not dev header simulation.

## Seed And Fixture Strategy

Use deterministic seeds.

Seed inputs:

- current `hhc-web` mock data
- current locale JSON editorial content
- public assets under current repo
- weekly bulletin fixtures
- lifecycle fixtures for soft-deleted content, revoked asset grants, legal hold, retention due items, redacted account fields, and restored-pending-reconciliation records
- publication workflow fixtures for waiting asset grant, stale publish after unpublish, emergency takedown, and reconciliation repair
- route registry and sitemap expectations

Seed outputs:

- `hhc_web` source rows
- public projections
- asset metadata rows or fake asset ids
- lifecycle ledger rows and expected retention worker dry-run output
- publication workflow rows and expected public projection/asset grant outcomes
- API fixtures for public route tests
- seed provenance: source commit, checksum, row counts, warnings

Rules:

- Seeds are idempotent.
- Seeds never require production services.
- Fixture snapshots are stable and reviewed with contract changes.
- Seed reset can drop local/test schemas but must never target staging/prod unless explicitly protected.
- Restore and retention fixtures must prove deleted, redacted, held, and revoked-grant data does not reappear in public projections, public search, sitemap, or public asset routes.
- Publication workflow fixtures must prove required-asset content stays hidden until grants are active and stale workflows cannot re-expose unpublished content.

## Test Pyramid

Use the fastest reliable test for each risk.

| Test Type | Runs Where | Proves |
| --- | --- | --- |
| Unit | local, CI | pure validation, policy, state machines |
| Integration | local, CI | DB/Redis/Blob adapters, migrations, workers |
| Contract | CI, staging | API shapes, gateway metadata, generated clients |
| Consumer fixture | CI | `hhc-web` and LINE bot compatibility |
| Lifecycle fixture | CI | retention worker, legal hold, deletion/redaction, restore reconciliation, and public-leak prevention |
| Publication workflow fixture | CI | grant-before-visible, stale workflow cancellation, emergency takedown, and reconciliation |
| Local smoke | local | developer stack is wired correctly |
| Staging smoke | staging | deployed hosts, auth, Dapr, storage, routes |
| Production smoke | prod after rollout | production route health and rollback evidence |

Do not use staging smoke tests as a replacement for CI integration tests.

## CI Gates

Every service CI should include:

1. Format check.
2. Lint/static analysis.
3. Unit tests.
4. Migration test against ephemeral PostgreSQL.
5. Integration tests with required ephemeral dependencies.
6. OpenAPI validation for API-owning services.
7. Contract compatibility check.
8. Generated client compile check for affected consumers.
9. Container build.
10. Secret scan.
11. Dependency/vulnerability scan when available.

CI must not require:

- production secrets
- production databases
- production Blob containers
- live notification providers
- live LINE channel credentials

## Service Doubles

Service doubles are allowed when they preserve contract behavior.

| Double | Required Behavior |
| --- | --- |
| fake `asset-api` | returns asset ids, public URLs, grant failures, scan states |
| fake scanner | deterministic clean/infected/failed |
| fake notification provider | queued/sent/failed callbacks |
| fake `audit-log` | validates event shape and idempotency |
| fake account/JWKS | real JWT signing/verification semantics with test keys |
| upstream echo service | validates gateway headers and route policy |
| fake LINE API | webhook signature fixtures and reply API behavior |

Fakes should fail loudly when called with unsupported behavior. Silent success hides integration bugs.

## Migration Testing

Migration rules:

- Every migration runs on an empty schema and an upgraded seeded schema.
- Roll-forward and rollback notes are generated with each production migration.
- Destructive migrations are blocked unless a backup point and manual approval exist.
- Migration tests include indexes/constraints needed for uniqueness and optimistic concurrency.
- `hhc-web-api` seed migrations must verify public route parity after migration.

## Staging Smoke Tests

Staging smoke tests must use staging hosts and staging data only.

Required route checks:

- public website route loads for `zh-Hant`, `zh-Hans`, and `en`
- `GET /api/home`
- `GET /api/site-layout`
- `GET /api/bulletins/latest`
- public asset download for a clean staged asset
- admin route without token returns `401`
- admin route with insufficient scope returns `403`
- admin route with valid token reaches upstream
- admin preview route returns no-store/noindex and the matching draft stays hidden from public routes
- public `/priv/*` and `/api/priv/*` are blocked
- `admin.alive.org.tw` equivalent staging host does not expose `/api/*`
- LINE bot weekly function fetches staged bulletin

Required dependency checks:

- PostgreSQL ready checks
- Redis ready checks
- Blob ready checks
- Dapr app ids and internal allowlists
- JWKS cache and key rotation rehearsal when account changes

## Test Data Safety

Rules:

- No production database dumps in local or CI.
- No production Blob copy into local or CI.
- No real member/pastoral/donation data in test fixtures.
- Emails, phone numbers, LINE ids, and provider ids in fixtures must be fake.
- Screenshots or logs from tests must not contain secrets or personal data.
- Staging may contain realistic fake content, not real sensitive data.

## Reset And Cleanup

Local reset should be predictable.

`scripts/dev/reset.ps1` should be able to:

- stop local services
- remove local containers/volumes when requested
- recreate schemas
- rerun migrations
- rerun deterministic seeds
- clear Redis
- clear local Blob/Azurite container
- print local URLs and test personas

CI cleanup should always remove ephemeral containers and test artifacts after the run.

## Observability In Tests

Local and CI should verify observability basics:

- logs include request id and service name
- protected route failures log reason without secrets
- worker retries expose retry count
- smoke tests print request ids for failed calls
- test failures include enough context to debug route/auth/cache issues

Do not print tokens, cookies, upload targets, Blob URLs, SAS URLs, provider secrets, or raw private payloads in test output.

## Developer Workflow

Recommended local flow:

1. Start the smallest profile needed.
2. Run migrations.
3. Run deterministic seed.
4. Run service unit/integration tests.
5. Run local smoke for touched routes.
6. Commit only code, docs, migrations, and safe fixtures.

Avoid starting the full platform unless the change crosses service boundaries. Smaller profiles keep feedback fast.

## Acceptance Criteria

- Local dev has documented profiles for frontend-only, web-api, asset, gateway-auth, bot-weekly, and full-platform.
- CI can run without production secrets or live provider credentials.
- Ephemeral PostgreSQL/Redis/Blob or fakes are defined for integration tests.
- Local JWT/JWKS behavior matches production claim names without production keys.
- Deterministic seed and fixture workflow supports current website parity.
- Staging smoke tests cover hosts, auth, `/priv/*` blocking, asset download, admin routes, and LINE weekly bulletin.
- Fakes are explicit and cannot silently run in staging/prod.
- Reset/cleanup procedure protects staging/prod and makes local state reproducible.
