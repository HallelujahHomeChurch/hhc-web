# HHC Publication Workflow Consistency And Reconciliation Design

## Purpose

This spec defines how `hhc-web-api` keeps public website state consistent when a publish, unpublish, rollback publish, or emergency takedown touches local CMS records, public projections, Redis, search documents, sitemap data, `asset-api` grants, `audit-log`, optional `notification-api`, and LINE bot reads.

The goal is to avoid broken public links, stale latest bulletin results, accidentally public draft assets, and hidden content that remains downloadable through a stable asset URL.

This spec complements:

- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-projection-cache-invalidation-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-background-jobs-scheduled-tasks-and-worker-orchestration-design.md`
- `docs/superpowers/plans/2026-07-08-hhc-web-rollout-verification-matrix.md`

## Core Decision

Use a service-owned publication workflow inside `hhc-web-api`.

Do not create a v1 `publication-orchestrator`, `workflow-api`, or `cms-api` split. The publication workflow belongs with CMS source records and public projections because `hhc-web-api` owns the business decision that content is ready for public exposure.

Do not use distributed transactions or two-phase commit across `hhc-web-api`, `asset-api`, `audit-log`, and `notification-api`.

Use:

- one local PostgreSQL transaction for source state and workflow intent
- durable outbox rows for remote side effects
- service-owned scheduled/manual jobs only as wake-up and repair mechanisms
- idempotency keys that include aggregate version
- explicit publication workflow states
- compensation/reconciliation workers for partial failures
- public projections as the only public read source

This follows the same principle as saga-style consistency: each participant commits locally, later steps are idempotent, and failures are retried or compensated.

Scheduled publish/unpublish must execute this same workflow. The schedule is not a separate source of truth and must not publish a newer unapproved draft simply because the scheduled time arrived.

## Workflow State Model

Source record statuses describe editorial state. Workflow rows describe in-progress publication operations.

Keep both concepts separate.

Source statuses:

- `draft`
- `published`
- `unpublished`
- `archived`

Publication workflow statuses:

- `requested`
- `validating`
- `waiting_asset_grant`
- `projection_pending`
- `public_visible`
- `waiting_asset_revoke`
- `public_hidden`
- `failed_retryable`
- `failed_terminal`
- `cancelled`

Recommended table:

```sql
publication_workflow(
  id uuid primary key,
  workflow_type text not null,
  resource_type text not null,
  resource_id text not null,
  locale text null,
  aggregate_version bigint not null,
  status text not null,
  required_asset_ids text[] not null default '{}',
  optional_asset_ids text[] not null default '{}',
  projection_keys text[] not null default '{}',
  idempotency_key text not null,
  requested_by text not null,
  reason text null,
  last_error text null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz,
  unique(workflow_type, resource_type, resource_id, locale, aggregate_version)
)
```

Workflow types:

- `publish`
- `unpublish`
- `rollback_publish`
- `restore_to_draft`
- `emergency_takedown`
- `projection_rebuild`

The workflow row is not a new source of public truth. Public routes still read `public_projection`.

## Publication Classes

Different publish operations need different consistency strength.

| Class | Examples | Rule |
| --- | --- | --- |
| `projection_only` | text-only page, location text update, history item | Local publish can create projection immediately; audit/notification async |
| `optional_asset` | news cover that UI can omit, body image that can render fallback | Projection can publish without optional asset if renderer omits unavailable asset |
| `required_public_asset` | weekly PDF, required news cover, required Open Graph image if referenced in metadata | Grant-before-visible |
| `shared_layout` | navigation, footer, public contact display, site SEO defaults | Publish projection atomically; no asset URL unless asset is already public-ready |
| `security_takedown` | accidental private file, wrong bulletin PDF, legal/privacy removal | Hide projection immediately and prioritize asset deny/revoke |

Weekly bulletin PDF is always `required_public_asset`.

## Publish Without Required Assets

Use for `projection_only` content.

Flow:

1. Admin requests publish.
2. `hhc-web-api` validates role/scope, source version, locale, structured content, slugs, SEO, and public-safe render model.
3. Local transaction:
   - update source status to `published`
   - write revision snapshot
   - upsert public projection
   - upsert public search document if enabled
   - upsert sitemap/metadata entries if affected
   - insert audit outbox
   - insert optional notification outbox if configured
   - invalidate or version-bump Redis keys
4. Return success after commit.
5. Outbox workers deliver audit and notification.

This is acceptable because the public projection is already complete without a required remote side effect.

## Grant-Before-Visible Publish

Use when the public projection would contain a URL that must work immediately.

Examples:

- latest weekly bulletin PDF
- bulletin archive/detail download URL
- required public image where renderer cannot omit the asset
- site metadata image if Open Graph output references it

Flow:

1. Admin requests publish.
2. `hhc-web-api` validates role/scope, source version, locale, and required asset eligibility.
3. Local transaction:
   - keep source public status as not publicly visible
   - write `publication_workflow(status='waiting_asset_grant')`
   - insert outbox rows for public grant commands with versioned idempotency keys
   - insert audit outbox for `publish.requested`
   - write revision snapshot
4. Return `202 Accepted` with workflow id, or return `200` only if the worker completes within a short request budget.
5. Asset grant worker calls `asset-api /priv/assets/{assetId}/grants`.
6. Worker re-reads source state and workflow version.
7. If source version still matches and asset grant is active:
   - update source status to `published`
   - upsert public projection
   - upsert search/sitemap/metadata entries
   - invalidate or version-bump Redis keys
   - mark workflow `public_visible`
   - emit audit `publish.completed`
8. If source changed before grant completion, cancel or compensate stale grant.

Public API routes must not expose the content until step 7 commits.

## Rollback Publish

Rollback publish is a new publish operation that uses an older revision as input.

Rules:

- It must not mutate old revision rows.
- It creates a new source version.
- It uses the same publication class as a normal publish.
- If the rollback projection includes required assets, it must use grant-before-visible.
- It must revoke public grants that are no longer referenced by any active published projection after the new projection is visible.
- It must emit audit events for both the rollback request and the completed public version.

## Restore To Draft

Restore to draft has no public side effects.

Rules:

- It creates or updates draft source state only.
- It does not touch `public_projection`, sitemap, search public rows, Redis public keys, or public asset grants.
- It emits audit events and revision evidence.

## Unpublish

Normal unpublish removes public discoverability first.

Flow:

1. Admin requests unpublish.
2. Local transaction:
   - update source status to `unpublished`
   - delete or tombstone public projection rows
   - remove public search documents
   - refresh sitemap/metadata affected keys
   - invalidate or version-bump Redis keys
   - write `publication_workflow(status='waiting_asset_revoke')`
   - insert outbox rows for public grant revocation
   - insert audit outbox
3. Return success after local public projection removal.
4. Grant revoke worker calls `asset-api`.
5. Workflow completes after all no-longer-needed grants are revoked.

This means public pages and LINE bot latest results stop seeing the content immediately, while direct stable asset URLs may deny only after grant revocation completes. For ordinary public church content this is acceptable if the revoke worker is monitored and fast.

## Emergency Takedown

Use when continued direct asset download is unacceptable.

Flow:

1. Local transaction removes public projections, search rows, sitemap rows, and Redis keys.
2. High-priority revoke/deny outbox rows are inserted for every public asset reference.
3. Worker calls `asset-api` to revoke grants or apply an asset deny state if available.
4. If grant revocation fails, alert immediately and keep workflow `failed_retryable`.
5. Operators may use asset public-download kill switches or namespace/asset deny overrides if a file must be blocked before normal revoke succeeds.

Emergency takedown is not a reason to make `hhc-web-api` write directly into the `asset` schema.

## Stale Workflow Protection

Every remote command must carry:

- `resourceType`
- `resourceId`
- `aggregateVersion`
- `assetId` when applicable
- idempotency key
- reason
- source workflow id

Before applying a stale side effect, the worker must re-read the current source row.

Rules:

- A stale publish grant must not re-expose an unpublished resource.
- A stale projection rebuild must not overwrite a newer projection version.
- A stale rollback workflow must be cancelled if a newer publish exists.
- Grant revoke must check whether any current published projection still references the asset before revoking public access.
- Search and sitemap updates must use current projection version, not an older source snapshot.

## Reconciliation Jobs

Scheduled reconciliation should verify that public surfaces match source truth.

Checks:

- every active public projection has source status `published`
- every projection asset URL has an active public grant, clean scan, and ready/not-required processing
- no unpublished/archived/deleted source record has an active public projection
- no public search document points to a missing or stale projection
- sitemap routes match active public projections
- latest weekly bulletin points to the newest published issue with a downloadable PDF
- public asset grants are still referenced by at least one published projection or allowed shared public setting
- Redis keys match PostgreSQL projection versions

Reconciliation actions:

- rebuild missing projections from source
- remove stale projections/search rows
- enqueue missing asset grants for currently published required assets
- enqueue public grant revokes for unreferenced assets
- refresh Redis keys
- emit audit and metrics for repairs

Reconciliation must be idempotent and must not make draft content public.

## API Behavior

Admin publish endpoints may return:

- `200 OK` when the public-visible operation completes synchronously within the request budget
- `202 Accepted` when a workflow continues asynchronously
- `409 conflict` when source version is stale
- `422 validation_error` when required public assets are not eligible
- `503 dependency_unavailable` only when policy requires synchronous completion and the dependency is unavailable

Public APIs must return only `public_projection` rows that are active for the current version.

LINE bot reads the same public bulletin API. It never reads workflow state directly. If a weekly publish is still `waiting_asset_grant`, LINE bot continues to see the previous latest published bulletin or no bulletin.

## Observability

Metrics:

- `publication.workflow.started`
- `publication.workflow.completed`
- `publication.workflow.failed`
- `publication.workflow.duration_seconds`
- `publication.workflow.waiting_asset_grant.count`
- `publication.workflow.waiting_asset_revoke.count`
- `publication.reconciliation.repairs`
- `publication.reconciliation.failures`
- `publication.stale_side_effect.cancelled`

Alerts:

- required-asset publish waits for grant longer than threshold
- emergency takedown asset revoke fails
- reconciliation finds public projection without valid asset grant
- latest bulletin projection points to a non-downloadable asset
- stale side effects repeatedly attempt to re-expose unpublished content

## Tests

Required tests:

- weekly bulletin publish returns no new latest result until public PDF grant is active
- grant worker retry eventually makes bulletin visible
- stale publish grant after unpublish does not recreate public visibility
- unpublish removes public projection/search/sitemap and revokes unused grants
- grant revoke does not remove access if another published projection still references the asset
- rollback publish with required asset follows grant-before-visible
- restore to draft does not touch public projections or grants
- emergency takedown removes projection and alerts if asset revoke fails
- Redis flush rebuild restores only active public projections
- LINE bot latest follows public API state and never sees `waiting_asset_grant`

## Acceptance Criteria

- No distributed transaction is required across services.
- No v1 workflow/orchestrator service is required.
- Required public assets use grant-before-visible.
- Optional assets may publish with fallback behavior only when the renderer and public contract allow it.
- Public projection is the only public read source.
- Every side effect is idempotent and version-guarded.
- Reconciliation can repair missing grants/projections and remove stale public state.
- Emergency takedown has a stronger path than normal unpublish.
