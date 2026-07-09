# HHC Platform Configuration, Feature Flag, And Release Control Design

This spec defines how HHC platform services should manage configuration, feature flags, kill switches, provider adapters, and release controls without creating a premature `config-api`.

Editable public site settings, navigation, footer links, social links, public contact display, shared layout data, and their separation from runtime config are specified in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

Restore quarantine controls, provider-send disablement during recovery, and DR evidence requirements are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`.

Deployment compatibility, release manifests, compatibility windows, ACA revision strategy, rollback/roll-forward rules, and production promotion evidence are specified in `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`.

Cloud Infrastructure as Code, canonical environment names, Azure resource naming/tagging, managed identity, Key Vault references, and drift checks are specified in `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`.

## Purpose

Configuration is a platform reliability and security boundary. A small church platform can move quickly only if each service starts with predictable config loading, explicit ownership, safe defaults, and a clear way to turn risky behavior off.

This spec covers:

- configuration classes and ownership
- environment variables and Key Vault usage
- product settings versus platform config
- feature flags and kill switches
- provider adapter selection
- release rollout controls
- config validation, audit, tests, and cleanup

## Core Decision

Do not create a standalone `config-api` in v1.

Use typed, service-owned configuration loaded at startup for deployment and platform behavior. Use service-owned database tables only for domain/product settings that editors or admins need to change at runtime. Use explicit feature flags and kill switches sparingly, with ownership, expiry, audit, and tests.

Create a separate `config-api` only after there are multiple independently deployed services that need shared dynamic runtime config, audited operator changes, and consistent rollout targeting that cannot be handled safely by service-owned config.

## Configuration Classes

| Class | Examples | Source of truth | Change cadence | Owner |
| --- | --- | --- | --- | --- |
| Build config | Next build mode, Go build tags | repository/pipeline | build time | owning repo |
| Deployment config | service URLs, route mode, environment name, cache TTL defaults | ACA env vars, pipeline variables, safe env files | deploy time | service owner |
| Secrets | DB password, provider API keys, webhook secrets, signing secrets | Azure Key Vault or platform secret store | rotated, never in repo | platform/operator |
| Route policy | gateway upstreams, CORS, rate zones, blocked paths | gateway config repo and pipeline | deploy time | gateway owner |
| Domain settings | public site settings, default locale, editable contact links | owning service database | runtime through admin UI | domain service |
| Feature flags | API-backed page reads, weekly bulletin function enabled, admin beta module | typed service config first; DB-backed only when admin-controlled | deploy time or controlled runtime | owning service |
| Kill switches | disable asset upload, disable provider sends, force public reads to stale projection | env var or explicit operator setting | incident time | service owner/operator |
| Restore controls | restore quarantine mode, disable public ingress, disable workers, disable provider callbacks | IaC/runtime config for recovery deployment | restore time | platform/operator |
| Provider config | email provider, scanner provider, Blob adapter | non-secret env plus Key Vault secret refs | deploy time | owning service |

Redis is not a source of truth for configuration. It can cache evaluated runtime settings only when the owning database remains authoritative.

## Runtime Config Versus Site Settings

V1 should keep three categories separate:

| Category | Examples | Owner | Change Path |
| --- | --- | --- | --- |
| Runtime config | hostnames, upstream URLs, OIDC issuer, token audience, DB/Redis URLs, provider adapters, cache default TTLs | service/gateway owner | deployment pipeline, env vars, Key Vault |
| Editorial site settings | public navigation, footer links, social links, music channel URL, contact display, site SEO defaults | `hhc-web-api` | admin CMS publish workflow |
| Frontend UI chrome | menu open/close labels, language switcher labels, generic loading/error copy | `hhc-web` | frontend release and i18n files |

Rules:

- Do not create a v1 `config-api` to serve navigation, footer links, or social links.
- Do not put editable public content in production env vars except as local bootstrap/fallback seed data.
- Do not allow CMS admins to edit runtime config, secrets, feature flags, service URLs, OIDC settings, storage provider details, or gateway route policy.
- Public site settings are served through `GET /api/site-layout`, not direct config reads.
- If an editable value changes public routing, sitemap, or metadata, it must publish through projection/cache invalidation instead of mutating live config in place.

## Ownership Rules

- Each service owns the config that changes its behavior.
- Gateway route, auth, CORS, rate-limit, and upstream config belong to `api-gateway`.
- OIDC issuer, JWKS URL, token audience, and emergency JWT denylist config belong to `api-gateway` and `account-api` contract ownership.
- Public website content settings belong to `hhc-web-api`, not `api-gateway`.
- Asset namespace policy belongs to `asset-api`.
- Notification template/provider policy belongs to `notification-api`.
- LINE bot function enablement belongs to `hhc-line-function-bot` profiles.
- Frontend presentation flags belong to `hhc-web`, but authorization-sensitive decisions must still be enforced by backend services.

Do not let one service read another service's config table. If a service needs another service's decision, call its API or consume its public contract.

## V1 Implementation Pattern

Every service should implement a typed config package:

```text
internal/config/
  config.go
  validate.go
  env.go
  defaults.go
  doc.go
```

The package should:

- load environment variables once at startup
- parse into a typed struct
- validate required fields
- validate URL hosts, issuer values, duration ranges, and allowed enum values
- reject unknown production values that would route to local/test resources
- expose a safe config summary for `/readyz` and logs
- never log secrets, tokens, upload targets, SAS URLs, or raw connection strings

Startup should fail fast when required production config is invalid. Non-production can use safe local defaults only when `ENVIRONMENT=local` or `ENVIRONMENT=test`.

## Required Common Fields

Every backend service should have:

```text
ENVIRONMENT=local|test|staging|prod
SERVICE_NAME=...
SERVICE_VERSION=...
PUBLIC_BASE_URL=https://www.alive.org.tw
LOG_LEVEL=info
REQUEST_TIMEOUT=...
DB_DSN=...
REDIS_URL=...
```

Services that call other services should use internal Dapr app ids or internal service URLs from config, not hard-coded hostnames.

Gateway-facing services should know their expected forwarded identity headers but should not accept client-supplied identity headers directly.

## Environment Naming

Allowed environments:

- `local`
- `test`
- `staging`
- `prod`

Do not use ambiguous names such as `dev`, `prod2`, `qa`, `live`, or `production` inside service config. Human-facing docs can say "production", but the application-facing `ENVIRONMENT` value should stay one of the four allowed values.

## Env Files And Examples

Each repo should keep safe examples:

```text
.env.example
.env.local.example
.env.test.example
.env.staging.example
```

Rules:

- Examples contain no real secrets.
- Examples use valid-looking but non-sensitive local values.
- Production `.env` files are not committed.
- New required env vars must update the examples in the same change.
- CI validates that documented required env vars match the config parser.

## Secrets

Secrets must be injected through Key Vault, ACA secret references, or the chosen cloud secret store.

Secrets include:

- database passwords
- Redis credentials
- OAuth client secrets
- token signing keys
- webhook signing secrets
- provider API keys
- Blob credentials and SAS signing material
- LINE channel access tokens and secrets

Do not expose secret values in `/readyz`, logs, metrics labels, audit metadata, OpenAPI examples, fixtures, or test output.

## Domain Settings Versus Platform Config

Use domain settings when authorized users need to change product behavior without a deployment.

Examples owned by `hhc-web-api`:

- public site display name
- default locale
- ministry contact links if editor-managed
- homepage module ordering if editor-managed
- SEO defaults if editor-managed

Do not use domain settings for:

- gateway route policy
- auth issuer/audience
- secret values
- provider credentials
- internal service allowlists
- database or cache connections
- asset namespace security rules

Domain settings should be versioned, audited, and validated like CMS content. Critical settings should require `cms.admin`.

## Feature Flag Principles

Feature flags are temporary release tools, not permanent architecture.

Every flag must define:

- flag key
- owning service
- owner contact/team
- purpose
- default by environment
- expiry or cleanup milestone
- allowed values
- affected routes or modules
- rollback action
- tests that prove both enabled and disabled behavior

Flags that affect security, privacy, grants, provider sends, or payment-like behavior must be server-side only. Frontend flags can hide UI, but backend authorization and validation must not rely on frontend flags.

Production-impacting flags must appear in the release manifest and config fingerprint. Expired temporary flags must fail CI or require explicit owner review.

## Recommended V1 Flags

| Flag | Owner | Default | Purpose |
| --- | --- | --- | --- |
| `hhc_web_api_public_reads_enabled` | `hhc-web` | staging `true`, production controlled rollout | Switch frontend modules from mock/static data to API reads |
| `hhc_web_api_admin_enabled` | `hhc-web-api` | staging `true`, production after gateway auth | Enable admin write routes after auth is verified |
| `weekly_bulletin_api_enabled` | `hhc-web-api` | staging `true`, production after seed parity | Enable public bulletin API |
| `line_download_weekly_bulletin_enabled` | `hhc-line-function-bot` | profile-specific | Enable LINE weekly bulletin function |
| `asset_admin_upload_enabled` | `asset-api` | staging `true`, production after scan pipeline ready | Enable admin upload sessions |
| `notification_sending_enabled` | `notification-api` | staging fake, production controlled | Allow real provider sends |

These flags should be removed after the rollout is stable unless they are true operational switches.

## Kill Switches

Kill switches are long-lived operational controls for incident response.

Recommended v1 kill switches:

| Switch | Owner | Effect |
| --- | --- | --- |
| `PUBLIC_API_FORCE_STALE_PROJECTIONS` | `hhc-web-api` | Serve last known good public projections when rebuilds fail |
| `ADMIN_WRITES_DISABLED` | `hhc-web-api` | Return maintenance error for admin mutations while public reads continue |
| `ASSET_UPLOADS_DISABLED` | `asset-api` | Reject new upload sessions while existing public downloads continue |
| `ASSET_PUBLIC_DOWNLOADS_DISABLED` | `asset-api` | Emergency block public asset downloads during malware or leakage incident |
| `NOTIFICATION_SENDS_DISABLED` | `notification-api` | Queue or suppress sends without losing intent |
| `LINE_OPTIONAL_FUNCTIONS_DISABLED` | `hhc-line-function-bot` | Disable non-webhook-critical functions while keeping basic bot health |
| `GATEWAY_ADMIN_API_BLOCKED` | `api-gateway` | Temporarily block admin API routes during high-risk auth incident |
| `RESTORE_QUARANTINE_MODE` | platform/runtime | Forces restored deployments to keep public ingress, provider sends, callbacks, scheduled jobs, LINE webhooks, and retention workers disabled until promotion approval |

Kill switch behavior must be explicit in API responses, logs, metrics, and runbooks. A kill switch should not make a service appear healthy if its critical user-facing behavior is disabled.

Kill switches must fail safe. They must not bypass auth, scan, asset grants, privacy, lifecycle, or retention checks. Active kill switches must appear in release evidence and incident/runbook output.

## Runtime Change Model

V1 prefers deploy-time config changes for platform behavior:

1. Change config in pipeline/ACA secret or env var.
2. Deploy or restart the affected service revision.
3. Run staging smoke or targeted production smoke.
4. Record the change in deployment evidence or incident notes.

Runtime admin-edited settings are allowed only for domain settings owned by the service database. Runtime operator switches are allowed only for documented kill switches.

Do not add generic "edit any env var from admin UI" behavior.

## Provider Adapter Selection

Provider choice should be explicit and typed.

Examples:

```text
NOTIFICATION_PROVIDER=fake|azure-communication-email|sendgrid
ASSET_BLOB_ADAPTER=azurite|azure-blob|filesystem
ASSET_SCANNER_PROVIDER=fake|clamav|cloud-provider
LINE_API_MODE=fake|line
```

Rules:

- `fake` providers are allowed only in `local`, `test`, and controlled staging tests.
- Production startup rejects fake providers unless a documented emergency degraded-mode switch allows no-op behavior.
- Provider secrets are separate from provider selection.
- Provider callbacks must verify signatures before updating state.
- Provider-specific response codes should be normalized before domain code sees them.

## Frontend Runtime Config

`hhc-web` should separate public browser config from server-only config.

Browser-exposed config can include:

- public base URL
- admin base URL
- account base URL
- locale list
- non-sensitive feature presentation flags

Browser-exposed config must not include:

- service internal URLs
- secrets
- provider keys
- upload signing material
- Redis or database addresses
- private feature flags that reveal unreleased sensitive behavior

Server-side `hhc-web` runtime config can include backend API base URL overrides for local/staging, but production should default to same-origin `/api` for public reads and `https://www.alive.org.tw/api/admin/*` for admin calls.

## Gateway Config

Gateway config should be treated like code.

It must define:

- host rules
- route groups
- allowed methods
- auth policy
- required scopes
- upstream app ids
- CORS policy
- body size limit
- rate-limit zone
- timeout
- blocked internal route patterns

Gateway config changes must be compared with service OpenAPI metadata and tested in staging before production promotion.

## Asset Namespace Config

`asset-api` namespace config is security-sensitive. It should be typed and validated at startup.

Each namespace must define:

- owner service
- allowed MIME types/extensions
- max size
- default visibility
- allowed visibility values
- scan requirement
- derivative policy
- retention policy
- upload session TTL
- download cache policy
- allowed caller app ids

Unknown namespace must be rejected. Production should not allow dynamic namespace creation through admin UI in v1.

## Notification Template Config

`notification-api` should store templates in a controlled registry.

Template config must define:

- template key
- owner service
- allowed channels
- required variables
- variable data classification
- allowed recipient source
- suppression policy
- provider category
- retention class

Templates that include personal or sensitive data require explicit data classification review before production use.

## LINE Bot Profile Config

The LINE bot already has profile-style behavior. Platform integration should keep that shape:

- functions are enabled per profile
- each function declares required upstream APIs
- function config cannot expose private service credentials unless that function truly needs internal service access
- public weekly bulletin download uses `hhc-web-api` public APIs, not `asset-api` credentials
- future LINE group file storage uses `asset-api /priv/assets/*` with explicit namespace and group policy

## Config Fingerprint

Each service should compute a safe config fingerprint at startup:

- include non-secret config keys and values
- include secret key names or versions, not secret values
- include service version and environment
- include enabled feature flags and kill switch states
- include provider adapter names

Expose the fingerprint hash in logs and `/readyz` metadata. This helps compare staging and production without leaking secrets.

## Audit Requirements

Audit these changes:

- domain setting changes
- admin role/scope changes
- feature flag runtime changes if DB-backed
- kill switch activation/deactivation
- provider config changes when performed through operational tooling
- gateway production route changes through deployment evidence
- asset namespace policy changes
- notification template registry changes

If a setting changes only through deployment, deployment metadata can be the audit evidence. If a setting changes through an admin/runtime API, write an `audit-log` event.

## Release Control Pattern

Use flags to reduce rollout risk:

1. Deploy schema and code with feature disabled.
2. Enable in staging.
3. Run contract, integration, and smoke tests.
4. Enable for production internal/admin users when applicable.
5. Enable production traffic.
6. Watch metrics and logs.
7. Remove temporary flag after one stable release window.

Do not keep old and new behavior forever behind a flag. Long-lived behavioral forks create untested combinations and increase support cost.

## Rollback Rules

Rollback should prefer the narrowest control:

1. Disable feature flag or kill switch if behavior is isolated.
2. Revert frontend data path to previous mode if public rendering breaks.
3. Revert gateway route config if routing/auth breaks.
4. Shift ACA traffic to previous revision if service code breaks.
5. Roll back data only if migration is reversible and no newer writes depend on it.

Flags must not hide data corruption. If data corruption is suspected, stop writes and follow the data recovery runbook.

## Testing Requirements

Every service should test:

- required env var validation
- invalid enum rejection
- invalid URL/host rejection
- fake provider rejected in production
- secrets are redacted from logs and ready output
- feature enabled and disabled behavior
- kill switch behavior
- config fingerprint contains no secret values
- `.env.example` stays in sync with config parser

Gateway should test route config against OpenAPI route metadata.

`hhc-web` should test that production public API base URL is same-origin and not a separate API host.

## CI Gates

CI should include:

- config parser unit tests
- env example consistency check
- forbidden production host scan
- secret pattern scan
- fake-provider-in-production test
- gateway policy versus OpenAPI comparison
- feature-flag matrix tests for changed modules
- kill-switch smoke tests for production-impacting switches

## Observability

Metrics:

- enabled feature flags by service
- active kill switches by service
- config validation failures
- provider adapter selected
- provider degraded/no-op mode
- domain setting update failures
- runtime setting audit failures

Logs should record config load success with safe summary only. Do not log full config structs unless redaction is guaranteed.

## Degraded Modes

Allowed degraded modes:

- public website serves stale projections
- notification sends queue for retry
- admin writes disabled while public reads continue
- asset uploads disabled while already published clean assets continue to download
- optional LINE functions disabled while webhook health remains intact

Not allowed:

- public asset download bypasses scan/grants because config failed
- admin API becomes public because config is missing
- fake notification provider silently active in production
- wildcard CORS with credentials due to config fallback
- `api-gateway` routes `/priv/*` publicly due to missing route config

## When To Introduce `config-api`

Introduce a dedicated config service only when at least three of these are true:

- multiple services need the same dynamic runtime flags
- operators need audited runtime changes without deployments
- staged rollout targeting by user/group/service is required
- config changes need approval workflow
- stale config propagation becomes a recurring incident source
- feature flags remain after release cleanup because they are true product controls

If introduced, `config-api` must be internal-only for platform config, audited, RBAC-protected, cached with explicit TTL, and designed so services fail safely when config is unavailable.

## Implementation Checklist

- Add typed config package to every service repo.
- Add safe env examples to every repo.
- Add config validation tests.
- Add config fingerprint in logs and `/readyz`.
- Add provider adapter enum validation.
- Add feature flag registry per service.
- Add kill switch registry per production-impacting service.
- Add audit events for runtime domain setting and kill-switch changes.
- Add CI checks for examples, forbidden hosts, fake providers, and secret leakage.
- Add runbook entries for every kill switch.

## Acceptance Criteria

- No v1 standalone `config-api` is required.
- Every service has typed startup config with fail-fast validation.
- Secrets come from Key Vault/secret store and are never logged or committed.
- Domain settings are stored in the owning service, not in a central catch-all table.
- Feature flags have owner, purpose, default, tests, rollback, and cleanup criteria.
- Kill switches are explicit, observable, audited when changed at runtime, and covered by runbooks.
- Fake providers cannot silently run in production.
- Gateway route config is treated as code and compared with API contracts.
- Asset namespace and notification template config are security-reviewed and owner-scoped.
- CI can prove env examples, config parser, and production guardrails stay aligned.
