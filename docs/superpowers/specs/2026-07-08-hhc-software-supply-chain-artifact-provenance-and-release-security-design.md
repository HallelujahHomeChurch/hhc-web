# HHC Software Supply Chain, Artifact Provenance, And Release Security Design

## Purpose

This spec defines how HHC platform code becomes trusted production artifacts. It covers repository controls, Azure DevOps pipelines, dependency governance, container image builds, SBOMs, provenance, vulnerability scanning, artifact signing, Azure Container Registry usage, release manifests, promotion gates, and compromised-artifact response.

The goal is not to create a heavy security program. The goal is to make every production deployment answer four questions:

1. Which source commit produced this artifact?
2. Which pipeline and inputs built it?
3. Which image digest is running in production?
4. Which security checks, exceptions, and approvals allowed it to be promoted?

This is an operating and release-governance capability. Do not create a v1 `supply-chain-api`, `artifact-api`, `sbom-api`, `vulnerability-api`, or `release-security-api`.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## External Alignment

- Azure Architecture Center CI/CD for microservices: `https://learn.microsoft.com/en-us/azure/architecture/microservices/ci-cd`
- Microsoft Cloud Security Benchmark DevOps security: `https://learn.microsoft.com/en-us/security/benchmark/azure/mcsb-v2-devops-security`
- Microsoft guidance for OSS updates, SBOM, container, and IaC scanning: `https://learn.microsoft.com/en-us/security/zero-trust/prioritizing-defense/adopt-open-source-updates`
- Microsoft Defender for Cloud container vulnerability management: `https://learn.microsoft.com/en-us/azure/defender-for-cloud/agentless-vulnerability-assessment-azure`
- Azure Architecture Center DevSecOps guidance: `https://learn.microsoft.com/en-us/azure/architecture/guide/devsecops/devsecops-on-aks`
- Microsoft container secure supply chain build stage: `https://learn.microsoft.com/en-us/azure/security/container-secure-supply-chain/articles/container-secure-supply-chain-implementation/build-overview`
- SLSA framework: `https://slsa.dev/`
- SLSA security levels: `https://slsa.dev/spec/v1.0/levels`
- OpenSSF Scorecard: `https://openssf.org/projects/scorecard/`

## Core Decision

Use pipeline-owned evidence and registry-enforced artifact discipline. Do not create a runtime supply-chain service in v1.

V1 requires:

- protected branches and reviewed pipeline changes
- secret scanning and dependency scanning
- reproducible build inputs where practical
- SBOM generation for production artifacts
- container image vulnerability scanning
- release manifest with source, pipeline, image digest, scan result, config fingerprint, and approval
- deployment by immutable image digest, not mutable tag
- ACR access controlled by least privilege
- production deployment through protected Azure DevOps environments

V1 should target SLSA Build L1-style provenance for production artifacts and prepare for SLSA Build L2-style signed provenance and artifact signing. Do not block v1 launch on formal SLSA certification, but do not design a process that prevents it later.

## Artifact Trust Boundary

Production trust starts at the protected source branch and ends at the ACA revision.

Trust chain:

```text
reviewed source commit
  -> protected Azure DevOps pipeline
  -> build artifact / container image
  -> SBOM
  -> vulnerability and secret scan results
  -> image digest in ACR
  -> release manifest
  -> protected environment approval
  -> ACA revision pinned to digest
  -> runtime evidence
```

Mutable tags such as `latest`, `main`, `prod`, or `staging` can exist for human convenience, but production deployment must record and use the immutable image digest.

## Source Repository Controls

Production-impacting repos:

- `api-gateway`
- `account-api`
- `hhc-web`
- `hhc-web-api`
- `asset-api`
- `notification-api`
- `audit-log`
- `hhc-line-function-bot`
- shared infra repo

Minimum controls:

- Require pull request review for protected branches.
- Require status checks before merge.
- Require pipeline YAML changes to be reviewed by an owner who understands release impact.
- Block direct pushes to production branches except documented break-glass.
- Record break-glass changes in incident notes.
- Do not allow personal access tokens as normal pipeline credentials.
- Do not store secrets in repository variables, source files, Dockerfiles, generated artifacts, or logs.

Recommended controls:

- Enable secret scanning and push protection where available.
- Enable branch policies for build validation.
- Require code-owner review for:
  - pipeline templates
  - Dockerfiles
  - IaC
  - auth/gateway policy
  - dependency lockfiles for production services
  - release scripts

## Pipeline Security Model

Azure DevOps pipelines are part of the production supply chain.

Rules:

- Use workload identity federation or another approved short-lived credential model for Azure access.
- Separate build identity from production deployment identity.
- Production deployment identity can deploy only the intended resource group/apps.
- Build identity can push only to the expected ACR repositories.
- Pipeline secrets are read only by the stages that need them.
- Pipeline logs must not print tokens, connection strings, SAS URLs, Key Vault secret values, signing keys, provider keys, or private webhook payloads.
- Pipeline templates are versioned and reviewed.
- Self-hosted agents require hardening, patching, network restrictions, and cleanup. Use Microsoft-hosted agents for v1 unless a build needs private network access.
- Production deploy stages use Azure DevOps protected environments with approvals.

Do not let a service pipeline deploy another service unless the release manifest names that service and the service owner approved it.

## Dependency Governance

Each service owns its dependencies, but the platform owns minimum rules.

Required:

- Commit lockfiles for package-managed services.
- Run dependency vulnerability checks in CI.
- Run license policy checks before production release.
- Use an update process such as Renovate, Dependabot, or scheduled manual dependency review.
- Treat dependency updates that touch auth, crypto, HTTP clients, serializers, database drivers, framework runtime, or container base image as production-impacting.
- Record vulnerable dependency exceptions with owner, reason, compensating control, and expiry.

Language-specific rules:

- TypeScript services must use lockfile-based installs and fail CI on lockfile drift.
- Go services must use `go mod verify` or equivalent module integrity check in CI.
- Docker builds must not download unpinned scripts from the public internet during build.
- Base images should be pinned by digest or by an approved version policy plus registry scan.

License policy:

- Allow permissive licenses by default.
- Require review for copyleft, source-available, unknown, custom, or no-license dependencies.
- Do not ship a dependency with unknown licensing into production without owner approval.

## Container Image Build Rules

All production deployables run as container images.

Rules:

- Build images in CI, not on operator workstations.
- Use minimal base images where practical.
- Prefer non-root runtime users.
- Avoid package managers and shells in final runtime image unless needed for operation.
- Avoid embedding `.env`, source maps with secrets, test fixtures with sensitive data, private keys, or build caches in final images.
- Label images with:
  - source repo
  - commit sha
  - pipeline run id
  - build timestamp
  - service name
  - image version
  - SBOM location or digest
- Push to ACR only after build and basic tests pass.
- Keep service images in service-specific ACR repositories.

Recommended labels:

```text
org.opencontainers.image.source
org.opencontainers.image.revision
org.opencontainers.image.created
org.opencontainers.image.version
org.opencontainers.image.title
org.opencontainers.image.vendor
```

## SBOM And Provenance

Every production image must have an SBOM.

Minimum v1:

- Generate SBOM during CI for each production image.
- Store SBOM as a pipeline artifact and attach or reference it from the release manifest.
- Include direct and transitive dependencies where the tool supports it.
- Record image digest, service name, source commit, and pipeline run id with the SBOM.

Recommended next step:

- Attach SBOM to the OCI image in ACR using an OCI artifact mechanism.
- Generate provenance attestation that records builder, pipeline, source repo, commit, inputs, and image digest.
- Sign provenance and image using Notation or an equivalent artifact-signing tool backed by managed keys.

V1 does not require a central `sbom-api`. SBOMs are release artifacts and can be indexed later if operations show a real need.

## Vulnerability, Secret, IaC, And Code Scanning

Required CI checks:

- dependency vulnerability scan
- container image scan before production promotion
- secret scan on source and generated artifacts
- Dockerfile and IaC scan
- lint/test/build for each service
- production config forbidden-pattern scan

Recommended checks:

- SAST for Go and TypeScript
- OpenSSF Scorecard or equivalent for externally sourced dependencies and public repos
- pull request annotations for code, IaC, and container findings
- registry scan using Defender for Cloud
- runtime vulnerability review for currently running images

Severity policy:

| Finding | Default Gate |
| --- | --- |
| Critical exploitable vulnerability in runtime path | block production |
| High vulnerability in exposed runtime dependency | block unless explicit expiring exception |
| High vulnerability in build-only dependency | owner review required |
| Medium vulnerability | track and patch by SLA |
| Secret exposure | block, revoke/rotate, incident note |
| Unknown license | block until classified |
| IaC opens public backend ingress or weakens secret access | block |

Exceptions require:

- owner
- affected artifact digest
- finding id
- reason
- compensating control
- expiry date
- follow-up issue

Do not grant blanket exceptions for a service or registry.

## Azure Container Registry Governance

ACR is the production artifact distribution boundary.

Rules:

- Use private ACR.
- Disable anonymous pull.
- Push permission belongs to build identities only.
- Pull permission belongs to runtime managed identities and approved deployment identities only.
- Human pull access is exceptional and audited.
- Service repositories are named consistently, for example:

```text
hhc-web/api-gateway
hhc-web/hhc-web
hhc-web/hhc-web-api
hhc-web/asset-api
hhc-web/notification-api
hhc-web/audit-log
hhc-web/line-bot
```

- Production deployment uses image digest.
- Tags are metadata, not authority.
- ACR retention policy keeps enough historical digests for rollback windows and incident investigation.
- Deleted image digests that are still referenced by release manifests must remain recoverable or archived until rollback windows expire.

Recommended:

- Enable Defender for Cloud registry scanning.
- Attach SBOM/provenance artifacts to the image digest when tooling is ready.
- Sign images or attestations before production deployment.

## Release Manifest

Every production-impacting deployment must produce a release manifest.

Required fields:

```yaml
releaseId:
service:
environment:
sourceRepo:
sourceCommit:
sourceBranch:
pipelineName:
pipelineRunId:
buildAgentType:
imageRepository:
imageTag:
imageDigest:
sbomArtifact:
provenanceArtifact:
signatureStatus:
dependencyScanResult:
containerScanResult:
secretScanResult:
iacScanResult:
testSummary:
openapiVersion:
eventSchemaVersions:
configFingerprint:
featureFlags:
killSwitches:
migrationPlan:
rollbackTarget:
approvals:
exceptions:
deployedAcaRevision:
deployedAt:
```

Rules:

- `imageDigest` is required for container deploys.
- `signatureStatus` can be `not_enabled` in early v1, but the manifest must record it explicitly.
- `exceptions` must include expiry and owner.
- The release manifest is stored as a pipeline artifact and linked from rollout evidence.
- Runtime `/readyz` metadata should expose service version, source commit, image digest or revision id, config fingerprint, and active flags without leaking secrets.

## Promotion Model

Recommended v1 flow:

1. Build and test service image from reviewed source.
2. Generate SBOM and provenance metadata.
3. Push image to ACR.
4. Scan image and source artifacts.
5. Deploy to staging by digest.
6. Run smoke, contract, auth, migration, and service-specific checks.
7. Produce release manifest.
8. Request production approval.
9. Deploy production by the same digest.
10. Record ACA revision, config fingerprint, smoke result, and rollback target.

Do not rebuild for production after staging approval. Promote the same image digest unless a new source commit or build input is intentionally approved.

## Signing And Attestation Roadmap

V1 starts with unsigned SBOM/provenance artifacts but designs the release manifest to carry signatures later.

Maturity path:

| Stage | Requirement | Notes |
| --- | --- | --- |
| `evidence` | SBOM, image digest, release manifest | v1 minimum |
| `provenance` | builder/source/input provenance generated in CI | SLSA Build L1-style |
| `signed_provenance` | provenance signed by hosted build identity/key | SLSA Build L2-style direction |
| `signed_artifact` | image or attestation signed and verified before prod | use Notation or equivalent when adopted |
| `policy_enforced` | deploy gate rejects missing/invalid signature | future hard gate |

Do not introduce runtime signature checks inside business services. Verification belongs in pipeline, registry, deployment admission, and release evidence.

## Compromised Artifact Response

Trigger conditions:

- secret found in source, image, SBOM, logs, or artifact
- malicious dependency discovered
- compromised pipeline identity
- unapproved image digest running in ACA
- vulnerability later discovered in deployed image
- ACR or build-agent compromise suspected

Response:

1. Declare incident using `docs/runbooks/platform-incident-command.md`.
2. Freeze affected pipelines and production promotions.
3. Identify all release manifests containing affected source commit, dependency, image digest, or pipeline run id.
4. Revoke or rotate affected secrets.
5. Disable compromised identities.
6. Roll back or roll forward to a known-good digest.
7. Rebuild from clean source and clean build environment.
8. Re-run scans and smoke tests.
9. Record final affected artifact list and follow-up controls.

Do not patch a running container in place. Produce a new image digest through the trusted pipeline.

## Metrics And Evidence

Track:

- percentage of production releases with SBOM
- percentage of production releases deployed by digest
- scan pass/fail counts by service
- open vulnerability exceptions by severity and age
- dependency update age by service
- production images running with critical/high findings
- release manifests missing required fields
- pipeline identity or approval failures
- ACR repository images older than retention policy

Minimum dashboards can be release notes plus Azure DevOps/Defender views in v1. Add automation only after manual evidence collection becomes a bottleneck.

## Anti-Patterns

Do not:

- deploy `latest` to production
- rebuild the image after staging approval and call it the same release
- let runtime apps pull from public registries
- allow developers to push production images manually
- store secrets in pipeline variables when Key Vault or federated identity is available
- give one broad service principal Owner rights to all resources
- treat a green unit-test build as production release evidence
- accept unscoped vulnerability exceptions
- use SBOM generation as a substitute for scanning and patching
- add a runtime `supply-chain-api` before the evidence workflow proves a real operational need

## Tests And Verification

Required checks:

- protected branch policy blocks direct production-branch push
- pipeline YAML changes require review
- production deploy uses image digest, not mutable tag
- release manifest contains source commit, pipeline run, image digest, SBOM, scan result, config fingerprint, approval, and rollback target
- CI fails when secret scan finds a secret
- CI fails when Dockerfile/IaC opens disallowed public backend ingress
- CI fails or blocks promotion on critical runtime vulnerabilities unless expiring exception exists
- build identity cannot deploy production
- production deploy identity cannot push arbitrary images
- runtime identity can pull only approved ACR repositories
- `/readyz` metadata exposes non-secret version/config fingerprint evidence

## Acceptance Criteria

- Software supply chain governance is defined as pipeline/release evidence, not a new v1 runtime service.
- Production images are built in CI, pushed to private ACR, and deployed by digest.
- SBOM and release manifest are required for production-impacting releases.
- Vulnerability, secret, dependency, license, Dockerfile, and IaC scanning gates are defined.
- ACR access uses least privilege and separates build, deploy, and runtime identities.
- Staging-to-production promotion uses the same image digest unless a new release is intentionally approved.
- Exceptions are scoped, expiring, and owner-approved.
- Compromised artifact response is documented.
- The design supports future signed provenance and image signing without blocking v1 launch.
