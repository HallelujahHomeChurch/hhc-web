# HHC Web Platform Detailed Architecture

## Purpose

This document turns the HHC web platform direction into implementation-level architecture decisions. It is the source of truth for service boundaries, API ownership, database ownership, cache policy, asset rules, internal events, and LINE bot weekly bulletin integration.

Companion documents:

- API contracts live under `docs/api/`.
- Service catalog, reusable capability ownership, allowed caller matrix, and service admission/extraction gates live in `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`.
- Account token contract lives in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.
- Account administrator identity lifecycle, invitations, role assignment, offboarding, and emergency access removal live in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.
- Gateway authentication design lives in `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`.
- Internal service identity and private route authorization live in `docs/superpowers/specs/2026-07-08-hhc-internal-service-identity-and-private-route-design.md`.
- Authorization policy, permission catalog, role/scope governance, resource-level checks, policy drift control, and authorization release gates live in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.
- Browser security header, CORS, CSRF, CSP, cookie, and cache profiles live in `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`.
- Public third-party links, embeds, analytics, consent, provider registry, and provider-scoped CSP rules live in `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.
- Data classification, privacy, retention, deletion, and redaction rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.
- Cross-service lifecycle ledger, legal hold, retention worker, privacy request, and restore reconciliation rules live in `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`.
- Platform API standards live in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`.
- API contract governance lives in `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.
- Configuration, feature flags, kill switches, provider adapters, and release controls live in `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`.
- Deployment compatibility, release manifests, migration protocol, API/client compatibility, gateway release gates, ACA revision strategy, rollback, and roll-forward rules live in `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`.
- Cross-service dependency, query ownership, read-model duplication, synchronous call budgets, anti-corruption adapters, and dependency tests live in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.
- Abuse prevention, rate limits, quotas, WAF adoption criteria, and provider reputation protection live in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.
- HHC web API service design lives in `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`.
- HHC web API PostgreSQL schema design lives in `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`.
- Public projection and cache invalidation design lives in `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`.
- Publication workflow consistency, grant-before-visible publish, stale side-effect cancellation, emergency takedown, and reconciliation rules live in `docs/superpowers/specs/2026-07-08-hhc-publication-workflow-consistency-and-reconciliation-design.md`.
- Site settings, navigation, footer links, social links, contact display, shared layout projection, and runtime-config separation live in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.
- Public SEO, URL, slug, redirect, sitemap, robots, and metadata design lives in `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`.
- Public accessibility, performance, media, image derivative, and admin keyboard-flow design lives in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.
- Public/admin search design, PostgreSQL search documents, public projection safety, CJK tokenization, and `search-api` extraction triggers live in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.
- CMS editorial workflow lives in `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`.
- CMS admin preview, draft rendering, revision preview, protected draft asset preview, and preview leak-prevention design lives in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.
- CMS content versioning, restore to draft, rollback publish, and revision retention live in `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.
- CMS structured content block schema, safe renderer contract, inline link validation, body asset references, and schema migrations live in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.
- CMS localization, source locale, translation status, stale translation, fallback policy, per-locale publish, localized slug, SEO alternate, and weekly bulletin locale rules live in `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.
- Content domain model lives in `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md`.
- Content migration and bootstrap design lives in `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`.
- HHC web rendering and delivery design lives in `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`.
- Security, RBAC, and threat model live in `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`.
- Service implementation standards live in `docs/superpowers/specs/2026-07-08-hhc-web-service-implementation-blueprint.md`.
- Cloud runtime and operations design lives in `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`.
- Cloud Infrastructure as Code, resource naming/tagging, Azure DevOps workload identity, managed identities, drift checks, and infra release gates live in `docs/superpowers/specs/2026-07-08-hhc-cloud-infrastructure-iac-and-resource-governance-design.md`.
- Software supply chain, SBOM/provenance, immutable image digest promotion, ACR governance, vulnerability gates, release artifact security, and compromised-artifact response live in `docs/superpowers/specs/2026-07-08-hhc-software-supply-chain-artifact-provenance-and-release-security-design.md`.
- Production go-live, DNS/TLS, custom domains, first-admin bootstrap, HSTS staging, traffic cutover, Front Door/CDN adoption gates, and launch rollback live in `docs/superpowers/specs/2026-07-08-hhc-production-go-live-edge-routing-and-cutover-design.md`.
- Platform backup, restore, RPO/RTO targets, restore quarantine, data-store recovery behavior, and DR evidence packets live in `docs/superpowers/specs/2026-07-08-hhc-platform-backup-restore-and-disaster-recovery-design.md`.
- SLO, observability, alerting, runbook, capacity, and cost guardrails live in `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`.
- Production incident command, service runbooks, SEV lifecycle, evidence capture, operational drills, and promotion gates live in `docs/superpowers/specs/2026-07-08-hhc-production-runbook-and-incident-operations-design.md` and `docs/runbooks/`.
- Background jobs, scheduled tasks, manual/backfill jobs, service-owned worker apps, ACA Jobs selection, job ledgers, leases, checkpoints, and scheduler non-service decisions live in `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`.
- Asset lifecycle and access design lives in `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`.
- Asset ingestion, processing, and download pipeline design lives in `docs/superpowers/specs/2026-07-08-hhc-asset-ingestion-processing-download-design.md`.
- Eventing, outbox, and reliability rules live in `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`.
- Event contract envelope, event naming, schema ownership, compatibility, replay, and privacy rules live in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.
- Notification API design lives in `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`.
- Audit log design lives in `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.
- LINE bot consumer integration lives in `docs/superpowers/specs/2026-07-08-hhc-line-bot-platform-integration.md`.
- Future domain extension strategy lives in `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`.
- Rollout and verification rules live in `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`.
- Architecture completion audit lives in `docs/superpowers/specs/2026-07-08-hhc-platform-architecture-completion-audit.md`.

The design favors modular services where they reduce coupling and increase reuse, not microservices for their own sake. The v1 split is:

- `api-gateway`: public ingress, routing, local JWT validation, rate limiting, CORS, trusted identity headers.
- `account-api`: account domain, OIDC/OAuth2, token issue/refresh/revocation, admin invitations, role lifecycle, JWKS.
- `hhc-web`: public website and admin console frontend.
- `hhc-web-api`: main website backend and CMS core for v1.
- `asset-api`: generic binary/object capability.
- `notification-api`: internal notification command capability.
- `audit-log`: internal append-only audit capability.
- `hhc-line-function-bot`: LINE interaction service and future consumer of published website data.

There is no v1 `config-api`. Services own typed startup config and domain settings. Feature flags and kill switches are release and incident controls, not a reason to create a new microservice.

There is no v1 `abuse-api`. Gateway owns coarse route limits while services own domain-specific quotas and durable abuse decisions.

There is no v1 `supply-chain-api`, `artifact-api`, `sbom-api`, `vulnerability-api`, or `release-security-api`. Source-to-production trust is handled by protected repositories, Azure DevOps pipelines, SBOM/provenance artifacts, private ACR, immutable image digests, scan gates, release manifests, and protected production promotion.

There is no v1 `scheduler-api`, `job-api`, `worker-api`, `workflow-api`, or `cron-api`. Background work belongs to the service that owns the data and business decision; separate worker apps or ACA Jobs are runtime shapes, not new domain services.

There is no `api.alive.org.tw`. Every non-account public API path is under `www.alive.org.tw/api/*`.

`hhc-web` starts from the current static-export site, but v1 CMS/API-backed production rendering uses a Next.js server behind `api-gateway`. It remains UI only; platform API routes stay in backend services behind the gateway.

## Boundary Decisions

### Why `hhc-web-api` Owns CMS In V1

CMS content, public projections, and the public website backend should stay together in v1 because they share one product surface, one admin workflow, one deployable business capability, one PostgreSQL schema, and one cache invalidation model. Splitting a standalone `cms-api` now would add service discovery, auth, events, retries, schema ownership, CI/CD, and operational cost without a separate scaling or ownership reason.

`hhc-web-api` can be split later when one of these becomes true:

- CMS has a separate team or release cadence.
- CMS write traffic or import jobs require independent scaling.
- External consumers need CMS write/read contracts that are independent from the HHC website.
- CMS content grows into multiple products beyond the church website.

Even after a future split, public website reads should not become gateway-level fan-out. The owning product backend or a justified read/query service must own the read model and consistency contract.

### Why `account-api` Owns Admin Identity Lifecycle

Admin invitations, role assignment, session revoke, suspend, disable, and offboarding are security-domain responsibilities, not CMS responsibilities. Keeping them in `account-api` prevents every feature service from inventing user-management logic and keeps refresh-token revocation, account state, account audit, and role freshness in one place.

`hhc-web-api` receives trusted gateway headers and enforces CMS domain rules. It does not own user records, invitations, refresh token families, or role assignment. `cms.admin` and `account.admin` are separate grants even if the same person holds both in v1.

### Why `asset-api` Is Separate From Day One

Assets are a reusable infrastructure capability. Weekly PDFs, news images, page images, LINE group files, and desktop cloud-folder objects share upload sessions, Blob storage, MIME/type metadata, scan status, visibility, grants, retention, derivatives, and download policy. They do not share business meaning.

Therefore:

- `asset-api` owns bytes, metadata, grants, visibility, scans, and stable download URLs.
- Consumer services own the domain record and decide when an asset becomes public, private, or restricted.
- Public clients never receive Azure Blob URLs or SAS URLs; they receive gateway URLs.

### Why `notification-api` Is Internal

Email and future notifications are cross-domain side effects. Account verification, admin invites, CMS publish notices, contact forms, event registration, reminders, and LINE/admin alerts should not each integrate provider APIs directly.

`notification-api` centralizes templates, provider adapters, retries, delivery status, suppression, rate limiting, and audit. It is only reachable through internal `/priv/*`.

### Why `audit-log` Is Separate From Day One

Protected admin and file operations need a durable cross-service audit trail. A separate `audit-log` avoids every service inventing a query model and retention policy. Services emit audit events through internal service identity and keep their own business transaction independent.

Audit writes should be best-effort but observable. Business writes must not silently disappear if audit is down; failed audit emission should be logged and retried through the service outbox.

## Public Ingress And Routing

Cloud ingress, environment separation, networking, secrets, rollout, rollback, and recovery rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cloud-runtime-operations-design.md`.

### Domains

| Host | Responsibility |
| --- | --- |
| `www.alive.org.tw` | Public website and every non-account API route |
| `admin.alive.org.tw` | Admin console UI only |
| `account.alive.org.tw` | Account UI, account APIs, OIDC/OAuth2, token, JWKS |

### Gateway Route Policy

| Route | Auth | Upstream | Notes |
| --- | --- | --- | --- |
| `GET /api/home` | public | `hhc-web-api` | Published projection only |
| `GET /api/news*` | public | `hhc-web-api` | Published news only |
| `GET /api/pages/*` | public | `hhc-web-api` | Published pages only |
| `GET /api/videos` | public | `hhc-web-api` | Published videos only |
| `GET /api/locations` | public | `hhc-web-api` | Published/active locations |
| `GET /api/history` | public | `hhc-web-api` | Published history timeline |
| `GET /api/legal/*` | public | `hhc-web-api` | Published legal pages |
| `GET /api/site-layout` | public | `hhc-web-api` | Published shared layout/settings projection |
| `GET /api/bulletins*` | public | `hhc-web-api` | Published bulletins only |
| `GET /api/sitemap-data` | public | `hhc-web-api` | Published routes only |
| `GET /api/search` | public | `hhc-web-api` | Post-v1 published projection-derived search only |
| `/api/admin/*` | JWT + role/scope | `hhc-web-api` | CMS/admin operations |
| `GET /api/admin/search/content` | JWT + `cms:read` | `hhc-web-api` | Post-v1 protected CMS search, no-store |
| `GET /api/admin/preview/*` | JWT + `cms:read` | `hhc-web-api` | Admin-only draft/revision render model, no-store |
| `GET /api/assets/public/{assetId}` | public | `asset-api` | Only public, clean, ready assets |
| `GET /api/assets/protected/{assetId}` | JWT | `asset-api` | Authenticated/restricted assets |
| `/api/assets/admin/*` | JWT + asset scope | `asset-api` | Admin asset operations |
| `POST /api/line/webhook/*` | LINE signature, no JWT | `hhc-line-function-bot` | POST only, rate-limited |
| `POST /api/notifications/provider-webhooks/{provider}` | provider signature, no JWT | `notification-api` | Optional delivery/bounce callback only |
| `/priv/*` | blocked | none | Never public |
| `/api/priv/*` | blocked | none | Never public |

### Trusted Headers

Gateway must strip client-supplied identity headers before routing:

- `X-HHC-*`
- `X-User-ID`
- `X-Roles`
- `X-Permissions`
- `X-Forwarded-User`

Gateway may inject only these trusted headers:

- `X-HHC-User-ID`
- `X-HHC-Roles`
- `X-HHC-Scopes`
- `X-HHC-Token-ID`
- `X-HHC-Session-ID`
- `X-HHC-Request-ID`
- `X-HHC-Auth-Provider`

Backend services must reject protected operations when required trusted headers are missing. This is defense in depth, even when gateway routing is correct.

## JWT And Account Contract

Detailed account token, refresh, JWKS, and browser token-handling rules are specified in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

Detailed admin invitation, role grant/revoke, suspend, disable, offboarding, account-domain API, and emergency access removal rules are specified in `docs/superpowers/specs/2026-07-08-hhc-account-admin-identity-rbac-lifecycle-design.md`.

Detailed gateway verifier behavior, Nginx `auth_request` integration, JWKS rotation, trusted headers, failure modes, and test matrix are specified in `docs/superpowers/specs/2026-07-08-hhc-api-gateway-authentication-design.md`.

### Access Token Claims

Access tokens issued by `account-api` must include:

```json
{
  "iss": "https://account.alive.org.tw",
  "aud": "hhc-api",
  "sub": "user_123",
  "typ": "access",
  "exp": 1783500000,
  "nbf": 1783499100,
  "iat": 1783499100,
  "jti": "token_abc",
  "sid": "session_123",
  "client_id": "hhc-admin",
  "roles": ["cms.editor"],
  "scope": "cms:read cms:write assets:write"
}
```

### Gateway Validation

Gateway validates locally:

- JWT structure and supported signing algorithm.
- Signature using cached JWKS by `kid`.
- `iss` equals `https://account.alive.org.tw`.
- `aud` contains `hhc-api`.
- `typ` equals `access`.
- `exp` and `nbf` are valid with small clock skew.
- Route-required roles/scopes are present.

Gateway must not call `account-api` per request. It can fetch and refresh JWKS in the background.

### Token Lifetimes

- Access token: 5-15 minutes.
- Refresh token: rotated and revocable by `account-api`.
- Logout/device revocation: revoke refresh token; existing access token expires naturally.
- Role downgrade, suspend, and disable: revoke affected refresh token families; existing access tokens expire naturally.
- Emergency access-token revoke list: optional Redis denylist keyed by `jti`, only for high-risk admin incidents.

### JWKS Cache

- Refresh interval: 5-15 minutes.
- Max stale key use: 24 hours only when the last refresh failed and the key is not expired by local policy.
- Unknown `kid`: force one refresh, then fail closed if still unknown.
- Empty JWKS cache on startup: admin/protected routes fail closed until keys are fetched.

## Shared API Standards Summary

The canonical API standards live in `docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md`. This section is a summary for the platform architecture.

### Envelope

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

Failure:

```json
{
  "data": null,
  "meta": {
    "requestId": "req_123"
  },
  "error": {
    "code": "forbidden",
    "message": "Forbidden"
  }
}
```

### Error Codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `bad_request` | 400 | Invalid syntax or unsupported query |
| `unauthenticated` | 401 | Missing/invalid token |
| `forbidden` | 403 | Valid token without required permission |
| `not_found` | 404 | Resource does not exist or is not visible |
| `conflict` | 409 | Version or publish-state conflict |
| `payload_too_large` | 413 | Upload/request exceeds configured limit |
| `unsupported_media_type` | 415 | Asset MIME type not allowed |
| `validation_failed` | 422 | Field-level validation failed |
| `rate_limited` | 429 | Gateway or service rate limit |
| `dependency_unavailable` | 503 | DB, Redis, Blob, or provider unavailable |

### Locale

Supported locale keys:

- `zh-Hant`
- `zh-Hans`
- `en`

Public read APIs accept `locale`. If missing, default to `zh-Hant`. Do not silently fall back to a different locale for detail pages unless the response includes `meta.fallbackLocale`.

## `hhc-web-api` Detail

### Responsibilities

`hhc-web-api` owns:

- Website CMS records.
- Admin draft/publish workflows.
- Admin-only preview render models for saved drafts and revisions.
- Content revision snapshots, restore to draft, and rollback publish.
- Structured body block validation, safe render model conversion, inline link validation, and body asset reference extraction.
- Public read APIs for published website content.
- Editable public site settings, navigation, footer links, social links, contact display, and site SEO defaults.
- Weekly bulletin issue/version model.
- Public projection cache.
- Domain validation before granting asset visibility.
- CMS-related audit event emission.

It does not own:

- File bytes.
- Account login/token/session state.
- Notification provider delivery.
- General asset scanning or derivatives.

### PostgreSQL Schema Summary: `hhc_web`

Use a single schema for CMS source and public projections. Detailed DDL, indexes, constraints, optimistic concurrency, seed provenance, and migration rules are specified in `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`.

Core tables:

```sql
content_item(
  id uuid primary key,
  type text not null,
  status text not null,
  slug text,
  translation_group_id uuid not null,
  created_by text not null,
  updated_by text not null,
  published_by text,
  published_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

`type` values:

- `news`
- `page`
- `video`
- `location`
- `history`
- `legal`
- `home_section`

`status` values:

- `draft`
- `published`
- `unpublished`
- `archived`

```sql
content_locale(
  id uuid primary key,
  content_item_id uuid not null,
  locale text not null,
  title text not null,
  summary text,
  body_json jsonb not null,
  seo_json jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(content_item_id, locale)
)
```

```sql
content_asset_ref(
  id uuid primary key,
  content_item_id uuid not null,
  locale text,
  asset_id text not null,
  purpose text not null,
  sort_order int not null default 0,
  created_at timestamptz not null
)
```

`purpose` values:

- `cover`
- `inline`
- `thumbnail`
- `attachment`

```sql
bulletin_issue(
  id uuid primary key,
  issue_date date not null unique,
  status text not null,
  created_by text not null,
  updated_by text not null,
  published_by text,
  published_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

```sql
bulletin_version(
  id uuid primary key,
  issue_id uuid not null,
  locale text not null,
  title text not null,
  pdf_asset_id text not null,
  file_name text not null,
  status text not null,
  created_by text not null,
  published_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(issue_id, locale)
)
```

```sql
public_projection(
  key text primary key,
  locale text not null,
  resource_type text not null,
  resource_id text not null,
  version bigint not null,
  payload_json jsonb not null,
  published_at timestamptz not null,
  updated_at timestamptz not null
)
```

```sql
publication_workflow(
  id uuid primary key,
  workflow_type text not null,
  resource_type text not null,
  resource_id text not null,
  locale text,
  aggregate_version bigint not null,
  status text not null,
  required_asset_ids text[] not null default '{}',
  optional_asset_ids text[] not null default '{}',
  projection_keys text[] not null default '{}',
  idempotency_key text not null,
  requested_by text not null,
  reason text,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  unique(workflow_type, resource_type, resource_id, locale, aggregate_version)
)
```

Publication workflows coordinate publish, unpublish, rollback publish, emergency takedown, and projection rebuilds when remote side effects such as asset grants must complete before public visibility changes.

```sql
outbox_event(
  id uuid primary key,
  event_type text not null,
  cloud_event_id text not null,
  cloud_event_source text not null,
  cloud_event_type text not null,
  cloud_event_subject text,
  data_schema text not null,
  classification text not null,
  visibility text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version bigint,
  destination text not null,
  idempotency_key text not null,
  payload_json jsonb not null,
  status text not null,
  attempts int not null default 0,
  max_attempts int not null default 12,
  next_attempt_at timestamptz not null,
  locked_by text,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  unique(destination, idempotency_key),
  unique(cloud_event_source, cloud_event_id)
)
```

`payload_json` stores the full CloudEvents-compatible envelope, including `data`. Outbox status values, worker leasing, retry, dead-letter, and idempotency rules follow `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`. Event names, schema locations, compatibility windows, replay behavior, and data classification rules follow `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.

### Public Bulletin API

Latest:

`GET /api/bulletins/latest?locale=zh-Hant`

Specific:

`GET /api/bulletins/2026-07-12?locale=zh-Hant`

Archive:

`GET /api/bulletins?locale=zh-Hant&page=1&pageSize=20`

Response:

```json
{
  "data": {
    "id": "bulletin_2026_07_12",
    "issueDate": "2026-07-12",
    "locale": "zh-Hant",
    "title": "2026-07-12 週報",
    "assetId": "asset_123",
    "downloadUrl": "https://www.alive.org.tw/api/assets/public/asset_123",
    "mimeType": "application/pdf",
    "sizeBytes": 1234567,
    "publishedAt": "2026-07-12T00:00:00Z"
  },
  "meta": {
    "requestId": "req_123"
  },
  "error": null
}
```

### Bulletin Publish Transaction

Publishing a bulletin version must:

1. Validate caller has `cms.publisher` or `cms.admin`.
2. Validate issue/version exists.
3. Validate `pdf_asset_id` belongs to `hhc-web-api`.
4. Validate asset namespace is `cms.weekly.pdf`.
5. Validate asset MIME type is `application/pdf`.
6. Validate asset scan status is `clean`.
7. Create a `publication_workflow` in `waiting_asset_grant`.
8. Insert versioned outbox commands to create the public read grant.
9. Emit audit `cms.bulletin.publish_requested` through outbox.
10. Return `202 Accepted` unless the workflow completes within the request budget.
11. After `asset-api` confirms the public grant, re-read source version.
12. If still current, set bulletin issue/version status to `published`.
13. Upsert `public_projection` for latest/archive/detail.
14. Refresh public search/sitemap/Redis keys as applicable.
15. Mark workflow `public_visible`.
16. Emit audit event through outbox:
    - `cms.bulletin.publish_completed`

Weekly bulletin public routes and LINE bot latest reads must not see the new issue until step 13 commits.

Unpublish reverses public visibility:

1. Set issue/version status to `unpublished`.
2. Remove or update public projection.
3. Insert high-priority outbox to revoke public read grant from `asset-api` when no other published projection references the PDF.
4. Emit:
    - `bulletin.version.unpublished`
    - `public_projection.invalidated`
    - `cms.bulletin.unpublish`

## `asset-api` Detail

### PostgreSQL Schema: `asset`

```sql
asset(
  id text primary key,
  namespace text not null,
  owner_service text not null,
  owner_type text not null,
  owner_id text not null,
  purpose text not null,
  locale text,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum_sha256 text not null,
  storage_container text not null,
  storage_key text not null,
  visibility text not null,
  scan_status text not null,
  processing_status text not null,
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz
)
```

```sql
asset_upload_session(
  id text primary key,
  namespace text not null,
  owner_service text not null,
  owner_type text not null,
  owner_id text not null,
  expected_mime_type text,
  max_size_bytes bigint not null,
  status text not null,
  upload_url_expires_at timestamptz not null,
  created_by text not null,
  created_at timestamptz not null,
  completed_at timestamptz
)
```

```sql
asset_grant(
  id uuid primary key,
  asset_id text not null,
  subject_type text not null,
  subject_id text not null,
  permission text not null,
  expires_at timestamptz,
  created_by_service text not null,
  created_at timestamptz not null,
  revoked_at timestamptz
)
```

```sql
asset_derivative(
  id uuid primary key,
  asset_id text not null,
  kind text not null,
  mime_type text not null,
  width int,
  height int,
  size_bytes bigint not null,
  storage_key text not null,
  created_at timestamptz not null
)
```

### Visibility Rules

| Visibility | Public route | Protected route | Internal route |
| --- | --- | --- | --- |
| `public` | allowed if clean/ready | allowed | allowed |
| `authenticated` | denied | any valid account user | allowed |
| `restricted` | denied | valid user with matching grant | allowed with service grant |
| `private` | denied | denied unless explicit grant | owner service only |

### Grant Subjects

`subject_type` values:

- `public`
- `user`
- `role`
- `line_group`
- `service`
- `app_client`

Weekly bulletin public grant:

```json
{
  "assetId": "asset_123",
  "subjectType": "public",
  "subjectId": "*",
  "permission": "read",
  "createdByService": "hhc-web-api"
}
```

LINE group file restricted grant:

```json
{
  "assetId": "asset_line_123",
  "subjectType": "line_group",
  "subjectId": "Cxxxxxxxx",
  "permission": "read",
  "createdByService": "hhc-line-function-bot"
}
```

### Download URL Policy

`asset-api` can internally stream from Blob or create short-lived Blob access behind the service, but public consumers receive only:

```json
{
  "downloadUrl": "https://www.alive.org.tw/api/assets/public/asset_123"
}
```

This keeps URLs stable, allows gateway/CDN policy, and avoids leaking cloud-provider storage details.

## `notification-api` Detail

Detailed template, provider adapter, suppression, provider webhook, ownership, and status lifecycle rules are specified in `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`.

### PostgreSQL Schema: `notification`

```sql
notification_template(
  id text primary key,
  channel text not null,
  locale text not null,
  subject_template text,
  body_template text not null,
  version int not null,
  active boolean not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
)
```

```sql
notification_message(
  id uuid primary key,
  template_id text not null,
  channel text not null,
  recipient text not null,
  payload_json jsonb not null,
  status text not null,
  attempts int not null default 0,
  next_attempt_at timestamptz not null,
  provider_message_id text,
  error_code text,
  error_message text,
  requested_by_service text not null,
  requested_at timestamptz not null,
  sent_at timestamptz,
  delivered_at timestamptz
)
```

Internal send command:

`POST /priv/notifications/send`

```json
{
  "templateId": "cms.publish-summary",
  "channel": "email",
  "recipient": "admin@example.com",
  "locale": "zh-Hant",
  "payload": {
    "title": "2026-07-12 週報",
    "publishedBy": "user_123"
  },
  "idempotencyKey": "cms.publish-summary:bulletin_2026_07_12"
}
```

## `audit-log` Detail

The complete audit service design lives in `docs/superpowers/specs/2026-07-08-hhc-audit-log-design.md`.

Core rules:

- `audit-log` is internal-only under `/priv/audit/*`.
- Producers write audit intent into their own outbox when protected writes commit.
- `eventId` is producer-generated and idempotent.
- Metadata is allowlisted per action to avoid leaking tokens, raw bodies, provider secrets, or sensitive pastoral/member data.
- Admin console audit reads go through `hhc-web-api`; browsers never call `audit-log` directly.
- Audit reads require `audit:read`; sensitive metadata requires `audit:sensitive_read`.
- Events are append-only. Corrections are new events, not row edits.
- Retention is class-based and implemented through partition maintenance.

### PostgreSQL Schema Summary: `audit`

```sql
audit_event(
  id uuid primary key,
  event_id text not null unique,
  schema_version int not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  request_id text not null,
  correlation_id text null,
  trace_id text null,
  source_service text not null,
  source_environment text not null,
  actor_type text not null,
  actor_id text not null,
  actor_id_hash text null,
  action text not null,
  category text not null,
  resource_owner_service text not null,
  resource_type text not null,
  resource_id text not null,
  outcome text not null,
  severity text not null,
  metadata_json jsonb not null,
  metadata_classification text not null,
  source_ip_hash text null,
  user_agent_hash text null,
  retention_class text not null,
  payload_hash text not null,
  exported_at timestamptz null
)
```

Required fields:

- `actor_type`: `user`, `service`, `system`, `provider`
- `actor_id`: account subject, service app id, or approved hashed external id
- `source_service`: emitting service
- `action`: stable event action
- `resource_type`: domain resource
- `resource_id`: stable resource id
- `outcome`: `success`, `failure`, `denied`, `queued`, `cancelled`
- `severity`: `info`, `warning`, `critical`

Example:

```json
{
  "occurredAt": "2026-07-12T00:00:00Z",
  "requestId": "req_123",
  "sourceService": "hhc-web-api",
  "actorType": "user",
  "actorId": "user_123",
  "action": "cms.bulletin.publish",
  "category": "cms.bulletin",
  "resourceType": "bulletin_issue",
  "resourceId": "bulletin_2026_07_12",
  "outcome": "success",
  "severity": "info",
  "metadata": {
    "assetId": "asset_123",
    "locale": "zh-Hant"
  }
}
```

## Event And Outbox Model

Use PostgreSQL outbox inside the service that owns the transaction. Start with each service processing its own outbox worker. Add Azure Service Bus only when cross-service fan-out, delayed jobs, or volume justify it.

Detailed state machine, worker lease, retry, dead-letter, idempotency, and Service Bus adoption rules are specified in `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`.

Continuous workers, scheduled/manual ACA Jobs, job ledgers, scheduled publishing, backfill checkpoints, and scheduler non-service rules are specified in `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`.

Event envelope, canonical event type naming, JSON Schema ownership, compatibility, replay, and privacy classification rules are specified in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.

Cross-service calls and read models must follow `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`: public reads avoid service fan-out, internal commands have one owning callee, duplicated read data records source/version/classification/freshness, and adapter packages translate provider models at the boundary.

### Event Names

The table below lists planning aliases used by product/domain conversations. Produced integration events must use the canonical reverse-DNS event names defined in the event contract governance document.

| Event | Producer | Consumers |
| --- | --- | --- |
| `content.published` | `hhc-web-api` | projection worker, audit-log, notification-api optionally |
| `content.unpublished` | `hhc-web-api` | projection worker, asset-api grant revoke, audit-log |
| `content.rollback_published` | `hhc-web-api` | projection worker, asset-api grant/revoke, audit-log |
| `bulletin.version.published` | `hhc-web-api` | projection worker, asset-api grant, audit-log, LINE bot indirectly via public API |
| `bulletin.version.unpublished` | `hhc-web-api` | projection worker, asset-api grant revoke, audit-log |
| `bulletin.version.rollback_published` | `hhc-web-api` | projection worker, asset-api grant/revoke, audit-log, LINE bot indirectly via public API |
| `site_settings.published` | `hhc-web-api` | projection worker, audit-log, hhc-web indirectly via public API |
| `site_settings.rollback_published` | `hhc-web-api` | projection worker, audit-log, hhc-web indirectly via public API |
| `asset.upload.completed` | `asset-api` | asset worker, audit-log |
| `asset.scan.completed` | `asset-api` | owner service if callback is needed |
| `asset.grant.changed` | `asset-api` | audit-log |
| `notification.message.requested` | `notification-api` | notification worker, audit-log |
| `notification.message.delivered` | `notification-api` | audit-log |

### Idempotency

Every internal command that causes side effects must accept an idempotency key:

- Asset grant: `ownerService:resourceId:assetId:permission:visibility`
- Notification send: caller-provided key.
- Audit event: event id from producer.

Workers must be safe to retry after process crash.

## Cache And Projection Policy

### Redis Key Format

Use environment and locale in every public cache key:

```text
{env}:hhc-web-api:public:{locale}:{resource}:{versionOrQueryHash}
```

Examples:

- `prod:hhc-web-api:public:zh-Hant:home:v42`
- `prod:hhc-web-api:public:zh-Hant:site-layout:v12`
- `prod:hhc-web-api:public:zh-Hant:news:list:p1:s10:v18`
- `prod:hhc-web-api:public:zh-Hant:bulletins:latest:v7`
- `prod:hhc-web-api:public:zh-Hant:bulletins:2026-07-12:v1`

### TTLs

| Data | Redis TTL | CDN TTL |
| --- | --- | --- |
| Home | 30 minutes | 5 minutes |
| Site layout | 30 minutes | 5 minutes |
| News list | 30 minutes | 5 minutes |
| News detail | 60 minutes | 10 minutes |
| Bulletin latest | 30 minutes | 5 minutes |
| Bulletin archive | 60 minutes | 10 minutes |
| Asset public metadata | 60 minutes | 10 minutes |
| Admin data | no shared cache | no CDN cache |

Publishing should invalidate or version-bump relevant keys immediately. TTL is only a safety net.

### Cache Invalidation

On content publish:

- Refresh detail projection.
- Refresh list projection for that content type.
- Refresh home projection if home depends on that content.
- Emit `public_projection.refreshed`.

On unpublish:

- Remove detail projection.
- Refresh list projection.
- Refresh home projection if needed.
- Revoke related public asset grants if no other published content references the same asset.
- Emit `public_projection.invalidated`.

On site settings publish or rollback publish:

- Refresh `site_layout:{locale}` projections.
- Refresh sitemap, metadata, and home projections when navigation, footer, SEO defaults, or shared OG defaults affect them.
- Reject any value that would expose secrets, Blob/SAS URLs, internal service hosts, admin URLs, or `/priv/*` routes.
- Emit `public_projection.refreshed`.

## LINE Bot Weekly Bulletin Integration

The LINE bot should add a `download_weekly_bulletin` function. It should call public `hhc-web-api` endpoints for public bulletins.

### Bot Config

Add:

```text
HHC_WEB_API_BASE_URL=https://www.alive.org.tw/api
```

### Bot Function Arguments

```ts
type DownloadWeeklyBulletinArguments = {
  issueDate?: string;
  dateIntent?: "latest" | "specific_date";
  locale?: "zh-Hant" | "zh-Hans" | "en";
};
```

Default:

- `dateIntent`: `latest`
- `locale`: `zh-Hant`

### Bot Error Handling

| API Result | Bot Reply |
| --- | --- |
| 200 | Return title, issue date, download URL |
| 404 latest | `目前還沒有可下載的週報。` |
| 404 specific | `找不到這一期週報，請確認日期，或輸入「下載最新週報」。` |
| 503/timeout | `週報服務暫時無法使用，請稍後再試。` |
| malformed response | `週報資料格式異常，我先不提供連結。` |

### Why Public API Is Enough

Weekly bulletins are public content. Using `hhc-web-api` means LINE bot gets the same publish rules, localization, latest-issue logic, and stable asset URL as the website.

If bulletins later become member-only, do not change the public endpoint to leak private data. Add a protected endpoint or internal `/priv/bulletins/*` route and let the bot call it with service identity.

## Observability And Operations

Every service must expose:

- `GET /healthz`: process is alive.
- `GET /readyz`: dependencies are ready.
- Structured JSON logs.
- Request ID propagation.
- Metrics for latency, status code, dependency latency, cache hit/miss, and worker retries.

Readiness dependencies:

| Service | Ready When |
| --- | --- |
| `api-gateway` | Nginx config valid, verifier running, JWKS cache initialized or public-only mode clearly marked |
| `hhc-web-api` | PostgreSQL reachable, Redis reachable, internal clients configured |
| `asset-api` | PostgreSQL reachable, Blob reachable, scan worker state known |
| `notification-api` | PostgreSQL reachable, provider config valid or disabled in non-prod |
| `audit-log` | PostgreSQL reachable |
| `hhc-line-function-bot` | LINE config valid; optional dependencies reported separately |

## Deployment Order

Recommended first rollout:

1. Deploy `account-api` JWKS/token contract changes.
2. Deploy `api-gateway` JWT verifier and route policy in staging.
3. Deploy `asset-api`.
4. Deploy `hhc-web-api` with public read APIs and CMS admin APIs.
5. Wire `hhc-web` public pages to `hhc-web-api`.
6. Add weekly bulletin admin publish flow.
7. Add LINE bot weekly bulletin function.
8. Deploy `notification-api` and `audit-log` integrations where used.

Do not deploy gateway route changes that point to missing upstreams in production. Use staging route verification first.

## Architecture Acceptance Checklist

- `api-gateway` is the only public ingress for non-account APIs.
- Backend API services are not directly public; external platform API traffic enters through `api-gateway`.
- `account-api` owns login, tokens, refresh token revocation, and JWKS.
- `account-api` owns admin invitations, account roles/scopes, session revocation, suspend, disable, and offboarding.
- `cms.admin` does not automatically imply `account.admin`.
- Gateway validates access JWTs locally and does not introspect per request.
- `/priv/*` is internal-only and blocked at public ingress.
- Route-level scopes are only the first authorization layer; backend services enforce domain/resource authorization, object-level access, field-level response policy, and asset grants according to the authorization governance spec.
- `hhc-web-api` owns v1 CMS content and public projections.
- Gateway routes and verifies; it does not compose business data from multiple services.
- Public website reads use `hhc-web-api` projections or a future explicitly owned read/query service, not per-request fan-out.
- Admin preview is authenticated admin-only and creates no public projections, sitemap routes, public Redis keys, ETag pointers, or public asset grants.
- CMS body content uses versioned structured blocks and a renderer whitelist; public and preview surfaces do not render raw CMS HTML.
- `hhc-web-api` owns editable public site settings in v1; runtime config and frontend UI chrome remain separate.
- Public search stays in `hhc-web-api` first and uses projection-derived search documents; `search-api` is added only after documented extraction triggers are met.
- `asset-api` owns bytes, grants, visibility, scan, and download policy.
- Public clients receive gateway asset URLs, not Blob URLs.
- `notification-api` is service-to-service only.
- `audit-log` is append-only and service-to-service only.
- Weekly bulletin is reusable by website and LINE bot through `hhc-web-api`.
- No service cross-queries another service's PostgreSQL schema.
- Cross-service duplicated data must have source service, source version, data classification, staleness policy, rebuild path, and deletion/redaction handling.
- New deployables and extracted services pass the service catalog admission gate before entering route policy, runtime topology, or production rollout.
- Cloud resources, managed identities, role assignments, environment names, and public ingress changes are governed by IaC and drift checks.
- Role bundles, scope catalog, gateway route policy, service authorization registry, OpenAPI route metadata, docs, and admin UI capability maps have drift checks.
- Cross-service integration events have owned JSON Schemas, committed examples, compatibility tests, replay tests, classification, visibility, and dedupe by `source + id`.
- Publish/unpublish updates projections, asset grants, audit events, and cache invalidation.
- Required-public-asset publish uses publication workflow and does not expose public projection until public asset grants are active.
- Stale publication workflows cannot re-expose unpublished or rollback-superseded content.
- Restore to draft has no public effect; rollback publish creates a new public projection version through normal publish safety checks.
- Backup restore does not promote public traffic until lifecycle ledger replay, deletion/redaction/legal-hold reconciliation, projection/search/sitemap rebuild, and asset grant checks pass.
- Backup/DR remains an IaC/runbook/service-owned reconciliation capability; no `backup-api`, `restore-api`, or `dr-api` is introduced for v1.
- Production-impacting releases require manifest, compatibility evidence, config fingerprint, and rollback or roll-forward plan before promotion.
- Production go-live requires DNS/TLS/custom-domain evidence, first-admin bootstrap evidence, seeded content/projection readiness, public/admin/account smoke tests, launch freeze, rollback target, and post-launch monitoring evidence.
- Production-routed deployables require concrete service runbooks, platform incident command linkage, and staging drill evidence before production traffic.
- Browser-facing routes require header, CORS, CSRF/origin, CSP, cookie, cache, and asset-download profile evidence before production traffic.
- Third-party public web integrations require provider registry, CMS URL validation, no arbitrary scripts/iframes, click-to-load embeds, analytics default-off or consent-gated behavior, provider-scoped CSP, and rollback evidence before production traffic.
- Multilingual CMS behavior requires source locale, translation status, stale-translation handling, explicit fallback policy, per-locale publish, locale-specific redirects, SEO alternates, and LINE bulletin locale tests before production traffic.
- Post-v1 domains use the future extension strategy before adding or extracting services.
