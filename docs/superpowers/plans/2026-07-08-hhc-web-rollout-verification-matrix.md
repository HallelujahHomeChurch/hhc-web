# HHC Web Platform Rollout And Verification Matrix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:verification-before-completion before claiming any rollout phase is complete. This matrix defines the proof required for each phase.

**Goal:** Roll out the HHC web platform safely across gateway, website, backend services, assets, notifications, audit, and LINE bot weekly bulletin integration.

**Architecture:** Production traffic enters through `api-gateway`; services deploy independently to Azure Container Apps; each service owns its PostgreSQL schema; Redis is cache/ephemeral state; Blob stores assets behind `asset-api`.

**Tech Stack:** Azure Container Apps, Azure DevOps, PostgreSQL Flexible Server, Azure Cache for Redis, Azure Blob Storage, Dapr, Go, TypeScript.

## Global Constraints

- Do not create or use `api.alive.org.tw`.
- Do not expose `/priv/*` or `/api/priv/*` publicly.
- Do not deploy route changes that point to missing upstreams.
- Do not expose Blob URLs or SAS URLs to public clients.
- Only `api-gateway` should have external ingress for platform API traffic in v1.
- Do not push production-impacting branches unless the rollout owner has explicitly approved deployment.
- Do not promote production containers by mutable tags; production uses the same immutable image digest that passed staging with SBOM/provenance and scan evidence.
- Every production phase must have a rollback path.

---

## Phase 0: Documentation And Contract Freeze

**Artifacts:**

- `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md`
- `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md`
- `docs/runbooks/*.md`
- `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-architecture-completion-audit.md`
- `docs/api/*.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-platform-roadmap.md`

**Verification:**

- `git diff --check`
- Search docs for conflicting service boundaries:
  - no v1 standalone `cms-api` requirement
  - no public `/priv/*`
  - no `api.alive.org.tw` usage except explicit prohibition
- Review gateway auth design for local JWT verification and no per-request `account-api` calls.
- Review service catalog for the finite v1 deployable set, reusable capability boundaries, explicit v1 non-services, host/prefix ownership, allowed caller matrix, source-of-truth matrix, service admission gates, and extraction playbooks.
- Review account admin identity lifecycle for invitation, role grant/revoke, suspend, disable, offboarding, account-domain APIs, refresh-token family revocation, and separation of `cms.admin` from `account.admin`.
- Review internal service identity design for `/priv/*` route ACLs, caller app-id derivation, confused-deputy controls, idempotency, local-dev simulation, and staging smoke tests.
- Review authorization policy governance for role/scope catalog, route/action metadata, resource-level checks, field-level response policy, policy drift gates, and `authz_policy` release evidence.
- Review browser security boundary design for route-class security headers, CORS allowlists, CSRF/origin checks, CSP rollout, host-only account refresh cookies, cache headers, and asset download headers.
- Review public third-party/analytics/consent governance for provider registry, CMS URL validation, no arbitrary scripts/iframes, click-to-load embeds, analytics default-off behavior, consent category rules, provider-scoped CSP, LINE-safe links, and no v1 `tag-manager-api`, `analytics-api`, or `consent-api`.
- Review data classification/privacy/retention design for data classes, service ownership, minimization, token/secret handling, deletion/redaction, logging, backup restore, and future sensitive-domain launch rules.
- Review data lifecycle/restore design for lifecycle ledgers, legal hold, retention workers, privacy requests, asset reference cleanup, restore quarantine, reconciliation gates, RPO/RTO defaults, and no v1 `privacy-api`, `retention-api`, or `recovery-api`.
- Review platform backup/restore/DR design for PostgreSQL PITR, retention/redundancy decision, Blob soft delete/versioning/PITR decision, Redis rebuild behavior, outbox/provider side-effect review, restore quarantine, RPO/RTO targets, evidence packets, and no v1 `backup-api`, `restore-api`, or `dr-api`.
- Review public/admin/asset/internal API contracts for route consistency.
- Confirm API standards cover envelope, error codes, pagination, idempotency, optimistic concurrency, headers, versioning, and OpenAPI.
- Confirm API contract governance covers OpenAPI ownership, generated clients, compatibility checks, gateway policy comparison, fixtures, and consumer contract tests.
- Confirm cross-service dependency governance covers synchronous call rules, dependency-chain budgets, query ownership, read-model duplication, anti-corruption adapters, dependency register, and provider-down tests.
- Confirm structured content design covers versioned `bodyJson`, allowed v1 block types, renderer whitelist, link validation, body asset refs, schema migration, no raw HTML, and no `dangerouslySetInnerHTML`.
- Confirm local dev/test environment covers local profiles, dev scripts, port registry, local JWKS, Testcontainers/Azurite/fakes, deterministic seeds, CI gates, staging smoke, and safe reset behavior.
- Confirm configuration design covers typed config, secret handling, domain settings, feature flags, kill switches, provider adapters, release controls, config fingerprints, CI guardrails, and no v1 `config-api`.
- Confirm deployment compatibility design covers release classes, release manifests, compatibility windows, migration protocol, provider-first API rollout, gateway release gates, ACA revision strategy, feature flags, kill switches, and rollback/roll-forward evidence.
- Confirm software supply chain design covers source commit, pipeline run, SBOM/provenance, private ACR, image digest, scanner gates, signing roadmap, same-digest staging-to-prod promotion, exception expiry, and no v1 runtime supply-chain services.
- Confirm abuse prevention design covers route classes, service-level quotas, Redis counter boundaries, asset egress protection, notification abuse controls, LINE webhook dedupe, future public forms, and no v1 `abuse-api`.
- Confirm search design keeps public search in `hhc-web-api` first, uses projection-derived search documents, separates admin CMS search, keeps asset/audit search with owning services, supports CJK tokenization, and defines `search-api` extraction triggers.
- Confirm `hhc_web` PostgreSQL schema covers shared content lifecycle, module-detail tables, bulletins, projections, outbox, seed provenance, indexes, constraints, and migration rules.
- Confirm public projection/cache design covers projection versions, Redis key strategy, ETags, negative cache, publish/unpublish affected keys, asset grant ordering, sitemap refresh, and LINE bot latest consistency.
- Confirm publication workflow design covers grant-before-visible publish, `202 Accepted`, rollback publish, emergency takedown, stale side-effect cancellation, and reconciliation.
- Confirm CMS workflow covers draft, preview, publish, unpublish, localization, asset picker, weekly bulletin publish, audit, and admin UI behavior.
- Confirm CMS localization design covers source locale, translation status, stale translation behavior, per-locale publish, explicit fallback policy, locale-specific redirects, SEO alternates, weekly bulletin locale consistency, and no v1 `translation-api`.
- Confirm CMS admin preview design covers `GET /api/admin/preview/*`, saved draft/revision render models, protected draft asset preview, no public preview tokens, no-store/noindex, and no public projection/cache/sitemap/public-grant side effects.
- Confirm CMS versioning/rollback covers revision snapshots, restore to draft, rollback publish, draft/published isolation, asset grant behavior, revision retention, and no use of `audit-log` as restore state.
- Confirm site settings design covers public navigation, footer links, social links, public contact display, site SEO defaults, `site_layout:{locale}`, `GET /api/site-layout`, admin site-settings routes, and runtime-config separation.
- Confirm content migration/bootstrap covers source inventory, seed manifests, asset import, API fixture generation, text encoding review, parity tests, and rollback.
- Confirm rendering/delivery covers static-export cutover, host-aware UI routing, public/admin cache rules, sitemap/SEO runtime behavior, no Next API routes, and frontend rollback.
- Confirm SEO/URL design covers canonical URLs, locale alternates, slug governance, redirect lifecycle, sitemap ownership, robots/noindex, metadata, Open Graph, and no v1 `seo-api`.
- Confirm accessibility/performance/media design covers WCAG baseline, CMS alt/dimensions metadata, image derivatives, Web Vitals targets, bundle gates, and admin keyboard accessibility.
- Confirm outbox/idempotency/dead-letter rules exist for cross-service side effects.
- Confirm event contract governance covers CloudEvents-compatible envelope, canonical event naming, JSON Schema ownership, schema examples, compatibility window, replay safety, privacy classification, visibility, and event release gates.
- Confirm post-v1 service candidates are documented as future split triggers, not current deployables.
- Confirm no new deployable, route policy upstream, pipeline, or runtime app is introduced without a service catalog entry or approved extraction evidence.
- Confirm cloud runtime design documents external ingress, internal Dapr calls, environment-separated data stores, secrets, rollback, and recovery.
- Confirm cloud infrastructure governance documents IaC ownership, canonical `ENVIRONMENT` values, resource naming/tagging, Azure DevOps workload identity, runtime managed identities, role assignments, drift checks, and infra release classes.
- Confirm production go-live design documents DNS/TLS/custom domains, host routing, first-admin bootstrap, content seed readiness, HSTS staging, traffic cutover, rollback decision rules, Front Door/CDN adoption gates, launch freeze, and post-launch monitoring.
- Confirm platform backup/restore/DR design documents data-store recovery, restore quarantine, RPO/RTO targets, side-effect review, public leakage checks, DR drills, and evidence packets.
- Confirm SLO/observability/runbook design documents route-class SLOs, SLIs, alert policy, dashboards, degraded modes, capacity tests, and cost guardrails.
- Confirm production runbook/incident operations design documents platform incident command, required v1 service runbooks, SEV lifecycle, mitigation decision rules, incident evidence, post-incident review, drills, and no v1 `incident-api`.
- Confirm background job design documents service-owned workers, scheduled/manual ACA Jobs, job ledgers, leases, checkpoints, scheduled publish/unpublish, backfill controls, worker release evidence, and no v1 `scheduler-api`, `job-api`, `worker-api`, `workflow-api`, or `cron-api`.
- Confirm architecture completion audit maps every explicit architecture requirement to current evidence, marks intentional deferrals, and leaves no unresolved planning blocker.

**Rollback:**

- Docs-only rollback through Git revert if a decision changes.

## Phase 1: Account And Gateway Foundation

**Deployables:**

- `account-api` token/JWKS contract changes.
- `api-gateway` local JWT verifier and route policy.

**Preconditions:**

- JWKS endpoint is reachable from gateway.
- Access token includes required claims.
- OIDC metadata advertises issuer, token endpoint, revocation endpoint, and JWKS URI.
- Account token contract is frozen for issuer, audience, token type, roles, scopes, `jti`, `sid`, and `client_id`.
- Refresh token rotation/revocation is implemented or explicitly staged before admin production login.
- Account admin invitation, role grant/revoke, suspend, disable, and session revocation behavior is implemented or explicitly staged before admin production login.
- `cms.admin` and `account.admin` separation is represented in account roles/scopes and tests.
- Staging gateway route config validates.
- All upstream service app ids are configured but missing routes are not pointed to production until services exist.
- Backend API services have internal ingress only; external traffic reaches APIs through `api-gateway`.

**Verification:**

- Valid access token reaches protected test route.
- Expired token returns `401`.
- Wrong audience returns `401`.
- Wrong issuer returns `401`.
- ID token used against API returns `401`.
- Missing CMS role returns `403`.
- Client-supplied `X-HHC-*` headers are stripped.
- Client-supplied `X-Internal-*` headers are stripped or rejected.
- `GET /api/home` public route works without token in staging.
- Public `/priv/*` returns blocked status.
- Public `/api/priv/*` returns blocked status.
- `admin.alive.org.tw/api/*` does not expose backend API routes.
- Direct public access to backend service ingress is impossible.
- Revoked refresh token cannot mint new access tokens.
- Reused refresh token revokes the token family.
- Invitation acceptance assigns roles and prevents invitation token reuse.
- Role downgrade, suspend, and disable revoke affected refresh token families.
- `cms.admin` without `account.admin` cannot manage account users.
- `account.admin` without CMS publish scope cannot publish CMS content.
- JWKS signing key rotation works without gateway restart.

**Rollback:**

- Revert gateway revision traffic to previous ACA revision.
- Keep account JWKS backward compatible during rollback.

## Phase 2: `asset-api`

**Deployables:**

- `asset-api`
- `asset` schema migrations
- Blob container and managed identity permissions

**Preconditions:**

- Blob storage container exists.
- PostgreSQL migration dry-run passes.
- Dapr app id is `asset-api`.
- Internal allowlist permits `hhc-web-api` and test caller only.

**Verification:**

- `/healthz` returns alive.
- `/readyz` confirms PostgreSQL and Blob.
- Upload session can be created by allowed internal caller.
- Disallowed app id cannot create upload session.
- Allowed app id with disallowed asset namespace cannot create upload session.
- MIME spoof and oversized uploads are rejected.
- Scan pending, infected, failed, and soft-deleted assets cannot be downloaded publicly.
- Download response does not expose Blob URL, SAS URL, or storage key.
- PDF download route supports safe streaming headers and planned single-range behavior.
- Scan/processing workers use leases and idempotent transitions.
- Completed clean public asset can be downloaded through gateway public URL.
- Private asset cannot be downloaded publicly.
- Grant create/revoke is idempotent.
- Audit event is emitted or queued for retry.

**Rollback:**

- Stop routing public asset paths to new revision.
- Keep uploaded blobs; do not delete objects during rollback.
- Re-run grants after rollback if publish state changed during test.

## Phase 3: `hhc-web-api`

**Deployables:**

- `hhc-web-api`
- `hhc_web` schema migrations
- Redis cache prefix

**Preconditions:**

- `asset-api` staging is ready.
- `audit-log` can accept events or audit outbox retry is enabled.
- Public route responses match `docs/api/public-api.md`.
- `hhc-web-api` OpenAPI validates and matches public/admin route contracts.
- `GET /api/site-layout` and admin site-settings routes are included in public/admin contracts.
- Generated `hhc-web` client or DTOs compile if generation is enabled for the route surface.
- Authorization policy metadata exists for protected routes, including required scopes, action ids, resource checks, and field-level response policy.
- Content seed manifest is generated from current `hhc-web` mock/i18n/assets sources.
- Source checksums, source commit, and seed version are recorded.
- Visible text for `zh-Hant`, `zh-Hans`, and `en` has passed review before production seeding.
- `hhc_web` schema migrations create required tables, indexes, and constraints.

**Verification:**

- Public APIs return published data only.
- Schema constraints reject invalid locale/status/content type values.
- Duplicate locale slugs, bulletin issue dates, and bulletin locale versions are rejected.
- Stale admin updates return conflict through optimistic concurrency.
- Seed import is idempotent and does not duplicate CMS records.
- Seed run records inserted/updated/skipped counts and warnings.
- Public API fixtures generated from seed data match current frontend feature shapes.
- Consumer contract tests pass for `hhc-web` public adapters and LINE bot weekly bulletin calls.
- Admin APIs reject missing token.
- Admin APIs reject missing trusted headers when called directly.
- Admin APIs reject valid tokens missing required scope and reject object-level probing for disallowed draft/private/deleted resources.
- Draft content is visible only through admin APIs.
- Admin preview renders draft/revision data through admin APIs only.
- Preview responses are no-store/noindex and create no public projection, public Redis key, sitemap entry, ETag pointer, or public asset grant.
- Draft save and publish create revision snapshots.
- Structured body blocks reject raw HTML, unsafe links, unsupported blocks, editor-library opaque JSON, arbitrary CSS classes, and Blob/SAS URLs.
- Structured body blocks project render-ready safe blocks and normalized body asset references.
- Restore to draft changes admin source and leaves public projections unchanged.
- Rollback publish creates a new public projection version and updates ETag.
- Publish writes projection and cache entry.
- Required-public-asset publish creates workflow and does not expose projection before asset grant confirmation.
- Delayed PDF grant keeps `/api/bulletins/latest` on previous issue or 404.
- Stale publish workflow after unpublish or rollback is cancelled and does not re-expose content.
- Unpublish removes public projection.
- Bulletin publish grants public read to PDF asset.
- Bulletin latest returns newest published issue.
- Site settings publish creates `site_layout:{locale}` projections.
- `GET /api/site-layout` returns navigation, footer links, social links, contact display, and site SEO defaults without secrets, Blob/SAS URLs, internal hosts, admin URLs, or `/priv/*`.
- Site settings rollback publish updates the site layout ETag and affected metadata/sitemap/home projections.
- Public cache invalidates on publish/unpublish.
- If search is enabled, public search documents update on publish/unpublish/rollback and stale projection versions are omitted from public results.
- Weekly, news, videos, locations, history, legal, and home projections match current route parity expectations.

**Rollback:**

- Revert ACA revision.
- Keep additive schema migrations.
- Invalidate Redis public cache after rollback.

## Phase 4: `hhc-web` Public Site And Admin UI

**Deployables:**

- `hhc-web`

**Preconditions:**

- Public APIs stable in staging.
- Admin OIDC login flow available.
- `NEXT_PUBLIC_API_BASE_URL` is same-origin or staging override, never `api.alive.org.tw`.
- `hhc-web` Next server deployment is available behind gateway.
- Static export rollback path or previous ACA revision is available.
- `output: 'export'` is removed when runtime CMS/API rendering is required.

**Verification:**

- Public home, news, weekly, videos, locations, history, legal pages render.
- Header, footer, navigation, social links, contact display, and site SEO defaults render from `GET /api/site-layout`.
- Public rich content renderer handles every v1 block type through whitelisted components and never renders raw HTML from CMS content.
- If search UI is enabled, public search results render plain-text snippets and public URLs only; admin search remains protected and no-store.
- Weekly download link points to `/api/assets/public/{assetId}`.
- Public pages handle API `404` and `503` gracefully.
- Sitemap and metadata use published public projections only.
- Admin console loads from `admin.alive.org.tw`.
- Admin API calls go to `www.alive.org.tw/api/admin/*`.
- `admin.alive.org.tw/api/*` is rejected by gateway.
- `www.alive.org.tw/api/*` routes to backend services, not Next.js handlers.
- Admin pages are noindex and no-store.
- Admin screens handle `401`, `403`, validation errors, save draft, publish, unpublish.
- Admin preview screens handle draft preview, revision preview, blocked asset warnings, no-store/noindex headers, and no public draft fetch.
- Admin revision screens handle revision list/detail, restore to draft, rollback publish, asset warnings, and public-impact confirmation.
- Admin Settings screen can edit/publish/rollback site settings and cannot edit runtime config, secrets, OIDC settings, service URLs, storage provider details, feature flags, or gateway route policy.

**Rollback:**

- Revert frontend deployment to previous revision/build.
- No DB rollback required for UI-only rollback.

## Phase 5: `notification-api`

**Deployables:**

- `notification-api`
- `notification` schema migrations
- Provider credentials/secrets

**Preconditions:**

- Provider test credentials configured.
- Internal app-id allowlist configured.
- Audit-log available or outbox retry configured.

**Verification:**

- Allowed internal caller can enqueue notification.
- Disallowed caller receives forbidden.
- Provider success marks message sent/delivered.
- Provider temporary failure retries.
- Provider permanent failure marks failed.
- Audit events are emitted for requested and final result.

**Rollback:**

- Disable notification calls in caller config.
- Revert notification-api revision.
- Queued messages remain in DB and can be retried after fix.

## Phase 6: `audit-log`

**Deployables:**

- `audit-log`
- `audit` schema migrations

**Preconditions:**

- PostgreSQL storage and retention configured.
- App-id allowlist includes required emitters.
- Action policy and metadata allowlist loaded for v1 producers.
- Producer outbox workers are configured for audit event delivery.

**Verification:**

- Allowed service can append event.
- Disallowed service is rejected.
- Events are immutable.
- Duplicate same-payload event id is accepted idempotently.
- Duplicate conflicting event id is rejected.
- Metadata denylist rejects token, secret, raw body, and oversized metadata.
- Query route returns events by resource id for internal/admin callers.
- Query route requires `audit:read`.
- Sensitive metadata requires `audit:sensitive_read`.
- Services retry audit writes through outbox when audit-log is unavailable.
- Retention worker can identify expired partitions without touching active partitions.

**Rollback:**

- Revert service revision.
- Keep append-only schema.
- Caller outboxes retain events for retry.

## Phase 7: LINE Bot Weekly Bulletin Download

**Deployables:**

- `hhc-line-function-bot`
- Config: `HHC_WEB_API_BASE_URL=https://www.alive.org.tw/api`

**Preconditions:**

- `GET /api/bulletins/latest` is stable.
- Public asset URL downloads in LINE client browser.
- Bot profile enables `download_weekly_bulletin`.

**Verification:**

- `小哈 下載週報` returns latest title/date/download URL.
- `小哈 週報 2026-07-12` returns the specific issue or clear not-found reply.
- API timeout returns retry-friendly text.
- Disabled function returns function-disabled behavior.
- Bot does not call `asset-api` or Blob directly.

**Rollback:**

- Disable `download_weekly_bulletin` in bot profile config.
- Revert bot revision if needed.
- No backend rollback required if public APIs remain healthy.

## Cross-Phase Smoke Checklist

Run before production promotion:

- CI completed without production secrets or live provider credentials.
- Production config validation passed with fake providers and local/test resources rejected.
- Public website loads.
- `GET /api/home` succeeds.
- `GET /api/site-layout` succeeds and contains no secret/internal/admin/private route data.
- `GET /api/bulletins/latest` succeeds or returns clean `404`.
- Published asset download succeeds.
- Representative route-class rate limit returns `429 rate_limited` without leaking identifiers.
- `GET /sitemap.xml` includes published public routes only and canonical URLs use `www.alive.org.tw`.
- Representative public pages pass accessibility/media metadata checks and performance budget smoke.
- Admin route without token returns `401`.
- Admin route with insufficient scope returns `403`.
- Admin preview route returns no-store/noindex and does not expose Blob/SAS URLs.
- Matching public route for a draft preview item still returns `404`.
- Public `/priv/*` is blocked.
- Gateway logs request id and upstream route group.
- `hhc-web-api` logs request id and cache hit/miss.
- Outbox backlog is not growing.
- Audit-log accepts events.
- Required production-routed service runbooks exist under `docs/runbooks/`.
- Platform incident command runbook covers SEV1/SEV2 evidence, mitigation choice, closeout, and post-incident review.

## Completion Evidence

For any phase to be marked done, collect:

- Commit SHA or build id.
- Migration version.
- Release manifest id and release class.
- Contract version and compatibility result where APIs changed.
- Event schema version, compatibility result, replay result, and classification review where integration events changed.
- Authorization policy diff, role/scope diff, route/action drift check, object-level authorization test, and field-level redaction evidence where authorization changed.
- Gateway route policy comparison where routes/auth/cache changed.
- ACA revision name.
- Smoke command output.
- Test command output.
- Local profile, CI fixture, and staging smoke evidence.
- Config fingerprint, feature flag state, active kill-switch state, and fake-provider guard evidence.
- Release compatibility evidence: migration dry run, old/new compatibility window, generated client compile, rollback or roll-forward plan, and owner approval for production-impacting changes.
- Rate-limit/quota evidence for changed route classes and provider-facing paths.
- Canonical, sitemap, redirect, alternates, robots/noindex, and metadata evidence for public route changes.
- Site-layout projection evidence, including no secret/internal URL leakage and updated header/footer after publish/rollback.
- Accessibility, image derivative, Core Web Vitals/lab performance, and admin keyboard-flow evidence for UI route changes.
- Preview leakage evidence: no public projection/cache/sitemap/public grant/Blob-SAS exposure for draft previews.
- Structured content evidence: schema validation, safe renderer, no raw HTML, no `dangerouslySetInnerHTML`, no unsafe links, no Blob/SAS URLs, and correct body asset grant behavior.
- Search evidence when enabled: public index built from active projections only, CJK query fixtures, no draft/private/stale results, admin search `no-store`, and no raw HTML snippets.
- Publication workflow evidence: workflow row, versioned idempotency keys, grant-before-visible proof, stale workflow cancellation, emergency takedown path, and reconciliation repair output.
- Event evidence for worker/event releases: committed schema examples, old/current fixture validation, dedupe by `source + id`, replay without unsafe external side effects, and unsupported future version behavior.
- Rollback revision or rollback command.
- SLO, dashboard, page-worthy alert, service runbook path, incident command runbook path, and staging drill evidence for production-routed services.
- SEV1/SEV2 response evidence rules when the release changes gateway auth, public routing, data recovery, asset public access, audit append, notification delivery, or LINE bulletin workflows.
- Browser security evidence: header snapshots for public HTML, admin HTML, public API, admin API, public asset, protected asset, account refresh, and webhook routes; CORS allow/deny tests; CSRF/origin checks; CSP report/enforce status; host-only account refresh cookie proof; and no Blob/SAS exposure in asset responses.
- Third-party public web evidence: provider registry review, CMS URL validation reject cases, no arbitrary script/iframe publish, provider-disabled fallback, click-to-load YouTube/map behavior if enabled, consent reject behavior, route-scoped CSP allowlist, no tag-manager default, and provider rollback proof.
- Production go-live evidence: DNS before/after, TLS certificate status, custom-domain binding, HSTS stage, first-admin bootstrap result, emergency-user review, seed/projection readiness, public/admin/account smoke checks, negative auth checks, rollback target, launch freeze window, post-launch metric snapshot, and freeze-end decision.
- Localization evidence: source locale and translation status fixtures, stale translation warning, no silent public detail fallback, published-locale-only `hreflang`, locale-specific slug redirect, sitemap alternate update, locale cache invalidation, and LINE latest/specific weekly bulletin locale behavior.
- Data classification, retention, public-leakage, log-redaction, and backup-restore privacy evidence for production-routed services.
- Lifecycle evidence for production-routed stateful services: ledger events, legal-hold behavior, retention worker dry run/apply output, restore quarantine, reconciliation report, projection/search/sitemap rebuild proof, Redis rebuild proof, asset grant verification, and RPO/RTO measurement.
- Backup/DR evidence for production-routed stateful services: PostgreSQL backup retention and redundancy decision, PITR drill result, restored-server quarantine proof, Blob soft delete/version/PITR setting proof, Redis rebuild proof, outbox/provider side-effect classification, negative leakage checks, measured RPO/RTO, and promote/abandon/degraded decision.
- Known residual risks.

Do not mark a phase complete from intent or deployment success alone. It is complete only after route, auth, data, and rollback evidence are captured.
