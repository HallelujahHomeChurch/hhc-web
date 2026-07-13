# HHC Service Catalog And Ownership Design

## Purpose

This spec is the operating catalog for the HHC web platform. It answers:

- which components are real v1 deployables
- which capabilities are reusable platform services
- which future domains must not be built yet
- who owns each data source, API surface, dependency, and operational signal
- which callers are allowed to use each service
- what evidence is required before adding or extracting a service

It exists to prevent two opposite failures:

- over-splitting into microservices because every noun sounds reusable
- under-splitting by letting `hhc-web-api` become the place where every future workflow and data type goes

This catalog does not replace the detailed specs. It is the index of ownership decisions that implementation, release, and review should use.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-web-platform-detailed-architecture.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`
- `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`

## Core Decision

V1 has a small service set with clear ownership:

- `api-gateway` is the public ingress and first policy enforcement point.
- `account-fe` owns the browser account console. `account-api` owns identity APIs, token, refresh, JWKS, account admin lifecycle, and role bundle issuance.
- `hhc-web` owns the public website UI and admin console UI.
- `hhc-web-api` owns the v1 website backend, CMS modules, public projections, and website product workflow.
- `asset-api` owns reusable file/object mechanics.
- `notification-api` owns internal notification command delivery.
- `audit-log` owns append-only accountability.
- `hhc-line-function-bot` owns LINE interaction context and consumes published platform data.

Everything else is either infrastructure, a library/contract artifact, or a future service candidate.

The platform should not add a service unless the split reduces ownership ambiguity, security risk, operational risk, or coupling enough to justify the deployment and runbook cost.

## V1 Deployable Catalog

| Component | V1 Status | Runtime | Public Surface | Private Surface | Source Of Truth | Reusable Capability | Criticality |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `api-gateway` | required | Nginx + Go verifier | all public non-account API routing under `www.alive.org.tw`; account host routing | none for business calls | route policy, verifier config | ingress, JWT validation, trusted headers, coarse limits | Tier 0 |
| `account-fe` | required | Vite/React/TypeScript | `account.alive.org.tw` account login/profile/security UI | `account-api` through account host | no DB | account browser console | Tier 0 |
| `account-api` | required | Go or existing account runtime | `account.alive.org.tw` account/OIDC/token/JWKS APIs | account-originated notification/audit commands | `account` schema | identity, refresh revocation, role/scope issuance, JWKS | Tier 0 |
| `hhc-web` | required | Next.js/TypeScript | UI routes on `www.alive.org.tw` and `admin.alive.org.tw` | none | no DB | public website UI, admin console UI | Tier 1 |
| `hhc-web-api` | required | Go | `www.alive.org.tw/api/*` website public/admin routes | service-owned workers and approved `/priv/*` only if added | `hhc_web` schema | website content backend, CMS, public projections | Tier 1 |
| `asset-api` | required | Go | `www.alive.org.tw/api/assets/*` downloads and upload coordination via gateway | `/priv/assets/*` | `asset` schema and Blob object keys | upload sessions, scan status, grants, stable URLs, downloads | Tier 1 |
| `notification-api` | required internal | Go | provider callbacks only if needed and signature-verified | `/priv/notifications/*` | `notification` schema | templates, provider adapters, retry, delivery status | Tier 2 |
| `audit-log` | required internal | Go | none | `/priv/audit/*` | `audit` schema | append-only audit, protected query/export | Tier 2 |
| `hhc-line-function-bot` | integration | Node/TypeScript | LINE webhook through gateway | future asset commands by app-id approval | bot-owned schema/state | LINE interaction adapter, weekly bulletin consumer | Tier 3 |

Criticality follows the SLO spec. It does not lower security requirements for Tier 2 or Tier 3 components.

## Non-Deployable Platform Capabilities

| Capability | Owner | Not A Service Because | Rules |
| --- | --- | --- | --- |
| PostgreSQL Flexible Server | platform/runtime | managed data store, not a domain boundary | each service owns one schema; no cross-schema queries |
| Redis | platform/runtime | cache and ephemeral state only | no source-of-truth data; service key prefixes required |
| Azure Blob Storage | `asset-api` as logical owner | storage provider, not public API | no browser Blob/SAS exposure; object paths are internal |
| Azure Container Registry | platform/runtime | image distribution boundary, not a business domain | private ACR; deploy production by immutable digest |
| Dapr service invocation | platform/runtime | transport identity, not business authorization | callee still enforces `/priv/*` ACL and domain rules |
| Key Vault / ACA secrets | platform/runtime | secret store, not config domain | services read typed startup config; no v1 `config-api` |
| OpenAPI specs | owning service | contract artifact | generated clients stay behind service adapters |
| JSON Schema event contracts | producing service | contract artifact | schema registry lives with producer contracts |
| Release manifests | pipeline/release owner | evidence artifact | required for production-impacting releases |
| SBOM/provenance artifacts | pipeline/release owner | release evidence artifact | referenced by release manifest; no v1 `sbom-api` |
| Vulnerability scan reports | pipeline/release owner | release gate artifact | block or document exceptions before production promotion |
| Service-owned workers and ACA jobs | owning service | runtime shape, not a domain boundary | worker owner, trigger, job ledger, schedule, and runbook required |
| Backup/restore/DR procedure | platform/runtime plus service owners | operational capability, not a product API | IaC owns data-protection settings; services own reconciliation; runbooks own promotion evidence |

Infrastructure can be shared, but ownership cannot be shared silently. Every schema, key prefix, Blob namespace, event type, route policy entry, and secret must have one declared owner.

## Explicit Non-Services In V1

Do not create these in v1:

| Candidate | V1 Decision | Reason |
| --- | --- | --- |
| `cms-api` | no | CMS is part of the website product backend until it has separate ownership, scale, or consumers |
| `bulletin-api` | no | weekly bulletin is a CMS module and public projection in `hhc-web-api` |
| `public-query-api` | no | `hhc-web-api` is the website backend; gateway and query convenience are not service boundaries |
| `query-api` or GraphQL gateway | no | no justified cross-service query product yet |
| `search-api` | no | start with `hhc-web-api` PostgreSQL search over published projections |
| `authorization-api` | no | gateway checks route scopes; services own resource/field authorization |
| `config-api` | no | typed config, feature flags, and kill switches are release/runtime controls |
| `abuse-api` | no | gateway owns coarse limits; services own durable domain quotas |
| `privacy-api` / `retention-api` / `recovery-api` | no | lifecycle rules are service-owned with shared governance |
| `backup-api` / `restore-api` / `dr-api` | no | backup and DR are IaC/runbook/release operations; services own reconciliation |
| `analytics-api` | no | v1 analytics is optional and should be provider/config governed, not a platform domain service |
| `consent-api` | no | v1 public consent is browser-local UI preference state; domain consent belongs to the future owning domain |
| `tag-manager-api` | no | tag managers are not approved in v1; third-party scripts are governed by provider registry and release controls |
| `launch-api` / `dns-api` / `certificate-api` | no | go-live, DNS, TLS, and custom-domain changes are IaC/runbook/release operations |
| `email-api` | no | name the capability by business role: `notification-api` |
| `asset-cdn-api` | no | asset delivery is part of `asset-api` download policy |
| `supply-chain-api` / `artifact-api` / `sbom-api` / `vulnerability-api` / `release-security-api` | no | artifact provenance, SBOM, scans, signing, and promotion are pipeline/release-governance concerns until a real operational query product exists |
| `scheduler-api` / `job-api` / `worker-api` / `workflow-api` / `cron-api` | no | background jobs are service-owned runtime shapes unless a future domain workflow service owns real business decisions |

These can be revisited only through the extraction gates in this spec and the future-domain strategy.

## Host And Route Ownership

| Host / Prefix | Owner | Allowed Purpose | Prohibited Use |
| --- | --- | --- | --- |
| `www.alive.org.tw` | `api-gateway` routes to `hhc-web` | public website UI | account-only identity UI as a separate product surface |
| `www.alive.org.tw/api/*` | `api-gateway` routes to owning service | all non-account public APIs | generic query fan-out, `/priv/*`, Blob/SAS URLs |
| `admin.alive.org.tw` | `api-gateway` routes to `hhc-web` | admin console UI only | backend APIs, internal routes |
| `account.alive.org.tw` | `api-gateway` routes UI to `account-fe` and API/OIDC/JWKS/token paths to `account-api` | account UI/API/OIDC/JWKS/token | CMS/admin content APIs |
| `/priv/*` | internal service invocation | service-to-service commands and queries | browser calls, public gateway routing |

There is no `api.alive.org.tw`.

## Caller Allowlist Matrix

Allowed v1 calls:

| Caller | Callee | Mode | Allowed Reason |
| --- | --- | --- | --- |
| browser | `api-gateway` | HTTPS | public UI/API and admin/account routes |
| `api-gateway` | `account-api` | cached JWKS pull | startup/refresh only; no per-request introspection |
| `api-gateway` | backend services | route forwarding | one upstream per route; no business aggregation |
| `hhc-web` | `hhc-web-api` | HTTPS through gateway | website public/admin data |
| `hhc-web` / admin UI | `account-fe` + `account-api` | HTTPS through account host | OAuth login/account flows |
| `hhc-web-api` | `asset-api` | `/priv/assets/*` command/query | upload sessions, grants, stable public URL lookup |
| `hhc-web-api` | `notification-api` | `/priv/notifications/*` command | optional CMS/contact/publish notifications |
| `hhc-web-api` | `audit-log` | outbox append and protected query | audit append and admin audit screen |
| `asset-api` | `audit-log` | outbox append | asset lifecycle/security audit |
| `notification-api` | `audit-log` | outbox append | delivery lifecycle audit |
| `account-api` | `notification-api` | `/priv/notifications/*` command | verification, reset, invitation messages |
| `account-api` | `audit-log` | outbox append | identity and admin lifecycle audit |
| `hhc-line-function-bot` | `hhc-web-api` | public HTTPS read | latest/specific weekly bulletin |
| `hhc-line-function-bot` | `asset-api` | future `/priv/assets/*` command | LINE-owned file namespaces only |

Disallowed v1 calls:

- Browser or LINE users calling `/priv/*`.
- Gateway calling multiple business services to compose one response.
- `hhc-web-api` reading `asset`, `audit`, `notification`, or `account` tables directly.
- `asset-api` calling `hhc-web-api` to understand CMS meaning.
- `notification-api` deciding who should receive domain messages.
- `audit-log` enriching events by calling producer services.
- `hhc-line-function-bot` constructing Blob URLs or public asset URLs.
- Any service using another service's Redis key prefix, Blob path convention, or migration files.

## Data Ownership Matrix

| Data | Source Of Truth | May Copy To | Copy Rule |
| --- | --- | --- | --- |
| access token claims | `account-api` | gateway trusted headers for one request | short-lived; services do not persist as user profile |
| refresh tokens and token families | `account-api` | nowhere | never exposed to gateway or feature services |
| role bundles and scopes | `account-api` plus authorization governance | gateway route policy and service policy metadata | drift checks required |
| public pages/news/videos/locations/history | `hhc-web-api` | public projections, public search docs | published-only, versioned, rebuildable |
| weekly bulletin metadata | `hhc-web-api` | public projection, LINE response | latest pointer changes only after PDF grant ready |
| weekly bulletin PDF bytes | `asset-api` | Blob provider only | public download through stable gateway URL |
| asset grants and visibility | `asset-api` | consumer projection may store stable URL after grant | no direct Blob/SAS URL copy |
| notification template and delivery state | `notification-api` | audit metadata subset | no raw message body in audit |
| audit event evidence | `audit-log` | admin response models through `hhc-web-api` | append-only; sensitive metadata redacted by policy |
| LINE group context | `hhc-line-function-bot` | asset namespace metadata when storing files | asset owns bytes; bot owns LINE meaning |
| public cache entries | Redis under owning service prefix | nowhere | rebuildable from PostgreSQL |
| lifecycle ledger entries | owning service | recovery reports | used for deletion/redaction/restore reconciliation |

## Reusable Capability Contracts

### Asset Capability

Use `asset-api` when the caller needs reusable file mechanics:

- upload session
- MIME/size/checksum metadata
- scan status
- derivative generation
- visibility and grants
- stable public/protected download URL
- retention and recovery mechanics

Do not use `asset-api` as a business attachment database. The consumer must own:

- why the file exists
- which domain record references it
- whether a business transition should grant or revoke visibility
- who can see the file in that domain context

Examples:

- weekly bulletin PDF: `hhc-web-api` owns issue; `asset-api` owns PDF bytes and public grant
- news cover image: `hhc-web-api` owns news article; `asset-api` owns image object and derivatives
- LINE group file: bot owns group/message context; `asset-api` owns object bytes and restricted grants
- desktop cloud folder object: future desktop app service owns sync metadata; `asset-api` owns bytes

### Notification Capability

Use `notification-api` when a domain has already decided that a message should be sent.

`notification-api` owns:

- template catalog and versioning
- rendering
- provider adapter
- retry and delivery state
- provider callbacks
- suppression mechanics

The caller owns:

- recipient eligibility
- consent
- message purpose
- domain timing
- domain resource id

This prevents `notification-api` from becoming a newsletter service, event scheduler, CRM, or workflow engine.

### Audit Capability

Use `audit-log` for protected writes, permission denials, lifecycle transitions, security events, and sensitive admin reads.

`audit-log` owns validation, storage, retention, query authorization, and export of evidence. Producers own the business meaning and must keep metadata minimal.

Audit must not become:

- analytics
- operational reporting
- event sourcing
- a recovery source for domain state
- an enrichment service that calls producers during query

### Website Public Projection Capability

Use `hhc-web-api` public projections for website-owned public data:

- home
- site layout
- news
- pages
- videos
- locations
- weekly bulletins
- public search when enabled

Do not create `public-query-api` or gateway aggregation for this. If another domain later owns public data, it can publish a public-safe summary event or provider API, and `hhc-web-api` can consume it only when the future-domain extraction rules allow.

## Service Admission Gate

Before adding a new service, the proposal must prove at least one strong trigger:

- data sensitivity requires a separate boundary
- the domain has a lifecycle that is not CMS/content lifecycle
- the domain has independent deploy/rollback risk
- external provider callbacks or credentials create separate risk
- multiple consumers need the same domain capability
- scale or worker behavior cannot be handled cleanly inside the owning service
- the service owns a data model that should not be visible to current service code

Convenience is not enough. The following are weak triggers and should be rejected by default:

- "the route list is getting long"
- "the UI page has its own menu item"
- "we might need it later"
- "the table name is different"
- "a generic API would make frontend fetching easier"
- "this could be shared someday"

If a weak trigger becomes a real problem, solve it first with modules, packages, projections, or adapters inside the current owning service.

## Service Readiness Checklist

A new service cannot receive production traffic until it has:

- service purpose and non-goals
- source-of-truth schema ownership
- OpenAPI contract for public/admin/internal routes
- `/priv/*` caller allowlist if internal
- authorization policy entries and denied-path tests
- data classification and retention rules
- migrations and rollback/roll-forward notes
- generated or adapter-wrapped clients
- outbox/idempotency strategy for side effects
- worker/job ownership, trigger, idempotency key, job ledger, and schedule policy when background work is required
- health, ready, metrics, logs, traces
- dashboard and runbook
- SLO tier and alert ownership
- local dev profile and CI test dependencies
- release manifest and smoke test
- dependency register update

If any item is missing, the feature can still be a module inside an existing service, but it is not ready to be an independent deployable.

## Extraction Playbook

When extracting a domain from `hhc-web-api` or another service:

1. Document the trigger and target owner.
2. Freeze the existing public/admin API path unless a versioned break is explicitly approved.
3. Add the new service contract and generated adapter behind a feature flag.
4. Create the target schema and run additive migrations.
5. Backfill using a migration job or export/import, not cross-service SQL.
6. Build consumer-owned read models or provider APIs for reads.
7. Dual-read or shadow-read in staging.
8. Move writes after idempotency and rollback paths are verified.
9. Keep old tables read-only until reconciliation passes.
10. Remove old tables only in a later cleanup release.

Extraction must preserve audit continuity by keeping stable resource ids or emitting mapping events.

## Review Rules

Every architecture review should check:

- Does the proposed service own a real domain decision, or only a route group?
- Can the caller complete with an outbox side effect instead of a synchronous call?
- Is the source of truth still singular?
- Is there any direct table, Redis, Blob, or provider coupling across service boundaries?
- Is the reusable service being used for mechanics while the consumer owns business meaning?
- Does the route live under the correct host and prefix?
- Are authorization, data classification, and release gates updated?
- Is the background work owned by the service with the data, or is a generic scheduler being introduced without a domain reason?
- Is the operational cost justified by risk reduction?

## Acceptance Criteria

- The v1 deployable set is explicit and finite.
- `hhc-web-api` is clearly the website backend and CMS core, not a generic platform aggregator.
- `asset-api`, `notification-api`, and `audit-log` are reusable capabilities with narrow ownership.
- Future service candidates have admission gates and extraction playbooks.
- `public-query-api`, `cms-api`, `bulletin-api`, `authorization-api`, `scheduler-api`, `job-api`, and other premature services are explicitly rejected for v1.
- Every service has a source-of-truth owner, route surface, allowed caller set, data boundary, SLO tier, and release evidence expectation.
- Reuse happens through stable contracts, not shared databases, Blob URLs, Redis keys, or shared domain-model packages.
