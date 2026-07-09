# HHC Cloud Infrastructure, IaC, And Resource Governance Design

## Purpose

This spec defines how HHC cloud infrastructure is created, named, secured, changed, and audited.

It covers:

- Infrastructure as Code ownership.
- Azure resource naming and tagging.
- Environment names and resource separation.
- Azure DevOps service connections and deployment identity.
- Managed identity and least-privilege access.
- Key Vault, secret references, and rotation ownership.
- IaC drift detection and manual-change controls.
- Infrastructure release classes and approval gates.
- Bootstrap order for new environments.

This spec prevents the platform from drifting through portal-click changes, inconsistent environment names, shared secrets, or broad deployment identities.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

External alignment:

- Azure Well-Architected Framework Operational Excellence: `https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/principles`
- Azure Well-Architected IaC design guidance: `https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/infrastructure-as-code-design`
- Azure Cloud Adoption Framework resource naming: `https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming`
- Azure Cloud Adoption Framework resource tagging: `https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging`
- Azure DevOps workload identity federation for Azure Resource Manager service connections: `https://learn.microsoft.com/en-us/azure/devops/pipelines/library/connect-to-azure`
- Azure Container Apps managed identity: `https://learn.microsoft.com/en-us/azure/container-apps/managed-identity`

DNS, TLS certificate, custom-domain binding, HSTS staging, and production traffic cutover are production-impacting infrastructure changes and follow `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`.

PostgreSQL backup retention, backup redundancy, Blob data-protection settings, Redis persistence/export decisions, restore quarantine controls, and DR drill age alerts follow `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`.

## Core Decision

Use Infrastructure as Code for cloud resources and deployment wiring. Do not create a runtime `platform-api`, `infra-api`, or portal-operated control plane in v1.

The v1 infrastructure model is:

- Azure Container Apps for deployables.
- Azure Container Apps Jobs for service-owned scheduled, manual, and event-driven finite work when the worker orchestration design approves that runtime shape.
- Azure Container Registry for private service images.
- Azure Database for PostgreSQL Flexible Server.
- Azure Cache for Redis.
- Azure Blob Storage behind `asset-api`.
- Azure Key Vault or ACA secrets for secrets.
- Managed identities for service-to-resource access where feasible.
- Azure DevOps pipelines with workload identity federation for Azure deployments.
- Bicep as the default Azure-native IaC engine unless the organization already standardizes on Terraform.

Bicep is recommended for v1 because the platform is Azure-first, the resource set is small, and native ARM integration reduces state-management overhead. Terraform is acceptable only if the team commits to remote state, state locking, provider version governance, and module ownership.

The important rule is one IaC engine per environment stack. Do not mix Bicep and Terraform for the same resource group.

## Canonical Environment Names

Application-facing `ENVIRONMENT` values:

```text
local
test
staging
prod
```

Rules:

- Use `prod`, not `production`, in app config, Redis prefixes, Blob containers, release manifests, tags, and metrics.
- Human-facing docs may say "production", but machine-readable values use `prod`.
- `local` and `test` never point to Azure production resources.
- `staging` is production-like and uses staging-only Azure resources and secrets.
- `prod` is the only environment allowed to serve production public traffic.

Canonical prefixes:

```text
REDIS_KEY_PREFIX=prod:hhc-web-api
BLOB_CONTAINER=assets-prod
PUBLIC_CACHE_PREFIX=prod:hhc-web-api:public
```

Do not introduce `dev`, `qa`, `prod2`, `live`, or `production` as service config values. If an Azure resource name needs a suffix, keep it outside `ENVIRONMENT`.

## IaC Repository And Ownership

Recommended repository shape:

```text
infra/
  README.md
  bicep/
    modules/
      container-app.bicep
      container-app-job.bicep
      postgres.bicep
      redis.bicep
      storage.bicep
      key-vault.bicep
      app-insights.bicep
      managed-identity.bicep
      role-assignment.bicep
    env/
      staging/
        main.bicep
        params.json
      prod/
        main.bicep
        params.json
    scripts/
      what-if.ps1
      deploy.ps1
      export-current-state.ps1
```

Placement options:

| Option | Use When | Decision |
| --- | --- | --- |
| Dedicated `hhc-platform-infra` repo | multiple service repos share runtime resources | recommended for v1 |
| Infra folder in each service repo | resource is truly service-local and not shared | allowed for service-local alerts/dashboards only |
| Portal-only setup | one-time emergency repair | temporary only; must be backfilled into IaC |

The infra repo owns shared cloud resources. Service repos own app code, service-local migrations, OpenAPI, and service-specific runtime config validation.

## IaC Layering

Use layered stacks:

| Layer | Owns | Release Frequency | Approval |
| --- | --- | --- | --- |
| Foundation | resource groups, Log Analytics, networking, Key Vault, managed identities | rare | platform owner approval |
| Data | PostgreSQL server/DBs/schemas access, Redis, Blob storage | low | platform + affected service owner |
| Runtime | ACA environment, Container Apps, Dapr settings, ingress, scale rules | normal | affected service owner; gateway changes need extra approval |
| Worker/Job Runtime | service-owned worker apps, ACA job definitions, schedules, worker identities, pause controls | normal | affected service owner; production schedules need platform approval |
| Observability | dashboards, alerts, action groups, log retention | normal | service owner |
| App config references | ACA env vars, secret references, identity bindings | normal | service owner + platform guardrails |

Layering should reduce blast radius, not create abstraction for its own sake. Avoid deep module hierarchies that hide resource ownership.

## Naming Convention

Use Azure Cloud Adoption Framework-style names with resource abbreviations and consistent tokens.

Default format:

```text
{abbr}-hhcweb-{component}-{env}-{region}-{nn}
```

Tokens:

| Token | Meaning | Example |
| --- | --- | --- |
| `abbr` | Azure resource abbreviation | `rg`, `ca`, `kv`, `st`, `pg`, `redis`, `appi` |
| `hhcweb` | workload | `hhcweb` |
| `component` | service or shared capability | `gateway`, `asset`, `shared`, `observability` |
| `env` | canonical environment | `staging`, `prod` |
| `region` | short region code chosen by platform owner | `ea` |
| `nn` | sequence for uniqueness | `001` |

Examples:

| Resource | Example |
| --- | --- |
| Resource group | `rg-hhcweb-prod-ea-001` |
| Container App | `ca-hhcweb-hhc-web-api-prod-ea-001` |
| Container App worker | `ca-hhcweb-hhc-web-api-worker-prod-ea-001` |
| Container App job | `caj-hhcweb-hhc-web-api-reconcile-prod-ea-001` |
| Container Apps environment | `cae-hhcweb-shared-prod-ea-001` |
| Key Vault | `kv-hhcweb-prod-ea-001` |
| PostgreSQL server | `pg-hhcweb-prod-ea-001` |
| Redis | `redis-hhcweb-prod-ea-001` |
| Storage account | `sthhcwebprodea001` |
| Application Insights | `appi-hhcweb-prod-ea-001` |
| User-assigned managed identity | `id-hhcweb-asset-prod-ea-001` |

Resource-specific Azure constraints override the default format. Storage account names must be lowercase alphanumeric and globally unique. Key Vault names must also satisfy Azure naming limits.

Do not encode secrets, tenant names, personal names, or deployment dates in resource names.

## Tagging Strategy

Required tags:

| Tag | Values |
| --- | --- |
| `workload` | `hhc-web` |
| `environment` | `local`, `test`, `staging`, `prod` when applicable |
| `service` | `api-gateway`, `hhc-web-api`, `asset-api`, `shared`, etc. |
| `owner` | owning team/person alias |
| `costCenter` | church/platform cost bucket |
| `dataClassification` | `public`, `internal`, `confidential`, `restricted`, `secret`, `mixed` |
| `managedBy` | `iac` |
| `repo` | source repo or infra repo |
| `criticality` | `tier0`, `tier1`, `tier2`, `tier3` |
| `backupRequired` | `true` or `false` |

Rules:

- IaC must apply tags at creation.
- A resource missing required tags fails IaC review.
- Manual tag edits are drift and must be reconciled back into IaC.
- Cost dashboards should group by `workload`, `environment`, `service`, and `costCenter`.

## Azure DevOps Deployment Identity

Use Azure Resource Manager service connections with workload identity federation. Avoid long-lived client secrets for pipelines.

Recommended identities:

| Identity | Scope | Permission |
| --- | --- | --- |
| `id-hhcweb-build-staging` | staging ACR repositories | push staging images and write build artifacts; no prod deploy |
| `id-hhcweb-build-prod` | prod ACR repositories | push approved production images; no app deploy |
| `id-hhcweb-platform-deploy-staging` | staging resource groups | deploy infrastructure and apps for staging |
| `id-hhcweb-platform-deploy-prod` | prod resource groups | deploy infrastructure and apps for prod |
| `id-hhcweb-gateway-deploy-prod` | gateway app and route policy resources | gateway-only production deployment when separated |
| `id-hhcweb-service-deploy-prod-{service}` | service-specific ACA and config resources | optional when service pipelines need narrower prod scope |

Rules:

- Staging and prod service connections are separate.
- Prod service connections require protected pipeline environments and manual approval for production-impacting releases.
- The pipeline identity must not have subscription Owner unless a bootstrap step explicitly requires it.
- Prefer least-privilege custom roles or resource-group-scoped built-in roles.
- Do not store Azure service principal client secrets in pipeline variables.
- Do not reuse one broad deployment identity for every service if narrower identities are practical.
- Build identities can push to approved ACR repositories but cannot deploy production Container Apps.
- Deploy identities can update ACA revisions and config but cannot push arbitrary images to ACR.
- Runtime identities can pull only approved ACR repositories and cannot push images.

Bootstrap exception:

- A highly privileged identity may create initial resource groups, Key Vault, managed identities, and role assignments.
- After bootstrap, normal deployments use narrower federated identities.
- Bootstrap actions must produce an IaC state/what-if artifact and be reviewed.

## Runtime Managed Identities

Each production Container App that accesses Azure resources should have a managed identity.

Recommended mapping:

| App | Identity | Access |
| --- | --- | --- |
| `api-gateway` | `id-hhcweb-gateway-prod-ea-001` | read gateway secrets if any; no DB/Blob write |
| `account-api` | `id-hhcweb-account-prod-ea-001` | account DB/Key Vault signing material, notification/audit service invocation config |
| `hhc-web` | `id-hhcweb-web-prod-ea-001` | minimal; no DB/Blob direct access |
| `hhc-web-api` | `id-hhcweb-webapi-prod-ea-001` | `hhc_web` DB, Redis prefix, needed secret references |
| `asset-api` | `id-hhcweb-asset-prod-ea-001` | asset DB, Blob containers, scanner secrets |
| `notification-api` | `id-hhcweb-notification-prod-ea-001` | notification DB, provider secrets |
| `audit-log` | `id-hhcweb-audit-prod-ea-001` | audit DB, optional immutable export storage |
| `hhc-line-function-bot` | `id-hhcweb-linebot-prod-ea-001` | bot secrets, no website DB access |

Rules:

- Runtime identities are separate from deployment identities.
- `hhc-web` does not get direct PostgreSQL or Blob data-plane permissions.
- `asset-api` is the only app with platform-managed asset Blob write access.
- `notification-api` is the only app with notification provider secret access, except account-specific provider setup if already owned by `account-api`.
- Role assignments are declared in IaC.
- Emergency portal role assignment must be time-boxed, audited, and backfilled or removed.

## Key Vault And Secret References

Key Vault is the preferred secret store for shared/stable production secrets. ACA secrets may be used for service-local values when Key Vault integration is not ready.

Rules:

- Secrets are referenced by versioned or named references, not copied into repo.
- Secret names use service prefixes, for example `asset-api-scanner-key`.
- Production and staging vaults are separate.
- Pipeline identities can deploy secret references but should not read secret values unless needed.
- Runtime identities read only their service secrets.
- Secret rotation must update config fingerprint and release evidence.

Minimum rotation evidence:

- old and new secret versions
- affected services
- rollout order
- smoke test
- rollback path
- audit/log entry

## Network And Public Exposure

The cloud runtime spec owns detailed networking. IaC must enforce:

- only `api-gateway` has external ingress for platform API traffic
- backend API services are internal
- `/priv/*` is not publicly routed
- staging and prod resources are separate
- private endpoints for PostgreSQL, Redis, Blob, and Key Vault when subscription/network constraints allow
- temporary public firewall rules are documented with expiry

Do not allow an IaC change that opens direct public ingress on `hhc-web-api`, `asset-api`, `notification-api`, or `audit-log` unless an approved architecture decision updates the service catalog and gateway rules.

## Drift Management

Manual cloud changes are allowed only for incident response or bootstrap gaps.

Required drift controls:

- IaC `what-if` or equivalent plan before staging/prod deployment.
- Scheduled drift check for staging and prod.
- Release manifest includes infra plan summary when IaC changes.
- Portal changes during incident are recorded in the incident notes.
- Backfill accepted manual changes into IaC before the next normal deployment.
- Revert unapproved drift.

Drift check should flag:

- external ingress added to backend apps
- missing tags
- resource missing from IaC
- role assignment added outside IaC
- Key Vault access widened
- firewall or private endpoint changed
- storage public access changed
- ACR public/anonymous pull enabled
- ACR repository permissions widened
- Container App image reference changed from immutable digest to mutable tag for production
- ACA job schedule, command, concurrency, max execution time, retry, or identity changed
- worker pause/resume control changed
- Redis/PostgreSQL SKU or backup setting changed
- Blob soft delete, container soft delete, versioning, point-in-time restore, or immutable retention setting changed
- restore quarantine ingress, provider callback, or worker-disable control changed
- Container App scale minimum/maximum changed
- Dapr app id changed

## IaC Release Classes

Infrastructure releases use the same release governance as application releases, with extra classes:

| Class | Examples | Required Evidence |
| --- | --- | --- |
| `infra_additive` | new staging resource, new alert, new service identity | IaC plan, tags, least-privilege role review |
| `infra_runtime` | ACA ingress, scale rule, Dapr config, env var reference | staging deploy, ready/smoke, rollback target |
| `infra_worker_job` | worker app, ACA job, cron schedule, job identity, concurrency/retry setting | service owner approval, schedule/misfire review, staging job run, runbook evidence |
| `infra_data` | PostgreSQL, Redis, Blob, backup, firewall/private endpoint | backup/RPO review, connectivity smoke, owner approval |
| `infra_secret` | Key Vault, secret reference, signing key, provider secret | rotation plan, no secret value in logs/artifacts |
| `infra_security` | role assignment, public ingress, network rule, WAF/private endpoint | security review, least-privilege diff, denied-path smoke |
| `infra_destructive` | delete resource, disable backup, remove identity, tighten network | explicit approval, backup point, rollback or replacement plan |

Production infra changes require:

- IaC plan artifact
- owner approval
- affected services list
- rollback or roll-forward plan
- staging evidence when resource type exists in staging
- post-deploy smoke

Production backup/DR-affecting infra changes also require:

- current restore drill age
- accepted RPO/RTO target
- backup retention and redundancy diff
- Blob data-protection diff
- public-ingress denial proof for restore/quarantine environments
- owner approval if protection is reduced

## Environment Bootstrap Order

For a new Azure environment:

1. Create resource group and baseline tags.
2. Create Log Analytics/Application Insights.
3. Create Key Vault.
4. Create user-assigned managed identities.
5. Create storage, PostgreSQL, Redis.
6. Create Container Apps environment.
7. Assign resource roles to runtime identities.
8. Create Container Apps with internal ingress by default.
9. Deploy `api-gateway` external ingress.
10. Configure custom domains and certificates.
11. Deploy `account-api` and JWKS route.
12. Deploy backend services behind gateway.
13. Run staging smoke or production restore/smoke gate.

No backend public API service should receive direct public ingress during bootstrap.

## CI Checks

Required checks for infra changes:

- format/lint for IaC files
- parameter validation
- forbidden environment value scan
- tag completeness check
- resource naming check
- no backend external ingress check
- role assignment diff
- Key Vault access diff
- `what-if` or plan artifact
- production environment approval gate

Recommended forbidden patterns:

```text
ENVIRONMENT=production
api.alive.org.tw
publicNetworkAccess=Enabled without exception note
allowBlobPublicAccess=true
external ingress on hhc-web-api, asset-api, notification-api, audit-log
Owner role assignment outside bootstrap
service principal secret in pipeline variable
public or anonymous ACR access
production app image tag latest, main, staging, or prod without digest
build identity with production deploy permission
deploy identity with arbitrary ACR push permission
ACA job with public ingress
job schedule without owner, concurrency policy, or missed-run policy
```

## Acceptance Criteria

- Cloud resources are created and changed through one IaC engine per environment stack.
- Application `ENVIRONMENT` values are limited to `local`, `test`, `staging`, and `prod`.
- Resource names and tags identify workload, service, environment, owner, criticality, and management source.
- Azure DevOps production deployments use workload identity federation or an equivalent secretless identity model.
- Private ACR is represented in IaC with least-privilege build, deploy, and runtime role assignments.
- Runtime managed identities are separate from deployment identities.
- Service-owned worker apps and ACA jobs are represented in IaC with no public ingress, least-privilege identities, schedule/concurrency metadata, and runbook evidence.
- Role assignments are least-privilege, environment-scoped, and declared in IaC.
- Only `api-gateway` has external ingress for platform API traffic.
- Backend services do not receive direct public ingress through IaC.
- Key Vault/secret references are environment-separated and never copied into source control.
- Drift checks detect manual ingress, role, firewall, tag, scale, and secret-access changes.
- Infra changes produce plan, approval, smoke, and rollback/roll-forward evidence before production promotion.
- Backup and DR settings are represented in IaC and cannot be reduced without explicit owner approval and restore risk review.
