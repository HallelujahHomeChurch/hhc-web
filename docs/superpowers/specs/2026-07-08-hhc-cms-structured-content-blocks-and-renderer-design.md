# HHC CMS Structured Content Blocks And Renderer Design

## Purpose

This spec defines the CMS structured content format for body content, rich text marks, inline links, media blocks, renderer behavior, validation, migration, preview, public projections, accessibility, and security.

Structured content is the boundary between editor freedom and public-site safety. It must let editors build church pages without giving the CMS arbitrary HTML, JavaScript, layout-breaking markup, Blob URLs, or inconsistent frontend behavior.

This spec complements:

- `docs/api/admin-api.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-content-domain-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-api-postgresql-schema-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-security-rbac-threat-model.md`
- `docs/superpowers/specs/2026-07-08-hhc-asset-lifecycle-and-access-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`

## Core Decision

Use a versioned JSON block AST for CMS body content.

Do not store arbitrary HTML, raw Markdown, editor-library opaque JSON, or frontend component props as the source of truth. The source format should be small, explicit, validated by `hhc-web-api`, and rendered by whitelisted React components in `hhc-web`.

Recommended source shape:

```json
{
  "schemaVersion": 1,
  "blocks": []
}
```

Reasons:

- JSON block AST is safer than HTML.
- It can be validated consistently in Go and TypeScript.
- It is portable if the admin editor library changes later.
- It keeps public rendering deterministic and accessible.
- It can be migrated with explicit schema-version upgrades.

## Non-Goals

- Full generic page-builder.
- Arbitrary HTML editing.
- Arbitrary Markdown storage.
- Admin-defined CSS classes.
- Inline scripts, iframes, forms, or custom embeds.
- Arbitrary third-party scripts, tag-manager snippets, tracking pixels, or raw provider widgets.
- Nested layouts, grids, columns, accordions, tabs, or carousels in v1.
- Tables in v1 unless a dedicated accessible table schema is added later.

## Source Shape

Every `bodyJson` value must be an object:

```json
{
  "schemaVersion": 1,
  "blocks": [
    {
      "id": "blk_01J00000000000000000000000",
      "type": "paragraph",
      "content": [
        {
          "type": "text",
          "text": "Welcome",
          "marks": []
        }
      ]
    }
  ]
}
```

Rules:

- `schemaVersion` is required.
- `blocks` is required and must be an array.
- Block ids are stable within a document for editor diffing and revision review.
- Unknown top-level fields are rejected unless explicitly allowed by a future migration.
- Unknown block types are rejected by admin save/publish APIs.
- Public renderers must fail closed and render an error placeholder only in admin preview, not public pages.

## V1 Block Types

| Block | Purpose | Public Renderer |
| --- | --- | --- |
| `paragraph` | normal body text | `<p>` |
| `heading` | section heading | `<h2>` to `<h4>` initially |
| `image` | CMS-managed inline image | semantic figure/image |
| `quote` | quotation/testimony-style block | `<figure><blockquote>` |
| `buttonLink` | explicit call-to-action link | styled anchor/button-link component |
| `divider` | visual section break | semantic separator |
| `callout` | short highlighted note | accessible callout container |
| `list` | ordered/unordered text list | `<ul>` or `<ol>` |

V1 should not include video embed blocks inside generic body content. Videos are managed by the video module so provider metadata, thumbnails, accessibility, and script loading stay controlled.

## Inline Content

Text-bearing blocks use inline nodes:

```json
{
  "type": "text",
  "text": "Example",
  "marks": ["strong"]
}
```

Supported inline node types:

| Type | Fields |
| --- | --- |
| `text` | `text`, optional `marks` |
| `link` | `href`, `content`, optional `title` |
| `lineBreak` | none |

Supported marks:

- `strong`
- `emphasis`

Do not add underline, color, font size, arbitrary spans, or custom classes in v1. These create design-system drift and accessibility risk.

Link node example:

```json
{
  "type": "link",
  "href": "/zh-Hant/about",
  "content": [
    {
      "type": "text",
      "text": "About us"
    }
  ]
}
```

Inline link rules:

- Links cannot be empty.
- Link text must be meaningful; reject repeated generic labels such as `click here` only when no surrounding context can make it meaningful.
- Internal links must be relative public routes.
- External links must be `https`.
- Links must not point to Blob/SAS URLs, admin URLs, internal service URLs, localhost, private IP ranges, `/priv/*`, or `/api/priv/*`.

## Block Schemas

### Paragraph

```json
{
  "id": "blk_01",
  "type": "paragraph",
  "content": []
}
```

Rules:

- Content cannot be empty after trimming unless used as an intentional spacer, which is not allowed in v1.
- Paragraph text length has a configured maximum.

### Heading

```json
{
  "id": "blk_02",
  "type": "heading",
  "level": 2,
  "content": []
}
```

Rules:

- V1 allowed levels: `2`, `3`, `4`.
- Page templates own the single `h1`.
- Heading levels should not skip from `h2` to `h4` unless the page template explicitly allows it.
- Heading content cannot contain links in v1.

### Image

```json
{
  "id": "blk_03",
  "type": "image",
  "assetId": "asset_123",
  "alt": {
    "mode": "text",
    "text": "Church meeting room"
  },
  "caption": []
}
```

Rules:

- `assetId` is required.
- Asset namespace must be allowed for the content type.
- Public publish requires asset scan clean and derivative readiness when the namespace requires derivatives.
- `alt.mode` is `text` or `decorative`.
- `alt.text` is required when `mode=text`.
- `caption` uses inline content and cannot contain nested block content.
- Renderer uses dimensions and derivative metadata from projection, not arbitrary editor dimensions.
- Public renderer receives gateway asset URLs only.

### Quote

```json
{
  "id": "blk_04",
  "type": "quote",
  "content": [],
  "source": []
}
```

Rules:

- Quote content is required.
- Source is optional inline content.
- Do not use quote blocks as generic indentation.

### Button Link

```json
{
  "id": "blk_05",
  "type": "buttonLink",
  "label": "Read more",
  "href": "/zh-Hant/about",
  "style": "primary"
}
```

Rules:

- `label` is required and must be meaningful.
- `href` follows link validation rules.
- Allowed styles: `primary`, `secondary`, `text`.
- No arbitrary color, icon, class, or target in v1.

### Divider

```json
{
  "id": "blk_06",
  "type": "divider"
}
```

Rules:

- Divider is visual grouping only.
- Do not use repeated dividers as layout spacing.

### Callout

```json
{
  "id": "blk_07",
  "type": "callout",
  "tone": "info",
  "content": []
}
```

Rules:

- Allowed tones: `info`, `notice`.
- Content uses inline nodes only in v1.
- No arbitrary icons or colors.

### List

```json
{
  "id": "blk_08",
  "type": "list",
  "ordered": false,
  "items": [
    {
      "content": []
    }
  ]
}
```

Rules:

- `items` cannot be empty.
- V1 list items use inline content only.
- Nested lists are not allowed in v1.

## Renderer Contract

`hhc-web-api` validates source blocks and transforms publish/preview responses into render-ready blocks.

`hhc-web` renders only known block types through a whitelist:

```text
paragraph -> RichParagraph
heading -> RichHeading
image -> RichImage
quote -> RichQuote
buttonLink -> RichButtonLink
divider -> RichDivider
callout -> RichCallout
list -> RichList
```

Rules:

- No `dangerouslySetInnerHTML` for CMS content.
- No dynamic component lookup from CMS-provided names.
- No CMS-provided CSS class names.
- Unknown block type in public payload is treated as a backend contract bug and should fail the page render safely.
- Admin preview can show an explicit unsupported-block warning.
- Renderer output uses semantic HTML and design-system components.

## Validation Layers

### Save Draft

Save draft should validate:

- JSON shape
- schema version
- known block types
- max block count
- max nesting depth
- max text length per block and document
- link safety
- basic required fields
- asset id format and ownership

Save draft may allow publish blockers such as missing alt text or scan-pending assets if the preview can safely show warnings.

### Preview

Preview validation should:

- reject unsafe blocks, unsafe links, arbitrary HTML/script, and invalid schema version
- return warnings for publish blockers
- hide blocked asset bytes
- return `no-store` render model

### Publish

Publish validation is stricter:

- all blocks pass save validation
- required accessibility metadata is complete
- image assets are clean and ready
- linked public CMS routes exist or are allowed future/static routes
- no unsupported locale link mismatch
- SEO summary/body-derived metadata is safe

## Asset References

Body image blocks create asset references with purpose `inline`.

Rules:

- `bodyJson` can contain `assetId`, but the backend should also maintain normalized `content_asset_ref` rows for query, cleanup, grants, and usage.
- Publish grants public read only for assets referenced by the published revision/projection.
- Unpublish revokes public grants only when no other published resource references the asset.
- Preview may use restricted/protected preview grants, never public grants.

## Projection Shape

Public projection payload should include render-ready blocks, not raw source rows.

Example:

```json
{
  "bodyBlocks": [
    {
      "id": "blk_03",
      "type": "image",
      "asset": {
        "assetId": "asset_123",
        "url": "https://www.alive.org.tw/api/assets/public/asset_123",
        "width": 1200,
        "height": 800,
        "derivatives": {
          "webMd": "https://www.alive.org.tw/api/assets/public/asset_123?variant=web-md"
        }
      },
      "alt": "Church meeting room",
      "caption": []
    }
  ]
}
```

Rules:

- Public projections must not include private asset ids that are not rendered.
- Public projections must not include draft-only validation notes.
- Public projections must not include raw editor-only state.
- Public projections must not include Blob/SAS URLs.

## Schema Versioning

`schemaVersion` changes when the source format changes incompatibly.

Rules:

- `hhc-web-api` supports reading all schema versions that exist in production.
- New writes use the current schema version.
- Migrations must be idempotent and produce revision snapshots before changing stored body content.
- Public projections are rebuilt after schema migration when render output can change.
- Unknown future versions are rejected for save/publish and treated as not renderable.

## Editor Integration

The admin editor may use a rich editor library internally, but it must map to and from the HHC block AST.

Rules:

- Store HHC block AST, not library-native opaque JSON.
- Editor toolbar exposes only supported blocks and marks.
- Paste handling converts allowed content into HHC blocks and strips unsupported formatting.
- Pasting HTML never stores raw HTML.
- External images pasted from clipboard/upload become `asset-api` uploads or are rejected.
- Editor shows accessibility warnings inline.

## Migration From Current Content

Current i18n/body strings should migrate into conservative blocks:

- plain paragraphs
- headings where current component structure already implies headings
- image blocks only when there is an existing static asset with reviewed alt text
- button links only for existing clear call-to-action links

Migration should not infer complex blocks from visual layout. When unsure, seed as paragraph content and mark `needs_review`.

## Security Rules

- No raw HTML source.
- No script/style/event attributes.
- No iframe/embed/object tags.
- No SVG as CMS image unless a separate sanitization policy exists.
- No `javascript:`, `data:`, `file:`, `blob:`, or `mailto:` links in v1 unless a future route-specific policy allows them.
- No external image URLs in body blocks; upload through `asset-api`.
- No internal service URLs, admin URLs, localhost, private IP ranges, Blob/SAS URLs, or `/priv/*`.

## Observability

Metrics:

- content block validation failures by block type/code
- publish blocker count by content type
- unsupported block type count
- body schema migration count/failure
- rich renderer error count by route

Logs:

- request id
- content id
- content type
- locale
- schema version
- validation error codes

Do not log full body content or raw pasted HTML.

## Tests

Backend tests:

- valid block schemas pass
- unknown block type fails
- invalid schema version fails
- raw HTML/script/link protocols fail
- internal/admin/private links fail
- image block requires allowed asset namespace
- publish requires alt/decorative metadata
- publish requires clean/ready image assets
- normalized `content_asset_ref` rows match body image blocks
- projection contains public gateway URLs only
- schema migration preserves revision history

Frontend tests:

- renderer maps every v1 block type
- renderer never uses `dangerouslySetInnerHTML`
- renderer applies semantic headings and landmarks correctly
- unsupported public block fails safely
- admin preview shows validation warnings
- paste handling strips unsupported formatting

End-to-end smoke tests:

- editor saves paragraph/heading/image/list content
- preview renders saved draft blocks
- publish renders public blocks
- public page contains semantic HTML for headings, images, lists, and links
- public page never renders raw HTML from CMS
- public projection and DOM contain no Blob/SAS URLs

## Acceptance Criteria

- `bodyJson` is a versioned JSON block AST.
- V1 supports paragraph, heading, image, quote, buttonLink, divider, callout, and list blocks.
- CMS source never stores arbitrary HTML, raw Markdown, editor-library opaque JSON, or CSS classes.
- `hhc-web-api` validates blocks on save, preview, and publish with publish-specific stricter rules.
- `hhc-web` renders blocks through a whitelist without `dangerouslySetInnerHTML`.
- Inline links and block links use shared public-safe URL validation.
- Image blocks use `assetId` and public/protected gateway URLs only.
- Accessibility metadata is required before public publish.
- Public projections contain render-ready safe blocks, not raw editor state.
- Schema versioning and migrations are explicit.
