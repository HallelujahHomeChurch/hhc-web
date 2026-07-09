# HHC LINE Bot Platform Integration

This spec defines how `hhc-line-function-bot` integrates with the HHC web platform without coupling the bot to CMS internals, Blob Storage, or account token verification.

API contract governance, generated client boundaries, and LINE bot contract test expectations follow `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

LINE identity storage, group file privacy, group quota/deletion policy, and account-linking privacy rules follow `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`.

LINE webhook body/rate limits, signature-first processing, event dedupe, source/profile function limits, group file quotas, and retry-friendly abuse responses follow `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`.

Weekly bulletin locale selection, no-silent-fallback PDF behavior, per-locale latest issue semantics, and translation governance follow `docs/superpowers/specs/2026-07-08-hhc-cms-localization-translation-and-locale-fallback-governance-design.md`.

## Purpose

The LINE bot is a platform consumer. It can expose church content and save group files, but it should not own website content, asset bytes, or gateway security policy.

The first integration is weekly bulletin download. The expandable integration is LINE group file storage backed by the shared `asset-api`.

## Current Bot Shape

`hhc-line-function-bot` already has a function registry pattern:

- Function names are listed in `src/types.ts` as `FUNCTION_NAMES`.
- Function definitions live in `src/functions/definitions.ts`.
- Function modules are registered in `src/functions/modules.ts`.
- Profile-level and group-level function enablement use `enabledFunctions`.
- Config is loaded from profile JSON and environment variables.

New HHC platform features should follow this pattern instead of creating a separate routing mechanism.

## Integration Principles

1. Public church content is read through `hhc-web-api` public routes.
2. Private or group-owned files are stored through `asset-api /priv/assets/*` using service identity.
3. The bot never calls Azure Blob Storage directly.
4. The bot never constructs public asset URLs by itself.
5. The bot does not call `account-api` to validate user JWTs.
6. LINE webhook authenticity is validated with LINE channel signature, not account JWT.
7. Service-to-service calls use Dapr/mTLS/app-id allowlists.
8. Bot-owned conversation, group, and command metadata stays in the bot database.

## Integration Modes

### Mode 1: Public Read

Use for public website data such as weekly bulletins.

Caller:

- `hhc-line-function-bot`

Target:

- `https://www.alive.org.tw/api/*`

Auth:

- No account JWT.
- Normal public API rate limits.

Example:

```text
GET https://www.alive.org.tw/api/bulletins/latest?locale=zh-Hant
GET https://www.alive.org.tw/api/bulletins/2026-07-12?locale=zh-Hant
```

The requested locale is part of the contract. The bot should not silently accept a different-locale PDF unless the public API explicitly returns fallback metadata and the command was designed to allow fallback.

The response includes a stable gateway asset URL:

```text
https://www.alive.org.tw/api/assets/public/{assetId}
```

### Mode 2: Internal Service Command

Use when the bot needs to create, update, or grant access to platform resources that are not public.

Caller:

- `hhc-line-function-bot` with app id `hhc-line-function-bot`

Targets:

- `asset-api /priv/assets/*`
- Future explicitly allowed `/priv/*` routes

Auth:

- Dapr/mTLS/app-id identity.
- Callee checks allowlist and rejects unknown app ids.

Example:

```text
POST /priv/assets/upload-sessions
POST /priv/assets/{assetId}/complete
POST /priv/assets/{assetId}/grants
```

### Mode 3: Future Protected Member Content

Use only if the bot later exposes member-only or role-protected church content.

Preferred flow:

1. Bot receives LINE event and authenticates LINE signature.
2. Bot maps the LINE source to a known member/account only through an explicit linking flow.
3. Bot requests a protected content or asset URL from the owning domain service.
4. Owning service checks membership and returns a short-lived protected gateway URL or a denial.

The bot must not bypass the owning service by creating direct asset grants for website-owned private content.

## Weekly Bulletin Download

### Function

Add:

```ts
"download_weekly_bulletin"
```

Arguments:

```ts
{
  issueDate?: string;
  dateIntent?: "latest" | "specific_date";
  locale?: "zh-Hant" | "zh-Hans" | "en";
}
```

Environment:

```text
HHC_WEB_API_BASE_URL=https://www.alive.org.tw/api
```

### Flow

1. User asks for the latest weekly bulletin or a specific issue date.
2. Router maps the message to `download_weekly_bulletin`.
3. Handler normalizes locale and date arguments.
4. Handler calls `hhc-web-api` public bulletin endpoint.
5. `hhc-web-api` returns published bulletin metadata and `downloadUrl`.
6. Bot replies with title, issue date, and stable download URL.

### API Boundary

The bot calls:

```text
GET /api/bulletins/latest?locale=zh-Hant
GET /api/bulletins/{issueDate}?locale=zh-Hant
```

The bot does not call:

```text
GET /priv/assets/*
GET /api/assets/admin/*
Azure Blob or SAS URL
```

### Error Handling

| Case | Bot Behavior |
| --- | --- |
| `200` | Reply with title, issue date, and download URL |
| `404` | Reply that the requested issue is not published |
| `429` | Reply with retry-friendly message |
| `5xx` | Reply with temporary unavailable message |
| Timeout | Reply with temporary unavailable message and log dependency timeout |
| Malformed response | Reply with generic failure and log contract error |

### Tests

- Router maps latest bulletin phrases to `download_weekly_bulletin`.
- Router maps date-specific phrases to `issueDate`.
- Disabled function returns `function_disabled`.
- Handler calls `/bulletins/latest` when no date is provided.
- Handler calls `/bulletins/{issueDate}` for a specific date.
- `404` returns a clear not-published reply.
- Timeout and malformed response do not crash the turn.
- Contract test uses the public API response shape from `docs/api/public-api.md`.

## LINE Group File Storage

This is a future extension, but the asset boundary should support it from day one.

### Ownership

The LINE bot owns:

- LINE profile name.
- LINE group, room, or user source id.
- LINE message id.
- File title, tags, and group-visible metadata.
- Search hints and command history.
- The relationship between LINE source and `assetId`.

`asset-api` owns:

- File bytes.
- Asset metadata required for storage.
- Virus scan state.
- Visibility.
- Grants.
- Download policy.
- Retention/lifecycle fields.

### Asset Namespace

Use:

```text
line.group.file
```

Recommended asset metadata:

```json
{
  "namespace": "line.group.file",
  "ownerService": "hhc-line-function-bot",
  "ownerType": "line_group_file",
  "ownerId": "line-group-file:01JZ...",
  "visibility": "restricted",
  "originalFileName": "meeting-notes.pdf",
  "contentType": "application/pdf"
}
```

Bot-owned relation table:

```sql
line_group_file(
  id uuid primary key,
  profile_name text not null,
  line_source_type text not null,
  line_source_id text not null,
  line_message_id text not null,
  asset_id text not null,
  display_name text not null,
  original_file_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  tags text[] not null default '{}',
  created_by_line_user_id text,
  created_at timestamptz not null,
  deleted_at timestamptz,
  unique(profile_name, line_message_id)
)
```

### Save Flow

1. Bot validates LINE signature.
2. Bot deduplicates the LINE event/message id.
3. Bot downloads file content from LINE content API while it is available.
4. Bot creates an `asset-api` upload session with namespace `line.group.file`.
5. Bot uploads bytes and completes the upload.
6. `asset-api` scans or marks the asset pending scan.
7. Bot stores `line_group_file` row with `assetId`.
8. Bot grants restricted read to the LINE source principal.
9. Bot replies that the file is saved only after upload and metadata commit both succeed.

### Retrieval Flow

1. User asks for a saved file by keyword, date, tag, or latest.
2. Bot searches its `line_group_file` rows scoped by profile and LINE source id.
3. Bot requests a permitted download URL from `asset-api` or a future domain wrapper.
4. Bot replies with the matching file and link.

### Grant Model

Suggested principals:

```text
line_group:{profileName}:{groupId}
line_room:{profileName}:{roomId}
line_user:{profileName}:{userId}
service:hhc-line-function-bot
```

Default visibility:

- Group files: `restricted`.
- Direct-user files: `private` or `restricted` to the source user.
- Explicitly shared files: `public` only through a separate share command and audit event.

## Function Roadmap

### Phase A: Public Weekly Download

Create:

- `src/functions/download-weekly-bulletin.ts`
- `src/clients/hhc-web-api.ts`
- `src/__tests__/weekly-bulletin.test.ts`

Modify:

- `src/types.ts`
- `src/function-arguments.ts`
- `src/functions/definitions.ts`
- `src/functions/modules.ts`
- `src/config.ts`
- router eval corpus/tests

No `asset-api` credentials are required in this phase.

### Phase B: Save LINE Group File

Create:

- `src/functions/save-line-group-file.ts`
- `src/clients/asset-api.ts`
- migration for `line_group_file`
- upload/session tests

Modify:

- LINE event handling to detect supported file message types.
- Function registry and function arguments.
- Access policy checks for group file features.

Requires:

- `ASSET_API_APP_ID=asset-api`
- Dapr service invocation configuration.
- Max file size and allowed content-type settings.

### Phase C: Find And Share Group File

Create:

- `src/functions/find-line-group-file.ts`
- `src/functions/share-line-group-file.ts`

Rules:

- Search stays scoped to the LINE source unless an admin/share policy expands it.
- Public sharing is explicit, audited, and reversible.
- The bot still does not construct Blob or SAS URLs.

### Phase D: Protected Member Content

Add only after account/member linking exists.

Rules:

- LINE identity linking is explicit and revocable.
- Content-owning services make authorization decisions.
- Asset grants are derived from domain authorization, not from bot shortcuts.

## Security Requirements

- Validate LINE signature before processing webhook bodies.
- Deduplicate webhook events and message ids.
- Enforce per-profile and per-source rate limits.
- Reject unsupported file types before upload.
- Apply max file size before reading into memory.
- Store secrets in platform secrets, not profile JSON.
- Never log raw file bytes, bearer tokens, LINE channel tokens, SAS URLs, or private download URLs.
- Audit group-file public share and grant changes.
- Fail closed if `asset-api /priv/*` service identity is missing or rejected.

## Observability

Track:

- `line.function.download_weekly_bulletin.calls`
- `line.function.download_weekly_bulletin.errors`
- `line.asset.save.calls`
- `line.asset.save.bytes`
- `line.asset.save.errors`
- `line.asset.retrieve.calls`
- Dependency latency for `hhc-web-api` and `asset-api`

Logs should include:

- `profileName`
- `sourceType`
- hashed `sourceId`
- function name
- dependency status
- `assetId` when available

Logs should not include:

- LINE channel secret.
- LINE channel access token.
- User message text that contains sensitive data unless explicitly needed for debugging in a protected environment.
- Private asset URLs.

## Best-Practice Decision

Weekly bulletin download should be integrated directly through `hhc-web-api` public routes. This is the lowest-coupling design because the bulletin domain owns issue selection, locale fallback, publish state, and public asset URL generation.

LINE group file storage should use `asset-api` directly through internal service identity because the bot owns the group-file domain relationship and does not need `hhc-web-api` to interpret it. This keeps `hhc-web-api` from becoming a proxy for unrelated bot-owned files while still reusing shared storage, grants, scan, and lifecycle behavior.
