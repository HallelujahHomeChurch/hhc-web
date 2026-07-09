# HHC Web Future Domain Extension Strategy

This spec defines how future church website and ministry features should extend the current HHC platform without turning `hhc-web-api` into a catch-all backend or creating microservices before they are justified.

## Purpose

V1 focuses on the current visible website surface: public content, CMS, weekly bulletins, assets, notifications, audit, and LINE bot weekly download. The church platform will likely grow into contact forms, event registration, search, member workflows, small groups, pastoral care, donations, newsletters, and richer LINE workflows.

Platform-wide data classification, privacy, retention, deletion, redaction, and future sensitive-domain launch rules are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

Service catalog, reusable capability ownership, allowed caller matrix, explicit v1 non-services, service admission gates, and extraction playbooks are defined in `docs/superpowers/specs/2026-07-08-hhc-service-catalog-and-ownership-design.md`.

Abuse prevention, quotas, rate limits, and future public form protection are defined in `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

Public/admin search ownership, PostgreSQL search documents, CJK tokenization, public projection safety, and `search-api` extraction triggers are defined in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

Cross-service dependency-chain budgets, query composition rules, consumer-owned read models, and dependency-register requirements are defined in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

Event envelope, canonical event names, JSON Schema ownership, compatibility, replay, and privacy classification rules are defined in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`.

Role/scope catalog ownership, route/action metadata, resource-level authorization, field-level response policy, and authorization drift checks are defined in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

The goal is to define the service boundary rules now so future features reuse the platform safely.

## Core Decision

Use `hhc-web-api` for website content and simple website-owned workflows. Create a new service only when the feature has a distinct domain lifecycle, sensitive data boundary, external integration risk, independent scaling need, or non-website consumers.

This keeps v1 pragmatic while preserving the option to split later without rewriting identity, asset, notification, audit, and gateway foundations.

## Extension Decision Rules

Keep a feature inside `hhc-web-api` when all are true:

- The feature is primarily website content or a small website-only workflow.
- Data is public or low-sensitivity.
- The workflow is edited by the same CMS admin team.
- The feature shares the website publish/projection/cache lifecycle.
- It does not need independent deployment, workers, retention policy, or external provider integration.

Create or extract a separate service when any are true:

- It stores sensitive personal, pastoral, payment, or member data.
- It has its own admin workflow, retention rules, or permission model.
- It has heavy background jobs, retries, queues, reminders, or provider callbacks.
- It will be used by LINE bot, desktop apps, admin tools, and website equally.
- It needs independent deploy/rollback because errors affect money, privacy, attendance, or member care.
- It needs a database schema that should not be visible to CMS code.

Passing one trigger is necessary but not sufficient. A new service also needs the service catalog readiness evidence before it is added to pipelines or production routing.

## Shared Platform Capabilities

Future domains should reuse these capabilities instead of rebuilding them:

| Capability | Owner | Reuse Rule |
| --- | --- | --- |
| Public ingress and JWT verification | `api-gateway` | All non-account public APIs stay under `www.alive.org.tw/api/*` |
| Login, token, JWKS, refresh revocation | `account-api` | Do not duplicate login/session logic in feature services |
| Public website content and CMS | `hhc-web-api` | Owns content, pages, news, weekly, locations, videos, projections |
| Files and binary objects | `asset-api` | Owns bytes, scan, visibility, grants, stable download URLs |
| Email and notification commands | `notification-api` | Owns templates, provider adapters, retry, delivery status |
| Audit trail | `audit-log` | Owns append-only protected-operation history |
| Cache and short-lived state | Redis | No source-of-truth data in Redis |
| Async reliability | PostgreSQL outbox first | Add Azure Service Bus only when fan-out or volume justifies it |

## Domain Roadmap Matrix

| Domain | First Placement | Split Trigger | Reused Services | Notes |
| --- | --- | --- | --- | --- |
| Public pages, news, videos, locations, history, legal pages | `hhc-web-api` | Split only if CMS becomes a separate product/team | `asset-api`, `audit-log`, Redis | This is the v1 CMS core |
| Weekly bulletins | `hhc-web-api` module | Split only if bulletin lifecycle becomes independently owned or high-volume | `asset-api`, `audit-log`, LINE via public API | Do not create `bulletin-api` in v1 |
| Contact and inquiry forms | Start in `hhc-web-api` if simple | Extract `engagement-api` when multiple form types, assignment, status workflow, LINE intake, or analytics appear | `notification-api`, `audit-log`, optional `asset-api` | Stores PII; admin access must be scoped |
| Newsletter or announcement subscriptions | `engagement-api` when subscriptions are needed | Keep out of `notification-api` because notification only sends | `notification-api`, `audit-log`, `account-api` optional | Subscription consent belongs to engagement domain |
| Event pages | `hhc-web-api` content module | Split only when registration/check-in is added | `asset-api`, Redis | Event content is CMS content |
| Event registration, capacity, waitlist, check-in | `event-api` once registration is needed | Start separate if collecting attendee PII or sending reminders | `notification-api`, `audit-log`, `account-api` optional | Registration state should not live in CMS tables |
| Member profile and household data | `member-api` | Create when member data goes beyond auth profile claims | `account-api`, `audit-log` | `account-api` authenticates; it should not become a membership CRM |
| Small groups and ministry teams | `group-api` after member model exists | Create when rosters, leaders, attendance, or permissions are needed | `member-api`, `notification-api`, `audit-log` | Group data is not website content |
| Pastoral care and prayer requests | `pastoral-care-api` if implemented | Always separate from CMS because of sensitivity | `member-api`, `notification-api`, `audit-log` | Restrict access more tightly than normal admin CMS |
| Donations and payments | `donation-api` if implemented | Always separate because money/provider callbacks/receipts | `notification-api`, `audit-log`, `account-api` optional | Never store raw card data; use provider-hosted payment |
| Search | Start with `hhc-web-api` PostgreSQL full-text for public content | Extract `search-api` when indexing cross-service data or external engine is needed | `hhc-web-api` projections, `asset-api` metadata | Do not add OpenSearch until Postgres is insufficient |
| LINE bot weekly download | `hhc-line-function-bot` calls `hhc-web-api` public API | Private member content needs protected/internal route | `hhc-web-api`, `asset-api` for URLs | Already covered by LINE integration spec |
| LINE group file storage | `hhc-line-function-bot` + `asset-api` | Keep domain metadata in bot unless reused outside LINE | `asset-api`, `audit-log` | Bot owns LINE context; asset service owns bytes/grants |
| Desktop cloud-folder objects | Owning desktop app service + `asset-api` | Create app-specific service when sync metadata is needed | `asset-api`, `account-api`, `audit-log` | Do not route through `hhc-web-api` unless files are website content |

## Recommended Post-V1 Phases

### Phase 9: Website Contact And Inquiry

Start only if the public site needs a contact form.

Recommended first version:

- Route: `POST /api/contact-submissions`.
- Owner: `hhc-web-api`.
- Stored data: name, email/phone, message, locale, source page, consent flag, status.
- Side effects: enqueue notification through `notification-api`; append audit event.
- Admin UI: simple inbox inside admin console with read, mark handled, archive.

Extract to `engagement-api` when:

- LINE bot can create inquiries.
- Multiple form types exist.
- Assignment or response tracking is needed.
- Inquiry analytics become a separate reporting workflow.

### Phase 10: Public Search

Start with `hhc-web-api` PostgreSQL full-text over published projections.

Detailed search document, API, indexing, tokenization, admin search, and extraction rules are specified in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

Search should include:

- News.
- Pages.
- Weekly issue titles and metadata.
- Videos.
- Locations.
- History timeline.

Do not index private assets or draft content in public search. Admin search is separate, uses protected CMS search documents, and requires CMS scopes.

Extract to `search-api` only when:

- Multiple services publish searchable data.
- Relevance tuning becomes complex.
- External search engine operation is justified.
- Index rebuilds need independent workers.

### Phase 11: Event Registration

Event display content can stay in `hhc-web-api`. Registration should move to `event-api` once the website collects attendee information.

`event-api` owns:

- event occurrence registration settings
- attendee records
- capacity and waitlist
- check-in state
- registration status
- reminder schedule

`hhc-web-api` owns:

- public event page content
- event images
- SEO
- curated home page placement

This split keeps CMS editorial content separate from personal registration data.

### Phase 12: Newsletter And Subscription Consent

Create `engagement-api` or extend it if Phase 9 already exists.

The engagement domain owns:

- subscriber identity
- consent source
- unsubscribe token
- language preference
- topic subscriptions
- suppression reason

`notification-api` only sends messages. It does not decide who is subscribed; that ownership boundary is defined in `docs/superpowers/specs/2026-07-08-hhc-notification-api-design.md`.

### Phase 13: Member, Group, And Pastoral Domains

Implement only after account linking and role design are mature.

Recommended split:

- `member-api`: member profile, household, membership status.
- `group-api`: small group and ministry team rosters.
- `pastoral-care-api`: prayer requests and pastoral notes.

Do not store pastoral-care data in generic CMS, LINE bot memory, or notification tables. Use stricter scopes, audit, and retention.

### Phase 14: Donations

Create `donation-api` when online giving is needed.

Rules:

- Use a payment provider redirect or hosted payment page.
- Do not store raw card or bank credentials.
- Store provider transaction id, amount, currency, status, campaign/fund, receipt metadata, and reconciliation state.
- Provider webhooks go through gateway route policy and are signature-verified by `donation-api`.
- Receipts are sent through `notification-api`.
- Financial operations are audited.

## Data Classification

| Class | Examples | Storage Rule | Access Rule |
| --- | --- | --- | --- |
| Public content | news, pages, videos, locations, weekly public PDFs | `hhc-web-api` and `asset-api` public grants | public read |
| Operational admin | draft content, publish state, audit metadata | owning service schema | CMS/admin scopes |
| Contact PII | contact forms, event registration, subscriber email | engagement/event schema | scoped admin only |
| Member data | household, membership, group membership | member/group schema | member/admin scopes |
| Pastoral sensitive data | prayer requests, pastoral notes | pastoral schema | restricted pastoral scopes |
| Financial data | donations, receipts, provider transaction ids | donation schema | finance/admin scopes |
| Bot/group files | LINE file metadata and `assetId` | bot schema plus `asset-api` | source-scoped grants |

## API Placement Rules

All public non-account APIs stay on `www.alive.org.tw`:

```text
GET  /api/search
POST /api/contact-submissions
GET  /api/events
POST /api/events/{eventId}/registrations
POST /api/donations/checkout
POST /api/donations/provider-webhooks/{provider}
```

Admin APIs stay under protected admin paths:

```text
GET /api/admin/contact-submissions
GET /api/admin/events/{eventId}/registrations
GET /api/admin/donations
```

Internal service APIs use `/priv/*` and are blocked publicly:

```text
POST /priv/notifications/send
POST /priv/audit/events
POST /priv/assets/upload-sessions
```

Do not create `api.alive.org.tw` for any future domain.

## Event And Integration Patterns

Use synchronous API calls only when the caller needs an immediate decision:

- create registration
- validate capacity
- create upload session
- create payment checkout

Do not use synchronous calls to assemble cross-domain public pages when a provider-owned query, product read model, or dedicated search/query service would be more stable. Public page reads should not grow into service-call chains.

Use outbox events for side effects:

- send confirmation email
- send reminder email
- refresh projection
- append audit event
- rebuild search index
- notify LINE/admin channel

Recommended future event aliases:

These aliases are for product/domain planning. Produced integration events must use the canonical reverse-DNS event type naming rule from the event contract governance document and must ship with JSON Schemas, examples, classification, compatibility tests, and replay tests.

| Event | Producer | Consumers |
| --- | --- | --- |
| `contact_submission.created` | `hhc-web-api` or `engagement-api` | notification-api, audit-log |
| `event_registration.created` | `event-api` | notification-api, audit-log |
| `event_registration.cancelled` | `event-api` | notification-api, audit-log |
| `subscriber.created` | `engagement-api` | notification-api, audit-log |
| `member.updated` | `member-api` | audit-log, group-api when needed |
| `donation.completed` | `donation-api` | notification-api, audit-log |
| `search_index.refresh_requested` | content-owning service | search worker |

## Reuse Examples

### Contact Form

1. Browser posts to `www.alive.org.tw/api/contact-submissions`.
2. Gateway applies rate limits and bot protection.
3. `hhc-web-api` validates fields and consent.
4. `hhc-web-api` writes submission and outbox event.
5. Worker calls `notification-api /priv/notifications/send`.
6. Worker emits audit event.
7. Admin console reads protected submissions.

This can later move to `engagement-api` without changing gateway, notification, audit, or frontend URL shape.

### Event Registration

1. Public event page is rendered from `hhc-web-api` content.
2. Registration form posts to `event-api` through `www.alive.org.tw/api/events/{eventId}/registrations`.
3. `event-api` validates capacity, waitlist, idempotency key, and consent.
4. `event-api` emits confirmation/reminder/audit events.
5. Admin console reads registration state from protected `event-api` routes.

CMS remains responsible for public event content. `event-api` remains responsible for attendee state.

### Donation Checkout

1. Browser posts donation intent to `www.alive.org.tw/api/donations/checkout`.
2. `donation-api` creates provider-hosted checkout session.
3. User completes payment on provider-hosted page.
4. Provider webhook posts to gateway route.
5. `donation-api` verifies signature, stores result, and emits receipt/audit events.
6. `notification-api` sends receipt.

The platform never stores raw payment credentials.

## Extraction Playbook

When a feature grows out of `hhc-web-api`:

1. Freeze the public contract and keep path compatibility.
2. Create the new service with its own PostgreSQL schema.
3. Add internal clients and route policy in staging.
4. Dual-write or backfill data through controlled migration.
5. Move reads behind a feature flag.
6. Move writes after reads are verified.
7. Remove old tables only in a later release.
8. Keep audit continuity by preserving resource ids or adding mapping events.
9. Add SLO targets, page-worthy alerts, dashboards, runbook, and rollback evidence before production traffic.

Do not extract by letting the new service read `hhc_web` tables directly. Use APIs, migration jobs, or events.

## What Not To Build In V1

Do not build these in the first website/CMS release:

- member CRM
- event registration
- donation processing
- pastoral care notes
- external search engine
- newsletter automation
- full engagement workflow
- generic workflow engine

The v1 platform should expose the reusable foundation that makes those later features cheaper: gateway auth, account token contract, asset service, notification service, audit service, outbox pattern, and CMS/public projections.

## Acceptance Criteria

- Future service candidates are documented with split triggers, not assumed as v1 services.
- `hhc-web-api` remains the v1 website backend and CMS core.
- Sensitive domains have separate-service guidance before implementation begins.
- `notification-api` sends notifications but does not own subscriber, event, member, or donation domain state.
- `asset-api` remains the reusable binary/object service for all future domains.
- All future public APIs stay under `www.alive.org.tw/api/*`.
- Future microservices have SLO, runbook, alert ownership, rollback, and contract-test evidence before production traffic.
- Future microservices that publish or consume integration events have owned event schemas/examples, compatibility windows, replay evidence, and data classification review before production traffic.
- Internal future APIs use `/priv/*` and service identity.
