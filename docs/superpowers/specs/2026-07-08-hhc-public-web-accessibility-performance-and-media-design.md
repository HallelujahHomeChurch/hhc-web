# HHC Public Web Accessibility, Performance, And Media Design

This spec defines accessibility, frontend performance, Core Web Vitals, image/media delivery, and CMS content quality rules for the public HHC website and admin console.

Structured content block schema, renderer semantics, inline link validation, image block metadata, and no-raw-HTML rules are defined in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

Third-party embed, analytics, consent, provider registry, and click-to-load rules are defined in `docs/superpowers/specs/2026-07-08-hhc-public-web-third-party-analytics-and-consent-governance-design.md`.

## Purpose

The church website serves visitors across devices, ages, languages, and network quality. Architecture quality is not only service boundaries; the public experience must be readable, accessible, fast, and resilient when content is managed through CMS.

This spec covers:

- accessibility standards
- CMS accessibility metadata
- public performance budgets
- Core Web Vitals targets
- image and media delivery
- font and script policy
- admin accessibility
- testing and rollout gates

## Core Decision

Do not create a standalone performance or accessibility service.

Accessibility and performance are shared responsibilities:

- `hhc-web` owns semantic markup, keyboard behavior, responsive layout, rendering strategy, bundle budget, and Web Vitals instrumentation.
- `hhc-web-api` owns public projections that include required accessibility and media metadata.
- `asset-api` owns image dimensions, derivatives, MIME validation, scan status, and stable gateway URLs.
- CMS/admin UI owns editorial validation for alt text, captions, link text, and required media metadata.
- CI and rollout checks enforce the budgets before production promotion.

## Accessibility Target

Target WCAG 2.2 AA for public pages and admin workflows where practical.

V1 minimum:

- semantic headings and landmarks
- keyboard-accessible navigation and controls
- visible focus states
- sufficient color contrast
- form labels and error messages
- meaningful link text
- image alt text rules
- no keyboard traps
- reduced motion support for animations
- language attributes per locale
- admin pages usable without pointer-only interactions

This is a target and design constraint, not a separate service boundary.

## Locale And Language Accessibility

Rules:

- Public HTML `lang` must match route locale.
- `zh-Hant`, `zh-Hans`, and `en` pages use appropriate language tags.
- Locale switch controls must expose current locale and target locale names accessibly.
- Missing translations should not create mixed-language labels without explicit fallback metadata.
- Direction is left-to-right for v1 locales.
- Future locales must define `lang`, direction, font coverage, and sitemap alternate behavior before launch.

## CMS Accessibility Metadata

CMS-managed media must include accessibility metadata where needed.

Required by asset/content type:

| Content | Required Metadata |
| --- | --- |
| News cover image | localized alt text or explicit decorative flag |
| Page/inline image | localized alt text or explicit decorative flag |
| Open Graph image | alt text not required for metadata render, but source asset should still have safe title/description |
| Video embed | localized title, source/provider, and transcript/caption link when available |
| Weekly PDF | localized title, issue date, file size, and document language |
| Location map link | accessible location name and address text outside the map |
| Icon-only admin buttons | accessible label |

Rules:

- Do not allow publish when required public images lack alt text or decorative flag.
- Decorative images must be intentionally marked decorative by an editor or module rule.
- Filename must not be used as alt text.
- Asset metadata should include dimensions so layout can reserve space and avoid CLS.
- Public projections should include `width`, `height`, `alt`, and derivative URLs for images.
- Third-party video or map embeds must have a static fallback and accessible click-to-load control before provider content loads.

## Public Performance Targets

Initial production targets on public pages:

| Metric | Target |
| --- | --- |
| LCP | p75 under 2.5s on real user traffic where measurable |
| CLS | p75 under 0.1 |
| INP | p75 under 200ms |
| HTML server response | p95 under 800ms excluding CDN/client network |
| Public JS per route | keep route-specific JS minimal; investigate regressions over budget |
| Images | serve appropriately sized derivatives instead of oversized originals |

These targets should be refined after real traffic data exists.

## Route Performance Classes

| Route Class | Examples | Performance Strategy |
| --- | --- | --- |
| Static chrome | navigation, footer, legal shell | mostly static/i18n |
| Public content pages | home, about, legal, news, videos, locations | server render from public projections with controlled revalidation |
| Weekly download page/list | weekly latest/archive | cache public metadata; asset download streams through `asset-api` |
| Admin shell | admin routes | no public cache; split admin bundle from public |
| Admin editor | CMS forms and asset picker | client-rendered, accessibility-tested controls |

Admin UI performance must not degrade the public website bundle. If shared dependencies grow large, split admin-only modules.

## Image Delivery Policy

Use `asset-api` gateway URLs for CMS-managed public images.

V1 policy:

- `asset-api` generates required derivatives for CMS image namespaces.
- Public projections reference derivative-capable metadata.
- `hhc-web` renders responsive image markup using known dimensions.
- Keep Next image optimization disabled until it is explicitly configured to fetch only safe public gateway asset URLs.
- Do not route private/protected assets through public image optimization.
- Do not serve CMS-managed images directly from Blob or committed `/public/assets` after migration unless they are intentionally static brand assets.

Recommended derivative kinds:

| Kind | Purpose |
| --- | --- |
| `thumbnail` | cards, admin picker |
| `web-sm` | mobile/content inline |
| `web-md` | card/list/detail |
| `web-lg` | hero/large content |
| `og` | Open Graph/social sharing |

Derivatives inherit original visibility and grants.

## Layout Stability

Prevent CLS:

- Images in public projections include width and height.
- Components reserve aspect ratio before image load.
- Fonts use stable fallback metrics where feasible.
- CMS editors cannot publish layout-critical media with unknown dimensions when the component requires dimensions.
- Admin preview should show when missing media dimensions would affect layout.

## Font Policy

Rules:

- Keep font families limited and intentional.
- Prefer local/self-hosted or framework-managed fonts with predictable loading.
- Use `font-display: swap` or equivalent strategy.
- Avoid loading large font subsets for locales that do not need them.
- Do not let CMS content select arbitrary external fonts.

## Script And Bundle Policy

Rules:

- Keep analytics, embeds, and third-party scripts out of the critical path.
- YouTube embeds should use lightweight preview/link behavior where possible before loading heavy iframe code.
- Admin-only dependencies must not be imported into public route bundles.
- Rich editor libraries should load only on admin editor routes.
- Feature adapters should avoid pulling large generated clients into every route if a smaller wrapper is enough.

## Video And External Media

Videos remain provider-hosted in v1 unless there is a real need to upload video files.

Rules:

- Store provider metadata, not arbitrary embed HTML.
- Render accessible title and link.
- Lazy-load heavy embeds.
- Provide transcript/caption link when available.
- Custom thumbnails use `asset-api` and require image metadata.
- External provider failures should not break the whole page.

## PDF Accessibility

Weekly PDFs are currently downloadable assets. Full PDF accessibility remediation is outside v1 unless the church requires it, but the platform should support better metadata:

- localized title
- issue date
- document language
- file size
- MIME type
- stable gateway download URL

The website and LINE bot should present enough context before download.

## Admin Accessibility

Admin UI must support:

- keyboard navigation
- form labels
- field-level validation messages
- focus movement after modal open/close
- accessible tabs for locales
- accessible asset picker
- clear scan/processing status text
- non-color-only status indicators
- accessible publish/unpublish confirmation dialogs

Admin content quality controls:

- required alt text validation
- meaningful link text warnings
- heading-level warnings for rich content if structured blocks support headings
- preview of public metadata

## Content Blocks

Structured body blocks should support accessibility constraints:

- heading blocks cannot skip levels unless explicitly allowed by page template
- image blocks require alt/decorative metadata
- link blocks require accessible label
- callout/quote blocks use semantic markup
- table blocks, if added later, require headers and caption support

No raw HTML editor in v1 keeps accessibility and security review manageable.

The public renderer must use the structured block whitelist and semantic components. It must not use `dangerouslySetInnerHTML` for CMS content.

## Core Web Vitals Instrumentation

`hhc-web` should collect Web Vitals in production when a privacy-safe analytics path exists.

Rules:

- Do not collect raw personal identifiers.
- Tag metrics by route pattern, locale, and build version.
- Keep sampling configurable.
- Treat Web Vitals as operational signals, not user tracking.
- If no analytics provider is selected in v1, keep the instrumentation hook ready and validate through lab tests.

## CI And Test Requirements

Required checks:

- lint/typecheck/build for frontend
- accessibility unit/component checks where tooling supports it
- keyboard smoke tests for primary admin flows
- public route render tests for all locales
- metadata tests for image dimensions and alt/decorative rules
- sitemap/canonical tests from SEO design
- bundle size or build artifact regression check
- Lighthouse or equivalent lab check for representative public pages before major rollout
- image derivative fixture tests in `asset-api`
- publish validation blocks missing required accessibility metadata

Automated accessibility tests do not replace manual keyboard and screen-reader spot checks for major admin workflows.

## Rollout Gates

Before CMS-backed public rendering goes production:

- current public routes render in all v1 locales
- home/about/legal/weekly pages have valid headings and landmarks
- public images have dimensions and alt/decorative metadata
- Open Graph image fallback works
- no admin code inflates public bundle materially
- representative pages meet lab performance budget
- sitemap/canonical/alternate metadata passes tests
- admin editor can publish without mouse-only interactions

## Observability

Track:

- Web Vitals by route pattern and locale
- public page render latency
- public route JS/build size trends
- image derivative missing/fallback count
- public image original-size usage count
- CLS fallback/dimension missing count
- admin publish blocked by accessibility validation
- external video embed failure count

Alert only on sustained regressions or release-related spikes. Single client Web Vitals outliers should not page operators.

## Degraded Modes

Allowed:

- serve default Open Graph image when content image is unavailable
- serve original public image temporarily only if namespace permits and dimensions are known
- show lightweight video link when embed provider fails
- block publish until required media metadata is fixed

Not allowed:

- publish public image with missing required alt/decorative metadata
- use private/protected asset as public image or Open Graph image
- use unknown dimensions for layout-critical public images
- make admin UI inaccessible to keyboard users for core publish flow
- load admin editor bundle on public pages

## Acceptance Criteria

- Accessibility and performance are treated as shared implementation gates, not separate services.
- Public pages target WCAG 2.2 AA practical baseline.
- Public projections include required image alt/decorative metadata, width, height, and derivative URLs.
- CMS publish validation blocks missing required accessibility metadata.
- `asset-api` derivatives support responsive public image delivery.
- `hhc-web` does not enable unsafe image optimization for private/protected assets.
- Admin-only bundles do not materially affect public route bundles.
- Public routes have canonical/sitemap/metadata tests and representative performance checks.
- Web Vitals instrumentation path is privacy-safe when enabled.
- Rollout evidence includes accessibility, media, and performance checks for CMS-backed rendering.
