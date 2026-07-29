# HHC Web Platform Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this roadmap phase-by-phase. Each component sub-plan should be treated as a separately reviewable delivery unit.

**Goal:** Evolve `hhc-web` into the public website, CMS, and reusable platform foundation for church content, assets, notifications, audit trails, and LINE bot integrations.

**Architecture:** `api-gateway` is the first public gate. `hhc-web-api` is the main website backend and CMS core for v1, while `asset-api`, `notification-api`, and `audit-log` are separate reusable capabilities from day one. All non-account public APIs live under `www.alive.org.tw/api/*`; `account.alive.org.tw` owns account, OIDC, token, and JWKS APIs.

**Tech Stack:** Next.js, TypeScript, Go, PostgreSQL, Redis, Azure Container Apps, Azure Blob Storage, Dapr service invocation, Azure DevOps.

**Frontend repositories:** `hhc-web`, `account-fe`, and `admin-fe` are
independently versioned and deployed. Shared compiled packages live in
`frontend-platform` and are consumed from GitHub Packages at exact versions.

**Detailed Architecture:** See `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md` for route policy, database schemas, JWT contract, event names, cache keys, asset grants, notification/audit contracts, and LINE bot weekly bulletin flow.

**Service Catalog/Ownership:** See `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md` for the finite v1 deployable set, reusable capability boundaries, allowed caller matrix, non-service decisions, and service admission/extraction gates.

**HHC Web API:** See `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md` for the main website backend, CMS core, public projection model, admin write model, asset/notification/audit orchestration, and service extraction triggers.

**HHC Web API PostgreSQL Schema:** See `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md` for the `hhc_web` hybrid content schema, module tables, bulletin tables, projection storage, outbox, seed provenance, indexes, constraints, and migration rules.

**Public Projection/Cache Invalidation:** See `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md` for projection versions, Redis keys, ETags, cache headers, negative cache, publish/unpublish invalidation, sitemap refresh, asset grant ordering, and LINE bot latest consistency.

**Publication Workflow Consistency:** See `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md` for service-owned publication workflows, grant-before-visible publish, rollback publish consistency, emergency takedown, stale side-effect cancellation, and reconciliation.

**CMS Workflow:** See `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md` for draft/save/preview/publish/unpublish, admin UI responsibilities, localization, asset picker, weekly bulletin management, and module-specific publishing rules.

**CMS Localization/Translation:** See `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md` for source locale, translation status, stale translation warnings, fallback policy, per-locale publish, localized slugs, SEO alternates, and weekly bulletin locale consistency.

**CMS Admin Preview:** See `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md` for authenticated draft/revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention.

**Structured Content Blocks:** See `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md` for versioned `bodyJson`, v1 block types, renderer contract, inline link validation, asset refs, schema migrations, and no-raw-HTML rules.

**CMS Versioning/Rollback:** See `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md` for revision snapshots, restore to draft, rollback publish, draft/published isolation, asset grant behavior, and rollback verification.

**Site Settings/Navigation:** See `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md` for editable public site layout settings, header navigation, footer links, social links, contact display, site SEO defaults, `GET /api/site-layout`, and separation from runtime config and frontend UI chrome.

**Account Token Contract:** See `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md` for access token claims, refresh token rotation/revocation, JWKS rotation, admin browser token handling, and gateway-local validation boundaries.

**Account Admin Identity/RBAC Lifecycle:** See `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md` for admin invitations, role assignment, account disable/suspend/offboarding, account-domain APIs, account audit events, and emergency access removal without per-request gateway introspection.

**Gateway Auth:** See `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md` for local JWT verification, Nginx route policy, JWKS cache/rotation, trusted headers, failure modes, and tests.

**Authorization Policy Governance:** See `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md` for role/scope catalog, permission naming, route policy, resource-level authorization, field-level response policy, policy drift checks, and `authz_policy` release evidence.

**Internal Service Identity:** See `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md` for `/priv/*` authorization, Dapr caller app-id rules, allowlists, confused-deputy controls, idempotency, local-dev simulation, and staging smoke tests.

**Cross-Service Dependency/Query Governance:** See `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md` for synchronous call rules, dependency-chain budgets, cross-service query ownership, consumer-owned read models, anti-corruption adapters, and dependency tests.

**Data Classification/Privacy/Retention:** See `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md` for data classes, service ownership, minimization, token/secret handling, retention, deletion/redaction, notification privacy, asset privacy, LINE privacy, and future sensitive-domain launch rules.

**Data Lifecycle/Restore Orchestration:** See `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md` for service-owned lifecycle ledgers, legal hold, retention workers, privacy requests, asset reference cleanup, restore quarantine, reconciliation gates, and RPO/RTO defaults.

**Platform Backup/Restore/DR:** See `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md` for PostgreSQL PITR, Blob data protection, Redis rebuild expectations, outbox/provider recovery, restore quarantine, RPO/RTO targets, DR drills, and evidence packets. V1 does not require `backup-api`, `restore-api`, or `dr-api`.

**Content Model:** See `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md` for how current `hhc-web` routes, components, feature models, CMS modules, locale policy, SEO, slugs, and admin workflows map together.

**Content Migration/Bootstrap:** See `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md` for moving current mock data, i18n editorial copy, and public assets into CMS source records, asset records, public projections, API fixtures, parity tests, and rollback.

**Rendering/Delivery:** See `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md` for the `hhc-web` static-export to Next-server cutover, host-aware public/admin UI delivery, server-side public API reads, sitemap/SEO rendering, admin no-store/noindex behavior, and frontend rollback.

**SEO/URL/Discoverability:** See `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md` for canonical URLs, locale alternates, slug governance, redirects, sitemap ownership, robots/noindex policy, Open Graph, structured data, and route metadata contracts. V1 does not require a standalone `seo-api`.

**Accessibility/Performance/Media:** See `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md` for WCAG baseline, CMS accessibility metadata, Core Web Vitals targets, image derivative delivery, media policy, admin accessibility, and rollout gates.

**Frontend/Admin Roadmap:** See `docs/superpowers/plans/2026-07-08-hhc-web-frontend-admin-component-roadmap.md` for public component migration and CMS admin UI buildout.

**Security/RBAC:** See `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md` for roles, scopes, route authorization, internal service identity, admin token handling, threat model, and incident defaults.

**Browser Security/HTTP Headers:** See `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md` for route-class security headers, CORS, CSRF/origin checks, CSP rollout, cookie boundaries, cache headers, and asset download headers.

**Public Third-Party/Analytics/Consent:** See `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md` for external links, third-party provider registry, embeds, analytics, consent UI, provider-scoped CSP, CMS URL validation, and no v1 tag-manager/analytics service.

**Service Blueprint:** See `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md` for repo layout, environment variables, Dapr app ids, CI/CD, migrations, tests, security, observability, backup, and service readiness rules.

**Cloud Runtime/Ops:** See `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md` for Azure Container Apps topology, public ingress, Dapr, environment separation, data stores, secrets, networking, CI/CD, rollout, rollback, observability, backup, and recovery.

**Cloud Infrastructure/IaC:** See `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md` for Infrastructure as Code, resource naming/tagging, canonical environment names, Azure DevOps workload identity, managed identities, role assignments, drift detection, and infra release gates.

**Production Go-Live/Cutover:** See `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md` for DNS, TLS, custom domains, HSTS staging, first admin bootstrap, content seed readiness, traffic switch, rollback, post-launch monitoring, and Front Door/CDN adoption gates.

**SLO/Observability/Runbooks:** See `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md` for route-class SLOs, SLIs, alert thresholds, dashboards, runbooks, degraded modes, capacity/load tests, and cost guardrails.

**Production Runbooks/Incident Ops:** See `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md` and `docs/runbooks/` for platform incident command, service runbooks, SEV lifecycle, evidence capture, operational drills, and production promotion gates.

**Background Jobs/Worker Orchestration:** See `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md` for service-owned workers, scheduled/manual ACA Jobs, job ledgers, leases, checkpoints, scheduled publishing, backfills, and no v1 `scheduler-api`, `job-api`, or `worker-api`.

**API Standards:** See `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md` for shared envelope, errors, pagination, idempotency, optimistic concurrency, headers, versioning, and OpenAPI rules.

**API Contract Governance:** See `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md` for OpenAPI ownership, generated client boundaries, compatibility checks, gateway policy comparison, fixture strategy, and contract review workflow.

**Local Dev/Test Environment:** See `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md` for local profiles, dev scripts, port registry, local JWKS, Testcontainers/Azurite/fakes, deterministic seeds, CI gates, and staging smoke checks.

**Configuration/Feature Flags/Release Controls:** See `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md` for typed config, secret handling, domain settings, feature flags, kill switches, provider adapters, release controls, config fingerprints, and CI guardrails. V1 does not require a standalone `config-api`.

**Deployment Compatibility/Release Governance:** See `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md` for release classes, manifests, compatibility windows, expand/contract migrations, API/client rollout, gateway release gates, ACA revisions, feature flags, rollback, and roll-forward.

**Software Supply Chain/Artifact Provenance:** See `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md` for source-to-production trust chain, SBOM/provenance, immutable image digest promotion, ACR governance, scan gates, signing roadmap, and compromised-artifact response. V1 does not require a standalone `supply-chain-api`, `artifact-api`, `sbom-api`, `vulnerability-api`, or `release-security-api`.

**Abuse Prevention/Rate Limits/Quotas:** See `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md` for gateway route classes, service-level quotas, Redis counter usage, asset egress protection, notification abuse controls, LINE webhook dedupe, future public form protection, and `429`/quota behavior. V1 does not require a standalone `abuse-api`.

**Asset Lifecycle:** See `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md` for namespace policy, upload and asset state machines, grants, scan status, derivatives, retention, recovery, and URL generation.

**Asset Pipeline:** See `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md` for upload target issuance, completion validation, scan workers, derivative workers, download streaming, range requests, headers, and worker failure modes.

**Eventing/Outbox Reliability:** See `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md` for at-least-once delivery, idempotency, worker leases, retry/backoff, dead-letter handling, and Service Bus adoption criteria.

**Event Contract/Schema/Replay Governance:** See `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md` for CloudEvents-compatible envelopes, event type naming, JSON Schema ownership, compatibility windows, replay safety, privacy classification, and release gates.

**Notification API:** See `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md` for templates, provider adapters, suppression, delivery lifecycle, provider callbacks, and ownership boundaries.

**Audit Log:** See `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md` for append-only audit storage, producer outbox rules, metadata policy, query authorization, retention, and tamper-resistance.

**LINE Bot Integration:** See `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md` for weekly bulletin download, future LINE group file storage, asset ownership, and service-to-service boundaries.

**Future Domain Strategy:** See `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md` for contact forms, search, event registration, member/group/pastoral, donations, newsletters, and post-v1 service split triggers.

**Search:** See `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md` for post-v1 public search, admin CMS search, projection-derived indexes, CJK tokenization, and `search-api` extraction triggers.

**Rollout Matrix:** See `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md` for phase-by-phase rollout, verification, and rollback evidence.

**Architecture Completion Audit:** See `docs/superpowers/specs/2026-07-08-hhc-platform-architecture-completion-audit.md` for the final requirement-to-evidence matrix used to close architecture planning before implementation planning.

**API Contracts:** See `docs/api/public-api.md`, `docs/api/admin-api.md`, `docs/api/account-api.md`, `docs/api/asset-api.md`, `docs/api/auth-headers.md`, `docs/api/internal-notification-api.md`, and `docs/api/internal-audit-api.md`.

## Global Constraints

- Do not create or use `api.alive.org.tw`.
- `www.alive.org.tw` serves the public website and every non-account API path.
- `admin.alive.org.tw` is CMS/admin console UI only.
- `account.alive.org.tw` owns login, account APIs, OIDC, token, refresh token, and JWKS.
- `api-gateway` validates access JWTs locally from JWKS and must not call `account-api` per request.
- Refresh tokens are revoked/rotated by `account-api`; access tokens are short-lived and expire naturally.
- Public gateway must reject `/priv/*` and `/api/priv/*`.
- Internal-only APIs use `/priv/*` behind Dapr service invocation, mTLS, and app-id allowlists.
- `api-gateway` is the only external ingress for platform API traffic; backend API services use internal ingress and Dapr/app-id controls.
- First implementation slice is the account system: `account.alive.org.tw` login/profile UI/API in the existing `account-api` repo, plus `api-gateway` host routing/JWKS/JWT boundary.
- Treat `account-api` as the existing identity capability; verify current contracts before adding account code.
- Account OIDC/token design must leave room for a future desktop application login client, not only `admin.alive.org.tw`.
- `admin.alive.org.tw` must not implement its own login system; it consumes account-issued access tokens after the account system and gateway protected-route smoke tests pass.
- Services own their PostgreSQL schemas and do not cross-query another service's schema.
- Gateway routes and verifies but does not compose business data from multiple services.
- Public content reads should hit one owning backend and its local PostgreSQL/Redis projection path, not runtime fan-out.
- Cross-service read models must declare source service, source version, data classification, freshness, rebuild, and deletion/redaction rules.
- `asset-api` owns file mechanics; consumer services own business meaning.
- Weekly bulletin is a module inside `hhc-web-api` for v1, not a standalone `bulletin-api`.
- Do not split a service unless the split reduces coupling or operational risk enough to justify deployment and ownership cost.
- New deployables must pass the service catalog admission gate before being added to pipelines, route policy, or runtime topology.
- Application `ENVIRONMENT` values are limited to `local`, `test`, `staging`, and `prod`; use `prod` for machine-readable production config.
- Production deployments use immutable image digests from private ACR, with SBOM/provenance, scan results, release manifest, and protected production approval.
- Background work is owned by the service with the data and business decision; worker apps and ACA Jobs are runtime shapes, not new microservices.

---

## Roadmap Phases

### Phase 0: Documentation Alignment

**Purpose:** Make the architecture docs and implementation plans consistent before engineering work starts.

**Modify:**
- `docs/superpowers/specs/2026-07-08-hhc-web-cms-architecture-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-cms-phase-1.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-platform-roadmap.md`

**Deliverables:**
- Service list is consistent: `api-gateway`, `account-fe`, `account-api`, `hhc-web`, `hhc-web-api`, `asset-api`, `notification-api`, `audit-log`, and `hhc-line-function-bot`.
- `cms-api` is not required as a separate v1 service.
- Weekly bulletin LINE bot integration is documented as a public `hhc-web-api` consumer.
- API contract governance defines OpenAPI ownership, generated client boundaries, and compatibility gates.
- Event contract governance defines CloudEvents-compatible envelopes, canonical event names, JSON Schema ownership, compatibility windows, replay/idempotency rules, privacy classification, and `worker_or_event` release gates.
- Authorization policy governance defines role/scope catalog, route/action metadata, service-local resource checks, object-level authorization, field-level response policy, drift checks, and `authz_policy` release gates.
- Internal service identity defines `/priv/*` route ACLs, caller app-id rules, denied-call behavior, idempotency, and staging smoke tests.
- Cross-service dependency governance defines allowed synchronous calls, dependency-chain budgets, query ownership, read-model duplication rules, adapter boundaries, dependency register, and tests.
- Data classification defines privacy, retention, deletion, redaction, logging, backup restore, and future sensitive-domain launch rules.
- Data lifecycle orchestration defines service-owned lifecycle ledgers, legal hold, retention worker behavior, privacy request flow, restore quarantine, reconciliation gates, and RPO/RTO defaults without introducing v1 `privacy-api`, `retention-api`, or `recovery-api`.
- Platform backup/DR defines PostgreSQL PITR, backup retention/redundancy decision, Blob soft delete/versioning/PITR decision, Redis rebuild behavior, outbox/provider side-effect review, restore quarantine, DR drills, and evidence packets without introducing v1 `backup-api`, `restore-api`, or `dr-api`.
- Operability design defines SLOs, SLIs, alert policy, runbooks, degraded modes, capacity tests, and cost guardrails.
- Production runbook design defines incident command, service-owned runbooks, SEV1/SEV2 lifecycle, mitigation decision rules, evidence capture, post-incident review, and operational drills without creating a v1 `incident-api`.
- Background job design defines service-owned continuous workers, scheduled/manual ACA Jobs, job ledgers, lease/checkpoint/idempotency rules, scheduled publishing, backfill controls, and no v1 `scheduler-api`, `job-api`, `worker-api`, `workflow-api`, or `cron-api`.
- Browser security boundary design defines route-class HTTP security headers, CORS allowlists, CSRF/origin checks, CSP rollout, host-only account refresh cookies, cache headers, and asset download headers without creating a v1 security-header service.
- Public projection/cache design defines projection versions, Redis key strategy, ETags, publish/unpublish invalidation, asset grant ordering, sitemap refresh, and LINE bot latest consistency.
- Publication workflow design defines projection-only publish, required-public-asset grant-before-visible publish, rollback publish, emergency takedown, stale side-effect cancellation, and reconciliation without adding a v1 workflow service.
- CMS localization design defines source locale, translation status, stale translation behavior, per-locale publish, explicit fallback policy, locale-specific redirects, SEO alternates, and weekly bulletin locale consistency without adding a v1 translation service.
- CMS admin preview design defines admin-only draft/revision preview, protected draft asset preview, no public preview tokens, no public projections, and no-store/noindex behavior.
- Structured content design defines versioned block AST, allowed block types, renderer whitelist, link/asset validation, migration rules, and no raw HTML.
- CMS versioning/rollback design defines content revision snapshots, restore to draft, rollback publish, published/draft isolation, rollback asset grants, and no use of `audit-log` as restore state.
- Site settings design defines editable public navigation, footer links, social links, public contact display, shared layout projection, and the split between runtime config, editorial settings, and frontend UI chrome.
- SEO/URL design defines canonical host, locale alternates, slug validation, redirect lifecycle, sitemap ownership, robots/noindex policy, metadata sources, and no v1 `seo-api`.
- Accessibility/performance/media design defines WCAG baseline, required alt/dimensions metadata, Core Web Vitals targets, image derivative delivery, and frontend bundle gates.
- Local dev/test environment design defines local profiles, fake providers, deterministic seeds, local JWKS, CI dependencies, safe reset behavior, and staging smoke checks.
- Configuration design defines typed startup config, secret source, domain settings, feature flags, kill switches, provider adapter selection, config fingerprint, and release controls without introducing a v1 `config-api`.
- Deployment compatibility design defines release classes, release manifests, compatibility windows, expand/contract migration protocol, provider-first API rollout, ACA revision strategy, feature flag/kill-switch gates, and rollback/roll-forward rules without introducing a v1 `release-api`.
- Software supply chain design defines the source-to-production trust chain, private ACR usage, image digest promotion, SBOM/provenance artifacts, vulnerability/secret scan gates, release manifest artifact fields, signing roadmap, and compromised-artifact response without introducing runtime supply-chain services.
- Abuse prevention design defines gateway route classes, service-owned quotas, Redis counter boundaries, asset/notification/LINE protections, future public form controls, and no v1 `abuse-api`.
- Account admin identity lifecycle defines invitation, role grant/revoke, account suspend/disable, offboarding, account-domain APIs, emergency access removal, and separation between `cms.admin` and `account.admin`.
- Architecture completion audit maps the user requirements to authoritative artifacts and records intentional v1 non-services and post-v1 deferrals.

**Verification:**
- Search docs for conflicting `cms-api` or `bulletin-api` guidance.
- Confirm all non-account APIs are documented under `www.alive.org.tw/api/*`.
- Confirm public canonical URLs, sitemap, redirects, and locale alternates are documented as public projection behavior.
- Confirm editable site settings are not modeled as runtime config, `config-api`, frontend-only constants, or a standalone v1 service.
- Confirm accessibility metadata, media derivative, and public performance gates are documented before CMS-backed rendering.
- Confirm CI and local test strategy can run without production secrets, live providers, or production data.
- Confirm production-impacting services have typed config validation, explicit kill switches, and no fake-provider production defaults.
- Confirm production-impacting releases require release manifest, migration/contract/gateway compatibility evidence, config fingerprint, and rollback or roll-forward plan.
- Confirm production-impacting releases require immutable image digest, SBOM/provenance reference, scan results, same-digest staging-to-production promotion, and protected production approval.
- Confirm worker/job changes require owner, trigger, runtime pattern, job ledger, schedule/concurrency policy, lease/idempotency/checkpoint tests, staging run evidence, and runbook updates.
- Confirm event-producing services have event schemas, examples, compatibility fixtures, replay tests, classification review, and release manifest event compatibility evidence.
- Confirm authorization changes have role/scope diff, gateway/OpenAPI/service policy comparison, object-level tests, field-level redaction tests, and rollback or roll-forward evidence.
- Confirm rate-limit and quota strategy protects public reads, assets, admin writes, notifications, LINE webhooks, provider callbacks, and future public forms without coupling every request to a central service.
- Confirm lifecycle restore promotion requires ledger replay, deletion/redaction/legal-hold reconciliation, projection/search/sitemap rebuild, Redis rebuild, asset grant checks, and provider/webhook kill switches.
- Confirm backup/DR readiness requires PostgreSQL PITR and retention evidence, backup redundancy decision, Blob data-protection evidence, Redis rebuild proof, outbox/provider side-effect review, restore quarantine, negative leakage tests, and measured RPO/RTO.
- Confirm publication workflow consistency prevents required-asset public projections from appearing before grants are active and cancels stale publish side effects.
- Confirm architecture completion audit has no uncovered user requirement, unreferenced design artifact, or unresolved contradiction.

### Phase 1: Account System And Gateway Security

**Components:** `account-fe`, `account-api`, `api-gateway`

**Detailed Account FE/Gateway Plan:** See `docs/superpowers/plans/2026-07-09-hhc-account-fe-and-gateway-login.md` for the standalone `account-fe` project, account host routing, JWT verifier base-image decision, and admin login readiness gate.

**Create or Modify:**
- `account-fe` login/profile/security web surface for `account.alive.org.tw`.
- Existing `account-api` login, profile, refresh/session, OAuth/OIDC metadata, JWKS, native-app PKCE, and role/scope issuance.
- Contract verification against the current `account-api` implementation before adding new account behavior.
- Local Go JWT verifier in the `api-gateway` deployment boundary, preferably as an ACA sidecar/container and acceptable as a same-image binary if multi-container is unavailable.
- Nginx route policy for public, admin, asset, account, LINE webhook, and blocked internal routes.
- JWKS cache configuration.
- Trusted identity header injection.

**Behavior:**
- `account.alive.org.tw` serves `account-fe` UI plus account-api API/OIDC/JWKS paths through `api-gateway`.
- Login/profile works against the existing `account-api` before admin work starts.
- `account-api` issues access tokens and owns refresh/session/profile behavior.
- Future desktop app login uses a separate registered account OAuth client and PKCE; do not hard-code the account contract only for `hhc-admin`.
- Public feature APIs are readable without JWT.
- Admin APIs require bearer access JWT with CMS roles/scopes.
- Asset protected/admin routes require JWT.
- LINE webhooks do not require JWT but are POST-only, rate-limited, and delegated to LINE signature validation in the LINE service.
- `/priv/*` and `/api/priv/*` are never reachable from public ingress.
- Client-supplied `X-Internal-*` headers are stripped or rejected before any upstream call.

**Tests:**
- Account login succeeds through `account.alive.org.tw`.
- Account profile loads after login.
- Logout/session expiry removes admin access.
- Public route success without JWT.
- Missing token returns `401`.
- Invalid token returns `401`.
- Valid token missing role/scope returns `403`.
- Valid token reaches upstream with sanitized `X-HHC-*` headers.
- Client-supplied identity headers are stripped.
- Public `/priv/*` request is rejected.
- Public `/api/priv/*` request is rejected.
- Spoofed `X-Internal-Caller-App-Id` cannot reach an upstream service.

### Phase 2: Account Token Contract

**Component:** `account-api`

**Create or Modify:**
- Document `docs/api/account-api.md` and `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.
- Document `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.
- Confirm OIDC metadata and JWKS endpoints.
- Confirm access token claim names, audience, issuer, `kid`, `sid`, `client_id`, roles, and scopes.
- Confirm opaque refresh token rotation/revocation model.
- Confirm admin UI Authorization Code with PKCE and no implicit flow.
- Confirm JWKS rotation sequence and rollback window.
- Confirm account admin invitation, role grant/revoke, session revoke, suspend, disable, and offboarding semantics.

**Behavior:**
- `account-api` owns login, refresh token, token issuance, user profile, roles/claims, and JWKS.
- `api-gateway` validates access tokens locally and does not introspect with `account-api`.
- Access tokens should be short-lived, recommended 5-15 minutes.
- Refresh token revocation handles logout/device revocation.
- Role downgrade revokes refresh token families; existing access tokens expire naturally unless emergency `jti` denylist is used.
- Account admin APIs live on `account.alive.org.tw`; `hhc-web-api` does not own user records, invitations, sessions, or role assignments.
- `cms.admin` and `account.admin` are separate grants even when the same person holds both.

**Tests:**
- JWKS contains current signing key and `kid`.
- Gateway can validate a newly issued access token.
- Revoked refresh token cannot mint a new access token.
- Reused refresh token revokes token family.
- Existing access token expires naturally.
- Signing key rotation works without gateway restart.
- Invitation acceptance assigns roles and prevents token reuse.
- Role downgrade, suspend, and disable revoke affected refresh token families.
- `cms.admin` without `account.admin` cannot manage users.
- `account.admin` without CMS publish scope cannot publish CMS content.

### Phase 3: Main Website Backend And CMS Core

**Component:** `hhc-web-api`

**Create:**
- Go service.
- PostgreSQL schema: `hhc_web`.
- Hybrid shared-content plus module-detail tables.
- Redis cache/projection layer.
- Public read routes.
- Admin CMS routes.
- Internal client adapters for `asset-api`, `notification-api`, and `audit-log`.
- Deterministic content seed/import tooling for current `hhc-web` data.

**Modules:**
- `home`
- `news`
- `pages`
- `videos`
- `locations`
- `history`
- `legal`
- `bulletins`
- `admin`
- `site_settings`
- `preview`
- `blocks`
- `projection`
- `seed`

**Behavior:**
- Owns CMS source data for visible website content in v1.
- Draft content is admin-only.
- Preview renders saved drafts/revisions through admin APIs only and has no public projection/cache/sitemap/public-grant side effects.
- Published content appears in public APIs.
- Unpublished content is retained but hidden publicly.
- Publishes and unpublishes update public projections and asset grants.
- Calls `notification-api` through `/priv/*` only when notifications are required.
- Writes protected operations to `audit-log`.
- Imports current visible website content through versioned seed manifests, not manual SQL edits.
- Owns editable public site layout settings and publishes them into `site_layout:{locale}` projections.
- Owns structured body block validation and render-ready body projections.

**Public Routes:**
- `GET /api/home`
- `GET /api/news`
- `GET /api/news/{slug}`
- `GET /api/pages/{slug}`
- `GET /api/videos`
- `GET /api/locations`
- `GET /api/history`
- `GET /api/legal/{slug}`
- `GET /api/site-layout`
- `GET /api/bulletins`
- `GET /api/bulletins/latest`
- `GET /api/bulletins/{issueDate}`
- `GET /api/sitemap-data`

**Admin Routes:**
- `GET /api/admin/content/*`
- `POST /api/admin/content/*`
- `PATCH /api/admin/content/*`
- `POST /api/admin/content/*/publish`
- `POST /api/admin/content/*/unpublish`
- `POST /api/admin/bulletins`
- `POST /api/admin/bulletins/{issueId}/versions`
- `POST /api/admin/bulletins/{issueId}/publish`
- `POST /api/admin/bulletins/{issueId}/unpublish`
- `GET /api/admin/preview/content/{id}`
- `GET /api/admin/preview/bulletins/{issueId}`
- `GET /api/admin/preview/site-settings`
- `GET /api/admin/site-settings`
- `PATCH /api/admin/site-settings`
- `POST /api/admin/site-settings/publish`
- `POST /api/admin/site-settings/unpublish`

**Tests:**
- Public APIs return only published content.
- Database constraints reject unsupported locale/status/content type and duplicate public slugs.
- Optimistic concurrency rejects stale admin writes.
- Revision snapshots are created for draft save, publish, unpublish, archive, seed, restore, and rollback actions.
- Restore to draft changes admin source without changing public projections.
- Rollback publish creates a new public projection version and required asset grants.
- Preview draft/revision creates no public projection, public Redis key, sitemap entry, ETag pointer, or public asset grant.
- Structured body blocks validate against the HHC block AST, reject raw HTML/unsafe links, and project render-ready safe blocks.
- OpenAPI validates and generated consumer clients compile after contract changes.
- Admin APIs reject missing trusted identity headers.
- CMS publish creates or refreshes projection cache.
- Required-public-asset publish creates a publication workflow and does not expose public projection until public grants are active.
- CMS unpublish removes content from public result.
- Site settings publish creates or refreshes `site_layout:{locale}` and affected metadata/sitemap/home projections.
- Site settings validation rejects Blob/SAS URLs, internal service URLs, admin URLs, `/priv/*`, and unsupported route paths.
- Bulletin publish grants public read to PDF asset.
- Bulletin latest remains on the previous published issue, or 404 if none exists, while the new PDF publish workflow waits for grant confirmation.
- Bulletin unpublish revokes public read from PDF asset.
- Seed import is idempotent and records source commit, checksums, row counts, and warnings.
- Public API fixtures generated from seed data match current frontend TypeScript feature shapes.
- Rendered route parity passes for `zh-Hant`, `zh-Hans`, and `en` before production mock fallback is disabled.

### Phase 4: Generic Asset Capability

**Component:** `asset-api`

**Create:**
- Go service.
- PostgreSQL schema: `asset`.
- Azure Blob Storage adapter.
- Upload session flow.
- Asset grants and visibility model.
- Public/protected download routes through gateway.

**Namespaces:**
- `cms.weekly.pdf`
- `cms.news.cover`
- `cms.page.image`
- `line.group.file`
- `desktop.cloud-folder.object`

**Visibility:**
- `public`: published website content and public bulletins.
- `authenticated`: any valid account user.
- `restricted`: explicit users, groups, roles, app clients, or service identities.
- `private`: owner service/creator only unless granted.

**Internal Routes:**
- `POST /priv/assets/upload-sessions`
- `POST /priv/assets/{assetId}/complete`
- `POST /priv/assets/{assetId}/grants`
- `DELETE /priv/assets/{assetId}/grants/{grantId}`
- `GET /priv/assets/{assetId}`
- `GET /priv/assets/{assetId}/public-url`

**Public Routes Through Gateway:**
- `GET /api/assets/public/{assetId}`
- `GET /api/assets/protected/{assetId}`

**Important Design:**
- Consumer services ask `asset-api` for asset URLs.
- External clients receive stable gateway URLs, not Azure Blob SAS URLs.
- `asset-api` does not know whether a file is a bulletin, news cover, LINE attachment, or desktop folder object beyond namespace and owner metadata.

**Tests:**
- Public clean asset downloads successfully.
- Private/restricted asset is blocked from public route.
- MIME spoof and oversized uploads are rejected.
- Scan pending, infected, failed, and soft-deleted assets cannot be downloaded publicly.
- Public PDF download supports safe streaming headers and planned single-range behavior.
- Scan/derivative workers use leases and idempotent transitions.
- Published bulletin/news image grants public read.
- Unpublished bulletin/news image revokes public read.
- LINE group file can be restricted to a service/group grant.
- `hhc-web-api` can use only CMS asset namespaces.
- `hhc-line-function-bot` can use only LINE-owned asset namespaces.

### Phase 5: Notification Capability

**Component:** `notification-api`

**Create:**
- Go service.
- PostgreSQL schema: `notification`.
- Internal-only HTTP API.
- Template catalog.
- Outbox/queue worker.
- Provider adapter.
- Retry/backoff and delivery state.

**Internal Routes:**
- `POST /priv/notifications/send`
- `GET /priv/notifications/{messageId}`
- `POST /priv/notifications/templates/preview`

**Behavior:**
- No public browser API.
- Only internal service identities can call.
- Supports email first.
- Can later support LINE/admin alerts without changing calling services.

**Tests:**
- Unauthorized app-id cannot call `/priv/notifications/send`.
- Valid service can enqueue email.
- Provider failure retries with backoff.
- Delivery status is recorded.
- Audit event is emitted for send request and final result.

### Phase 6: Audit Trail

**Component:** `audit-log`

**Create:**
- Go service.
- PostgreSQL schema: `audit`.
- Monthly partitioned append-only event table.
- Action policy and metadata allowlist table.
- Idempotent event writer.
- Batch append route for producer outbox workers.
- Admin query route for future console audit screens through `hhc-web-api`.
- Retention worker and optional export manifest table.

**Internal Routes:**
- `POST /priv/audit/events`
- `POST /priv/audit/events/batch`
- `GET /priv/audit/events`
- `GET /priv/audit/events/{eventId}`

**Events:**
- Content create/update/publish/unpublish.
- Bulletin issue/version upload/publish/unpublish.
- Asset upload/grant/revoke/delete.
- Permission denied.
- Notification send requested/delivered/failed.
- Account security and role/scope changes.
- Gateway JWT failures and blocked internal path attempts when needed.

**Tests:**
- Events are append-only.
- Service identity is required.
- Event payload requires event id, actor, source service, action, resource type, resource ID, timestamp, severity, retention class, and request ID.
- Same `eventId` plus same canonical payload is idempotent.
- Same `eventId` plus different canonical payload returns conflict.
- Metadata denylist rejects tokens, provider secrets, raw request bodies, and sensitive narrative text.
- Query requires `audit:read`; sensitive metadata requires `audit:sensitive_read`.
- Producer outbox retries when `audit-log` is unavailable.

### Phase 7: Public Website And Admin UI

**Components:** `hhc-web`, `admin-fe`

**Modify:**
- Replace mock-only feature data with typed API client calls.
- Read shared header/footer/social/contact display data from `GET /api/site-layout`.
- Keep same-origin `/api/*` as production default.
- Use `NEXT_PUBLIC_API_BASE_URL` only for local/staging override.
- Remove `output: 'export'` when CMS/API-backed runtime rendering becomes the production data path.
- Serve public UI from `hhc-web` and the CMS/admin UI from `admin-fe`, with host-aware routing behind `api-gateway`.
- Do not add Next.js API route handlers for platform APIs.
- Keep CMS/admin editors in `admin-fe`; both frontends consume typed `hhc-web-api` contracts from `frontend-platform`.

**Public Pages:**
- Home.
- News.
- Weekly bulletin latest/archive/download.
- Videos.
- Locations.
- About/history.
- Legal pages.
- SEO/sitemap.
- Shared header/footer/navigation/social/contact display.

**Admin Screens:**
- News.
- Pages.
- Weekly bulletins.
- Assets.
- Videos.
- Locations.
- Settings.

**Tests:**
- Public pages render from API responses.
- API error states do not crash pages.
- `www.alive.org.tw/api/*` routes to backend services, not Next route handlers.
- `admin.alive.org.tw/api/*` is rejected by gateway.
- Sitemap and SEO metadata use published public projections only.
- Header, footer, social links, contact display, and site SEO defaults render from published site layout data.
- Weekly download link points to `www.alive.org.tw/api/assets/public/{assetId}`.
- Admin UI handles `401`, `403`, validation errors, draft save, publish, and unpublish.
- Admin preview renders draft/revision content with no-store/noindex behavior and no public draft/API fetch.
- Admin UI exposes revision history, restore to draft, and rollback publish with role checks and public-impact warnings.

### Phase 8: LINE Bot Weekly Bulletin Download

**Component:** `hhc-line-function-bot`

**Detailed Spec:** `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`

**Can integrate directly:** Yes. The LINE bot should integrate through `hhc-web-api` public bulletin routes, not direct `asset-api` or Blob access.

**Create or Modify:**
- Add `download_weekly_bulletin` to `FUNCTION_NAMES`.
- Add `downloadWeeklyBulletinArgumentsSchema`.
- Add function definition and keyword fallback.
- Add module registration in `FUNCTION_MODULES`.
- Add `HHC_WEB_API_BASE_URL`, defaulting to `https://www.alive.org.tw/api`.
- Add a bulletin API client.
- Add router/function tests.

**Arguments:**
```ts
{
  issueDate?: string;
  dateIntent?: "latest" | "specific_date";
  locale?: "zh-Hant" | "zh-Hans" | "en";
}
```

**Commands:**
- `小哈 下載週報`
- `小哈 最新週報`
- `小哈 週報 2026-07-12`
- `小哈 找 7/12 週報`

**Flow:**
1. User asks LINE bot for a weekly bulletin.
2. Router maps the message to `download_weekly_bulletin`.
3. Handler calls `GET /api/bulletins/latest` or `GET /api/bulletins/{issueDate}` on `hhc-web-api`.
4. `hhc-web-api` returns bulletin metadata and a stable asset download URL.
5. Bot replies with issue title, date, and the download link.

**Reply Example:**
```text
這是最新週報：
2026-07-12 週報
下載：https://www.alive.org.tw/api/assets/public/asset_123
```

**Boundary:**
- Public weekly bulletins use public HTTPS API.
- Future private/member-only bulletins should use internal `/priv/*` service identity or protected asset URLs.
- The bot must not construct Blob URLs or asset URLs by itself.

**Tests:**
- Latest weekly command routes to `download_weekly_bulletin`.
- Specific date command passes `issueDate`.
- Disabled function returns `function_disabled`.
- Successful API response returns title/date/download URL.
- `404` returns a clear "not found" reply.
- Timeout returns retry-friendly text.

### Phase 9: Public And Admin Search

**Component:** `hhc-web-api` first; `search-api` only after extraction triggers are met.

**Detailed Spec:** `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`

**Create or Modify:**
- Add `internal/search/` to `hhc-web-api`.
- Add `hhc_web.search_document` migration when search is enabled.
- Add `GET /api/search` public route.
- Add `GET /api/admin/search/content` protected CMS route.
- Add CJK token generation and English search vector support.
- Add public search document upsert/remove during publish, unpublish, and rollback publish.
- Add admin CMS search document refresh for source edits.
- Add frontend search UI only when product need exists.

**Boundary:**
- Public search indexes active public projections only.
- Admin CMS search is a separate protected index and uses `Cache-Control: no-store`.
- Asset manager search belongs to `asset-api`.
- Audit search belongs to `audit-log` query APIs.
- Do not create `search-api` until cross-service indexing, external engine operation, or independent scaling is justified.

**Verification:**
- Draft, unpublished, deleted, private, restricted, infected, scan-failed, and stale projection content never appears in public search.
- Public search result snippets are plain text and public URLs only.
- `zh-Hant`, `zh-Hans`, and `en` representative queries work without relying on whitespace tokenization for Chinese.
- Admin search requires `cms:read` and can include drafts only through protected admin routes.
- Unpublish and rollback update or omit stale search documents.

## Post-V1 Extension Guardrails

Future features should follow `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`.

**Keep in `hhc-web-api` first:**
- Public website content.
- Simple website-owned contact form if no multi-channel workflow exists.
- Public search over published `hhc-web-api` projections.
- Event display pages without registration.

**Create a new service when required:**
- `engagement-api` for multi-channel contact, inquiry, newsletter, and subscription consent workflows.
- `event-api` for registration, capacity, waitlist, check-in, reminders, and attendee PII.
- `member-api`, `group-api`, and `pastoral-care-api` for member, small group, and sensitive care data.
- `donation-api` for provider checkout, webhooks, receipts, reconciliation, and finance audit.
- `search-api` only when cross-service indexing or external search engine operation is justified.

These are post-v1 candidates, not required v1 deliverables.

## Build Order

1. Align docs and roadmap.
2. Complete the account system with the standalone `account-fe`, existing `account-api`, and `api-gateway`: `account.alive.org.tw` login/profile/security UI, session/refresh, OAuth/OIDC/JWKS, native-app PKCE support, and role/scope issuance.
3. Implement `api-gateway` host routing, account route forwarding, protected-route JWT verification, JWKS cache, and trusted header injection.
4. Lock the account token/JWKS/admin role contract with gateway smoke tests.
5. Define public/admin/asset/internal API contracts, event JSON Schemas, and authorization policy metadata.
6. Build the admin shell on `admin.alive.org.tw` as an account-system consumer; do not add a second login flow.
7. Build `asset-api`.
8. Build `hhc-web-api` CMS modules and public read APIs.
9. Wire `hhc-web` public pages to APIs.
10. Build weekly bulletin admin upload/publish flow.
11. Add LINE bot weekly bulletin function.
12. Add notification and audit integrations.
13. Harden staging/prod observability and deployment pipelines.

## Acceptance Criteria

- `api.alive.org.tw` is not used as a route, config target, or deployment host; mentions are limited to explicit prohibition.
- Only `api-gateway` has external ingress for platform API traffic; internal services are not directly public.
- Gateway validates JWT locally and does not call `account-api` per request.
- Account role assignment and role bundle issuance stay in `account-api`; feature services do not query account tables during request authorization.
- Gateway route-level scopes are not the final authorization decision; backend services enforce domain/resource-level authorization and field-level response policy.
- Gateway does not compose business data; cross-service query composition belongs in an owning product backend or a justified read/query service.
- Account admin lifecycle is owned by `account-api`, and `cms.admin` does not automatically imply `account.admin`.
- Public `/priv/*` access is impossible.
- Service dependency registers, adapter boundaries, and dependency-chain budgets exist before adding new service-to-service calls.
- `asset-api` supports public, authenticated, restricted, and private assets.
- Weekly PDFs, news images, LINE group files, and future desktop objects reuse the same asset service.
- Weekly bulletin can be downloaded from the website and LINE bot through the same published API and stable asset URL.
- Publish/unpublish updates public projections, ETags, sitemap data, asset grants, and LINE bot latest behavior without relying only on TTL.
- Required public asset publish, including weekly PDF, uses grant-before-visible workflow so public APIs never point at a non-downloadable required file.
- Preview has no public side effects and cannot leak drafts through public routes, sitemap, cache, or public asset grants.
- Site settings publish/rollback updates shared layout projections without exposing secrets, Blob/SAS URLs, internal hosts, admin URLs, or private routes.
- Restore to draft and rollback publish are supported without treating `audit-log` as content recovery state.
- Canonical URLs, sitemap, redirects, locale alternates, and Open Graph metadata use published public projections only.
- Public pages and CMS/admin workflows have accessibility, image metadata, derivative, and performance verification gates.
- `notification-api` command routes and `audit-log` are internal-only reusable capabilities; notification provider webhooks, if enabled, are signed callback routes only.
- Cross-service duplicated read data has source/version/classification/freshness/rebuild/deletion rules, and eventual consistency is explicit.
- Cross-service integration events have CloudEvents-compatible envelopes, committed JSON Schemas/examples, old/new compatibility tests, replay tests, classification, visibility, and dedupe by `source + id`.
- Non-public data has explicit classification, retention, logging, deletion/redaction, and backup restore rules before production traffic.
- Services that store non-public or recoverable data have lifecycle ledger events, legal hold behavior, retention worker rules, restore reconciliation, and RPO/RTO expectations before production traffic.
- Production backup/DR has IaC-managed PostgreSQL backup settings, Blob protection settings, Redis rebuild expectations, restore quarantine controls, quarterly drill evidence, and evidence packet requirements before production traffic.
- Tier 0 and Tier 1 surfaces have SLO targets, dashboards, page-worthy alerts, and runbooks before production traffic.
- Production-routed services have concrete `docs/runbooks/{service}.md` evidence and at least one staging drill for rollback, degraded mode, or recovery behavior.
- Browser-facing routes have header snapshot, CORS allow/deny, CSRF/origin, CSP, cookie domain, cache, and asset download header evidence before production traffic.
- Production go-live has DNS/TLS/custom-domain evidence, first-admin bootstrap evidence, content seed/projection readiness, launch freeze, public/admin/account smoke tests, rollback target, and post-launch monitoring evidence before the freeze is lifted.
- Multilingual CMS routes have locale completeness, source/translation status, fallback, `hreflang`, sitemap, locale-specific redirect, cache, and LINE weekly bulletin locale evidence before production traffic.
- Local development, CI, and staging smoke tests have documented profiles, fakes, deterministic seeds, and reset/cleanup rules.
- Service config is typed, validated, secret-safe, covered by CI, and has documented feature flags or kill switches where rollout risk requires them.
- Production-impacting releases have compatibility gates, release manifests, migration evidence, config fingerprints, and rollback or roll-forward evidence.
- Production-impacting releases use immutable image digests from private ACR and include SBOM/provenance, vulnerability/secret scan results, release manifest artifact evidence, and same-digest staging-to-prod proof.
- Worker/job changes have service ownership, no public ingress, IaC schedule/job definitions, job ledger evidence, idempotency/lease/checkpoint tests, and staging smoke evidence.
- Authorization-impacting releases have `authz_policy` evidence and drift checks across account role bundles, gateway policy, OpenAPI metadata, service policy, docs, and admin UI capability maps.
- Rate limits, quotas, abuse metrics, and representative `429`/`quota_exceeded` paths are documented before production traffic.
