# HHC Event Contract, Schema, And Replay Governance Design

## Purpose

This spec defines how HHC platform services describe, version, validate, publish, consume, replay, and deprecate events.

It complements:

- `docs/superpowers/specs/2026-07-08-hhc-platform-eventing-outbox-reliability.md`
- `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`
- `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-data-lifecycle-deletion-retention-and-restore-orchestration-design.md`

External alignment:

- CloudEvents defines common event metadata such as `id`, `source`, `specversion`, `type`, `datacontenttype`, `dataschema`, `subject`, and `time`. It is designed for interoperability across independently deployed producers and consumers.
- Microsoft Azure Event Grid recommends CloudEvents as the standardized event format.
- AsyncAPI describes message-driven APIs in a machine-readable, protocol-agnostic way. HHC should adopt it when event consumers, broker channels, or generated async docs justify the extra governance surface.

References:

- CloudEvents spec: `https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md`
- CloudEvents primer: `https://github.com/cloudevents/spec/blob/main/cloudevents/primer.md`
- Azure Event Grid event schema: `https://learn.microsoft.com/en-us/azure/event-grid/event-schema`
- AsyncAPI 3.1.0 specification: `https://www.asyncapi.com/docs/reference/specification/v3.1.0`

## Core Decision

Use a CloudEvents-compatible JSON envelope for integration events and outbox payloads that cross service boundaries.

V1 does not require Azure Event Grid, Azure Service Bus, Kafka, or AsyncAPI. The event contract still needs an envelope and schema discipline from day one so service-local outbox rows, future broker messages, read-model consumers, and replay tooling share the same shape.

Rules:

- Domain events can stay internal to a service when they never leave the service boundary.
- Integration events and side-effect commands stored in outbox rows use the HHC event envelope.
- Every integration event has a JSON Schema file and compatibility policy.
- Event producers own event contracts.
- Consumers must not infer behavior from undocumented payload fields.
- Event payloads carry facts, not commands. Commands stay in `/priv/*` API contracts or outbox destinations.
- Events must be small, public-safe or classification-safe, replayable, idempotent, and forward-compatible.

## Event Categories

| Category | Meaning | Contract Required | Example |
| --- | --- | --- | --- |
| Domain event | Internal fact inside one service | service-local only | `draft_saved` inside CMS module |
| Integration event | Fact published for another service or future broker | yes | `org.alive.hhc.bulletin.version.published.v1` |
| Side-effect command envelope | Durable outbox work item addressed to one callee | yes for payload | asset public grant request |
| Projection event | Fact that triggers local/public read model update | yes when consumed outside producer module | `public_projection.refreshed.v1` |
| Lifecycle event | Deletion, redaction, retention, restore, legal hold | yes | `asset.deleted.v1`, `member.redacted.v1` |
| Audit event | Append-only accountability event | audit contract | `cms.bulletin.publish_requested` |

Do not use one generic `event_type` plus arbitrary `payload_json` without a schema once the event can cross a package, service, worker, or release boundary.

## Envelope

Use this logical envelope for integration events:

```json
{
  "specversion": "1.0",
  "id": "01JZ7S3M6T9X9V6F3J9G2J4X2A",
  "source": "urn:hhc:service:hhc-web-api",
  "type": "org.alive.hhc.bulletin.version.published.v1",
  "subject": "bulletin/version/version_123",
  "time": "2026-07-08T12:34:56Z",
  "datacontenttype": "application/json",
  "dataschema": "urn:hhc:event-schema:hhc-web-api:bulletin.version.published:v1",
  "hhccorrelationid": "corr_123",
  "hhcaggregateversion": 7,
  "hhcclassification": "public",
  "hhcvisibility": "public",
  "data": {
    "issueId": "bulletin_2026_07_12",
    "versionId": "version_123",
    "issueDate": "2026-07-12",
    "locale": "zh-Hant",
    "assetId": "asset_123",
    "projectionKeys": [
      "bulletin_latest:zh-Hant",
      "bulletin_detail:2026-07-12:zh-Hant"
    ],
    "publishedAt": "2026-07-08T12:34:55Z"
  }
}
```

Required fields:

| Field | Rule |
| --- | --- |
| `specversion` | Always `1.0` for CloudEvents-compatible HHC events. |
| `id` | Globally unique within producer `source`; reused only for exact duplicate resend. |
| `source` | Stable producer identifier, usually `urn:hhc:service:{service}`. |
| `type` | Reverse-DNS event type with major version suffix. |
| `subject` | Producer-local aggregate path. |
| `time` | UTC occurrence time, not delivery time. |
| `datacontenttype` | `application/json` unless a specific event says otherwise. |
| `dataschema` | Stable URI/URN for the JSON Schema governing `data`. |
| `hhccorrelationid` | Correlates request, outbox rows, logs, and audit events. |
| `hhcaggregateversion` | Monotonic source aggregate version when the source has one. |
| `hhcclassification` | Highest data classification inside `data`. |
| `hhcvisibility` | `public`, `authenticated`, `restricted`, `private`, or `internal`. |
| `data` | Event-specific payload that matches `dataschema`. |

Extension field names intentionally use lowercase CloudEvents-style names. If tooling requires another naming convention internally, adapters must translate at the boundary.

## Event Type Naming

Format:

```text
org.alive.hhc.{boundedContext}.{aggregate}.{pastTenseVerb}.v{major}
```

Examples:

| Type | Producer |
| --- | --- |
| `org.alive.hhc.content.item.published.v1` | `hhc-web-api` |
| `org.alive.hhc.content.item.unpublished.v1` | `hhc-web-api` |
| `org.alive.hhc.bulletin.version.published.v1` | `hhc-web-api` |
| `org.alive.hhc.bulletin.version.unpublished.v1` | `hhc-web-api` |
| `org.alive.hhc.site_settings.published.v1` | `hhc-web-api` |
| `org.alive.hhc.asset.upload.completed.v1` | `asset-api` |
| `org.alive.hhc.asset.scan.completed.v1` | `asset-api` |
| `org.alive.hhc.asset.grant.changed.v1` | `asset-api` |
| `org.alive.hhc.notification.message.delivered.v1` | `notification-api` |
| `org.alive.hhc.account.admin_role.granted.v1` | `account-api` |
| `org.alive.hhc.privacy.resource.redacted.v1` | owning service |

Verb rules:

- Use past tense facts: `published`, `unpublished`, `deleted`, `redacted`, `granted`.
- Do not use imperative names such as `sendEmail` or `grantAsset`.
- Do not encode minor versions in `type`.
- Breaking data-shape or semantic changes require a new major type suffix.

## Schema Registry

Before service repos exist, human design lives under `docs/superpowers/specs/`.

When service repos exist, each event-producing service owns:

```text
api/events/{event-name}.v1.schema.json
api/events/examples/{event-name}.v1.json
api/events/README.md
```

Optional future docs bundle:

```text
docs/events/{service}/{event-name}.v1.schema.json
docs/events/{service}/examples/{event-name}.v1.json
docs/events/catalog.md
```

AsyncAPI adoption trigger:

- three or more event-consuming services exist
- Azure Service Bus or Event Grid becomes a shared broker
- event docs need generated HTML or client stubs
- multiple services subscribe to the same event stream
- CI needs machine-readable channel/operation ownership beyond JSON Schema

Do not add AsyncAPI in v1 just to mirror OpenAPI. JSON Schema plus examples is enough until events become a first-class external contract.

## JSON Schema Rules

Each schema must define:

- `$id` matching `dataschema`
- event `type`
- event major version
- owning service
- data classification
- payload properties
- required fields
- additional property policy
- examples

Recommended data schema style:

```json
{
  "$id": "urn:hhc:event-schema:hhc-web-api:bulletin.version.published:v1",
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Bulletin Version Published",
  "type": "object",
  "additionalProperties": false,
  "required": ["issueId", "versionId", "issueDate", "locale", "assetId", "projectionKeys", "publishedAt"],
  "properties": {
    "issueId": { "type": "string" },
    "versionId": { "type": "string" },
    "issueDate": { "type": "string", "format": "date" },
    "locale": { "type": "string", "enum": ["zh-Hant", "zh-Hans", "en"] },
    "assetId": { "type": "string" },
    "projectionKeys": {
      "type": "array",
      "items": { "type": "string" }
    },
    "publishedAt": { "type": "string", "format": "date-time" }
  }
}
```

Compatibility note:

- For event `data`, `additionalProperties: false` is acceptable only when producers and consumers use schema compatibility checks before rollout.
- Consumers must still ignore unknown envelope extension fields.
- Additive schema changes should add optional fields first.
- New required fields require a new major version or a multi-release migration with defaultable semantics.

## Versioning And Compatibility

Event compatibility is stricter than REST response compatibility because replay queues can contain old payloads.

Compatible changes:

- add optional field
- add enum value only when consumers already tolerate unknown values
- add new event type
- add new producer of an existing event type only if source semantics remain clear
- add nullable field
- widen string length

Breaking changes:

- remove field
- rename field
- change field type
- make optional field required
- change event meaning without changing type
- narrow enum values
- change identifier format in a way consumers parse
- change `subject` semantics
- change classification or visibility to less restrictive without explicit security review

Compatibility window:

- Producers keep old event shape readable for at least the outbox retry window plus one release cycle.
- Consumers support current and previous major version while old payloads can be replayed.
- Unknown future major versions must dead-letter or skip without destructive side effects.
- Replay tooling must choose event versions explicitly.

## Event Payload Privacy

Event payloads must use minimum necessary data.

Do not put these in integration events:

- access tokens
- refresh tokens
- cookies
- upload URLs
- Blob URLs
- SAS URLs
- provider secrets
- full raw email bodies
- payment provider raw payloads
- pastoral notes
- member private narrative fields
- raw LINE message bodies unless the event is owned by the LINE service and classified accordingly

Prefer identifiers and public-safe snapshots:

- `assetId`, not Blob path
- `downloadUrl` only when it is a stable gateway URL and visibility allows it
- `recipientRef`, not raw email, when downstream does not need email address
- `templateId`, not rendered email body
- `resourceId` and `resourceType`, not full object dump

Classification rules:

- `hhcclassification` is the highest classification of any field in `data`.
- Consumers must not copy event payloads into lower-classification stores.
- Public read models may consume only events classified `public` or explicitly public-safe snapshots from a higher-classification source.
- Redaction/deletion/lifecycle events must be treated as high-priority and idempotent.

## Ordering, Deduplication, And Idempotency

Consumers dedupe by:

```text
source + id
```

Read-model consumers also compare:

```text
source + subject + hhcaggregateversion
```

Rules:

- Events for the same aggregate should include `hhcaggregateversion` when the source has versioning.
- Consumers ignore stale versions.
- Consumers can process duplicate events without duplicate side effects.
- Consumers should not assume global ordering across aggregates.
- Event batches, if introduced later, do not imply ordering unless the broker/contract explicitly guarantees it.

## Replay

Replay exists to rebuild projections, search documents, or consumer read models. It is not a way to rerun unsafe side effects.

Replayable event requirements:

- deterministic consumer behavior
- idempotent processing key
- source version included
- schema version included
- redaction/deletion events included in the replay range
- consumer can start from empty state or a checkpoint
- replay can be scoped by event type, aggregate id, time range, and schema version

Side effects that must not blindly replay:

- send notification
- send LINE reply
- charge payment
- create external provider checkout
- grant public asset access without current source-state recheck

For these, replay should rebuild internal state or enqueue a reviewed repair command, not repeat the external action.

## Event Lifecycle And Deprecation

Lifecycle:

1. Proposed: documented schema and example exist.
2. Experimental: staging only, no production consumers.
3. Active: production producer and at least one supported consumer.
4. Deprecated: replacement event exists; consumers have migration plan.
5. Retired: producer stopped; old payloads outside retry/replay window; schema kept for audit/replay history.

Deprecation rules:

- Producers must announce replacement event type.
- Consumers must record migration status.
- Release manifest records affected event types.
- Retired schemas remain in source control.
- Data retention may remove old event rows, but schema docs remain for audit interpretation.

## Outbox Storage

The service-owned outbox table should keep envelope fields queryable enough for workers and operations.

Recommended columns:

```sql
outbox_event(
  id uuid primary key,
  cloud_event_id text not null,
  cloud_event_source text not null,
  cloud_event_type text not null,
  cloud_event_subject text not null,
  data_schema text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  aggregate_version bigint,
  destination text not null,
  idempotency_key text not null,
  classification text not null,
  visibility text not null,
  payload_json jsonb not null,
  status text not null,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  leased_by text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  unique(destination, idempotency_key),
  unique(cloud_event_source, cloud_event_id)
)
```

`payload_json` stores the full envelope. Columns duplicate envelope fields for indexing and operator visibility.

## Current Event Catalog

V1 active or planned integration events:

| Event Type | Producer | Primary Consumers | Classification |
| --- | --- | --- | --- |
| `org.alive.hhc.content.item.published.v1` | `hhc-web-api` | projection/search/audit/optional notification | public |
| `org.alive.hhc.content.item.unpublished.v1` | `hhc-web-api` | projection/search/asset grant revoke/audit | public |
| `org.alive.hhc.content.item.rollback_published.v1` | `hhc-web-api` | projection/search/asset grant/audit | public |
| `org.alive.hhc.bulletin.version.published.v1` | `hhc-web-api` | projection/search/asset grant/audit/LINE indirectly through API | public |
| `org.alive.hhc.bulletin.version.unpublished.v1` | `hhc-web-api` | projection/search/asset grant revoke/audit | public |
| `org.alive.hhc.bulletin.version.rollback_published.v1` | `hhc-web-api` | projection/search/asset grant/audit | public |
| `org.alive.hhc.site_settings.published.v1` | `hhc-web-api` | projection/audit | public |
| `org.alive.hhc.asset.upload.completed.v1` | `asset-api` | asset worker/audit | internal |
| `org.alive.hhc.asset.scan.completed.v1` | `asset-api` | owner callback when needed/audit | internal |
| `org.alive.hhc.asset.grant.changed.v1` | `asset-api` | audit/owner reconciliation | internal |
| `org.alive.hhc.notification.message.requested.v1` | `notification-api` | notification worker/audit | restricted |
| `org.alive.hhc.notification.message.delivered.v1` | `notification-api` | audit | restricted |
| `org.alive.hhc.account.admin_role.granted.v1` | `account-api` | audit/security dashboard | restricted |
| `org.alive.hhc.account.admin_role.revoked.v1` | `account-api` | audit/security dashboard | restricted |
| `org.alive.hhc.privacy.resource.redacted.v1` | owning service | read-model/search/projection cleanup | restricted |
| `org.alive.hhc.privacy.resource.deleted.v1` | owning service | asset/read-model/search/projection cleanup | restricted |

The existing shorter names in older docs remain readable aliases during planning. Implementation contracts should use the reverse-DNS names above.

## Producer Rules

Producers must:

- validate event data against schema before inserting outbox rows
- generate stable event ids
- set `source`, `subject`, `type`, `dataschema`, classification, and visibility
- write domain transaction and outbox row atomically
- include request id/correlation id when available
- avoid logging full payload when classification is non-public
- maintain examples for success and edge cases
- publish redaction/deletion events when copied data must be removed downstream

Producers must not:

- publish internal database rows directly
- include draft content in public events
- publish a public event before required asset grants are active
- publish event semantics not covered by schema
- reuse event id for different data

## Consumer Rules

Consumers must:

- validate envelope required fields
- validate `data` against supported schemas
- dedupe by `source + id`
- ignore or dead-letter stale aggregate versions
- process current and previous schema versions during compatibility window
- fail closed for unknown classification or visibility
- record checkpoint or last processed event where needed
- expose lag and dead-letter metrics

Consumers must not:

- treat event arrival as authorization
- use event data to grant user access without policy check
- copy higher-classification data into public read models
- assume global ordering
- re-run non-idempotent external side effects during replay

## Release Governance

Any production-impacting event change is release class `worker_or_event`.

Required release evidence:

- schema diff
- compatibility result against previous released schema
- old payload replay test
- new payload replay test
- consumer contract test result
- dead-letter behavior for unsupported future major version
- data classification review
- release manifest entry listing affected event types
- rollback or roll-forward plan for producer and consumers

Breaking event changes require provider-first rollout:

1. Add new event type or schema version.
2. Deploy consumers that can handle both old and new.
3. Deploy producer emitting new event.
4. Confirm replay and lag metrics.
5. Stop emitting old event after consumers migrate.
6. Retire old schema only after retry/replay window closes.

## Testing

Schema tests:

- every event example validates against its JSON Schema
- invalid missing required field fails
- invalid classification transition fails
- unknown future major version is not processed destructively

Compatibility tests:

- additive optional field remains compatible
- removed/renamed field fails compatibility
- new required field fails compatibility unless major version changes
- enum narrowing fails compatibility

Consumer tests:

- duplicate `source + id` is ignored
- stale `hhcaggregateversion` is ignored
- out-of-order publish/unpublish does not re-expose public content
- redaction/delete event removes copied read-model/search data
- non-public event cannot feed public projection
- old event fixtures from previous release replay successfully

Operational tests:

- dead-letter includes sanitized error and schema id
- replay command can scope event type and time range
- replay does not resend notifications or LINE replies
- event lag and dead-letter metrics appear in dashboards

## Acceptance Criteria

- Integration events use a CloudEvents-compatible JSON envelope.
- Each cross-service event has JSON Schema, example, owner, classification, and compatibility policy.
- Event type naming uses reverse-DNS and major version suffix.
- Outbox rows store queryable envelope metadata plus full payload.
- Consumers dedupe, validate schema, handle stale versions, and fail closed on unknown classification.
- Replay is safe for projections/read models and does not rerun unsafe external side effects.
- Lifecycle/redaction/deletion events are part of read-model and search cleanup.
- `worker_or_event` releases include schema diff, replay tests, consumer tests, classification review, and release manifest evidence.
- AsyncAPI remains optional until event channels or consumers justify it.
