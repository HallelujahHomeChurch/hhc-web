# HHC API Contract Governance And Client Generation

## Purpose

This spec defines how HHC platform HTTP API contracts are authored, reviewed, tested, published, and consumed by TypeScript and Go clients.

Event contracts are governed separately in `docs/superpowers/specs/2026-07-08-hhc-event-contract-schema-and-replay-governance-design.md`. Use OpenAPI for HTTP request/response routes and event JSON Schema or future AsyncAPI for asynchronous events.

Authorization policy, role/scope catalog, route/action metadata, object-level authorization, and policy drift checks are governed in `docs/superpowers/specs/2026-07-08-hhc-authorization-policy-and-permission-governance-design.md`.

The goal is to prevent drift between:

- `docs/api/*.md`
- service implementations
- `hhc-web` frontend API clients
- `hhc-line-function-bot` API clients
- gateway route policy
- contract tests

Local test profiles, fake dependencies, deterministic seed fixtures, and CI/staging smoke boundaries are specified in `docs/superpowers/specs/2026-07-08-hhc-local-development-and-test-environment-design.md`.

Structured content block schemas, render payload rules, invalid link cases, and no-raw-HTML renderer expectations are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Public/admin search API contracts, result safety, admin/public index separation, and search fixture requirements are specified in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

Deployment compatibility, release manifests, API/client compatibility windows, provider-first rollout, gateway release gates, and rollback/roll-forward rules are specified in `docs/superpowers/specs/2026-07-08-hhc-deployment-compatibility-migration-and-release-governance-design.md`.

Cross-service dependency ownership, generated-client adapter boundaries, query composition, read-model duplication, and dependency-chain budgets are specified in `docs/superpowers/specs/2026-07-08-hhc-cross-service-dependency-query-and-read-model-governance-design.md`.

## Core Decision

Use service-owned OpenAPI contracts, generated clients where they reduce drift, and CI gates for compatibility.

Do not create one monolithic OpenAPI document for the whole platform. Each service owns its own contract because each service owns its route behavior, release cadence, schema, and rollback.

## Current Interim State

Before service repos exist, the human-readable contract source is:

```text
docs/api/*.md
docs/superpowers/specs/2026-07-08-hhc-platform-api-standards-design.md
```

When a service implementation begins, that service must add machine-readable OpenAPI. From then on:

- OpenAPI is the executable contract for request/response shape.
- `docs/api/*.md` remains the human-readable contract summary.
- CI checks must keep OpenAPI and `docs/api/*.md` consistent.

## Contract Ownership

| Service | OpenAPI Owner | Consumers |
| --- | --- | --- |
| `hhc-web-api` | `hhc-web-api` repo | `hhc-web`, `hhc-line-function-bot`, gateway tests |
| `asset-api` | `asset-api` repo | `hhc-web-api`, `hhc-web` admin asset UI |
| `notification-api` | `notification-api` repo | `account-api`, `hhc-web-api`, future services |
| `audit-log` | `audit-log` repo | `hhc-web-api`, `asset-api`, admin audit UI through `hhc-web-api` |
| `account-api` | `account-api` repo | `api-gateway`, `hhc-web` admin auth |
| `api-gateway` | route policy contract, not domain OpenAPI | all public traffic |

The owning service is responsible for:

- route definitions
- request and response schemas
- auth requirements
- error responses
- idempotency/precondition headers
- examples
- deprecation metadata
- backward compatibility notes

## File Locations

In each service repo:

```text
api/openapi.yaml
api/examples/
api/fixtures/
internal/http/
internal/contracts/
```

In `hhc-web`:

```text
src/lib/api/generated/
src/lib/api/client.ts
src/lib/api/public.ts
src/features/admin/api-client.ts
src/test/fixtures/public-api/
```

In `hhc-line-function-bot`:

```text
src/clients/generated/
src/clients/hhc-web-api.ts
src/__tests__/contracts/
```

Optional documentation catalog in this repo:

```text
docs/openapi/
```

`docs/openapi/` may contain copied or bundled OpenAPI files for review convenience, but the service repo remains the source of truth after the service exists.

## OpenAPI Requirements

Each OpenAPI document must include:

- OpenAPI 3.1 where tooling supports it; otherwise OpenAPI 3.0.3 is acceptable.
- `info.title`, `info.version`, and service owner metadata.
- public server examples using the real host shape.
- route tags by surface: `public`, `admin`, `asset`, `internal`, `callback`.
- security schemes for bearer JWT, gateway trusted headers, internal app identity, or signed callback.
- shared envelope schemas.
- common error schema.
- reusable structured content block schemas for `bodyJson` source payloads and public/admin render models.
- pagination metadata schema.
- request id/correlation headers.
- idempotency headers for mutating routes.
- `If-Match` or `expectedVersion` for versioned admin mutations.
- binary response documentation for asset downloads.
- examples for success and common failures.

Use custom extensions for platform checks:

```yaml
x-hhc-route-surface: public | admin | internal | callback
x-hhc-gateway-auth: none | jwt | line-signature | signed-callback | internal-only
x-hhc-owner-service: hhc-web-api
x-hhc-required-roles:
  - cms.publisher
x-hhc-required-scopes:
  - cms:publish
x-hhc-authz-action: content.publish
x-hhc-resource-check: hhc-web-api:content.publish
x-hhc-data-classification: internal
x-hhc-cache-policy: public-short | no-store | internal
x-hhc-idempotent: true
```

These extensions let CI compare OpenAPI with gateway route policy and security expectations.

## Client Generation Strategy

### TypeScript For `hhc-web`

Generate TypeScript types and thin endpoint functions from OpenAPI only after the route surface stabilizes.

Generated code should live under:

```text
src/lib/api/generated/{service}/
```

Hand-written wrapper code should live outside generated folders:

```text
src/lib/api/client.ts
src/lib/api/public.ts
src/features/admin/api-client.ts
```

Rules:

- Generated code is not edited manually.
- Wrappers own base URL selection, token injection, error normalization, mock fallback, and feature-model mapping.
- Public page components should keep using existing feature API functions during migration.
- Admin clients inject bearer tokens and handle `401`, `403`, validation errors, and precondition conflicts.
- Generated types must not leak Blob URLs, internal service URLs, or draft-only fields into public models.

Recommended phases:

1. Hand-written envelope-aware client with fixtures.
2. Generate TypeScript types from OpenAPI.
3. Replace hand-written DTO types with generated DTO types.
4. Generate endpoint functions only when naming and request shapes are stable.

### TypeScript For `hhc-line-function-bot`

Generate or copy only the small public `hhc-web-api` client surface the bot needs.

V1 bot routes:

```text
GET /api/bulletins/latest
GET /api/bulletins/{issueDate}
```

Rules:

- Bot should not generate admin clients.
- Bot should not receive `asset-api` credentials for public weekly downloads.
- Bot contract tests should validate latest and date-specific bulletin response shapes.

### Go Internal Clients

Start with hand-written Go clients for internal `/priv/*` calls when the surface is small.

Generate Go clients later when:

- more than one service consumes the same internal API
- request/response DTO duplication appears
- contract test maintenance becomes expensive
- internal API routes stabilize

Internal generated clients must still use:

- service identity headers from Dapr/internal invocation
- idempotency keys
- request id and correlation id propagation
- sanitized error handling

## Human Docs And OpenAPI Consistency

`docs/api/*.md` should remain readable and concise. They do not need to duplicate every schema property once OpenAPI exists.

Required consistency:

- base paths match
- route list matches
- auth requirements match
- common request headers match
- common error codes match
- public response examples match OpenAPI examples
- admin role/scope notes match OpenAPI extensions

If OpenAPI and `docs/api/*.md` disagree during implementation review, treat it as a contract failure and fix both before merge.

## Gateway Policy Comparison

CI should compare gateway route policy with OpenAPI route metadata.

Examples:

| OpenAPI Extension | Gateway Expectation |
| --- | --- |
| `x-hhc-route-surface: public` | route under `www.alive.org.tw/api/*`, no JWT required unless explicitly protected |
| `x-hhc-route-surface: admin` | route under `www.alive.org.tw/api/admin/*`, JWT required |
| `x-hhc-route-surface: internal` | route under `/priv/*`, not public |
| `x-hhc-gateway-auth: jwt` | Nginx policy calls local verifier |
| `x-hhc-gateway-auth: line-signature` | POST-only, rate-limited, forwarded to LINE bot for signature validation |
| `x-hhc-authz-action` | service authorization registry contains the action |
| `x-hhc-resource-check` | service policy has object-level authorization tests |
| `x-hhc-cache-policy: no-store` | no public cache headers |

This catches route drift such as accidentally exposing `/priv/*` or making admin APIs available under `admin.alive.org.tw/api/*`.

## Backward Compatibility Policy

Additive changes:

- adding optional response fields
- adding optional request fields
- adding new endpoints
- adding enum values only when old clients can ignore them
- adding new error codes while preserving existing common mappings

Potentially breaking changes:

- removing fields
- changing field type or meaning
- making an optional request field required
- changing route path
- changing auth requirements
- changing pagination shape
- changing error code semantics
- returning draft/private data in a public route

Breaking changes require:

1. compatibility review
2. migration plan
3. client update plan
4. deprecation window when possible
5. release manifest marking the release as `api_breaking`
6. provider-first rollout plan
7. new route name or version only when additive evolution is impossible

Do not add `/api/v1` just for convention.

## Contract Versioning

Use service OpenAPI `info.version` for contract publication.

Recommended format:

```text
YYYY.MM.DD.patch
```

Examples:

```text
2026.07.08.0
2026.07.08.1
```

Rules:

- Patch increments for compatible schema/documentation fixes.
- Date changes when publishing a new reviewed contract.
- Service runtime version can differ from contract version.
- Public API responses do not need to include contract version in every response.
- Contract version should be visible in docs, generated client package metadata, and CI artifacts.

## Fixture Strategy

Use fixtures for stable consumer tests.

Fixture sources:

- OpenAPI examples for generic route shape.
- Seed-generated public API fixtures for current website parity.
- Admin workflow fixtures for validation and state transitions.
- Admin preview fixtures for draft, revision, blocked asset warning, and no-store/noindex behavior.
- Structured content fixtures for every v1 block type and invalid cases for unsafe links, unsupported blocks, raw HTML, editor-library opaque JSON, arbitrary CSS classes, and Blob/SAS URLs.
- Search fixtures for public results, empty results, CJK queries, invalid query validation, stale projection omission, and admin-only draft results when search is enabled.
- Contract snapshots for LINE bot weekly bulletin responses.

Rules:

- Fixtures must not include tokens, cookies, provider secrets, Blob URLs, or SAS URLs.
- Fixtures should include both success and failure examples.
- Seed-generated fixtures should be reproducible through the documented local/test seed workflow.
- Fixture updates require review when public or admin consumer behavior changes.

## CI Gates

Each API-owning service should run:

- OpenAPI syntax validation.
- OpenAPI style linting for envelope/error/header rules.
- Backward compatibility check against the previous released contract.
- Generated client compile check.
- Contract tests for implemented routes.
- Gateway policy comparison for route surface/auth/cache metadata.
- Authorization policy drift check for route action ids, required scopes, resource checks, and field-level response policy.
- Documentation consistency check against `docs/api/*.md` when docs are in the same repo or imported as CI input.
- No production secrets, live provider credentials, production Blob URLs, or production data are required for contract tests.

`hhc-web` should run:

- generated TypeScript client compile.
- wrapper tests for envelope parsing and error normalization.
- feature adapter tests using generated/fixture DTOs.
- rich content renderer contract tests using generated/fixture DTOs for every v1 block type.
- search adapter tests using generated/fixture DTOs when public search UI is enabled.
- admin preview adapter tests for draft/revision render models and blocked asset warnings.
- public route render tests for all locales.
- check that production config does not use `api.alive.org.tw`.

`hhc-line-function-bot` should run:

- bulletin API contract tests.
- response parsing tests for latest and date-specific issue.
- failure handling tests for `404`, `503`, malformed response, and missing `downloadUrl`.

## Review Workflow

For contract changes:

1. Update OpenAPI.
2. Update `docs/api/*.md` summary if route behavior changed.
3. Regenerate clients or DTOs.
4. Update fixtures.
5. Run compatibility and consumer tests.
6. Review gateway route policy impact.
7. Review authorization policy impact when route scopes, action ids, resource checks, or field visibility change.
8. Record release class and compatibility result in the release manifest.
9. Merge service contract change before or with implementation.
10. Roll out consumers after compatible contract is available in staging.

Do not change frontend or bot assumptions without a matching contract update.

## Error Handling Contract

Generated clients should not throw raw transport errors directly into UI/domain code.

Wrappers should normalize to:

```ts
type ApiResult<T> =
  | {ok: true; data: T; meta: ApiMeta}
  | {ok: false; status: number; code: string; message: string; details?: unknown; requestId?: string};
```

Rules:

- UI layers decide how to display errors.
- Bot layers decide reply wording.
- Service clients log request id/correlation id.
- Public UI optional sections can show empty/error states.
- Required pages can map `not_found` to Next `notFound`.

## Generated Code Boundaries

Do not put business logic in generated code.

Generated code may include:

- DTO types
- endpoint parameter types
- raw endpoint functions
- schema constants if tooling supports them

Hand-written wrappers own:

- auth token source
- base URL source
- retry policy
- idempotency key generation
- locale defaulting
- feature model mapping
- mock fallback
- logging
- UI/bot-friendly error mapping

## Rollout Checklist

- [ ] Add `api/openapi.yaml` to each implemented service.
- [ ] Add platform OpenAPI extensions for route surface, gateway auth, cache, roles, and scopes.
- [ ] Add platform OpenAPI extensions for authorization action id, resource check, and data classification where protected routes are involved.
- [ ] Validate OpenAPI in CI.
- [ ] Generate TypeScript DTOs for `hhc-web` after public/admin contracts stabilize.
- [ ] Add contract tests for `hhc-web` public adapters.
- [ ] Add contract tests for structured content render payloads and invalid block/link cases.
- [ ] Add contract tests for public/admin search routes when search is enabled.
- [ ] Add contract tests for `hhc-web` admin preview adapters.
- [ ] Add contract tests for LINE bot weekly bulletin download.
- [ ] Add gateway policy comparison for public/admin/internal routes.
- [ ] Add authorization policy drift checks for protected route action ids and required scopes.
- [ ] Keep `docs/api/*.md` in sync with service OpenAPI.
- [ ] Block breaking changes unless migration and client update plan exist.
