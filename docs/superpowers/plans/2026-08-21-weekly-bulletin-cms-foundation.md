# Weekly Bulletin Online Reader — CMS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revised:** 2026-10-01. Member access follows download authorization. User-supplied 1739/1740 replace unavailable 1731/1733 originals as the initial acceptance corpus; legacy mixed-paper acceptance remains separate.

**Goal:** Turn one uploaded general Traditional Chinese weekly-bulletin PDF into an editable, reviewable, independently publishable structured document while preserving the PDF's page composition.

**Architecture:** `hhc-web-api` remains the sole business owner of bulletin drafts, extraction jobs, revisions, mappings, and publication. A scheduled extractor runtime built from the same repository uses its managed identity to call the existing restricted `asset-api` contract over internal HTTPS, runs Poppler geometry extraction and template rules, and calls the existing Azure OpenAI deployment only for unresolved semantic classification; the public API runtime never parses PDFs. `admin-fe` edits typed components in a responsive form with a shared read-only paper renderer; there is no canvas editor or new business service.

**Tech Stack:** Go 1.25, PostgreSQL, `net/http`, Poppler `pdftohtml` XML geometry output, Azure Container Apps Job, Azure OpenAI structured output, OpenAPI, generated TypeScript client, React, Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-weekly-bulletin-online-reader-design.md`

## Global Constraints

- V1 extraction template is general `zh-Hant` (1739/1740). Storage/contracts use `(issueID, series, contentLocale)` everywhere; other editions retain PDF-only behavior until their own template acceptance.
- Member access reuses the exact download checker; no new reader roles/permissions/grants. Staff `cms:bulletins:*` does not confer member access.
- UI localization remains independent. Shared chrome uses existing UI tokens; Admin and Website use one paper renderer.
- Existing issue number, date, title, and subtitle are canonical. Extraction reports mismatches and never overwrites them.
- Remove service rosters, attendance totals, and offering names/amounts before any external AI request and do not persist their extracted text or logs.
- Fixed weekly decorations and labels come from a versioned template; AI handles only unresolved semantic roles.
- Initial extraction must preserve source page count, component start pages, reading order, paragraph indentation, and font roles.
- Every immutable revision owns an immutable layout manifest containing its page instances, normalized boxes/slots/continuations, template version, and permanent versioned template/font asset URLs with SHA-256 checksums; later text edits may deliberately repaginate by creating a new manifest.
- Re-upload produces an immutable Incoming snapshot and a three-way comparison against Base and Local; it never overwrites a draft or published revision.
- Online publication is independent from PDF publication but requires the matching `zh-Hant` PDF edition to be published.
- Draft saving is explicit. Idle recovery is browser-local only and never creates a server revision.
- No new business microservice, canvas editor, generic workflow engine, or second authentication model.

## Review Focus

- Same issue/language in two series must not share jobs/pointers/mappings: Task 2 tests composite identities.
- Canonical corrections remain possible without stale confirmation: Task 8 tests invalidation/republish.
- Admin preview must match published font/geometry: Tasks 7 and 9 pin and verify the shared renderer.
- A 1024px iPad editor has less width after its sidebar: Task 10 tests container breakpoints and save visibility.
- Replaced PDF bytes cannot masquerade as an old source: Tasks 8 and 10 verify checksums and label mismatches.

---

### Task 1: Prove the PDF geometry parser with controlled originals and sanitized CI fixtures

**Parser gate passed (2026-10-01):** API commit `e1dc919`, PR #137, CI run
`36747874128` passed all required checks. Controlled 1739/1740 originals and
sanitized fixtures passed Poppler 25.03.0 geometry validation. This is not a
renderer/UI acceptance or production release. Extraction-job identity persistence
is still implemented/verified with Tasks 2/6; this baseline records the parser
version in its goldens. PR approval/merge remains pending.

**Repository:** `hhc-web-api`

**Files:**
- Create: `scripts/verify-bulletin-pdf-geometry.sh`
- Create: `internal/onlinebulletins/testdata/1739-sanitized.pdf`
- Create: `internal/onlinebulletins/testdata/1740-sanitized.pdf`
- Create: `internal/onlinebulletins/testdata/1739-geometry.golden.json`
- Create: `internal/onlinebulletins/testdata/1740-geometry.golden.json`
- Create: `Dockerfile.extractor` with a `geometry-probe` target
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- The probe runs `pdftohtml -xml -zoom 1 -noroundcoord -hidden -nomerge -fontfullname` in an empty temporary directory and records every page box, ordered text boxes with non-zero width/height/font data/decoded UTF-8, and positioned extracted-image checksums.
- This task is a hard gate: Tasks 2–11 do not begin until both original PDFs pass a controlled local probe and both sanitized full-layout fixtures pass the same assertions in CI. Original PDFs/output remain outside Git and are used again only for controlled release acceptance.

- [ ] Do not add the previously rejected `github.com/ledongthuc/pdf` dependency. Verify Poppler geometry directly; earlier zero-width observations are historical evidence, not a required fabricated failure.
- [ ] Write the probe assertions for 1739 page count `12`, 1740 page count `16`, all page boxes A4 `595.32x841.92`, non-zero text boxes, decoded synthetic `COVER_WELCOME`/`COVER_WORSHIP`/`COVER_WORK`/`COVER_WORD`, stable two-column hymn reading order, and known component start-page sentinels. Poppler XML page sizes are truncated, so use `pdfinfo` for precise source boxes and accumulate document-scoped font definitions across pages.
- [ ] Run the probe against the two original PDFs in `/Users/rayselfs/Downloads`, confirm Chinese CID text has non-zero geometry and the expected reading order, and record only source SHA-256, Poppler version, page-box/count booleans, and pass/fail—not extracted text or XML.
- [ ] Produce two committed, full-page sanitized fixture PDFs from the approved geometry: replace all real text with synthetic tokens rendered in a redistributable substitute CJK font while retaining page boxes, size classes, coordinates, columns, synthetic image slots, and excluded rectangles. Re-render every image/QR as synthetic pixels; never copy original embedded fonts/images or service roster, attendance, offering, sermon, or member text.
- [ ] Add a fixture scan that rejects unknown embedded font names, original image checksums/metadata, URLs/QR payloads, and any non-allowlisted text token before Git/CI accepts the PDFs.
- [ ] Run the Poppler command against the sanitized fixtures and save only synthetic geometry/text sentinels in the golden files.
- [ ] Fail the gate on missing Poppler, zero-width CID text, changed page box/count, undecodable text, or reading-order mismatch.
- [ ] Build/run the probe through `Dockerfile.extractor`'s production-equivalent `geometry-probe` target in CI; record `pdftohtml -v` in test output and include that version in `extractor_version` so parser upgrades create new extraction identities. Task 6 extends the same file with the final binary target rather than introducing a second image definition.
- [ ] Run `./scripts/verify-bulletin-pdf-geometry.sh` and commit the passing probe before schema or worker implementation.

```bash
git add .github/workflows/ci.yml Dockerfile.extractor scripts/verify-bulletin-pdf-geometry.sh internal/onlinebulletins/testdata
git commit -m "test: prove weekly bulletin PDF geometry extraction"
```

### Task 2: Add the structured bulletin domain and database schema

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/migrations/sql/NNN_online_bulletins.sql`
- Create: `internal/onlinebulletins/types.go`
- Create: `internal/onlinebulletins/validation.go`
- Create: `internal/onlinebulletins/validation_test.go`
- Modify: `internal/migrations/migrations_test.go`
- Modify: `openapi.yaml` components for the domain-only Document/Manifest types consumed by Task 3a

**Interfaces:**
- `Document` contains `IssueID`, `Series`, `ContentLocale`, `TemplateVersion`, `SourceAssetChecksum`, `SourcePageCount`, `Pages`, `LayoutManifest`, and `Components`. Mutable source asset IDs live only on extraction jobs/current PDF edition state, never immutable Online revisions.
- `LayoutManifest` is revision-owned and immutable: page instances, normalized content boxes/template slots/continuations, template asset URLs + SHA-256, and legal self-hosted font URLs + SHA-256. Published and offline clients never resolve mutable “latest” assets.
- Revision/manifest schema includes `contentHash`, `rendererVersion`, `rendererArtifactSha256`, and `layoutValidationHash`. Validation hash covers content, renderer/paper CSS, template/font hashes and measured manifest; publishing rejects any mismatch.
- Components are the closed V1 union `cover | bodySection | hymnLyrics | backSummary | announcements | victoriesAndPrayers`; `bodySection.kind` is `sermon | testimony | teaching | reflection | unknown`, and `unknown` always creates a blocking review issue.
- Text leaves are ordered `Sentence` values with stable IDs and typed `Span` values using `body | scripture | emphasis | reference | foreignText` font roles.
- Draft lifecycle is `extracting | reviewRequired | ready | published | extractionFailed`.
- Allocate NNN from the next unused forward-only migration on current main (026/027 are applied). Revision mappings are stored in this Online schema migration with the approved statuses `unchanged | moved | split | merged | removed | requires_review`; ambiguous proposals remain `requires_review` until Admin confirms them.

- [ ] Write failing validation tests for valid 1739/1740-shaped documents, all five body-section kinds, blocking `unknown`, duplicate sentence IDs, invalid page/component references, unsupported series/locale, same-locale general/children isolation, unsupported template, empty required components, and forbidden back-page component types.
- [ ] Run `go test ./internal/onlinebulletins ./internal/migrations` and confirm failure because the package and migration do not exist.
- [ ] Create normalized top-level tables for document/revision/job state and store each revision's typed document as validated `jsonb`; add unique keys on `(issue_id, series, content_locale, revision)` and one active draft pointer per edition.
- [ ] Add extraction job leasing columns (`status`, `attempts`, `available_at`, `lease_until`, `last_error_code`) and an index that supports `FOR UPDATE SKIP LOCKED` claims.
- [ ] Make extraction idempotent with a unique `(issue_id, series, content_locale, source_asset_checksum, template_version, extractor_version)` key and exact job states `queued | parsing | review_ready | failed`; draft review disposition remains separate.
- [ ] Complete extraction with a compare-and-swap against the edition's current source asset ID + checksum. A superseded job may persist diagnostics but cannot create/replace Base, Local, Incoming, or published pointers.
- [ ] Keep immutable Base, Incoming, and published revision payloads; Local is a new revision on every successful save, not an in-place JSON update.
- [ ] Add client-facing mapping checkpoints to the Online schema migration only when a new revision is published: compare the previous published revision directly to the new published revision and persist complete unchanged/moved/split/merged/removed/requires_review mappings. Draft saves/compare/restore preserve stable IDs and may compute temporary review diffs, but do not consume migration checkpoints; publication rejects unresolved `requires_review` mappings.
- [ ] Retain published checkpoints with their immutable revisions; the private API may compose any historical published checkpoint to current and bounds the composed sentence arrays/document size rather than imposing a transition-count ceiling.
- [ ] Validate every write before persistence, cap document size and collection lengths, and reject unknown JSON fields at HTTP boundaries.
- [ ] Run `go test ./internal/onlinebulletins ./internal/migrations` and commit.

```bash
git add internal/migrations internal/onlinebulletins
git commit -m "feat: add structured weekly bulletin domain"
```

### Task 3: Publish the permanent Template V1 asset bundle

**Repository:** `hhc-web`

**Files:**
- Create: `public/assets/weekly/v1/manifest.json`
- Add: legal redistributable font/decorative bytes below `public/assets/weekly/v1/`
- Create: `scripts/verify-weekly-template-assets.mjs`
- Modify: `next.config.ts`
- Modify: `package.json`

**Interfaces:**
- Fixed Template V1 bytes are code-owned website assets, not uploaded bulletin content. Every filename is content-hashed, `manifest.json` records SHA-256/MIME/size, and URLs use permanent `/assets/weekly/v1/...` paths rather than `next/font` build-generated URLs.
- A published template directory is append-only: later releases may add `/v2`, but must not mutate/delete `/v1` while any revision can reference it.

- [ ] Add only licensed substitute fonts and fixed church-owned/synthetic decorations required by Template V1; record license/source alongside the bundle and exclude source PDF font/image bytes.
- [ ] Add immutable cache headers for content-hashed files, verify manifest checksums against bytes, and fail CI if a previously published versioned path changes or disappears.
- [ ] Release this asset-only `hhc-web` change before CMS extraction can publish a revision; smoke every manifest URL through `www.alive.org.tw`, including checksum and cache headers.
- [ ] In a separate `api-gateway` branch/PR, add an exact Admin-host `/assets/weekly/` location before its generic `/assets/` rule and proxy it to the existing `hhc-web` upstream. Update the existing Admin-host asset fragment (resolve its include from `conf.d/default.conf`, do not add locations there), `docs/openapi.yaml`, `docs/openapi_test.go`, and routing tests; permit only GET/HEAD, preserve immutable cache headers, and prove the same manifest URLs/checksums work on both `www.alive.org.tw` and `admin.alive.org.tw` without loosening CSP.

```bash
git add next.config.ts package.json public/assets/weekly scripts/verify-weekly-template-assets.mjs
git commit -m "feat: publish weekly bulletin template assets"
```

### Task 3a: Release the shared renderer and authoritative measurement artifact

**Repository:** `frontend-platform`

**Files:**
- Create: `packages/ui/src/bulletin-reader/BulletinDocumentRenderer.tsx`, test, `paper.css`, `measure.ts`
- Modify: existing UI package exports/build configuration
- Create: `scripts/measure-bulletin-layout.mjs` with a pinned Chromium runner used by the isolated worker

**Interfaces:**
- `BulletinDocumentRenderer({document, manifest, mode, activePage, sentenceState?, onSentenceActivate?})` is the one pure paper renderer. Admin and Website import it; chrome stays outside.
- `measureBulletinLayout(document, templateAssets)` runs the same renderer at unscaled paper dimensions after `document.fonts.ready`, returning line/page/overflow geometry bound to content/renderer/font hashes. The server chooses assets; no arbitrary URLs/scripts are accepted.
- The pinned Node/Chromium runner executes in the isolated extractor image, never the public Go API. Reuse existing browser tooling if suitable; otherwise add only the pinned runner needed for authoritative text measurement.
- Generate the domain-only content/manifest types from Task 2 OpenAPI components before building this artifact; Task 9 later adds endpoint clients. UI consumes these generated types rather than inventing a second content schema.
- Renderer version is independent of package release. Use a static supported-renderer registry, initially only immutable V1; retain referenced implementations/paper CSS and their reproducible artifact digests. Admin/worker/Website select an exact entry or return update-required. Document JSON never supplies executable import URLs.

- [ ] Prove sanitized 1739/1740 layout, substitute-font proportions, one typo edit and explicit continuation with this renderer. Unfittable text blocks publication; never silently shrink/truncate.
- [ ] Test Admin/Website geometry parity at identical versions, scoped CSS isolation, deterministic post-font-load measurement, missing fonts, timeout, stale content hash and overflow.
- [ ] Publish a new UI package/renderer version in a fixture test, then reopen old revisions in Admin/Website/offline mode. Require identical old geometry and digest selection; unknown/mismatched renderer must fail visibly rather than use latest. CI rejects mutation/removal of referenced V1 assets.
- [ ] Export one renderer/CSS from existing UI package; no independent preview layout or second sentence wrapper.
- [ ] Run shared UI tests/lint/build/packed-consumer checks, publish the versioned renderer/measurement artifact, and pin its exact version/digest in extractor builds. Record artifact and font checksums before Task 7.

### Task 4: Verify and authorize only the extractor workload delta

**Repository:** `asset-api`

**Files:**
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `cmd/server/main.go`
- Modify: `internal/httpapi/handler_test.go`
- Modify: `infra/main.bicep`
- Modify: `infra/main.bicepparam.example`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/check-what-if.sh`
- Modify: `scripts/test-what-if-policy.sh`
- Modify: `scripts/test-release-workflow.sh`
- Create: `scripts/ensure-workload-app-role.sh`
- Create: `scripts/ensure-workload-app-role.test.sh`

**Interfaces:**
- The extractor reuses the existing user-assigned `hhc-web-api-identity` and requests an access token for the existing `asset-api` EasyAuth audience; no extra identity is needed for the same owner boundary.
- `asset-api` maps that identity's exact client ID + object ID to the existing caller/owner service `hhc-web-api`; no new asset owner or browser route is introduced.

- [ ] Inventory existing watermark-worker delegation, workload transport and identity/app-role assignment first. Reuse owner-client/auth primitives, but keep Poppler/Chromium in a separate extractor process/image. Skip duplicate config/assignments if an existing exact mapping already satisfies the boundary.
- [ ] Write failing config/auth tests for any required extractor client/object-ID pair, wrong tenant/audience/issuer/role, swapped LINE/extractor identity, and the resulting trusted caller exactly `hhc-web-api`.
- [ ] Only if no existing equivalent mapping applies, add explicit `ASSET_EXTRACTOR_WORKLOAD_CLIENT_ID` / `ASSET_EXTRACTOR_WORKLOAD_OBJECT_ID` configuration and include that pair in `WorkloadAuthConfig.Callers` as service `hhc-web-api`; keep the LINE pair, required `Asset.Invoke` role, and existing Dapr callers unchanged.
- [ ] Add the existing `hhc-web-api-identity` client/object-ID pair to EasyAuth `allowedApplications` and `allowedPrincipals`, and pass its identifiers through reviewed deployment parameters without logging them.
- [ ] Reuse existing role-assignment tooling; only if absent, add an idempotent, tested release helper that resolves the existing identity and asset API service principals, creates the exact `Asset.Invoke` app-role assignment only after reviewed deployment approval, and otherwise performs a read-only check. Run apply mode only under the existing Entra deployment identity with app-role-assignment authority; if that authority is unavailable, stop for the platform owner instead of bypassing the role. Stop on missing/duplicate/wrong-resource assignments and never broaden consent.
- [ ] Before enabling extraction, acquire a real managed-identity token and verify `aud`, `appid`, `oid`, and `roles: Asset.Invoke`, then smoke a least-privilege owned-asset read through EasyAuth.
- [ ] Run the repository's Go, Bicep, what-if-policy, release-policy, and auth smoke checks; release `asset-api` before enabling the extractor Job.

```bash
git add .github/workflows/release.yml cmd internal infra scripts/check-what-if.sh scripts/test-what-if-policy.sh scripts/test-release-workflow.sh scripts/ensure-workload-app-role.sh scripts/ensure-workload-app-role.test.sh
git commit -m "feat: authorize bulletin extractor asset access"
```

### Task 5: Reuse the existing restricted asset download contract

**Repository:** `hhc-web-api`

**Files:**
- Modify: `internal/assetclient/client.go`
- Modify: `internal/assetclient/client_test.go`
- Modify: `go.mod`
- Modify: `go.sum`

**Interfaces:**
- Reuse existing `CreateServiceGrant`, `AuthorizedDownload`, and `RevokeGrant` against `/priv/assets/{assetID}/grants` and `/priv/assets/{assetID}/download`, using subject type `service` and subject ID `hhc-web-api`.
- Extraction may start only after `Get` reports completed upload, clean scan, and ready/not-required processing.
- The API server continues using its existing Dapr asset base URL. `cmd/extractor` uses a role-specific config loader with the internal HTTPS asset URL/audience and `azidentity` credential; it must not call the server `config.Load()` path that requires inbound `APP_API_TOKEN`.

- [ ] Write failing client tests proving a short-lived service grant, required `X-Asset-Subject-*` headers, URL escaping, timeout/error mapping, bounded non-PDF rejection, response-body ownership, grant revocation, and retry after a revoked grant.
- [ ] Reuse the already installed Azure Identity SDK and compatible workload transport; set `AZURE_CLIENT_ID` to the existing `hhc-web-api-identity` on the Job, request the configured EasyAuth audience, attach `Authorization: Bearer`, and test token acquisition/refresh without persisting tokens.
- [ ] Run `go test ./internal/assetclient` and confirm the extraction-specific bounded-stream/auth test fails before modifying existing methods.
- [ ] Extend existing streaming methods only where extraction needs differ; create the service grant only after clean scan, use idempotency key `online-extract:{jobID}:{attempt}`, set a one-hour expiry, and revoke it after that attempt on success or failure. Do not make the PDF public and do not add an `asset-api` endpoint.
- [ ] Enforce the existing 20 MiB PDF limit again while the parser copies to a temporary file, and close/remove the file on every path.
- [ ] Run `go test ./internal/assetclient` and commit.

```bash
git add go.mod go.sum internal/assetclient
git commit -m "feat: download clean bulletin sources for extraction"
```

### Task 6: Implement deterministic geometry parsing and exclusion rules

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/onlinebulletins/pdf_parser.go`
- Create: `internal/onlinebulletins/pdf_parser_test.go`
- Create: `internal/onlinebulletins/template_v1.go`
- Create: `internal/onlinebulletins/template_v1_test.go`
- Reuse: `internal/onlinebulletins/testdata/1739-sanitized.pdf`
- Reuse: `internal/onlinebulletins/testdata/1740-sanitized.pdf`
- Modify: `Dockerfile.extractor`

**Interfaces:**
- `ParsePDF(path string) (GeometryDocument, error)` returns page boxes, ordered text boxes with font name/size/coordinates, and extracted-image references identified by page + bounding box + dimensions + checksum. Poppler XML does not provide PDF object IDs.
- `ApplyTemplateV1(GeometryDocument, CanonicalIssue) (DocumentCandidate, []ReviewIssue, error)` creates components and removes excluded regions before returning any AI-eligible payload.

- [ ] Reuse the Task 1 sanitized fixtures and add only small synthetic XML fragments needed for parser edge cases; do not create a second fixture set.
- [ ] Write failing tests for page count and per-page boxes, component start pages, two-column reading order, title/body proportions, paragraph indentation, cover arrays, every body-section kind, hymn lyrics, and retained back summary/announcements/victories-prayers.
- [ ] Parse the proven Poppler XML output with Go's `encoding/xml`; invoke `pdftohtml` through `exec.CommandContext` with the exact Task 1 flags and reject non-zero exit, stderr overflow, malformed XML, missing page boxes, or zero-width text.
- [ ] Normalize coordinates to a page-relative 0–1 system while retaining source page boxes; group text into lines/sentences with deterministic tolerances stored in `template_v1.go`.
- [ ] Load the already-live Task 3 manifest, verify every remote byte/checksum, and build the initial revision's immutable `LayoutManifest` from those permanent URLs plus page boxes; validate that every component/sentence is assigned to a page slot or explicit continuation. Extraction cannot become `ready` if a referenced asset is missing or changed.
- [ ] Match embedded-image checksums and slots against immutable Template V1 assets; retain only references in parser evidence, and create a blocking review issue for any unknown image because V1 content schema has no dynamic image block.
- [ ] Detect raster-only/encrypted/unmappable PDFs and produce `reviewRequired` with an explicit unsupported-source issue instead of fabricating content.
- [ ] Put synthetic `DROP_*` sentinels inside every excluded rectangle and adjacent `KEEP_*` sentinels in retained regions; assert snapshots/debug metadata/AI payloads contain `KEEP_*` but never `DROP_*`, while logs contain neither sentinel nor extracted text.
- [ ] Map legal self-hosted font families by semantic role rather than retaining embedded PDF font binaries.
- [ ] Build a non-root extractor image containing only the Go extractor binary, Poppler runtime, and CA certificates; the public API image remains unchanged. Task 7 adds the pinned Node/Chromium layout runner only to this isolated image, with bounded processes/resources and no network navigation or untrusted script execution.
- [ ] Run `go test ./internal/onlinebulletins -count=1` against both reference fixtures and commit.

```bash
git add Dockerfile.extractor internal/onlinebulletins
git commit -m "feat: parse weekly bulletin page geometry"
```

### Task 7: Add exception-only AI classification and the isolated extraction job

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/onlinebulletins/azure_openai.go`
- Create: `internal/onlinebulletins/azure_openai_test.go`
- Create: `internal/onlinebulletins/repository.go`
- Create: `internal/onlinebulletins/worker.go`
- Create: `internal/onlinebulletins/worker_test.go`
- Create: `cmd/extractor/main.go`
- Modify: `internal/postgres/repository.go`
- Modify: `internal/config/config.go`
- Modify: `internal/config/config_test.go`
- Modify: `infra/main.bicep`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/check-what-if.sh`
- Modify: `scripts/test-what-if-policy.sh`
- Modify: `scripts/test-release-policy.sh`

**Interfaces:**
- `Classify(ctx, AmbiguousBlocks) (Classifications, error)` accepts only already redacted text blocks and a strict closed JSON schema.
- The worker claims due jobs with a lease, waits for clean assets, parses deterministically, classifies only unresolved blocks, and validates the complete candidate. Initial extraction atomically saves Base + Local; re-upload saves Incoming only and leaves Local/published pointers unchanged.

- [ ] Add a leased `validate_layout` job variant for drafts using Task 3a's shared runner. Only matching content/renderer/font hashes can transition to ready; missing fonts, timeout, nonzero exit or overflow creates blocking review findings, never changes publication.
- [ ] Write failing tests proving unambiguous documents make zero AI calls, instruction-like PDF text remains inert data, forbidden regions never reach the classifier, every allowed text fragment is assigned exactly once, repeated identical input is byte-deterministic, invalid model output fails closed, retries do not duplicate revisions, initial extraction creates Base + Local, and re-upload creates only Incoming without changing Local/published pointers.
- [ ] If Azure OpenAI is disabled, unavailable, times out, or returns invalid output, persist the deterministic candidate as `review_ready` with blocking review issues for unresolved blocks; do not discard it or retry forever.
- [ ] Reuse the existing Azure endpoint/deployment/key/RAI configuration and HTTP conventions; add only extraction enablement, per-job timeout, batch size, and max-attempt settings.
- [ ] Keep the current translation implementation separate; share configuration values, not translation prompts or business types.
- [ ] Enforce before/during Poppler execution: 20 MiB source, at most 40 pages, at most 250,000 text boxes, at most 200 extracted images, at most 100 MiB total temporary output, one concurrent document per job instance, panic recovery, and a 120-second wall-clock timeout; never log extracted text or model payloads.
- [ ] Implement `cmd/extractor` as one bounded `RunBatch` invocation that claims leased jobs, processes up to the configured batch size, and exits non-zero only on job-runner/infrastructure failure; individual document failures persist stable error codes for review/retry.
- [ ] Add a scheduled Azure Container Apps Job running every minute at one replica, 1 CPU/2 GiB initially for bounded Poppler/Chromium; validate peak use before activation, with the extractor image, DB/Azure OpenAI settings, internal asset HTTPS URL/audience, existing `hhc-web-api-identity`, and explicit `AZURE_CLIENT_ID`; do not add an HTTP endpoint or Dapr sidecar/app ID.
- [ ] Give the extractor image its own immutable digest. Extend release/what-if policies with the smallest exact allowlist for creating/updating this one Job; verify digest, schedule, replica/resource limits, identity, and disabled/enabled state, and provide a rollback that disables/restores the prior Job revision without rolling back database migrations.
- [ ] Extend the release workflow to build/scan/deploy the extractor image and scheduled job before enabling extraction; require Task 3a's renderer artifact first. Add a load gate proving public `/health/ready` remains healthy while both sanitized fixtures extract.
- [ ] Run `go test ./internal/onlinebulletins ./internal/config ./internal/postgres ./cmd/extractor` and commit.

```bash
git add .github/workflows/release.yml Dockerfile.extractor cmd/extractor infra/main.bicep internal/config internal/onlinebulletins internal/postgres scripts/check-what-if.sh scripts/test-what-if-policy.sh scripts/test-release-policy.sh
git commit -m "feat: extract structured weekly bulletins asynchronously"
```

### Task 8: Add Admin edit, source-PDF preview, review, compare, restore, and independent publication APIs

**Repository:** `hhc-web-api`

**Files:**
- Create: `internal/httpapi/online_bulletin_handlers.go`
- Create: `internal/httpapi/online_bulletin_handlers_test.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `internal/bulletins/service.go`
- Modify: `internal/bulletins/service_test.go`
- Modify: `openapi.yaml`
- Cross-repository contract sync: `api-gateway/docs/openapi.yaml`
- Cross-repository test: `api-gateway/docs/openapi_test.go`

**Interfaces:**
- Admin routes live below `/api/admin/bulletins/{issueID}/online/{series}/{contentLocale}` and use existing `cms:bulletins:read`, `cms:bulletins:write`, and `cms:bulletins:publish` scopes.
- Required operations: get state, start/retry extraction, explicitly save typed Local revision with expected version, list/resolve review issues, create Incoming from re-upload, resolve three-way differences, restore an immutable revision into a new Local revision, publish, and unpublish.
- `GET .../source-pdf` requires `cms:bulletins:read`, resolves only the current PDF edition asset (not a historical revision), returns checksum/provenance headers and streams it through `hhc-web-api` with `Cache-Control: private, no-store`, a 20 MiB cap, and no public/SAS URL. Missing/removed current source returns `404`; Online revisions remain valid because they retain checksum/provenance, not the asset ID.

- [ ] Write failing handler/service tests for canonical metadata mismatch, optimistic-write conflict, invalid component edits, restore-as-new-Local, immutable published revision, and independent PDF/online failure states.
- [ ] Add source-PDF proxy tests for scope enforcement, clean/ready ownership checks, full-response streaming, size/type rejection, no-store headers, bounded upstream errors, and grant revocation.
- [ ] Add routes to the existing trusted Admin mux; do not add a new capability or proxy service.
- [ ] Save with `If-Match`/expected revision and return `409` with current revision metadata on stale writes.
- [ ] Compute Base/Local/Incoming differences at component/block/sentence granularity; unchanged Local values accept Incoming automatically, locally edited values require explicit resolution.
- [ ] Preserve stable sentence IDs through every save, accepted comparison, and restore. On publish only, write the complete previous-published → new-published checkpoint; test that 33+ explicit draft saves followed by publish still create exactly one usable client migration checkpoint.
- [ ] On save/compare/restore, persist an immutable draft with `layoutStatus=pending` and enqueue validation keyed by content hash + renderer/template/font versions. Server selects slots/continuations; the isolated worker measures the shared renderer with pinned Chromium and returns manifest/line/overflow geometry. Reject client coordinates/pass flags. Stale results cannot mark a newer draft ready.
- [ ] Add one table-driven publish-gate test covering: matching PDF published, human confirmation and exact-hash worker layout validation present, all blocking reviews resolved, warnings explicitly accepted, no unassigned text, document validation passed, immutable layout manifest/assets/checksums valid, initial unedited extraction preserves source page count/component starts, and every edited overflow is assigned an explicit continuation page.
- [ ] Publish by atomically pointing the member projection to an immutable ready revision; online publication failure must not alter the PDF version state.
- [ ] Preserve the existing PDF/notification workflow unchanged; online publish/restore/unpublish emits no duplicate weekly notification.
- [ ] Extend existing PDF unpublish behavior to warn when a matching online edition is live, offer an explicit checked-by-user synchronous online unpublish option, and prove authorized PDF/online actions reflect the resulting independent states.
- [ ] Add repository/service guards: while Online history exists, block edition/issue deletion with `409 online_document_exists`, but allow canonical metadata corrections with existing `If-Match`. Invalidate layout/confirmation and create drafts for affected editions: issue number/date affects all editions, title/subtitle only its edition. Preserve immutable publication metadata until explicit republish and show pending synchronization, never silently mix new title with old pages. Keep source-PDF replacement/re-upload available; permanent removal requires deleting private-reader data under its lifecycle and removing Online history through a separately authorized future workflow, not V1 UI.
- [ ] Update OpenAPI schemas with bounded arrays, closed enums, and explicit conflict/error responses.
- [ ] In a separate `api-gateway` branch/PR, vendor the exact new Admin edge operations into its canonical OpenAPI and contract tests; add exact Online methods/paths to `conf.d/api/admin/40-bulletins.conf` with existing bulletin scopes and route tests. Do not presume the old regex covers the series path or broaden to a wildcard.
- [ ] Run `go test ./... -race -count=1 -p=1`, `go vet ./...`, migration checks, and commit.

```bash
git add internal openapi.yaml
git commit -m "feat: manage online bulletin revisions"
```

### Task 9: Release the typed client

**Repository:** `frontend-platform`

**Files:**
- Modify: `packages/hhc-web-client/openapi/hhc-web-api.yaml`
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Modify: `packages/hhc-web-client/src/client.test.ts`
- Modify: root `package.json`, all release-required `packages/*/package.json` manifests from the current inventory, and `pnpm-lock.yaml`

- [ ] Copy the deployed-compatible OpenAPI contract from Task 8 and run `pnpm --filter @hallelujahhomechurch/hhc-web-client generate`.
- [ ] Add only convenience methods needed by the Admin flows; keep generated request/response types authoritative.
- [ ] Write client tests for conditional saves, extraction retry, review resolution, compare resolution, restore, and online publish/unpublish.
- [ ] Run `pnpm --filter @hallelujahhomechurch/hhc-web-client check:generated`, `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm pack:packages`, and `pnpm test:consumers`.
- [ ] Increment the current root patch version once, set that exact version in the root and all release-required package manifests, run `pnpm install --lockfile-only`, and verify `pnpm check:packages`; do not look for a nonexistent version script.
- [ ] Commit, open a PR, pass CI, tag that exact shared version so the existing release workflow publishes all packages, and record it for Task 10.

### Task 10: Build the approved Admin Console editor

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
- Add: locally served `pdfjs-dist` worker asset/config (reuse the dependency if already present; otherwise add only this renderer dependency)

**Interfaces:**
- Route: `/content/bulletins/:issueId/online/:series/:contentLocale` under the existing bulletin CMS capability.
- Modes: Content Editing, Issue Review, Compare New Version.
- Editing layout: >=1200px available editor container uses tree/form/preview; below that, tree drawer and Content/Preview tabs; below 768px, one column. Compare panes stack/tab with persistent labels.
- Preview controls are `Online | Original PDF | Overlay` and `Desktop | iPad | Mobile`; review displays source evidence and choices together; compare shows Base/Local/Incoming with word-level differences and explicit `Keep Local | Use Incoming | Manual Merge` choices.

- [ ] Write failing routing and interaction tests for each approved mode, both preview-control groups, dirty-navigation guard, local crash recovery, explicit save, save conflict, extraction status, evidence/choice review with automatic next-item focus, word-level three-way choice, restore, and every publish gate.
- [ ] Update the exact released client package from Task 9; do not duplicate API response types in `admin-fe`.
- [ ] Add an Online Reading entry to the current bulletin detail page without changing the existing PDF upload/publication controls.
- [ ] Keep canonical edit available with optimistic checks, impact preview and pending-Online-republish status; disable only edition Remove/issue Delete while history exists. Test PDF-unpublished + Online-live corrections and re-upload.
- [ ] Implement array controls and typed block editors with existing shared Input/TextField/Tabs/Drawer/Button/StatusBadge components and explicit reorder/add/remove actions; no drag canvas or rich-text dependency.
- [ ] Use Task 3a shared renderer/CSS, not duplicated fonts/slots. Preview Local form state provisionally; after Save show pending authoritative validation, page boundaries/overflow/source count/component starts. Publish requires exact saved-hash worker validation.
- [ ] For the rare real overflow, expose only `Continue on next page` / remove-continuation controls on the affected component. The server remains authoritative for regenerated slots/coordinates; Admin never edits geometry.
- [ ] Fetch the protected source PDF as a full bounded ArrayBuffer with the authenticated client and `no-store`; render Original PDF to canvas with PDF.js and a same-origin local worker, then draw structured geometry in a separate accessible overlay layer. Do not use `<embed>`/`<object>` or loosen the existing `object-src 'none'` / `worker-src 'self' blob:` CSP.
- [ ] Label current PDF upload and checksum. If it differs from displayed revision source checksum, disable Overlay rather than imply historical parity; allow clearly labelled side-by-side current PDF. Missing source disables PDF modes only.
- [ ] Test Original PDF/Overlay authorization failures, loading/error states, page alignment at Desktop/iPad scales, worker URL/CSP compatibility, and that source text is not copied into logs or persistent browser caches.
- [ ] Disable publish until extraction is ready, required reviews are resolved, validation passes, and the matching PDF is published.
- [ ] Put restore behind `cms:bulletins:publish`; restoring creates a new Local draft and never changes the published pointer or client mapping checkpoint until a separate Confirm Online Version action.
- [ ] Key recovery by account/issue/series/locale/base revision. Stale base offers Compare/Discard, never auto-restore; logout/switch clears it. Save Draft alone writes server state; show saving/saved/layout-pending/error, clear only matching recovery and preserve input on 409. Test 768/1024px/split-view, focus return and persistent save visibility without horizontal overflow.
- [ ] Run `pnpm test:run`, `pnpm lint`, `pnpm build`, and commit.

```bash
git add src package.json pnpm-lock.yaml
git commit -m "feat: edit structured weekly bulletins"
```

### Task 11: Release and accept the CMS foundation

- [ ] Release in dependency order: Task 3 asset-only `hhc-web`, Task 3 Admin asset-proxy `api-gateway`, Task 3a shared renderer artifact, Task 4 `asset-api` workload authorization/app-role gate, `hhc-web-api` schema/API plus disabled extractor Job, gateway Admin contract sync, `frontend-platform`, then `admin-fe`; use one branch, PR, passing CI, merge, and immutable release per repository, then enable extraction after template URL/checksum and asset-auth smoke pass.
- [ ] Verify migrations complete before the new API revision receives traffic; extraction stays disabled until the scheduled job image, limits, secrets, and ready-state smoke all pass.
- [ ] Upload the original 1739 PDF, verify exact source page count/component start pages, resolve review items, edit one sentence, and independently publish the online version.
- [ ] Re-upload the 1739 PDF with one controlled typo correction and verify Base/Local/Incoming comparison preserves the local edit until an explicit choice.
- [ ] Repeat extraction for 1740 and verify excluded back-page data is absent from database rows, application logs, and captured AI requests.
- [ ] Verify the existing PDF download and publication workflow is unchanged even when online extraction is failed or unpublished.
- [ ] Verify shared-renderer parity, canonical correction/reconfirmation, source-checksum overlay handling and account-scoped recovery at narrow widths. Record deployed revisions and smoke evidence before starting the member-reader plan (historical `public-reader.md` filename).
