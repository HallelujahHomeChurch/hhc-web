# Weekly Bulletin Online Reader — CMS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn one uploaded Traditional Chinese weekly-bulletin PDF into an editable, reviewable, independently publishable structured document while preserving the PDF's page composition.

**Architecture:** `hhc-web-api` remains the sole owner of bulletin drafts, extraction jobs, revisions, and publication. It downloads the already scanned source through the existing `asset-api` contract, runs deterministic PDF geometry parsing and template rules first, and calls the existing Azure OpenAI deployment only for unresolved semantic classification. `admin-fe` edits typed components in a three-column form; there is no canvas editor or new service.

**Tech Stack:** Go 1.25, PostgreSQL, `net/http`, `github.com/ledongthuc/pdf` pinned at `v0.0.0-20250511090121-5959a4027728`, Azure OpenAI structured output, OpenAPI, generated TypeScript client, React, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

## Global Constraints

- V1 structured content locale is exactly `zh-Hant`; UI localization remains independent.
- Existing issue number, date, title, and subtitle are canonical. Extraction reports mismatches and never overwrites them.
- Remove service rosters, attendance totals, and offering names/amounts before any external AI request and do not persist their extracted text or logs.
- Fixed weekly decorations and labels come from a versioned template; AI handles only unresolved semantic roles.
- Initial extraction must preserve source page count, component start pages, reading order, paragraph indentation, and font roles.
- Re-upload produces an immutable Incoming snapshot and a three-way comparison against Base and Local; it never overwrites a draft or published revision.
- Online publication is independent from PDF publication but requires the matching `zh-Hant` PDF edition to be published.
- No new microservice, canvas editor, generic workflow engine, or second authentication model.

---

### Task 1: Add the structured bulletin domain and database schema

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/migrations/sql/026_online_bulletins.sql`
- Create: `internal/onlinebulletins/types.go`
- Create: `internal/onlinebulletins/validation.go`
- Create: `internal/onlinebulletins/validation_test.go`
- Modify: `internal/migrations/migrations_test.go`

**Interfaces:**
- `Document` contains `IssueID`, `ContentLocale`, `TemplateVersion`, `SourceAssetID`, `SourcePageCount`, `Pages`, and `Components`.
- Components are the closed V1 union `cover | sermon | hymnLyrics | backSummary | announcements | victoriesAndPrayers`.
- Text leaves are ordered `Sentence` values with stable IDs and typed `Span` values using `body | scripture | emphasis | reference | foreignText` font roles.
- Draft lifecycle is `extracting | reviewRequired | ready | published | extractionFailed`.

- [ ] Write failing validation tests for valid 1731/1733-shaped documents, duplicate sentence IDs, invalid page/component references, unsupported locale, empty required components, and forbidden back-page component types.
- [ ] Run `go test ./internal/onlinebulletins ./internal/migrations` and confirm failure because the package and migration do not exist.
- [ ] Create normalized top-level tables for document/revision/job state and store each revision's typed document as validated `jsonb`; add unique keys on `(issue_id, content_locale, revision)` and one active draft pointer per edition.
- [ ] Add extraction job leasing columns (`status`, `attempts`, `available_at`, `lease_until`, `last_error_code`) and an index that supports `FOR UPDATE SKIP LOCKED` claims.
- [ ] Keep immutable Base, Incoming, and published revision payloads; Local is a new revision on every successful save, not an in-place JSON update.
- [ ] Validate every write before persistence, cap document size and collection lengths, and reject unknown JSON fields at HTTP boundaries.
- [ ] Run `go test ./internal/onlinebulletins ./internal/migrations` and commit.

```bash
git add internal/migrations internal/onlinebulletins
git commit -m "feat: add structured weekly bulletin domain"
```

### Task 2: Reuse the existing restricted asset download contract

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/assetclient/client.go`
- Modify: `internal/assetclient/client_test.go`

**Interfaces:**
- Add `CreateServiceReadGrant` and `DownloadRestricted`, then compose them with existing `RevokeGrant` against `/priv/assets/{assetID}/grants` and `/priv/assets/{assetID}/download`, using subject type `service` and subject ID `hhc-web-api`.
- Extraction may start only after `Get` reports completed upload, clean scan, and ready/not-required processing.

- [ ] Write failing client tests proving a short-lived service grant, required `X-Asset-Subject-*` headers, URL escaping, timeout/error mapping, bounded non-PDF rejection, response-body ownership, and grant revocation.
- [ ] Run `go test ./internal/assetclient` and confirm the new method is missing.
- [ ] Add the smallest streaming client method; create the service grant only after clean scan, set a one-hour expiry, and revoke it after extraction on success or failure. Do not make the PDF public and do not add an `asset-api` endpoint.
- [ ] Enforce the existing 20 MiB PDF limit again while the parser copies to a temporary file, and close/remove the file on every path.
- [ ] Run `go test ./internal/assetclient` and commit.

```bash
git add internal/assetclient
git commit -m "feat: download clean bulletin sources for extraction"
```

### Task 3: Implement deterministic geometry parsing and exclusion rules

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/onlinebulletins/pdf_parser.go`
- Create: `internal/onlinebulletins/pdf_parser_test.go`
- Create: `internal/onlinebulletins/template_v1.go`
- Create: `internal/onlinebulletins/template_v1_test.go`
- Add test fixtures derived from: `/Users/rayselfs/Downloads/1731-詩篇一百零三篇、基甸的三百勇士.pdf`
- Add test fixtures derived from: `/Users/rayselfs/Downloads/1733-基督的薦信、詩篇卅三篇.pdf`
- Modify: `go.mod`
- Modify: `go.sum`

**Interfaces:**
- `ParsePDF(path string) (GeometryDocument, error)` returns page boxes plus ordered glyph/text runs with font name, size, and coordinates.
- `ApplyTemplateV1(GeometryDocument, CanonicalIssue) (DocumentCandidate, []ReviewIssue, error)` creates components and removes excluded regions before returning any AI-eligible payload.

- [ ] Add minimal redacted fixtures that retain page geometry/text needed for regression without copying service rosters, attendance, or offering data into the repository.
- [ ] Write failing tests for page count, component start pages, two-column reading order, title/body proportions, paragraph indentation, cover arrays, sermon blocks, hymn lyrics, and retained back summary/announcements/victories-prayers.
- [ ] Add `github.com/ledongthuc/pdf@v0.0.0-20250511090121-5959a4027728`; isolate its coordinate/font extraction behind the two functions above instead of introducing a general parser interface.
- [ ] Normalize coordinates to a page-relative 0–1 system while retaining source page boxes; group text into lines/sentences with deterministic tolerances stored in `template_v1.go`.
- [ ] Detect raster-only/encrypted/unmappable PDFs and produce `reviewRequired` with an explicit unsupported-source issue instead of fabricating content.
- [ ] Apply exclusion rectangles and heading rules before building debug output or semantic-classification payloads; tests must assert forbidden strings are absent.
- [ ] Map legal self-hosted font families by semantic role rather than retaining embedded PDF font binaries.
- [ ] Run `go test ./internal/onlinebulletins -count=1` against both reference fixtures and commit.

```bash
git add go.mod go.sum internal/onlinebulletins
git commit -m "feat: parse weekly bulletin page geometry"
```

### Task 4: Add exception-only AI classification and the extraction worker

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/onlinebulletins/azure_openai.go`
- Create: `internal/onlinebulletins/azure_openai_test.go`
- Create: `internal/onlinebulletins/repository.go`
- Create: `internal/onlinebulletins/worker.go`
- Create: `internal/onlinebulletins/worker_test.go`
- Modify: `internal/postgres/repository.go`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `cmd/server/main.go`

**Interfaces:**
- `Classify(ctx, AmbiguousBlocks) (Classifications, error)` accepts only already redacted text blocks and a strict closed JSON schema.
- The worker claims due jobs with a lease, waits for clean assets, parses deterministically, classifies only unresolved blocks, validates the complete candidate, and saves Base + Local revisions atomically.

- [ ] Write failing tests proving unambiguous documents make zero AI calls, forbidden regions never reach the classifier, invalid model output fails closed, and retries do not duplicate revisions.
- [ ] Reuse the existing Azure endpoint/deployment/key/RAI configuration and HTTP conventions; add only extraction enablement, bounded timeout, job polling interval, and max-attempt settings.
- [ ] Keep the current translation implementation separate; share configuration values, not translation prompts or business types.
- [ ] Implement short leased jobs with bounded retry/backoff and stable error codes; never log extracted text or model payloads.
- [ ] Wire one in-process worker goroutine beside the existing publication worker and stop it through the same server context.
- [ ] Run `go test ./internal/onlinebulletins ./internal/config ./internal/postgres ./cmd/server` and commit.

```bash
git add cmd/server internal/config internal/onlinebulletins internal/postgres
git commit -m "feat: extract structured weekly bulletins asynchronously"
```

### Task 5: Add Admin edit, review, compare, and independent publication APIs

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/httpapi/online_bulletin_handlers.go`
- Create: `internal/httpapi/online_bulletin_handlers_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/bulletins/service.go`
- Modify: `internal/bulletins/service_test.go`
- Modify: `openapi.yaml`

**Interfaces:**
- Admin routes live below `/api/admin/bulletins/{issueID}/online/{contentLocale}` and use existing `cms:read`, `cms:write`, and `cms:publish` scopes.
- Required operations: get state, start/retry extraction, save typed Local revision with expected version, list review issues, create Incoming from re-upload, resolve three-way differences, publish, and unpublish.

- [ ] Write failing handler/service tests for canonical metadata mismatch, optimistic-write conflict, invalid component edits, matching-PDF publication prerequisite, immutable published revision, and independent PDF/online failure states.
- [ ] Add routes to the existing trusted Admin mux; do not add a new capability or proxy service.
- [ ] Save with `If-Match`/expected revision and return `409` with current revision metadata on stale writes.
- [ ] Compute Base/Local/Incoming differences at component/block/sentence granularity; unchanged Local values accept Incoming automatically, locally edited values require explicit resolution.
- [ ] Preserve stable sentence IDs for unchanged sentences and write split/merge/remove mappings for every accepted comparison.
- [ ] Publish by atomically pointing the public projection to an immutable ready revision; online publication failure must not alter the PDF version state.
- [ ] Update OpenAPI schemas with bounded arrays, closed enums, and explicit conflict/error responses.
- [ ] Run `go test ./... -race -count=1 -p=1`, `go vet ./...`, migration checks, and commit.

```bash
git add internal openapi.yaml
git commit -m "feat: manage online bulletin revisions"
```

### Task 6: Generate and release the typed Website client

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`
- Modify: package version files changed by the repository's patch-version command

- [ ] Copy the deployed-compatible OpenAPI contract from Task 5 and run `pnpm --filter @hallelujahhomechurch/hhc-web-client generate`.
- [ ] Add only convenience methods needed by the Admin flows; keep generated request/response types authoritative.
- [ ] Write client tests for conditional saves, extraction retry, compare resolution, and online publish/unpublish.
- [ ] Run `pnpm --filter @hallelujahhomechurch/hhc-web-client check:generated`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:packages`, and `pnpm test:consumers`.
- [ ] Apply the next patch version with the repository's existing version command, commit, open a PR, pass CI, merge, publish the package, and record the released version for Task 7.

### Task 7: Build the approved Admin Console editor

**Repository:** `admin-fe`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/BulletinDetailPage.tsx`
- Create: `src/pages/bulletins/OnlineBulletinEditorPage.tsx`
- Create: `src/pages/bulletins/OnlineBulletinEditorPage.test.tsx`
- Create: `src/pages/bulletins/ComponentTree.tsx`
- Create: `src/pages/bulletins/StructuredComponentForm.tsx`
- Create: `src/pages/bulletins/BulletinPagePreview.tsx`
- Create: `src/pages/bulletins/ReviewIssueList.tsx`
- Create: `src/pages/bulletins/ThreeWayCompare.tsx`
- Modify: `src/lib/cms-api.ts`
- Modify: `src/lib/mock-cms-api.ts`
- Modify: `src/preferences/locale-context.tsx`
- Modify: `package.json`
- Modify: lockfile

**Interfaces:**
- Route: `/content/bulletins/:issueId/online/:contentLocale` under the existing bulletin CMS capability.
- Modes: Content Editing, Issue Review, Compare New Version.
- Editing layout: component tree left, structured form center, read-only reconstructed preview right.

- [ ] Write failing routing and interaction tests for each approved mode, dirty-navigation guard, save conflict, extraction status, review resolution, and three-way choice.
- [ ] Update the exact released client package from Task 6; do not duplicate API response types in `admin-fe`.
- [ ] Add an Online Reading entry to the current bulletin detail page without changing the existing PDF upload/publication controls.
- [ ] Implement array controls and typed block editors with native inputs/textareas and explicit reorder/add/remove actions; no drag canvas or rich-text dependency.
- [ ] Keep preview read-only and derive it from the same Local form state; clearly show page boundaries, overflow warnings, source page count, and component start pages.
- [ ] Disable publish until extraction is ready, required reviews are resolved, validation passes, and the matching PDF is published.
- [ ] Implement autosave only after a short idle period, with visible saving/saved/error state and an explicit retry; never overwrite a `409` conflict.
- [ ] Run `pnpm test:run`, `pnpm lint`, `pnpm build`, and commit.

```bash
git add src package.json pnpm-lock.yaml
git commit -m "feat: edit structured weekly bulletins"
```

### Task 8: Release and accept the CMS foundation

- [ ] Release in dependency order: `hhc-web-api`, `frontend-platform`, then `admin-fe`; use one branch, PR, passing CI, merge, and immutable release per repository.
- [ ] Verify migrations complete before the new API revision receives traffic and confirm both worker loops remain healthy.
- [ ] Upload the original 1731 PDF, verify exact source page count/component start pages, resolve review items, edit one sentence, and independently publish the online version.
- [ ] Re-upload the 1731 PDF with one controlled typo correction and verify Base/Local/Incoming comparison preserves the local edit until an explicit choice.
- [ ] Repeat extraction for 1733 and verify excluded back-page data is absent from database rows, application logs, and captured AI requests.
- [ ] Verify the existing PDF download and publication workflow is unchanged even when online extraction is failed or unpublished.
- [ ] Record deployed revisions and smoke evidence before starting the public-reader plan.
