# HHC Deployment Compatibility, Migration, And Release Governance Design

## Purpose

This spec defines how HHC platform changes move from code to production without forcing all services to deploy in lockstep or risking public downtime, data loss, broken clients, stale generated clients, unsafe gateway routes, or irreversible schema mistakes.

It coordinates:

- service versions
- PostgreSQL migrations
- OpenAPI contract versions
- generated clients
- gateway route policy
- feature flags and kill switches
- Azure Container Apps revisions
- worker/outbox behavior
- authorization policy
- rollback and roll-forward evidence

This spec complements:

- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## Core Decision

Use compatibility-first releases.

Do not create a v1 `release-api`, `deployment-api`, or central runtime release coordinator. Release governance is a pipeline, manifest, contract, and runbook concern. Runtime services should not depend on a central deployment service to decide whether a request can run.

Do not require all services to deploy together. Each service remains independently deployable, but cross-service changes must pass compatibility gates before production promotion.

Artifact security details for image digests, SBOMs, provenance, vulnerability scans, ACR governance, and signing roadmap follow `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`.

Every production-impacting release must have:

- release manifest
- immutable image digest for container deploys
- SBOM/provenance artifact reference
- vulnerability and secret scan result
- migration plan
- contract compatibility result
- generated client result when consumers are affected
- gateway route policy comparison when routes are affected
- config fingerprint
- rollout plan
- rollback or roll-forward plan
- smoke evidence
- owner approval for production

## Release Classes

| Class | Examples | Required gates |
| --- | --- | --- |
| `docs_only` | architecture docs, roadmap updates | doc checks |
| `ui_only` | copy/layout change, admin screen without API change | frontend tests, no API route/config diff |
| `api_additive` | optional field, new route, new enum old clients ignore | OpenAPI compatibility, generated client compile, gateway comparison |
| `api_breaking` | route removal, field type change, auth change | migration plan, new route/version or deprecation window, consumer rollout |
| `schema_additive` | nullable column, new table/index, new outbox destination | migration dry-run, old app revision compatibility |
| `schema_behavioral` | read path switches to new table, dual-write cleanup | backfill evidence, dual-read/dual-write test, feature flag |
| `schema_destructive` | drop column/table, tighten constraint, delete old enum | backup point, stable release window, rollback review, explicit approval |
| `gateway_or_auth` | route policy, JWT verifier, JWKS, CORS, rate limits | staging route smoke, header stripping tests, account/gateway compatibility |
| `authz_policy` | role bundle, scope catalog, service action policy, object-level authorization, field visibility | policy diff, role/scope diff, gateway/OpenAPI/service drift check, object-level tests, field-level redaction tests |
| `asset_public_access` | grant rules, download policy, scan requirement | asset leakage tests, cache TTL review, emergency deny path |
| `worker_or_event` | outbox payload, new worker destination, event schema | event schema diff, old/new worker compatibility, idempotency, replay tests, classification review |
| `data_backfill` | seed import, projection rebuild, asset metadata backfill | chunked job, dry run, repair plan, reconciliation output |
| `infra_additive` | new staging resource, new alert, new identity | IaC plan, tag check, least-privilege role review |
| `infra_runtime` | ACA ingress, scale rule, Dapr config, env var reference | staging deploy, ready/smoke, rollback target |
| `infra_data` | PostgreSQL, Redis, Blob, backup, firewall/private endpoint | backup/RPO review, connectivity smoke, owner approval |
| `infra_secret` | Key Vault, secret reference, signing key, provider secret | rotation plan, no secret value in logs/artifacts |
| `infra_security` | role assignment, public ingress, network rule, WAF/private endpoint | security review, least-privilege diff, denied-path smoke |
| `infra_destructive` | delete resource, disable backup, remove identity, tighten network | explicit approval, backup point, rollback or replacement plan |
| `supply_chain_or_artifact` | base image update, build pipeline change, SBOM/provenance/signing policy, ACR retention/access, scanner gate | image digest, SBOM/provenance reference, scan result, ACR/RBAC diff, exception review |
| `emergency_hotfix` | security fix, data exposure stop, provider outage mitigation | narrow change, expedited approval, after-action follow-up |

The release class is recorded in the release manifest. Mixed releases use the strictest applicable gate.

## Release Manifest

Every production-impacting release should produce a small machine-readable manifest as a CI artifact.

Recommended shape:

```yaml
releaseId: 2026-07-08-hhc-web-api-publication-workflow
class:
  - schema_additive
  - api_additive
  - worker_or_event
owner: hhc-platform
services:
  - name: hhc-web-api
    imageRepository: acrhhcwebprodea001.azurecr.io/hhc-web-api
    imageTag: sha-abc123
    imageDigest: sha256:...
    sourceCommit: abc123
    pipelineRunId: 12345
    sbomArtifact: sbom/hhc-web-api.spdx.json
    provenanceArtifact: provenance/hhc-web-api.intoto.json
    containerScanResult: passed
    secretScanResult: passed
    signatureStatus: unsigned_v1
    openapiVersion: 2026.07.08.1
    migrationVersion: 202607081200_publication_workflow
    configFingerprint: sha256:...
    featureFlags:
      publicationWorkflowEnabled: false
    killSwitches:
      adminPublishDisabled: false
      publicProjectionServeStale: true
gateway:
  routePolicyVersion: gateway-sha-def456
authorization:
  policyVersion: authz-sha-123abc
  policyDriftCheck: passed
contracts:
  compatibilityCheck: passed
  eventCompatibilityCheck: passed
  generatedClients:
    hhc-web: passed
    hhc-line-function-bot: not_affected
data:
  backupPoint: automatic-pitr-before-release
  backfill: not_required
rollout:
  environment: prod
  strategy: aca_revision_progressive
  stages:
    - 0
    - 10
    - 50
    - 100
rollback:
  appRevision: hhc-web-api--abc123-prev
  dataRollback: not_required_additive_migration
evidence:
  stagingSmoke: passed
  productionSmoke: pending
```

The manifest is evidence for review. It is not a runtime source of truth.

## Compatibility Window

During deployment, old and new revisions can coexist.

Rules:

- New service code must tolerate the previous production schema until the additive migration has run.
- Old service code must tolerate additive schema changes.
- New providers must accept old consumer request shapes during rollout.
- New consumers must not require provider behavior that is not deployed and verified.
- Workers must be able to skip, retry, or dead-letter unknown future payload versions safely.
- Public API responses can add optional fields but must not remove or rename fields used by current `hhc-web` or LINE bot clients.
- Redis/cache payloads must be versioned so old clients do not parse incompatible cached payloads.
- Gateway route changes must be compatible with the currently live upstream revision before traffic moves.

Default compatibility target:

- Keep runtime compatibility across current production revision and one next revision.
- Keep API contract compatibility until all known consumers have moved.
- Keep outbox/event payload compatibility for at least the maximum retry window plus one release cycle.

## Database Migration Protocol

Use expand/contract.

### Expand

Allowed before app rollout:

- create table
- add nullable column
- add new index
- add new enum-like text value when old code ignores it
- add trigger-free metadata column

Rules:

- Migrations are per service schema.
- Migrations acquire a service-level advisory lock or migration-tool lock.
- Set lock timeout and statement timeout for production migrations.
- Large index builds should use online/non-blocking strategy where supported.
- Do not backfill large tables in one unbounded transaction.

### Dual Write Or Dual Read

Use when changing storage shape.

Rules:

- New code writes both old and new shapes when old revision can still read old shape.
- New code can read old first, new first, or both, but the rule must be explicit.
- Include metrics for old-shape fallback.
- Keep dual behavior behind a feature flag only when it helps rollback; do not leave permanent ambiguity.

### Backfill

Backfills are jobs, not hidden request-path work.

Rules:

- Chunk by primary key or stable timestamp.
- Record progress and checksum/count evidence.
- Can pause/resume.
- Is idempotent.
- Emits sanitized logs and metrics.
- Does not call remote services unless the backfill explicitly owns a cross-service reconciliation workflow.

### Contract

Destructive migration is a separate release after the replacement has been stable.

Rules:

- Confirm no old app revision reads old shape.
- Confirm backfill and read switch are complete.
- Confirm rollback plan no longer needs old shape.
- Capture backup/PITR point before destructive change.
- Require explicit approval for drops, non-null constraints on existing rows, data deletion, and enum tightening.

## API And Client Compatibility Protocol

Provider-first rollout:

1. Add provider support for new optional behavior.
2. Publish OpenAPI contract.
3. Generate clients/DTOs.
4. Run consumer compile and fixture tests.
5. Deploy provider.
6. Deploy consumers.
7. Enable feature flag if needed.
8. Remove old behavior only after deprecation window.

Breaking changes must use one of:

- additive route plus old route retained
- new route name
- new request/response field while old field remains
- explicit route version only when additive evolution is impossible

Do not add `/api/v1` just for convention. The platform starts with stable paths and evolves additively.

## Gateway Release Protocol

Gateway route policy changes can expose or block the whole platform, so they are high-risk.

Rules:

- Gateway route metadata must be compared with OpenAPI `x-hhc-*` extensions.
- Authorization route/action metadata must be compared with service authorization policy and the canonical role/scope catalog.
- Do not route production traffic to missing upstreams.
- Do not expose `/priv/*` or `/api/priv/*`.
- Do not add `api.alive.org.tw`.
- Do not make `admin.alive.org.tw/api/*` a backend API surface.
- Strip trusted identity headers before auth.
- Inject trusted headers only after JWT verification.
- Provider webhook routes must stay method-limited, signed, and rate-limited.

Rollout order for route additions:

1. Deploy upstream service route behind internal ingress.
2. Verify upstream `/readyz`.
3. Verify route in staging gateway.
4. Compare gateway policy with OpenAPI.
5. Deploy gateway route with zero or low traffic when practical.
6. Smoke public route.

## Azure Container Apps Revision Strategy

Use Azure Container Apps revisions for progressive exposure where the app has ingress traffic.

Recommended:

- Use multiple revision mode for gateway, `hhc-web`, and public-facing backend apps where traffic splitting is useful.
- Start new revision at zero or low traffic.
- Run readiness and smoke checks before raising traffic.
- Increase traffic in small stages for high-risk releases.
- Keep previous revision active until the release is stable.
- Use labels where they simplify blue/green validation.

Do not assume revision traffic splitting solves all internal service-to-service rollout. Dapr/internal callers still need contract compatibility, feature flags, and staging smoke tests.

For internal-only services:

- Deploy to staging first.
- Promote with compatibility gates.
- Use feature flags in callers for new behavior.
- Keep old revision available when ACA revision mode and operational model allow it.

## Feature Flags And Kill Switches

Feature flags are release controls, not permanent product configuration.

Rules:

- Every flag has owner, purpose, default, expiry/review date, and production behavior.
- Default production value should preserve existing behavior.
- CI must fail if expired flags are not reviewed.
- High-risk flags must be visible in config fingerprint and release manifest.

Required kill switches:

- disable admin publish
- serve stale public projections
- disable asset upload
- disable public asset download by namespace or emergency deny rule
- disable notification provider sends
- disable LINE optional functions
- disable provider webhook processing

Kill switches must fail safe. They must not bypass auth, scan, grants, or privacy checks.

## Worker, Outbox, And Event Payload Compatibility

Workers often outlive deploy timing because retry queues contain old payloads.

Rules:

- Every outbox payload has `schemaVersion`.
- Cross-service event payloads use the CloudEvents-compatible envelope and JSON Schema rules defined in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.
- Handlers support current and previous payload schema during the retry window.
- Unknown future schema is not processed destructively.
- Permanent payload validation failures dead-letter with sanitized error.
- Stale publish/revoke events re-check current source state.
- Retrying old events must not recreate deleted, unpublished, or redacted public state.
- Worker deploys include replay tests for old and new payload fixtures.

## Rollback And Roll-Forward

Prefer rollback for bad code and roll-forward for additive data issues.

Rollback safe when:

- migration was additive
- old app revision can run against new schema
- gateway route can point back to old revision
- clients still understand old response shape
- feature flag can disable new behavior

Roll-forward required when:

- data already transformed in a non-reversible way
- external provider side effects were sent
- destructive migration already completed
- old revision cannot safely handle new persisted state

Rollback steps must specify:

- app revision target
- gateway route change if needed
- feature flags/kill switches
- cache invalidation
- worker pause/resume behavior
- data repair or reconciliation command
- verification smoke

## Emergency Hotfix Protocol

Emergency changes are allowed, but they must stay narrow.

Rules:

- Identify incident class and owner.
- Prefer kill switch or config-only mitigation when safe.
- If code is required, limit scope to the failing path.
- Skip only gates that cannot run in time; record skipped gates.
- Run minimum smoke before production exposure.
- Create follow-up item for full tests/docs if bypassed.

Emergency hotfix does not justify permanent drift from contracts, route policy, or data ownership.

## Evidence Required Before Production Promotion

Required evidence:

- release manifest
- immutable image digest for each container deployment
- SBOM/provenance artifact reference for each production image
- vulnerability, dependency, secret, Dockerfile, and IaC/config scan results where applicable
- migration dry-run output
- OpenAPI compatibility result
- generated client compile result when affected
- gateway policy comparison when routes/auth/cache affected
- config validation output and fingerprint
- staging smoke result
- rollback or roll-forward plan
- owner approval

Additional evidence by release class:

- schema backfill: row counts, checksum or reconciliation result
- worker/event: event schema diff, compatibility result, old payload replay, new payload replay, unsupported future version behavior, and data classification review
- authorization: role/scope diff, gateway/OpenAPI/service policy comparison, object-level authorization tests, field-level redaction tests, and denied-path audit/metrics proof
- publication workflow: grant-before-visible proof and stale workflow cancellation
- lifecycle restore: restore quarantine and reconciliation proof
- asset access: no Blob/SAS leakage and grant enforcement proof
- auth/gateway: JWT/JWKS/header stripping tests
- notification: fake/provider adapter proof and no production fake provider
- infrastructure: IaC plan, drift check, naming/tag validation, role-assignment diff, and post-deploy smoke
- supply chain/artifact: source commit, pipeline run, ACR image digest, SBOM/provenance, scan result, signature status or approved unsigned-v1 exception, and same-digest staging-to-prod proof

## Tests

Required CI tests:

- migration applies to empty schema and upgraded seeded schema
- old app compatibility against additive schema when feasible
- OpenAPI backward compatibility
- generated client compile for `hhc-web`
- LINE bot bulletin consumer fixture when public bulletin contract changes
- gateway policy comparison
- authorization policy drift check and denied-path tests when authorization is affected
- feature flag default behavior
- kill-switch safe behavior
- IaC plan/drift/naming/tag checks when infrastructure changes are affected
- outbox old/new payload replay
- event schema compatibility and replay evidence when events are affected
- rollback smoke script exists for production-impacting releases

## Acceptance Criteria

- Releases do not require all services to deploy in lockstep.
- No v1 `release-api`, `deployment-api`, or central runtime release coordinator is required.
- Every production-impacting release has a manifest and rollback or roll-forward plan.
- Container releases deploy by immutable image digest; mutable tags such as `latest`, `main`, `staging`, or `prod` are not production deployment inputs.
- Release manifests include source commit, pipeline run, image digest, SBOM/provenance, scan result, config fingerprint, approval, and rollback target.
- Staging-to-production promotion uses the same image digest unless a new release is intentionally approved.
- Additive migrations can be rolled back at the app revision level.
- Destructive migrations are delayed until old code and old clients are retired.
- API changes are provider-first and consumer-tested.
- Gateway route changes are compared against service contracts before promotion.
- Authorization policy changes are compared across account role bundles, gateway policy, OpenAPI metadata, service policy, docs, and UI capability maps before promotion.
- Workers can process retry payloads from the compatibility window.
- Feature flags and kill switches fail safe.
- Production promotion is based on evidence, not deployment success alone.
- Infrastructure changes are promoted through IaC evidence, least-privilege review, drift checks, and smoke tests.
