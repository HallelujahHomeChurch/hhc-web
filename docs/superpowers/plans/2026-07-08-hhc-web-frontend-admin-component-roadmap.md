# HHC Web Frontend And Admin Component Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans when implementing this roadmap. Each task should preserve current public routes while moving data behind stable APIs.

**Goal:** Move the existing `hhc-web` public site from mock/i18n-only content toward `hhc-web-api` backed content, while adding an admin console that manages the same CMS source model.

**Architecture:** Public pages call same-origin `www.alive.org.tw/api/*` through typed clients. Admin UI is served from `admin.alive.org.tw` and calls `www.alive.org.tw/api/admin/*` with account-issued access tokens validated by gateway.

Account login, refresh, JWKS, and browser token-handling boundaries are specified in `docs/superpowers/specs/2026-07-08-hhc-account-token-contract-design.md`.

CMS editorial workflow, admin console behavior, preview, publish/unpublish, localization, asset picker, and module-specific admin rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-editorial-workflow-design.md`.

CMS admin preview, draft rendering, revision preview, protected draft asset preview, no-store/noindex behavior, and public-leak prevention are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-admin-preview-and-draft-rendering-design.md`.

Structured content block schema, renderer contract, inline link validation, body asset references, schema versioning, and no-raw-HTML rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`.

CMS revision history, restore to draft, rollback publish, and public-impact confirmation rules are specified in `docs/superpowers/specs/2026-07-08-hhc-cms-content-versioning-rollback-design.md`.

Site settings, header navigation, footer links, social links, public contact display, site SEO defaults, and `GET /api/site-layout` are specified in `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`.

Content migration/bootstrap, seed manifests, public API fixtures, and route parity rules are specified in `docs/superpowers/specs/2026-07-08-hhc-content-migration-bootstrap-design.md`.

Rendering/delivery, static-export cutover, host-aware public/admin UI routing, sitemap/SEO runtime behavior, and frontend rollback are specified in `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`.

Accessibility, performance, media metadata, image derivative, public bundle, and admin keyboard-flow gates are specified in `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`.

API contract governance, generated TypeScript client boundaries, fixture strategy, and compatibility gates are specified in `docs/superpowers/specs/2026-07-08-hhc-api-contract-governance-and-client-generation.md`.

Public/admin search UI boundaries, result safety, snippets, and post-v1 activation rules are specified in `docs/superpowers/specs/2026-07-08-hhc-public-and-admin-search-design.md`.

**Tech Stack:** Next.js 16, React 19, TypeScript, current `src/features/*` modules, future generated or hand-written API clients, existing i18n locale registry.

## Global Constraints

- Keep existing public routes stable.
- V1 locales are `zh-Hant`, `zh-Hans`, and `en`.
- Production must not use `api.alive.org.tw`.
- Public feature functions should keep current exported names during migration where practical.
- CMS/editor UI must not expose draft content through public routes.
- Weekly download URLs must be gateway asset URLs.
- Existing mock data stays as local/test fallback until API fixtures and route parity prove the CMS-backed path.
- Remove `output: 'export'` when CMS/API-backed runtime rendering becomes the production path.
- Do not create Next.js API routes for platform APIs; the frontend is UI only.
- V1 CMS uses explicit Save Draft, Preview, Publish, Unpublish, and Archive actions; approval workflow, scheduled publishing, collaborative editing, and autosave-as-source-of-truth are out of scope.
- Admin mutations use `Idempotency-Key`; update/publish/unpublish/archive flows use version preconditions when versioned resources are implemented.
- Revision restore and rollback controls are allowed in v1 because they protect recoverability; rollback publish still uses the normal publish safety checks.

---

## Current Public Components

| Component | Current File | Data Source Today | Future Data Source |
| --- | --- | --- | --- |
| Site header/nav | `src/components/layout/SiteHeader.tsx` | hard-coded nav plus i18n labels | `GET /api/site-layout` for nav; i18n for UI chrome |
| Site footer/social | `src/components/layout/SiteFooter.tsx` | `siteConfig` plus i18n labels | `GET /api/site-layout` for footer/social/contact; i18n for UI chrome |
| Home hero | `src/components/home/HomeHero.tsx` | i18n messages | home projection |
| News section | `src/components/home/NewsSection.tsx` | `features/news` mock | `GET /api/news` |
| Weekly card | `src/components/home/WeeklyCard.tsx` | `features/weekly` mock | `GET /api/bulletins/latest` |
| Video section | `src/components/home/VideoSection.tsx` | `features/videos` mock | `GET /api/videos` |
| About teaser | `src/components/home/AboutTeaser.tsx` | i18n messages | home projection or about page summary |
| Location section | `src/components/home/LocationSection.tsx` | `features/locations` mock | `GET /api/locations` |
| About hero | `src/components/about/AboutHero.tsx` | i18n messages | page/about projection |
| Vision content | `src/components/about/VisionContent.tsx` | i18n messages | structured content blocks rendered by `RichContentRenderer` |
| History timeline | `src/components/about/HistoryTimeline.tsx` | `features/history` mock | `GET /api/history` |
| Weekly archive | `src/components/literature-ministry/WeeklyArchive.tsx` | `features/weekly` mock | `GET /api/bulletins` |
| Legal document | `src/components/legal/LegalDocument.tsx` | i18n messages | `GET /api/legal/{slug}` |

## Phase 1: Public API Client Foundation

**Files:**

- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/public.ts`
- Create: `src/lib/api/errors.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/weekly/api.ts`
- Modify: `src/features/videos/api.ts`
- Modify: `src/features/locations/api.ts`
- Modify: `src/features/history/api.ts`
- Create: `src/features/site-layout/api.ts`
- Create: `src/features/site-layout/types.ts`
- Modify: `src/components/layout/SiteHeader.tsx`
- Modify: `src/components/layout/SiteFooter.tsx`

**Plan:**

- Add an envelope-aware API client.
- Default base URL to same-origin `/api`.
- Use `NEXT_PUBLIC_API_BASE_URL` only for local/staging override.
- Preserve existing feature API function names.
- Keep mock fallback only for local development and tests.
- Add `getSiteLayout(locale)` and local/test fallback seeded from current `siteConfig` and locale messages.
- Move header navigation, footer links, social links, contact display, and site SEO defaults to the site-layout response.
- Keep menu open/close labels, language-switcher labels, loading/error text, and other generic UI chrome in frontend i18n.
- Add generated public API fixtures from the content seed manifest before switching production routes.
- Add route-level parity tests for every current locale route.
- Introduce generated DTO types only after the public/admin OpenAPI contracts stabilize.
- Keep business logic, token injection, mock fallback, and feature-model mapping in hand-written wrappers outside generated folders.

**Acceptance:**

- Existing public pages can still render from mocks.
- API-backed path can be tested through mocked fetch.
- Fixture-backed API adapter tests cover weekly, news, videos, locations, history, legal, and home data.
- Site header/footer render from `GET /api/site-layout` and never expose Blob/SAS URLs, internal hosts, admin URLs, or `/priv/*`.
- Generated client/DTO code compiles when OpenAPI contracts change.
- No production config references `api.alive.org.tw`.

## Phase 2: Weekly Bulletin UI Integration

**Files:**

- Modify: `src/features/weekly/types.ts`
- Modify: `src/features/weekly/api.ts`
- Modify: `src/components/home/WeeklyCard.tsx`
- Modify: `src/components/literature-ministry/WeeklyArchive.tsx`

**Plan:**

- Map public API bulletin response into current `WeeklyBulletin` and `WeeklyIssue`.
- Use `downloadUrl` as `href`.
- Support latest and archive paging.
- Show clean empty state when no bulletin exists.
- Keep download link a normal anchor for browser and LINE compatibility.

**Acceptance:**

- Home weekly card uses latest published bulletin.
- Literature archive lists published issues.
- Download URL points to `/api/assets/public/{assetId}`.
- Missing bulletin does not crash page.

## Phase 3: News, Videos, Locations, History

**Files:**

- Modify existing `src/features/*/api.ts`.
- Add mapping tests for each feature response.
- Keep existing components unless presentation changes are required.

**Plan:**

- News list maps `GET /api/news` to `NewsItem[]`.
- Videos map `GET /api/videos` to `VideoItem[]`.
- Locations map `GET /api/locations` to `LocationItem[]`.
- History maps `GET /api/history` to `HistoryTimelinePayload`.

**Acceptance:**

- Current component tests still pass.
- API errors return controlled empty/error state.
- SEO metadata still renders for all locales.

## Phase 4: About And Legal Content Move

**Files:**

- Modify `src/app/[locale]/about/page.tsx`.
- Modify `src/app/[locale]/privacy-policy/page.tsx`.
- Modify `src/app/[locale]/terms-of-use/page.tsx`.
- Add page-content client methods.
- Create: `src/components/content/RichContentRenderer.tsx`
- Create: `src/components/content/rich-blocks/*`

**Plan:**

- Move editorial hero/body/legal document content from i18n messages to CMS public page APIs.
- Render body content through the structured block renderer, not raw HTML.
- Move navigation and footer link labels through the published site-layout projection.
- Keep button labels, menu open/close labels, language-switcher labels, generic states, and other static UI chrome in i18n.
- Keep legal slugs stable.

**Acceptance:**

- About page renders CMS hero, vision, and history.
- Legal pages render CMS content.
- Missing legal page returns Next `notFound`.
- Locale alternates remain correct.

## Phase 5: Admin Shell

**Files:**

- Create: `src/app/[locale]/admin/page.tsx`
- Create: `src/app/[locale]/admin/preview/content/[id]/page.tsx`
- Create: `src/app/[locale]/admin/preview/bulletins/[issueId]/page.tsx`
- Create: `src/app/[locale]/admin/preview/site-settings/page.tsx`
- Create: `src/features/admin/components/AdminShell.tsx`
- Create: `src/features/admin/auth.ts`
- Create: `src/features/admin/api-client.ts`
- Create: `src/features/admin/components/SiteSettingsEditor.tsx`

**Plan:**

- Add admin shell with navigation:
  - Dashboard
  - News
  - Pages
  - Weekly Bulletins
  - Videos
  - Locations
  - Assets
  - Legal
  - Audit
  - Settings
- Integrate OIDC token retrieval through an account-flow adapter that redirects to `account.alive.org.tw`, receives the access token, and exposes token/error state to admin API clients.
- Call `www.alive.org.tw/api/admin/*`.
- Add Settings entry point for site navigation, footer links, social links, public contact display, and site SEO defaults.
- Exclude runtime config, secrets, OIDC settings, service URLs, storage provider details, feature flags, and gateway route policy from the Settings UI.

**Acceptance:**

- Admin UI is host-aware for `admin.alive.org.tw`.
- Missing token shows login/unauthorized state.
- Insufficient role shows forbidden state.
- Admin UI does not fetch draft content from public APIs.
- Preview routes are admin-only, no-store, noindex, and fetch only `www.alive.org.tw/api/admin/preview/*`.

## Phase 6: CMS Editors

**Components:**

- `ContentList`
- `ContentEditor`
- `BlockEditor`
- `RichContentRenderer`
- `LocaleTabs`
- `SeoPanel`
- `PublishControls`
- `AssetUploadField`
- `PreviewPane`
- `PreviewToolbar`
- `PreviewWarnings`
- `RevisionPreview`
- `RevisionTimeline`
- `SiteSettingsEditor`

**Plan:**

- Build one reusable content editor for news/pages/legal where possible.
- Build a structured block editor that stores the HHC block AST, not editor-library native JSON.
- Build specialized editors for bulletins and locations.
- Use locale tabs for `zh-Hant`, `zh-Hans`, `en`.
- Keep publish controls explicit; no auto-publish on save.
- Add revision timeline, selected-revision preview, restore-to-draft action, and rollback-publish confirmation.
- Add preview route/pane states for draft, published, and revision modes.
- Build `SiteSettingsEditor` as a specialized editor because it edits shared layout/navigation rather than page body content.

**Acceptance:**

- Editor can save draft.
- Editor can publish/unpublish with role checks.
- Validation errors show field-level messages.
- Preview uses admin API only.
- Preview prompts Save Draft before server preview when there are unsaved changes.
- Preview never renders Blob/SAS URLs and never calls public APIs for draft content.
- Rich content renderer never uses `dangerouslySetInnerHTML`.
- Paste handling strips unsupported formatting and rejects unsafe links.
- Restore to draft does not change public pages.
- Rollback publish shows asset/slug/public-impact warnings before confirmation.
- Site settings publish updates header/footer/navigation/social/contact display without requiring frontend redeploy.

## Phase 7: Bulletin Manager

**Components:**

- `BulletinIssueList`
- `BulletinIssueEditor`
- `BulletinVersionUploader`
- `BulletinPublishPanel`

**Plan:**

- Create issue by date.
- Upload one PDF per locale.
- Show asset scan/processing status.
- Publish only when PDF assets are clean and ready.
- Show public download URL after publish.

**Acceptance:**

- Admin cannot publish infected or scan-failed PDF.
- Public latest updates after publish.
- Public latest removes issue after unpublish.
- LINE bot can fetch the same issue through public API.

## Phase 8: Asset Manager

**Components:**

- `AssetLibrary`
- `AssetDetail`
- `AssetUsageList`
- `AssetGrantPanel`

**Plan:**

- Show asset metadata, visibility, scan status, owner, and usage.
- Do not expose Blob URL.
- Show gateway public URL only when public grant exists.

**Acceptance:**

- Admin sees where an asset is used.
- Public grant/revoke updates displayed URL state.
- Private/restricted assets do not display public URL.

## Phase 9: Search UI

Build only when public or admin search is enabled in `hhc-web-api`.

**Files:**

- Create: `src/features/search/api.ts`
- Create: `src/features/search/types.ts`
- Create: `src/components/search/SearchForm.tsx`
- Create: `src/components/search/SearchResults.tsx`
- Create: `src/app/[locale]/search/page.tsx`
- Add admin content search integration to the relevant CMS list views.

**Plan:**

- Public search page calls `GET /api/search`.
- Admin CMS list search calls `GET /api/admin/search/content`.
- Render snippets as plain text only.
- Keep public search result pages `noindex` unless a deliberate SEO strategy is approved.
- Do not create Next.js API routes or proxy search through `hhc-web`.
- Do not mix admin draft search results into public UI.

**Acceptance:**

- Public search supports `zh-Hant`, `zh-Hans`, and `en` fixtures.
- Empty, loading, error, invalid query, and `429` states render cleanly.
- Snippets do not render raw HTML.
- Public results contain only public URLs.
- Admin search requires authenticated admin state and handles `401`/`403`.

## Testing Requirements

- Feature API adapter tests for all public modules.
- Search adapter and component tests when search UI is enabled.
- Rich content renderer tests for every v1 block type.
- Component tests for empty/error/loading states.
- Admin auth state tests.
- Publish control role tests.
- Revision timeline, restore, and rollback role tests.
- Preview route/component tests for no-store/noindex, forbidden, validation warning, revision read-only, and no public draft fetch.
- Bulletin upload/publish tests.
- Asset URL tests proving no Blob URL is exposed.
- Site-layout tests proving no secret/internal/admin/private route leaks.
- Structured content tests proving no raw HTML, unsafe link, Blob/SAS URL, or unsupported block renders publicly.
- Locale tests for `zh-Hant`, `zh-Hans`, `en`.

## Migration Rule

Do not delete existing mock data until:

- public API response fixtures exist
- feature adapters are tested
- all current public pages pass rendering tests
- staging public API smoke tests are available
- encoded text has been reviewed in all v1 locales
- production has a tested feature flag or config rollback to the previous data path
