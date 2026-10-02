# Weekly Bulletin Online Reader Design

**Date:** 2026-08-21
**Revised:** 2026-10-01 — stable source-inspired desktop/iPad layout; member download authorization, seven-day offline reading, and readable trace watermark.

## Goal

Add a first-class online reading format for HHC weekly bulletins while keeping
the existing downloadable PDF workflow intact. A PDF upload produces a
structured, editable draft whose desktop and iPad presentation reconstructs
the original bulletin layout from content rather than embedding the PDF. The
mobile presentation uses the same visual language in a responsive continuous
layout.

The first release includes member-authorized reading, per-bulletin search,
PWA installation and explicit offline saves, and signed-in private highlights,
notes, and reading progress. It must establish a repeatable ingestion path for
future bulletins rather than hard-code the two initial samples.

## Confirmed Product Decisions

- The PDF remains independently downloadable and publishable.
- Online Reading has its own draft, revision, publish, unpublish, and restore
  lifecycle. Its readiness never blocks PDF publication.
- Desktop and iPad render structured content with the source PDF's visual
  hierarchy, section order, columns and approximate proportions. Stable,
  readable layout takes precedence over exact coordinates. Complex WordArt,
  shadows, scrolls and ornamental frames may use simpler native equivalents.
  They do not display PDF pages or page screenshots.
- Source page count/start pages remain provenance and comparison data. Small
  differences in line breaks and pagination are acceptable, including initial
  extraction, when needed for legal substitute fonts and stable layout. The
  preview must expose the resulting page count and retain every allowed sentence.
- Mobile uses a same-style responsive continuous layout rather than simulated
  paper pages.
- The existing issue number, issue date, title, and subtitle are canonical.
  Extraction validates them and never overwrites them.
- Fixed weekly elements come from a versioned template and are not sent to AI.
- The online back page keeps Summary, announcements, and victories/prayers. It
  excludes service rosters, attendance totals, and offering names and amounts.
  Excluded regions are removed before any external AI call and are not retained
  in extraction snapshots or logs.
- Deterministic parsing and rules run first. An LLM only resolves semantic
  ambiguity; administrators provide final approval.
- The first structured content locale is `zh-Hant`. Reader controls use the
  website's five UI locales independently of bulletin content locale.
- Reading, copying, highlights, notes, and progress follow the existing PDF
  download authorization for the exact `(series, contentLocale)` edition.
  Reuse the existing entitlement checker; no reader permission, role, grant
  table, independent approval, or independent membership setting is added.
- V1 highlight colors are fluorescent yellow, red, and blue. Notes are private
  plain text.
- The first release includes in-bulletin search, PWA installation, and explicit
  account-scoped offline reading with private mutation sync. Member content is
  not search-engine indexed, anonymously rendered, or stored in shared caches.
- Explicit offline saves expire 7 days (604800 seconds) after the last successful
  server validation of download entitlement and Online publication. Opening a
  local copy, refreshing a token, or a failed validation never renews the clock.
- Online and offline reading display a faint, opaque trace code issued for the
  member and exact edition/revision. Readability requires human visual approval;
  low opacity alone is not acceptance. This is not DRM or proof of who shared it.
- Original fonts are not redistributed. The reader uses legally self-hostable
  approximate fonts mapped by semantic font role.
- There is no visual canvas editor, new bulletin microservice, cross-bulletin
  search service, rich-text notes, tag system, public notes, or automatic
  archive download in V1.

## Reference Bulletins

The initial acceptance corpus is:

- issue 1739, `詩篇廿三篇、洗革拉戰役` (12 A4 pages);
- issue 1740, `永恆的命定和呼召` (16 A4 pages).

On 2026-10-01 the user supplied these originals to replace unavailable
1731/1733 files. All source page boxes are `595.32x841.92` points. Historical
Letter/mixed-paper support is not accepted by this replacement corpus; it needs
its own original-based regression before making compatibility claims. Source
page count and size remain document data, not production constants. The body is
single-column in these samples; the penultimate hymn page has two columns.

The two bulletins demonstrate variable counts in cover worship songs, Word
questions, weekly verses, body sections, hymn songs, announcements, and prayer
items. Those counts are arrays, not template assumptions.

## Current Platform Fit

The existing platform already has the required service boundaries:

- `hhc-web-api` owns bulletin metadata, CMS revisions, publication workflows,
  protected bulletin projections, an outbox worker pattern, and Azure OpenAI integration.
- `asset-api` owns upload sessions, private PDF objects, malware scanning,
  restricted grants and downloads. Member PDFs use the existing personalized
  watermark download-job flow, never a new public URL.
- `admin-fe` owns the existing bulletin upload and publication UI.
- `hhc-web` is a standalone Next.js runtime with dynamic sitemap and
  server-rendered content routes. It already has a manifest, app icons, service
  worker registration, and a service worker used for Web Push.
- `account-api` owns identity and account lifecycle. The gateway validates the
  access credential and supplies trusted identity headers to downstream APIs.

The design extends these boundaries. It does not create another CMS, bulletin,
AI, identity, asset, or offline-sync service.

## Approaches Considered

### Chosen: existing service boundaries with staged delivery

Keep all bulletin business state in `hhc-web-api`, use `asset-api` for bytes,
and add the Admin and member experiences to their existing applications. Reuse
the current Azure OpenAI account, Responses API contract pattern, publication
outbox, gateway identity, and native service worker.

This gives one owner for revisions and user annotations, preserves existing
deployment boundaries, and permits backward-compatible releases.

### Rejected: separate bulletin or AI service

There is no current ownership, scaling, security, or deployment requirement
that justifies another runtime. A new service would add authentication,
delivery, data-consistency, and observability work without simplifying V1.

### Rejected: browser-side PDF extraction

Browser parsing would vary by device and make retries, auditing, resource
limits, and pre-AI exclusion guarantees harder to enforce. Extraction is a
server-side background job.

## Repository Ownership

### `hhc-web-api`

Owns Online Documents, immutable revisions, extraction jobs and snapshots,
template references, sentence identities and mappings, independent online
publication, member projections, highlights, notes, reading progress, offline
mutation idempotency, and account-erasure handling.

### `asset-api`

Owns the uploaded source PDF, malware status, storage lifecycle, and stable
downloads. It does not interpret components or own online publication state.

### `admin-fe`

Owns extraction status, exception review, structured component editing,
PDF/online comparison, preview, three-way merge, and online publish controls.

### `hhc-web`

Owns a no-content reader shell, authenticated semantic HTML, locale resolution,
the shared renderer integration, in-bulletin search, interaction UI, PWA
shell, permanent code-owned versioned template/font bytes, explicit offline
content management, and private offline mutation sync.

### `frontend-platform`

Owns generated Website contracts and one pure `BulletinDocumentRenderer` in
the existing UI package, with its scoped paper CSS and font-role mapping.
Admin preview and the member reader consume the same version, document,
manifest, and template bytes; neither implements its own paper layout engine.

### `account-api` and `api-gateway`

`account-api` remains the identity authority and owns the final
account-lifecycle signal needed for erasure; implementation reuses or adds the
required contract there. The gateway remains the only public policy boundary,
strips client identity headers, validates access credentials, and injects
trusted `X-HHC-*` identity for protected routes.

## End-to-End Flow

```text
Admin creates/updates existing issue and series/locale edition
  -> asset-api upload and malware scan
  -> hhc-web-api extraction job
       -> local text/geometry/font parser
       -> fixed-template exclusion mask
       -> deterministic component rules
       -> optional LLM semantic classification
       -> schema/layout validation
  -> editable Online Draft
  -> Admin exception review and confirmation
  -> immutable Online Published Revision
  -> existing download entitlement check for the exact series/locale
  -> member projection and account-bound trace receipt
  -> hhc-web shared HTML renderer
  -> explicit seven-day account-scoped offline save
  -> account-owned highlights, notes, and progress
```

No extraction failure changes an existing draft, PDF publication, or current
Online Published Revision.

## Domain Model

The names below describe ownership and relationships; implementation may align
the final SQL names with existing bulletin conventions.

### Existing canonical records

`bulletin_issue` remains authoritative for issue number and date. The existing
series/locale edition/version remains authoritative for content locale, title,
subtitle, PDF asset, and PDF publication state. Online content references these
fields rather than copying them into editable JSON.

Canonical fields remain editable through the existing metadata form with
`If-Match`. A correction updates the one canonical source, invalidates affected
layout/confirmation evidence, and creates an Online draft requiring layout
validation and explicit republish. Existing published content keeps its immutable
publication-time metadata snapshot until republished; the UI marks it as pending
metadata synchronization rather than silently mixing new metadata with old pages.
Snapshots are audit/rendering evidence, never a second editable source. Issue
number/date changes invalidate all affected editions; title/subtitle changes
invalidate only that edition. Correcting an issue number changes its reader URL;
Admin warns that old external URLs may stop resolving. Stored documents, notes,
and offline bookmarks use immutable issue/document IDs and update displayed URLs
after authorization; no alias service is added in V1. Edition/issue deletion remains blocked while Online history exists;
source PDF replacement/re-upload remains available through comparison.

### Online document and revisions

One `OnlineDocument` exists per `(issueID, series, contentLocale)`. It keeps independent
online lifecycle state and pointers to its current draft and published
revision.

Use an opaque document ID internally; every uniqueness constraint, foreign key,
job key, sentence mapping, API selector, browser key, and private-state owner
must preserve that edition identity. Current supported PDF editions are general
in `zh-Hant`, `zh-Hans`, `en`, and children in `zh-Hant`, `en`. V1 extraction
supports the general `zh-Hant` template proved by 1739/1740; other editions keep
their existing PDF behavior until their own template/content acceptance passes.

Each immutable `OnlineRevision` contains:

- a versioned structured JSON document;
- a deterministic layout manifest with page instances, normalized boxes/slots,
  explicit continuations, template version, and permanent versioned
  template/font asset URLs plus SHA-256 checksums;
- source PDF asset checksum and publication-time canonical metadata snapshot;
- template, extractor, and content-schema versions;
- `contentHash`, `rendererVersion`, `rendererArtifactSha256`, and
  `layoutValidationHash` binding the validated content, renderer/paper CSS,
  font/template hashes and final measured manifest;
- revision authorship and timestamps;
- validation and human-confirmation evidence.

The mutable source asset ID is not part of `OnlineRevision`; it belongs to the
extraction job/current PDF edition pointer. Re-upload may retire old PDF bytes
without dangling an immutable Online reference; revision provenance keeps the
checksum, and Admin Original PDF/Overlay refers only to the current upload.
Overlay is disabled when that checksum differs from the selected revision's
source; a labelled current-PDF side-by-side view may still be used.

The published pointer changes atomically. Editing or restoring always creates
a new draft/revision; published rows are never modified in place.

Renderer identity is independent of the enclosing UI package release. The shared
package initially has one static supported-renderer entry, V1, with a reproducible
renderer/paper-CSS artifact digest. Preserve that implementation and CSS while
any revision references it; a behavior-changing renderer receives a new version,
never overwrites V1. Admin, worker and Website select the matching compiled-in
entry/digest. Unsupported or mismatched versions show an explicit update-required
state rather than approximate rendering. Never import executable URLs supplied
by document JSON. Offline saves include the required code-owned versioned assets;
SW/app updates must retain compatibility with saved referenced renderer versions.

### Template version

An immutable `TemplateVersion` supplies fixed elements and layout tokens:

- logo, masthead, vision text, labels, and decorations;
- source page dimensions, margins, columns, and fixed component slots;
- responsive mobile composition rules;
- semantic font-role mapping and typography metrics.

Cover clarification (2026-10-02): desktop/iPad covers end at the weekly verse
and remain one page. Omit the address/contact block, all QR codes/captions and
the scan invitation from Online composition; the downloadable PDF is unchanged.
The theme/title and subtitle share one row, Welcome shares one row with its
label, and all Worship songs share one row. Each Work point occupies one row,
using a common font size and native last-line justification to preserve the
aligned text edges without inserting spaces into stored/copied content.
Word questions use compact full-width paragraphs. The weekly verse has a small
heading above full-width scripture, not a narrow side label beside the text.
Single-row sizing uses measured legal-font widths with a readability floor;
content that cannot fit fails composition for editing rather than clipping or
silently creating a second cover. Mobile retains readable, wrapping reflow.

V1 has one operational template and no template canvas UI. Versioning exists
to keep old published revisions reproducible when the fixed template changes.
Its licensed font/decorative bytes live at permanent content-hashed website
paths below `/assets/weekly/v1/`; the directory is published before extraction
and remains append-only while any revision references it. Later templates add
new version directories instead of replacing old bytes.
The Admin host proxies only `/assets/weekly/` to the same website origin path,
so preview consumes identical URLs/checksums without cross-origin font or CSP
exceptions.

### Extraction job and snapshot

An `ExtractionJob` is idempotent for:

```text
source asset checksum + template version + extractor version
```

The complete unique key also includes issue ID, series, and content locale;
identical PDF bytes uploaded to different editions never share mutable jobs.
Its snapshot contains allowed-region text, geometry, parser evidence,
component assignments, and actionable validation findings. It does not contain
excluded back-page content. Job states are `queued`, `parsing`, `review_ready`,
and `failed`; review disposition belongs to the resulting draft rather than
the worker state.

### Sentence identity and mappings

Every component, block, and sentence has a stable opaque ID. A sentence keeps
display text, semantic spans, source page/bounding box, paragraph formatting,
font role, and an internal original-text snapshot.

Revision-to-revision mappings explicitly represent `unchanged`, `moved`,
`split`, `merged`, `removed`, and `requires_review`. They are proposed by
deterministic matching/AI and confirmed by Admin when ambiguous.
Client-facing checkpoints are written only from previous published revision to
new published revision; draft saves create none. The server retains and
composes any historical published checkpoints into one bounded direct sentence
mapping to current, so editing frequency does not consume a client limit.

### Private records

- `Highlight`: account, Online Document, sentence ID, color, version, and
  timestamps. One active color exists per account and sentence.
- `Note`: account, Online Document, plain text, optimistic `version`, quoted
  source snapshot, and one or more sentence anchors. Multiple notes may share
  a sentence.
- `ReadingProgress`: account, Online Document, revision, device-independent
  sentence anchor, desktop page or mobile section, and timestamp.
- `ReaderMigrationState`: account, Online Document, last transactionally
  applied published revision, and unresolved mapping conflicts. Reading state
  lazily and idempotently advances cloud Highlight/Note/Progress rows before
  returning them; repeated reads cannot duplicate split/merge effects.
- processed client mutation IDs/results provide bounded idempotency for offline
  writes. V1 retains seen terminal results for 91 days and supports a 90-day
  offline-mutation window; older unseen local operations require user action
  and are never silently dropped or assigned new IDs.

A differing-color merged-highlight conflict has a stable conflict ID. The user
chooses red/yellow/blue through a new idempotent mutation carrying that conflict
ID and current revision; acknowledgement applies the chosen target color,
resolves the conflict, and advances migration state when no blockers remain.

Private records are relational because they require account isolation,
concurrency, and deletion. Per-revision bulletin content remains one validated
JSON document because V1 has no cross-bulletin query that warrants tables for
every paragraph or sentence.

## Structured Content Schema

```text
OnlineRevisionContent
├─ cover
│  ├─ welcome
│  ├─ worship[]
│  ├─ work[]
│  ├─ wordQuestions[]
│  └─ weeklyVerses[]
├─ bodySections[]
│  ├─ kind: sermon | testimony | teaching | reflection | unknown
│  ├─ title
│  ├─ subtitle?
│  ├─ contributors[]: role + name
│  └─ blocks[]
│     └─ sentences[]
│        └─ spans[]
├─ hymns[]
│  ├─ number?
│  ├─ title
│  ├─ sourceLabel?
│  └─ sections[]: verse | chorus | bridge + lines[]
└─ back
   ├─ summary[]
   ├─ announcements[]
   └─ victoriesAndPrayers[]
```

Supported inline roles are `body`, `scripture`, `emphasis`, `reference`, and
`foreignText`. Paragraph blocks preserve indentation and spacing semantics.
Font names are evidence only; the published schema stores roles so the web can
map them to legally self-hosted substitutes.

Variable arrays never assume the counts observed in one sample bulletin.
Unknown but allowed body content remains editable as `unknown`; unassigned
allowed-region text blocks publication until reviewed.

## Extraction and AI Boundary

### Deterministic first

The local parser extracts text, page geometry, bounding boxes, font metadata,
reading order, and embedded-image references. The template then identifies
fixed regions, allowed dynamic regions, and excluded regions. Deterministic
rules handle known cover fields, list boundaries, font-role mapping, paragraph
formatting, and sentence segmentation.

If all requirements are unambiguous, the job makes no LLM call.

### LLM supplement

The LLM only receives the minimum allowed-region text and layout features
needed to classify ambiguous section boundaries, contributor roles, headings,
or semantic blocks. It uses the existing Azure OpenAI account and Responses
API security pattern with a bulletin-specific prompt, strict JSON Schema,
timeout, and usage accounting. It does not share code ownership with the
translation package beyond reusable provider primitives.

The current deployment is reused initially if it meets context and throughput
evaluation. A separate deployment is justified only by measured model
incompatibility or production contention; there is no speculative deployment
in V1.

PDF text is data, never instructions. The model cannot alter exclusion masks,
canonical metadata, schema, publication rules, or tool behavior.

### Raster-only input

The supported V1 source is the existing digitally generated weekly PDF with a
usable text layer. A raster-only/scanned PDF is marked for manual handling; V1
does not add an OCR or vision runtime before such inputs are observed.

### Review classification

The system does not trust an LLM's self-reported confidence percentage.
Findings come from verifiable signals: schema validity, expected region and
font evidence, metadata agreement, unassigned text, conflicting rules, and
layout constraints.

- `parsed`: deterministic evidence is complete;
- `needs_review`: a human must resolve or explicitly accept the finding;
- `error`: publication is blocked.

Even a warning-free extraction requires one explicit Admin confirmation before
online publication.

## Admin Experience

The existing bulletin detail page gains an Online Reading area with lifecycle:

```text
not created -> extracting -> review required -> draft -> published
                         \-> extraction failed
```

The approved Admin layout keeps the existing application navigation and opens
with canonical bulletin metadata, PDF/Online status, last-saved evidence, and
the page-level `Save Draft` and `Confirm Online Version` actions. Confirmation
stays disabled while blocking findings remain.

The workspace has three top-level modes:

- `Content Editing`: routine structured editing and synchronized preview;
- `Issue Review`: an exception-first queue for parser, AI, metadata, and layout
  findings;
- `Compare New Version`: Base/Local/Incoming review and merge choices after a
  later PDF upload.

On a workspace content width of at least 1200 CSS px, Content Editing uses three regions:

- left: page/component tree, status, and warning counts;
- center: forms and block editor for the selected component;
- right: live desktop, iPad, mobile, and original-PDF comparison previews.

Below 1200 px, the component tree is a drawer and Content/Preview are tabs;
below 768 px all modes use one column. Measure the available editor container,
not device names or full viewport width. Comparison panes stack or use tabs
with persistent Base/Local/Incoming labels. Save status/actions remain reachable
without horizontal scrolling. Use existing shared UI controls and warm brand
tokens for chrome; paper typography, color, and decorations remain PDF-derived.

The component tree groups Cover, Body, Worship, and Back content, shows source
page numbers, and marks verified and review-required nodes without relying on
color alone. The center form shows the selected component path, typed fields,
paragraph formatting, semantic text roles, sentence boundaries, and source
page evidence. The preview is read-only and supports Online, Original PDF, and
Overlay modes plus Desktop, iPad, and Mobile device views. Editing always
happens through the structured form, never by manipulating the preview.

Issue Review presents only unresolved findings in a left queue and shows the
source evidence and required choice together. Resolving one item can advance
to the next. Compare New Version displays Base, Local, and Incoming side by
side at block scope, then offers `Keep Local`, `Use Incoming`, or `Manual
Merge`; applying decisions creates a draft and never publishes directly.

Editors can change array items, contributors, paragraphs, indentation,
semantic roles, and sentence split/merge relationships. Layout comes from the
template; there is no drag positioning or freeform canvas.

Draft saving is explicit. Browser-local recovery preserves unsent work, the
page warns before losing dirty state, and `If-Match`/revision versioning
prevents silent concurrent overwrite. A concurrency conflict preserves the
local draft and requires reload/compare. Recovery keys include account ID,
issue ID, series, locale, and base revision. A stale base offers Compare/Discard,
never auto-restore; logout/account switch clears the previous account's recovery.
Online preview uses the shared renderer and marks unsaved geometry provisional.
Saving schedules authoritative layout validation using that same pinned renderer
in the isolated worker. Publish requires validation for the exact saved content
hash, renderer version, manifest, and font checksums, not a browser-supplied pass.

Publishing requires:

- canonical issue/date agreement;
- resolution or explicit acceptance of every warning;
- no hard validation error, unassigned allowed text, or blocked overflow;
- reviewed desktop/iPad composition with complete text, stable pagination and
  source-like hierarchy; exact source page-count equality is not required;
- an explicit human `Confirm Online Version` action;
- the corresponding content-locale PDF to be published.

The template may reflow and add continuation pages at the saved-layout stage;
the preview shows page-count changes for human confirmation. Clipped,
overlapping or unassigned text still blocks publication. No text is silently
shrunk or discarded to meet the source page count.

### Re-upload comparison

A later PDF upload may publish through the existing PDF flow immediately. It
also produces an Incoming Extraction but never mutates the current Online
Draft or Published Revision.

The merge compares:

```text
Base     = previous PDF extraction
Local    = administrator-edited online document
Incoming = new PDF extraction
```

Diff is component/block-level, with word-level detail inside changed blocks.
Local-only changes remain local, incoming-only changes preselect incoming,
identical changes auto-merge, and concurrent changes require selection or
manual merge. Additions and deletions are explicit. Applying the comparison
creates a new draft revision.

### Permissions and publication independence

Existing permissions remain authoritative:

- `cms:bulletins:read`: view extraction, components, PDF comparison, and preview;
- `cms:bulletins:write`: upload/extract/edit/merge/save draft;
- `cms:bulletins:publish`: publish, unpublish, and restore Online revisions.

These staff capabilities do not grant member reading access. Member Online
reads, offline validation, and private interactions call the exact existing
download entitlement check (`bulletin.{series}.{locale}.access`) before content
lookup. No new authorization product or token is introduced. An offline receipt
records a successful check; it is not a credential accepted by any server API.

Online publishing does not send a duplicate weekly notification by default.
Unpublishing a PDF warns that Online is still live and offers a simultaneous
Online unpublish checkbox. The default leaves Online available and hides its
PDF download action until the PDF is republished.

Member bulletin discovery therefore exposes authorized Online editions through a separate
combined projection that unions PDF/Online editions before authoritative
issue/date sorting and pagination, independently from and without changing the
existing member PDF list/latest contracts. An Online projection carries
`pdfPublished` and edition identifiers for the existing download-job action,
never a public or SAS download URL; PDF unpublish never removes or
404s an independently published Online projection.

Home and Archive consume this combined projection. On a transient projection
failure only, they may use the existing authorized PDF endpoint and hide Online
actions; never fall back through an authorization denial. A healthy
combined response does not depend on a second PDF request.

Admin cannot view, search, or export reader notes or highlights. It may show
anonymous affected-record counts for revision migration.

## Locale Resolution and Member URLs

Reader URLs explicitly carry UI and content locale:

```text
/{uiLocale}/literature-ministry/{issueNumber}/read/{series}/{contentLocale}
```

For example, `/ja/literature-ministry/1740/read/general/zh-Hant` renders Japanese
controls around Traditional Chinese content.

Home resolves one complete bulletin edition:

Apply this resolution within the selected series and only over editions already
authorized by the existing download access projection. Do not infer absence
from a protected 404 or use fallback to bypass an entitlement. No authorized
candidate means no reader/download action, not an unauthorized Chinese fallback.

- `zh-Hant` prefers `zh-Hant`;
- `zh-Hans` prefers `zh-Hans`, falling back as a whole to `zh-Hant` only when
  the Simplified Chinese edition is absent;
- `en` prefers `en`, falling back as a whole to `zh-Hant` only when the English
  edition is absent;
- `ja` and `ko` use `zh-Hant`.

Title, subtitle, Online action, and PDF action always come from that same
resolved content locale. If a Simplified Chinese PDF exists but its Online
Document does not, Home shows that PDF and no Online action; it does not mix in
the Traditional Chinese Online action.
Conversely, if that locale's Online Document remains published after its PDF is
unpublished, Home/Archive keep the Online action and omit Download; discovery
does not depend on the PDF projection row.

The literature-ministry archive remains the only surface that presents all
authorized editions grouped by series. V1 publishes structured general `zh-Hant`
only; other series/locale readers do not exist until their Online Documents are
supported and published.

Every reader wrapper uses `noindex, nofollow`; no reader URL or body enters the
sitemap, public search, public metadata, JSON-LD, Open Graph text, or previews.
Unauthenticated shells contain only generic localized UI. API deny/unknown uses
the same nondisclosing 404; entitlement dependency failure is fail-closed 503.

## Member Reader

### Rendering and indexing

The server renders only a generic no-content shell. The browser reuses
`useBulletinAuthorization()` and the existing Account auth runtime to fetch
the published document; no new token endpoint, token refresh loop, or SSR
cookie-to-member bridge is introduced. After authorization, the shared renderer
produces semantic selectable HTML. Without JavaScript, show a localized
explanation rather than exposing member content. All member API successes and
errors use `Cache-Control: private, no-store`; content is never CDN cached.
A closed member mapper contains renderable components, stable anchors, manifest,
publication metadata, and authorized action identifiers only. Source asset
identifiers/checksum, original snapshots, parser/review/authorship evidence, and
other accounts' data never leave through the reader DTO.

### Trace watermark and readability

The server issues a random opaque code with a receipt bound to account, issue,
series, locale, revision, channel `online_reader`, and issuance time. Reuse the
existing watermark receipt/privileged lookup/audit conventions, but keep reader
receipts distinct from PDF fingerprint/model/page-hash evidence. Reader opening
must not trigger PDF generation. No name, email, account ID, or bearer credential
is displayed. Lookup requires the existing investigation capability and records
an audit event; staff still cannot inspect private notes/highlights.

Use a faint repeated text overlay scoped to the paper/content region, including
mobile flow. It is outside text semantics, `aria-hidden`, non-selectable, and
`pointer-events: none`; it does not appear in copy output or note text. Keep
paper/text geometry identical with and without it. Do not add invisible image
watermarking, anti-debugging, MutationObserver enforcement, or screenshot blocking.
UI chrome may follow dark mode; paper retains its validated light palette.

Before V1 approval, show 1739/1740 cover, dense body, scripture/emphasis, hymns,
and back sections with all three highlight colors and active selection. Compare
with/without watermark on desktop, iPad portrait/landscape, and 320/375px phones,
Fit Page/Fit Width, 75/100/200/250% reader zoom, and 200% browser zoom. Require no
clipping/reflow, unchanged pointer/keyboard/copy behavior, readable glyphs, and
at least 4.5:1 body text contrast against the worst overlaid background. The user
must explicitly approve actual device views; unreadable results block rollout.
Opacity/spacing are calibrated in that preview, not declared acceptable by a
hard-coded alpha. Repeated codes aid ordinary screenshots, not tamper resistance;
a receipt proves issuance only, never who shared content.

Receipts use existing 365-day watermark retention and privacy/erasure policy.
Store no reading telemetry beyond the minimal issuance record. Keep a receipt
per account/document revision/browser session, and reuse it for reload/retries;
an explicit offline save retains its code. Revalidation of the same revision
renews expiry without generating needless receipts. Content and receipt are returned by one idempotent access POST only after the
receipt is durably recorded; there is no separate member full-content GET.
Failed receipt issuance returns no content. Expired-receipt lookup reports no
match, never a guessed account.

### Desktop and iPad

- Reconstruct the source page dimensions and fixed template layout.
- Show one page at a time; there is no two-page mode in V1.
- Default to Fit Page, with Fit Width and 75%-250% zoom.
- Support thumbnails, direct page entry, previous/next, keyboard arrows,
  unzoomed swipe, pinch zoom, and pan while zoomed.
- Panning wins over page navigation while zoomed.
- More than one pointer is pinch; a drag exceeding 8 CSS px never toggles a
  sentence. Existing native text selection/long-press wins over sentence click.
  Page arrows do not intercept input/textarea/contenteditable or modifier keys.
  Enter/Space toggles a focused sentence; Escape clears transient selection.
- The initial unedited revision must preserve source page count and component
  start pages.

### Mobile

- Render a continuous responsive document using the same palette, typography
  roles, hierarchy, borders, and decoration language.
- Provide section navigation across cover, body components, hymns, Summary,
  announcements, and victories/prayers.
- Preserve source-page and sentence anchors for search, notes, and progress
  without showing artificial paper pagination.

### In-bulletin search

Search covers titles, body, scripture, hymns, Summary, announcements, and
victories/prayers in the current Online Document. Results include context and
jump to the matching page/sentence. Search runs against the downloaded
structured document and works offline. V1 has no cross-bulletin search index.

### Accessibility

The reader provides semantic headings and reading order, full keyboard
operation, visible focus, localized accessible names for icon/color actions,
screen-reader status announcements, sufficient contrast, and reduced-motion
support. Unsupported PWA capabilities degrade by hiding only the unavailable
feature; online reading remains usable.

## Sentence Selection and Actions

Sentence is the minimum interaction unit. Clicking an unselected sentence
selects it; clicking it again unselects it. Non-contiguous multi-selection is
supported. Selection styling is visually distinct from saved highlight color.
With no selected sentence, the action toolbar is absent.

Desktop/iPad page navigation clears transient selection. Mobile may select
across components in its continuous document.

The toolbar order is:

```text
[ yellow  red  blue ]  Clear  Copy  Note
```

The three fluorescent swatches form one unseparated highlight-color control at
the far left. Yellow is first. Swatches have no visible action label, but do
have localized tooltips, accessible names, focus, and selected states. The UI
does not use the phrase `畫重點`.

On phones the toolbar sits above existing bottom navigation plus safe-area
insets. Keep all color controls together; allow two rows at narrow widths,
with at least 44x44 CSS px targets. Reserve space so selected text stays visible.
Hide/inert the toolbar while the note sheet is open; handle the software keyboard
and return focus to the invoking control when the sheet closes.

### Bulk highlight behavior

Choosing a color applies it atomically to every selected sentence. Existing
colors are replaced and unhighlighted sentences gain the chosen color. If all
selected sentences have one color, that swatch is active. Mixed colors or a
mix of highlighted/unhighlighted sentences show no active swatch; choosing one
normalizes the entire selection. Choosing the current color is idempotent and
does not clear it.

`Clear` atomically removes highlights from all selected sentences. Sentences
without a highlight are unchanged. Notes are never deleted. Highlight and
Clear keep selection so a user can recolor immediately.

### Copy

Copy is available only during authorized online reading or a valid offline save.
It orders selected sentences by document order, inserts blank
lines between components, and appends:

```text
— 第 {issueNumber} 期《{title}》
```

It does not append a URL. Copy keeps selection.

### Notes

Note requires login and creates one private plain-text note anchored to all
selected sentences. Multiple notes may reference the same sentence. Desktop
uses a right panel only when the remaining page width stays at least 640 CSS px;
otherwise (including narrow iPad/split view) use a dismissible sheet. Mobile
uses a bottom sheet. Inline indicators open
the associated notes. A current-bulletin `My Notes` list jumps to source
sentences and supports create, edit, and delete. Successful note creation
clears selection; cancelling preserves it.

V1 has no rich text, tags, sharing, public notes, or global notes center.

### Login return

Signed-out entry requires login before any content is fetched. Preserve only
the validated same-origin reader URL. When an existing reader needs renewed
authentication, preserve position/selection/action in account-scoped transient
state; after the same account returns and download authorization is rechecked,
restore it and ask for confirmation before any write. Account switch clears it.
An unexpired explicit offline save may remain usable during session expiry;
explicit logout always removes the local copy and transient state.

## Reading Progress and Revision Migration

Desktop/iPad progress stores page plus sentence anchor. Mobile progress stores
section plus sentence anchor. Progress is always account-scoped and syncs
after authorization. Reopening offers `Continue` or `Start over`
rather than forcing a jump.

Migration behavior is:

- edit/move: keep the stable sentence ID;
- split: apply a highlight to all resulting sentences and anchor the note to
  all of them;
- merge: combine anchors; differing highlight colors become a user-visible
  migration conflict rather than an arbitrary overwrite;
- removed/unmapped: preserve quoted private evidence as inactive with `Original
  content removed`; do not force a fuzzy match.

## PWA and Offline Data

### Explicit saves

The reader exposes `Save offline` and `Remove download`. Saving stores one
exact Published Revision, layout manifest, structured content, template
assets, images, fonts, and the reader trace receipt. It does not download the PDF or the bulletin archive
by default.

Use native platform storage already available to the application:

- Cache Storage only for the no-content PWA shell and code-owned public template/fonts;
- IndexedDB for account-scoped structured documents, receipt/expiry, private local state, and pending
  mutations;
- the existing native service worker, extended with the minimum fetch/cache
  behavior. Do not add Workbox unless native APIs measurably fail the design.

Exact reader-route navigations are network-first. Offline failure returns one
stable cached reader shell, which loads only the requested issue/locale's
explicitly saved active revision for that account/series/locale from IndexedDB; it never substitutes cached
SSR HTML from another or older revision.

### Offline capabilities

Saved documents support reading, navigation, zoom, in-bulletin search, copy,
highlight create/recolor/clear, note create/edit/delete, and progress updates.
An unsaved unavailable document shows an explicit offline state, never a blank
page or an unrelated stale revision.

Offline access is a client-enforced seven-day window, not a separate entitlement.
The same member validation returns server `validatedAt`, `offlineValidUntil =
validatedAt + 604800 seconds`, account/document/revision binding, and receipt.
Only a successful exact download-entitlement + Online-publication check renews
it. On each open/foreground/reconnect, try validation before content/sync; network
failure or 503 may retain an existing unexpired save, but cannot extend it.
401 pauses network sync and requests login, while the same account's valid save
may be read offline. A 404 immediately locks that edition and pauses sync. Purge
only on the owner contract's typed `not_found` envelope plus
`X-HHC-Bulletin-Access: unavailable` response marker from the matched access route;
the same marker/body covers denied, unknown and unpublished editions and reveals
no distinction. A generic, malformed or unmarked 404 is deployment drift: retain
locked data, retry/report the fault, and never try another locale. Add this marker
to the existing checker/owner response, not a second authorization decision. A successful
session with another account clears the previous account's copies.

At expiry lock content/copy/search/annotation operations and prompt reconnect;
check on every foreground/action and schedule a deadline while the reader stays
open, so an idle visible tab cannot continue past expiry without validation.
retain the locked replica and pending mutations until revalidation or explicit
removal, so expiry alone does not silently lose notes. Observed clock rollback
behind the last server/check high-water mark locks until revalidation. A local
clock/storage owner can still bypass checks; offline revocation cannot be instant.
Revocation/unpublication learned online takes precedence over the seven-day
window and atomically clears that edition's content, quote/private replica,
receipt, and pending writes. Warn about unsynced work before explicit logout or
removal, but never keep revoked content readable. Server-owned notes are not
deleted by a local cache purge. No personal data is placed in Cache Storage.

Every private offline mutation receives a client-generated idempotency ID and
immutable local creation time and updates the local UI immediately. A
`revision_changed` response does not consume the ID; terminal results bind the
ID to the request fingerprint. Status is one of `synced`, `waiting for
connection`, `syncing`, or `action required`.

Highlights use last successfully synchronized change per sentence without a
conflict UI. Notes include `baseVersion`; concurrent cloud/local changes and
delete-vs-edit preserve both sides and offer Cloud, Local, or Manual Merge.
Reading progress chooses the newest valid anchor without prompting.

### Revision updates

Offline documents remain pinned to their exact revision until the user accepts
an update:

1. show that an update is available;
2. fetch the server-composed direct published mapping and rebase pending
   mutation anchors/versions to the current published revision;
3. resolve mapping conflicts, then replay those same mutation IDs against the
   current revision while idempotently migrating cloud private rows;
4. fully download and validate the new revision and required assets;
5. atomically switch local pointers;
6. retain the old working revision on update failure only while its access
   window remains valid; expiry locks and learned denial purges as below.

If the user declines an available revision update, keep the pinned local view
while access is valid and label synchronization paused until update/mapping is
accepted. Never apply current-revision state/anchors directly to an older paper.

There is no background content replacement or storage-pressure archive deletion;
explicit logout and learned revocation still perform the mandatory privacy purge.

### Account and storage lifecycle

An expired login leaves only an unexpired account-bound offline save readable
and pauses sync. Explicit logout/account switch clears that account's content,
receipts, local private state, recovery, and pending mutations in all tabs.
An Offline Content page shows issue, series, locale, revision, size, expiry,
update state, locked/available status, and removal.
Low storage produces a user choice instead of deleting private data.

Browsers without installation or required storage APIs retain full online
reading and hide unsupported offline actions.

## Browser Support

Formal support covers the current and previous major Chrome, Edge, and Safari
releases. iPad/iPhone Safari web and Home Screen PWA, and Android Chrome web and
installed PWA, receive explicit device acceptance. Firefox must support the
complete online reader; install UI is only promised where the browser exposes
it. IE and obsolete operating-system/browser releases are out of scope.

## Security, Privacy, and Reliability

### Trust boundaries

- Only malware-cleared assets enter extraction.
- PDF parsing has file-size, page-count, memory, and time limits.
- Exclusion masking runs before persistence outside the parser and before AI.
- Strict schemas reject unexpected AI output.
- Source checksums prevent stale job results from replacing newer input.
- Protected API bodies never accept authoritative `userId`; gateway identity
  is the only account selector.
- Private writes validate account, document, revision, and sentence ownership.
- Batch highlights execute in one database transaction.

### Failure behavior

Transient extraction failures retry a bounded number of times. Deterministic
results survive an unavailable LLM with ambiguous fields marked for manual
review. Invalid input does not retry forever. No failure changes the existing
PDF state or Published Revision.

Online publication validates content, mappings, layout, human confirmation,
and PDF precondition in one transaction, creates an immutable revision,
switches the published pointer atomically, and emits an outbox event. Failure
leaves the previous revision live.

Offline sync keeps unsynchronized local operations on transient failure,
pauses on authentication failure, and never retries through a note conflict.

### Private data lifecycle

`hhc-web-api` owns highlights, notes, progress, migration state, processed
mutations and reader receipts. Ordinary CMS/trace Admin cannot access private
annotations. Account deactivation/grace retains server data under existing
policy but removes member access. Extend the existing Website DSR owner
execution with explicit coverage for these datasets, preserving existing
watermark coverage and subject export/restrict/erase semantics. Exports remain
subject-scoped private DSR artifacts, not CMS browsing/export endpoints.
Final Account deletion requires the current DSR completed execution/coverage
contract; old watermark-only evidence cannot stand for new reader datasets.
Missing routes, incomplete coverage or failed erasure block finalization.
Retries/zero rows are idempotent and late mutations cannot recreate erased rows.
Do not introduce a parallel direct hard-delete callback or pretend any 404
proves erasure. Audit contains result/counts, not annotation content.

Mutation limits are 100 actions per batch, 500 sentence anchors per action/note,
10000 Unicode code points per note, and 1 MiB per request. Limits are enforced
server-side and mirrored in generated client/UI validation.

### Observability

Logs/metrics may contain non-sensitive job, revision, and asset IDs; stages,
latency, retry count, error class, warning counts, layout result, LLM token/cost
usage, publication result, synchronization rates, and erasure result.

They must not contain bulletin full text, LLM full responses, excluded-region
text, selections, copied text, notes, credentials, or private mutation bodies.

Alert on sustained extraction failure, queue backlog, member-projection
failure, repeated private sync failure, or incomplete account erasure.

## Validation and Acceptance

### Extraction and content

- Canonical metadata is never overwritten.
- Every allowed source text fragment is assigned once; none is omitted or
  duplicated.
- Excluded sensitive regions are absent from the captured outbound AI request.
- Instruction-like PDF content is treated as data.
- Repeated identical input produces identical structured output.
- Rules, schema validation, three-way merge, and every sentence mapping type
  have focused tests.

### Layout

For the initial unedited 1739 and 1740 extractions:

- page count is identical to source;
- every body component, hymn area, and retained back section starts on the same
  page;
- text is not clipped, overlapped, missing, or outside its slot;
- representative cover, body, hymn, and back pages pass desktop/iPad overlay
  or screenshot baselines;
- legal substitute glyph differences are allowed, but material reflow or page
  changes fail acceptance;
- mobile representative screens cover every component kind.

### Contracts and authorization

Tests cover independent PDF/Online lifecycle, publish preconditions, immutable
revisions, same-series authorized whole-edition fallback, uniform deny/unknown
404, no member sitemap/body leakage, identical download/reader entitlement results,
forged identity rejection, cross-account isolation, inaccessible Admin private
content, atomic bulk highlight, and idempotent account erasure.

### Reader and accessibility

End-to-end tests cover select/unselect, non-contiguous and mixed-color bulk
operations, Clear, exact Copy output, note CRUD, login return, navigation,
zoom/pan/swipe arbitration, progress, search, authenticated semantic HTML, keyboard
operation, focus, accessible naming, heading order, contrast, and reduced
motion.

### PWA and synchronization

Tests cover offline open/navigation/search/copy, every private offline
operation, idempotent replay, highlight ordering, note conflict and
delete-vs-edit, session expiry, logout clearing, failed revision download,
atomic revision switch, seven-day boundary, no renewal on failed auth, clock
rollback lock, learned revocation purge, cross-tab logout races, storage pressure,
and unsupported-API fallback. Seven days limits reading; the existing 90-day
mutation replay/91-day dedupe windows only apply after successful reauthorization
and never extend reading access.

### Performance

Page navigation, sentence selection, and optimistic private actions use local
state and do not wait for network response. The reader transfers structured
content and reusable assets rather than PDF page images. Production targets a
p75 time from authorized navigation to readable content of 2.5 seconds (measure
separately from generic shell LCP) and maintains responsive local
page/selection interactions.

## Delivery Sequence

The first member launch contains the complete V1, but implementation and
deployment are split into backward-compatible stages:

1. **CMS foundation:** `hhc-web-api` storage/contracts/extraction/publication
   and `admin-fe` editor/review/merge, with no public entry.
2. **Member reader:** protected published projection, shared renderer integration,
   existing download authorization, trace watermark, whole-edition locale
   resolution, in-bulletin search, and seven-day account-scoped offline content.
3. **Private interaction:** gateway/account integration, highlights, notes,
   progress, revision migration, and private offline sync.

Each repository receives its own branch, PR, required CI, merge, immutable
release, and live smoke check. Contracts are additive and released producer
first. The Home/archive Online entry is enabled only after both reference
bulletins pass end-to-end Admin, member, offline, authentication, watermark, and device
acceptance. A failed stage leaves the current PDF bulletin experience healthy.

## Explicit Non-Goals

- Rendering or embedding PDF pages as the online desktop/iPad implementation
- Visual drag-and-drop/template canvas editing
- OCR/vision ingestion for raster-only bulletins before a real input requires
  it
- New bulletin, AI, search, note, or synchronization microservices
- Structured `zh-Hans` or `en` Online Documents in the first release
- Cross-bulletin full-text search
- Two-page spread mode
- More than three highlight colors or custom colors
- Rich-text, tagged, shared, public, or global notes
- Automatic whole-archive offline caching or default PDF caching
- Duplicate weekly notification on Online publication
- Anonymous/full-body SEO, new reader permissions, and public bulletin caches
- Invisible browser fingerprinting, screenshot prevention, or DRM guarantees
