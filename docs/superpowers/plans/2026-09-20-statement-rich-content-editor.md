# Statement Rich Content Editor Implementation Plan

> **Approval gate:** This document is planning only. Do not create implementation worktrees, change runtime code, publish content, or deploy until the user explicitly approves implementation.

**Goal:** Replace the plain-text Statement body editor with a constrained, Word-like rich-content editor that supports inline formatting, paragraph alignment, structured lists and quotes, and up to ten inline images while preserving safe publication, revision, translation, and asset-service boundaries.

**Architecture:** Reuse the existing versioned HHC Rich Content JSON AST in `content_translation.body_json`. `hhc-web-api` remains the only business owner: it validates Statement documents, derives the legacy/plain-text body, maintains normalized image references, coordinates existing `asset-api` upload/grant/download mechanics, builds public projections, and translates text without letting AI alter structure or asset identity. `admin-fe` maps a small TipTap editor surface to the HHC AST. `hhc-web` renders only whitelisted blocks. No new service and no `asset-api`, gateway, account, notification, or engagement code change is planned.

**Repositories in implementation scope:** `hhc-web-api`, `frontend-platform`, `hhc-web`, `admin-fe`

**Repository explicitly out of implementation scope:** `asset-api`

## Re-reviewed product decisions

### Editor behavior

- The rich editor is available only when `module=news` and `kind=statement`; ordinary news/history/video editors keep their current fields.
- Inline commands are `strong`, `emphasis`, and safe links. Bold or italic affects only the current selection, or the next typed text when the caret has that mark active.
- Block commands are paragraph, H2, H3, quote, unordered list, ordered list, and paragraph/heading alignment (`start`, `center`, `end`).
- Alignment affects the selected paragraph(s), not the whole document. Enter inherits the current alignment; a new paragraph after an empty list item exits the list; Enter after a heading creates a paragraph; Shift+Enter inserts a line break.
- Undo and redo operate on editor transactions. Browser/native editing behavior is delegated to the editor library instead of implementing a custom `contenteditable` command engine.
- Images can be inserted between any blocks. A Statement locale may reference at most ten images.
- Image controls are limited to size preset (`small`, `medium`, `full`), alignment (`start`, `center`, `end`), move up/down, replace, and delete.
- A meaningful image requires alt text. A deliberately decorative image must be explicitly marked decorative. Caption is optional.
- Editor has local `Edit` and `Preview` modes. Preview renders current unsaved form state; it does not publish or create a server-side preview resource.
- A new Statement must be saved once before image upload so every asset has a stable owner id. The image action explains this instead of silently auto-saving.

### Toolbar

Desktop order:

```text
[Edit | Preview]
[Undo] [Redo] | [Paragraph / H2 / H3] | [Bold] [Italic] [Link]
| [Bullets] [Numbering] [Quote] | [Align start] [Center] [Align end]
| [Insert image]
```

- The main toolbar remains visible while editing and uses native buttons/selects wrapped in an accessible `role=toolbar`.
- Active toggles use `aria-pressed`; mixed multi-selection state is visually and programmatically distinct.
- Buttons have labels/tooltips and 44px minimum touch targets.
- On narrow screens the toolbar is one horizontally scrollable row; the image action remains visible without opening a second configuration panel.
- Selecting an image shows a contextual toolbar for size, alignment, move, replace, and delete. These image-only actions do not occupy the persistent text toolbar.
- Formatting state follows selection/caret changes. Preview mode hides editing commands and shows a clear return-to-edit action.

### Deliberate limits

The first version does **not** include:

- text color, highlight color, arbitrary font size, font family, or user-controlled line height;
- underline, strikethrough, tables, nested lists, columns, gallery, image float/text wrapping, video/embed blocks, or arbitrary spacing controls;
- arbitrary HTML, Markdown as source, editor-library JSON as source, external image URLs, SVG uploads, or pasted remote images;
- drag-and-drop block reordering; image move up/down is sufficient for the ten-image ceiling;
- a generic page builder or a reusable rich-content microservice.

Typography remains owned by `hhc-web` design tokens: body, H2, H3, quote, caption, and fixed responsive line-height styles. “字級” in this design therefore means semantic block styles, not a free numeric point-size control.

## Canonical Statement document contract

Do not introduce a parallel `StatementDocumentV1`. Extend the existing HHC Rich Content AST specification with two constrained presentation fields, then allow the following subset for Statement bodies:

- blocks: `paragraph`, `heading` levels 2 and 3, `quote`, `list`, `image`;
- inline nodes: `text`, `link`, `lineBreak`;
- marks: `strong`, `emphasis`;
- `alignment: start | center | end` on paragraph and heading blocks, defaulting to `start` when omitted;
- `size: small | medium | full` and `alignment: start | center | end` on image blocks, defaulting to `full` and `center` when omitted.

Draft image example:

```json
{
  "schemaVersion": 1,
  "blocks": [
    {
      "id": "blk_01",
      "type": "paragraph",
      "alignment": "start",
      "content": [
        { "type": "text", "text": "聲明內容", "marks": ["strong"] }
      ]
    },
    {
      "id": "blk_02",
      "type": "image",
      "assetId": "asset_123",
      "size": "medium",
      "alignment": "center",
      "alt": { "mode": "text", "text": "聚會現場" },
      "caption": []
    }
  ]
}
```

Rules:

- Backend rejects unknown fields, block types, marks, enum values, unsafe link schemes, unsafe/internal URLs, duplicate block ids, more than ten image blocks, more than 200 blocks, or more than 100,000 Unicode code points of aggregate text.
- Save permits a referenced image still being scanned, but publish requires every referenced inline image to be upload-complete, scan-clean, and processing-ready.
- Save derives `body` deterministically from `bodyJson` for notification text, search/current compatibility, and legacy consumers. Clients do not maintain two independent body sources.
- Legacy Statement rows with only `body` remain readable as a single paragraph document. No bulk data migration or automatic republish runs in the first release; the first rich-editor save writes canonical `bodyJson`.
- Revision snapshots retain `bodyJson`. Restore revalidates the document and every referenced asset before creating the new draft revision.

Public projections replace draft-only image references with render-ready asset metadata and same-origin gateway URLs. They never contain SAS, Blob, internal-service, upload-target, or object URLs.

## AI translation contract

- Traditional Chinese (`zh-Hant`) remains the saved source.
- Simplified Chinese (`zh-Hans`) uses the existing OpenCC path and transforms every textual field while preserving block ids, block order, block type, marks, links, image references, size, and alignment exactly.
- English, Japanese, and Korean continue to use the existing synchronous Azure OpenAI preview route, rate limits, timeouts, audit policy, and concurrency-two Admin orchestration.
- AI receives only title and ordered text fields: paragraph/heading/quote/list text runs, link labels, image alt text, and captions. It never receives or returns asset ids, image URLs, block ids, block types, ordering, alignment, size, or link destinations.
- The server reconstructs the target document from the source structure plus translated text fields. Unknown/missing/extra translation keys reject the preview.
- Inline marks and link nodes stay attached to their original text run. Editors must still review emphasis and sentence flow because word order differs across languages.
- Generating a missing locale copies the current source structure once. After the preview is accepted and saved, each locale is an independent document; later source edits do not silently overwrite target locales.
- The server computes a content-only source fingerprint from the normalized `zh-Hant` title and translatable AST text. A generated target stores that fingerprint; if the source text later changes, Admin marks the target stale and requires explicit regeneration/replacement. Layout-only edits do not trigger an automatic merge or overwrite.
- Replacing an existing target retains the current explicit confirmation. Translation remains preview-only until the editor presses Save; it never auto-publishes.
- The existing 20,000-character translation input ceiling applies to the aggregate translatable text, not serialized JSON.
- No persistent cross-locale merge engine, field-level synchronization, or automatic “keep layouts in sync” behavior is added in this version.

## Asset boundary

`asset-api` already owns all mechanics needed here. Reuse namespace `cms.news.cover` with owner service `hhc-web-api`, owner type `news`, and purpose `statement_inline`.

`asset-api` continues to own:

- upload sessions and private Blob credentials;
- file type/size policy, malware scan, processing/derivatives, stable downloads, grants, and deletion lifecycle.

`hhc-web-api` owns the new business rules:

- only Statements may request `statement_inline`;
- referenced inline assets must belong to the same Statement;
- maximum ten image references per locale;
- protected Admin preview proxying;
- which referenced assets become public during publication;
- normalized content-to-asset references and revision/publication consistency.

No `asset-api` branch, migration, endpoint, deployment, or release is included. Add contract/integration verification from `hhc-web-api`; if that verification shows the existing namespace policy cannot accept the purpose without code changes, stop and return for plan revision instead of quietly expanding scope.

## Implementation tasks

### Task 0: Update the canonical rich-content specification

**Repository:** `hhc-web`

**Files:**

- Modify: `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- Modify: `docs/superpowers/specs/2026-08-11-five-locale-shared-controls-ai-translation-design.md`

- [ ] Add the two finite presentation enums (`alignment`, image `size`) and the Statement block allowlist.
- [ ] Record the text-only translation reconstruction rule and independent-locale behavior.
- [ ] Keep color, arbitrary font size/line height, raw HTML, and editor-native JSON explicitly out of scope.
- [ ] Review the updated specs before runtime edits. If the contract cannot be expressed as an additive v1 change, stop and version the schema explicitly rather than weakening validation.

### Task 1: Add Statement AST validation and compatibility conversion

**Repository:** `hhc-web-api`

**Files:**

- Create: `internal/content/rich_document.go`
- Create: `internal/content/rich_document_test.go`
- Modify: `internal/content/types.go`
- Modify: `internal/content/service.go`
- Modify: `internal/content/service_test.go`
- Modify: `internal/content/statement_test.go`

- [ ] Define small Go structs for the canonical HHC AST; use strict `encoding/json` decoding and existing public-link safety rules.
- [ ] Validate the Statement-only subset, limits, ids, marks, links, alignments, image metadata, and asset-id shape.
- [ ] Derive stable plain text from blocks for the existing `body` field. Ignore or reject a client-supplied mismatched body so JSON and text cannot drift.
- [ ] Treat a legacy body-only Statement as a one-paragraph document on read without rewriting the row.
- [ ] Continue rejecting `bodyJson` for non-Statement news/history/video records; fixed editorial pages keep their existing page schemas.
- [ ] Add focused unit tests for valid documents, every rejected unsafe shape, legacy conversion, deterministic plain-text derivation, and the ten-image boundary.

**Verification:**

```bash
go test ./internal/content
```

### Task 2: Persist normalized current image references

**Repository:** `hhc-web-api`

**Files:**

- Create: next numbered migration under `internal/migrations/sql/`
- Modify: `internal/migrations/migrations.go`
- Modify: `internal/migrations/migrations_test.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/content_repository_test.go`
- Modify: `internal/postgres/repository_integration_test.go`

- [ ] Add `hhc_web.content_asset_ref(entry_id, locale, block_id, asset_id, purpose)` with keys/foreign keys needed to make the current draft references queryable.
- [ ] Add one nullable generated-translation source fingerprint to `content_translation`; expose `current`, `stale`, or untracked/manual status without storing source text in metadata.
- [ ] Replace references transactionally whenever a Statement translation is saved or restored; deleting a locale deletes only that locale’s current refs.
- [ ] Verify rows exactly match image blocks in `body_json`; do not make this table another editable source of truth.
- [ ] Preserve revision snapshots and existing content version/optimistic concurrency behavior.
- [ ] Do not build speculative orphan cleanup. Removed assets remain governed by current asset retention until a separately reviewed retention policy exists; content deletion must still retire every inline asset that remains referenced/known at deletion time.

**Verification:**

```bash
go test ./internal/migrations ./internal/postgres
```

### Task 3: Reuse the existing news asset flow for inline images

**Repository:** `hhc-web-api`

**Files:**

- Modify: `internal/assetclient/client.go`
- Modify: `internal/assetclient/client_test.go`
- Modify: `internal/httpapi/content_handlers.go`
- Modify: `internal/httpapi/content_handlers_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `openapi.yaml`

- [ ] Extend the existing news upload usage allowlist with `inline -> statement_inline`; reject it for non-Statement news.
- [ ] Reuse JPEG/PNG/WebP, 10 MiB, checksum, scan retry, status polling, ownership checks, and upload completion paths.
- [ ] Before accepting a Statement save/restore, resolve every referenced image through the existing asset client and reject wrong owner, namespace, purpose, or content id. Keep network checks outside the PostgreSQL transaction.
- [ ] For inline completion, return the current content item without assigning a cover field; the editor inserts the returned/known asset id into local `bodyJson`, and the later Save establishes the reference.
- [ ] Add an authenticated `GET /admin/content/news/{contentId}/assets/{assetId}/preview` endpoint that verifies Statement ownership/read permission, streams through the existing `AuthorizedDownload`, supports safe range headers, and returns `private, no-store`.
- [ ] Block preview bytes while scan/processing is not safe; Admin shows pending/failed placeholders using the existing status endpoint.
- [ ] Never expose the upload target or a public grant as the saved preview URL. An in-memory object URL may be used only before reload and must be revoked by the browser.
- [ ] Add an integration contract test against existing `asset-api` behavior. Any required `asset-api` code change is a stop gate.

**Verification:**

```bash
go test ./internal/assetclient ./internal/httpapi
```

### Task 4: Publish and unpublish every referenced inline image atomically

**Repository:** `hhc-web-api`

**Files:**

- Modify: `internal/publication/types.go`
- Modify: `internal/publication/worker.go`
- Modify: `internal/publication/worker_test.go`
- Modify: `internal/publication/asset_adapter.go`
- Modify: `internal/postgres/content_repository.go`
- Modify: `internal/postgres/repository_integration_test.go`
- Modify: `internal/reconcile/` files only where the existing news reconciler requires inline-asset coverage

- [ ] Snapshot the unique inline asset ids for the target version in the existing news publication event; keep cover fields backward compatible.
- [ ] Validate every inline asset belongs to the Statement and is upload-complete, clean, and ready before making a new public projection visible.
- [ ] Create idempotent public grants first, then build each locale’s render-ready `bodyBlocks` with same-origin public URLs and available dimensions/derivatives.
- [ ] Persist the inline grant records needed for idempotent retry and later revoke. If any grant/projection step fails, keep the previous public version visible and compensate newly created grants.
- [ ] On unpublish, remove the public projection first and then revoke inline grants through the existing outbox workflow.
- [ ] Include inline grants/projection references in the existing reconciliation checks; do not add a second workflow or worker.
- [ ] Derive Statement notification text from the canonical plain-text body. Images and captions do not become notification attachments.

**Verification:**

```bash
go test ./internal/publication ./internal/postgres ./internal/reconcile
go test ./...
```

### Task 5: Extend structured translation without exposing layout to AI

**Repository:** `hhc-web-api`

**Files:**

- Modify: `internal/translation/types.go`
- Modify: `internal/translation/service.go`
- Modify: `internal/translation/service_test.go`
- Modify: `internal/translation/prompt.go`
- Modify: `internal/translation/prompt_test.go`
- Modify: `internal/httpapi/translation_handlers_test.go`
- Modify: `openapi.yaml`

- [ ] Flatten only translatable Statement text into deterministic keys and provide ordered context to the existing strict-schema generator.
- [ ] Compute the normalized source fingerprint server-side, return it with a preview, validate it again on save, and retain it when an editor manually adjusts that generated target.
- [ ] Reconstruct the target from the server-held source AST; reject missing, extra, duplicated, or oversized output fields.
- [ ] Preserve link destinations, structure, marks, image asset ids, size, alignment, and ordering outside the model request.
- [ ] Apply OpenCC recursively for `zh-Hans` without an Azure request.
- [ ] Return translated `bodyJson` in the existing preview envelope and retain preview-only/version-mismatch/replace-confirmation semantics.
- [ ] Ensure logs, traces, audit events, and provider error bodies still contain no source or generated content.

**Verification:**

```bash
go test ./internal/translation ./internal/httpapi
```

### Task 6: Publish the typed client contract

**Repository:** `frontend-platform`

**Files:**

- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`

- [ ] Sync the reviewed `hhc-web-api` OpenAPI contract.
- [ ] Export the HHC rich-document draft/public types, inline image upload usage, protected preview method, and structured translation preview type through the existing client.
- [ ] Export generated-translation source fingerprint/status fields through the same generated contract; do not introduce a separate translation-state endpoint.
- [ ] Do not create a second client package or hand-maintain types that are already generated from OpenAPI.

**Verification:** run the repository-required OpenAPI generation plus:

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm build
corepack pnpm pack:packages
corepack pnpm test:consumers
```

### Task 7: Render Statement blocks safely on the public website

**Repository:** `hhc-web`

**Files:**

- Modify: `src/features/news/types.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/news/api.test.ts`
- Modify: `src/components/statements/StatementBody.tsx`
- Create or modify: `src/components/statements/StatementBody.test.tsx`
- Modify: Statement dialog/detail tests that currently assert plain text

- [ ] Accept optional public `bodyBlocks` while retaining `body` fallback for already published/legacy Statements.
- [ ] Render the Statement allowlist through an explicit switch to semantic elements (`p`, `h2`, `h3`, `blockquote`, `ul`/`ol`, `figure`/`img`/`figcaption`).
- [ ] Map only finite alignment/size enums to hard-coded design-system classes. Never accept CMS class names or styles.
- [ ] Render inline marks and safe links as React elements; never use `dangerouslySetInnerHTML`.
- [ ] Use responsive images and intrinsic dimensions when provided; keep full-width images within the article container and preserve aspect ratio.
- [ ] Fail safely on an unknown public block and record the existing renderer error signal without rendering raw payload data.

**Verification:**

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
```

The public renderer must be deployed before Admin can create/publish rich Statements.

### Task 8: Build the constrained Admin editor and toolbar

**Repository:** `admin-fe`

**Files:**

- Modify: `package.json`
- Modify: lockfile
- Create: `src/components/rich-content/StatementRichEditor.tsx`
- Create: `src/components/rich-content/statement-document.ts`
- Create: `src/components/rich-content/StatementDocumentPreview.tsx`
- Create: focused tests beside those files
- Modify: `src/pages/content/ContentEditorPage.tsx`
- Modify: `src/pages/content/ContentEditorPage.test.tsx`
- Modify: `src/lib/cms-api.ts`
- Modify: relevant locale message files
- Modify: shared stylesheet only for editor-specific classes that cannot be expressed locally

- [ ] Add the minimum TipTap packages needed for React integration, starter editing behavior, links, and text alignment. Do not add a second UI kit or generic page-builder dependency.
- [ ] Implement explicit HHC AST <-> editor-state adapters; never persist TipTap JSON.
- [ ] Configure only the approved blocks/marks, paste sanitization, heading/list/Enter behavior, history, selection-aware toolbar state, and keyboard shortcuts.
- [ ] Implement the persistent and contextual toolbars exactly as specified above, including accessible names, focus behavior, touch targets, disabled states, and mobile overflow.
- [ ] Insert uploaded images at the current block position, poll existing scan status, show safe placeholders, require alt/decorative selection before publish, and cap each locale at ten images.
- [ ] Keep local object URLs ephemeral and revoke them on replace/remove/unmount. Persist only `assetId` and semantic image metadata.
- [ ] Use the same AST preview renderer in local Preview mode; no new server preview route or public draft URL.
- [ ] Update translation preview insertion so the returned target `bodyJson` replaces only the target locale after confirmation; image blocks and layout arrive from the server-preserved source structure.
- [ ] Show a stale badge when the saved generated-target fingerprint no longer matches the current source fingerprint; regeneration still requires explicit replacement confirmation.
- [ ] Include `bodyJson` in dirty-state, navigation-blocker, reload, revision restore, and save behavior.
- [ ] Keep ordinary content editor behavior unchanged through a narrow `isStatement` branch rather than splitting the full page into a new editing framework.

**Verification:**

```bash
corepack pnpm test:run
corepack pnpm lint
corepack pnpm build
```

### Task 9: Cross-repository acceptance and release gates

- [ ] Create one isolated worktree per affected repository from the then-current `origin/main`; read each repository’s current `AGENTS.md` and README before editing.
- [ ] Keep each repository change in a separate focused branch and PR. Do not combine releases or call local tests CI.
- [ ] Merge/release in this order: `hhc-web-api` -> `frontend-platform` package -> `hhc-web` -> `admin-fe`.
- [ ] Keep backend additions backward compatible so old frontend deployments continue to read/write plain Statements during rollout.
- [ ] Verify immutable revision, health/readiness, and route availability separately for each released service/application.
- [ ] Run authenticated Admin smoke checks on a non-public draft: selection-only bold/italic, paragraph alignment inheritance, lists, links, multiple image positions, size/alignment, pending/failed scan states, reload, local preview, undo/redo, translation preview, save, and revision restore.
- [ ] Run public renderer checks against a controlled non-production fixture or explicitly approved production test content. Production publish/unpublish is a separate content mutation and requires explicit approval.
- [ ] Confirm public DOM/projection contains semantic HTML and no raw HTML, SAS/Blob/internal URLs, or draft asset ids lacking a public grant.
- [ ] Confirm legacy body-only Statements still render and no existing published Statement was automatically republished.
- [ ] Preserve worktrees if CI/release/smoke fails; clean up only after merge, successful release, and verified smoke results.

## Acceptance criteria

- Editors can apply bold/italic/link to selected text without affecting unrelated text.
- Paragraph/heading alignment is block-scoped and inherited by the next paragraph as described.
- Editors can insert up to ten owned images between arbitrary blocks and control only approved size/alignment presets.
- The toolbar works by keyboard, pointer, and touch and accurately reflects selection state.
- Saved content is canonical HHC AST; no HTML, Markdown, or TipTap JSON is stored.
- Public rendering uses a whitelist and never `dangerouslySetInnerHTML`.
- Draft preview never creates a public asset grant.
- Publish becomes visible only after all referenced images are clean/ready and publicly granted; failure preserves the prior public version.
- Translation changes text only. Image identity, location, size, alignment, block order, and link destination are server-preserved.
- Translated locales are independently editable after save; future source edits never silently overwrite them.
- Existing plain-text Statements remain compatible without a bulk migration.
- `asset-api`, `api-gateway`, `account-api`, `notification-api`, and `engagement-api` have no code changes for this feature.

## Stop gates

Stop and return for review if any of these becomes necessary:

- changing `asset-api` namespace policy or API code;
- adding a new public/admin gateway route rather than using the existing hhc-web-api route family;
- changing the HHC rich-content schema incompatibly without a new schema version;
- storing editor-native JSON or raw HTML;
- publishing before the public renderer is deployed;
- weakening scan/readiness, ownership, link-safety, optimistic-concurrency, revision, audit, or authorization checks;
- adding color/font/line-height controls, layout grids, arbitrary resizing, or automatic cross-locale synchronization;
- mutating production content or infrastructure without separate explicit approval.

## Plan review verdict

The plan is implementable with the current service boundaries. The review removed three unnecessary ideas: a Statement-specific document format, a new rich-content service, and an `asset-api` change. It also keeps preview local, reuses the existing upload/status/publication/translation workflows, and introduces only one editor dependency family where native `contenteditable` would otherwise recreate selection, history, list, paste, and accessibility behavior unsafely.

The main implementation risks are multi-asset publication compensation, AST/editor round-trip fidelity, and translated inline-run quality. Each has a focused test/stop gate above. No unresolved product choice blocks implementation approval.
