# Five-Locale Products, Shared Controls, and CMS Translation Design

**Date:** 2026-08-11

**Status:** Approved design

**Coordinating repository:** `hhc-web`

**Affected repositories:** `frontend-platform`, `hhc-web`, `account-fe`, `admin-fe`, `hhc-web-api`, `account-api`, `engagement-api`, `notification-api`

**Read-only verification target:** `api-gateway`

## Summary

HHC will support Traditional Chinese, Simplified Chinese, English, Japanese, and Korean across the public website, account experience, CMS content, subscriptions, campaigns, and user-facing notifications. The Admin console interface itself remains Traditional Chinese, Simplified Chinese, and English because its operators do not need Japanese or Korean console copy.

The current single locale tuple cannot represent those different responsibilities. The implementation must split Admin interface locales from product and content locales before adding Japanese and Korean. The Admin header keeps a three-language selector backed by a host-only preference, so isolating Admin from the product cookie does not remove the operator's ability to choose a console language.

The same work will refine the shared avatar menu and selector primitives using the approved **Compact Utility** direction, remove the redundant hero image preload that produces browser warnings, and preserve the current server-rendered navigation without adding a global loading page.

CMS editors will also be able to generate missing language drafts from a saved Traditional Chinese source through Azure OpenAI. Generated text is a reviewable preview only: it never overwrites existing translations, saves automatically, or publishes automatically.

Japanese and Korean banners retain the site's handwritten brand character through locale-specific display fonts. Generated CMS translations target natural, contemporary local expression rather than literal Traditional Chinese sentence structure.

## Authoritative Domain Correction (2026-08-11)

| Domain | Values | Owns |
| --- | --- | --- |
| `ProductLocale`, `ContentLocale`, `MessageLocale` | `zh-Hant`, `zh-Hans`, `en`, `ja`, `ko` | Product routes/preferences, generic CMS content, and recipient/message copy. |
| `AdminUiLocale` | `zh-Hant`, `zh-Hans`, `en` | Admin console chrome only. |
| `BulletinEdition` | `zh-Hant`, `zh-Hans`, `en` | Weekly-paper metadata, PDF assets, editor tabs, and public downloads. |

`BulletinEdition` is independent of the five-locale domains. Japanese and Korean product/message routes display links to all three weekly-paper editions; Japanese/Korean notification copy may use the English message fallback, but no Japanese or Korean PDF edition exists. Generic CMS translation previews target `zh-Hans`, `en`, `ja`, and `ko`; bulletin metadata previews target only `zh-Hans` and `en`. Any later requirement in this document for a Japanese/Korean bulletin upload, preview, or download lifecycle is superseded by this correction. Migration 022 is immutable; inventory any legacy `ja`/`ko` bulletin rows before a reviewed remediation, and do not silently relabel, delete, or rewrite them.

## Goals

1. Keep the Admin console interface limited to `zh-Hant`, `zh-Hans`, and `en`.
2. Support `zh-Hant`, `zh-Hans`, `en`, `ja`, and `ko` in `hhc-web` and `account-fe`.
3. Let Admin editors create and publish all five generic CMS content locales while keeping weekly-paper PDFs at exactly three independent editions.
4. Carry Japanese and Korean through account security email, newsletter, campaign, Web Push, and subscription contracts.
5. Give CMS editors an explicit, audited way to generate missing translations from Traditional Chinese without weakening the existing draft, revision, or publish boundaries.
6. Make the shared avatar menu and selector visually consistent, accessible, compact, and reusable by all three frontends.
7. Remove the hero image preload warning without regressing above-the-fold image priority.
8. Avoid adding a global text-only loading page.
9. Publish Isaiah 49:1–3 and 49:5–6 with reviewed source text, locale-specific fallback, and publisher-compliant attribution.
10. Preserve the handwritten banner identity in Japanese and Korean without mixed fallback glyphs or large runtime font payloads.
11. Make generated Japanese and Korean CMS drafts natural and approachable while preserving meaning, terminology, and editorial control.

## Non-Goals

- Translating weekly-paper PDF contents or creating Japanese/Korean PDF editions. Editors continue to upload one PDF for each of the three `BulletinEdition` values.
- Generating account security emails with an LLM at send time.
- Automatically translating static product copy, privacy policies, or terms at runtime. Those translations remain reviewed source files.
- Translating or paraphrasing canonical scripture with an LLM.
- Automatically translating campaign/newsletter copy in the first CMS translation release. Campaign schemas and editors become five-locale capable, but LLM assistance starts with website CMS text and bulletin metadata.
- Creating a translation microservice.
- Automatically saving or publishing generated text.
- Replacing the current authentication, publication, revision, asset, or notification service boundaries.
- Introducing a global `loading.tsx` or client-side locale redirect page.
- Loading Japanese or Korean banner fonts from a third-party origin at runtime.
- Applying a casual conversational register to legal copy, account security messages, or scripture.

## Current-State Findings

### Locale ownership is conflated

`@hallelujahhomechurch/preferences` currently exports one tuple:

```ts
['zh-Hant', 'zh-Hans', 'en']
```

`hhc-web`, `account-fe`, and `admin-fe` all consume that tuple. Admin additionally uses similarly named local tuples for CMS translations, campaigns, schedules, and bulletins. This makes “console language” and “published content language” look like the same concept even though they have different audiences.

The shared `hhc_locale` cookie is valid across `.alive.org.tw`. If it is expanded to `ja` and `ko` without isolating Admin preferences, Admin can receive a locale it does not support.

The server-side contracts are also limited to three locales:

- `hhc-web-api` validates three content and bulletin locales and has PostgreSQL checks with the same values.
- `engagement-api` validates three subscription, Web Push, delivery, and campaign translation locales and stores those values under database checks.
- `account-api` treats Japanese and Korean locale cookies as invalid for security mail and registration/newsletter preferences.
- `notification-api` has reviewed templates for three locales and defensively falls back unsupported locales to English.

### Shared menu hover states differ

`AccountMenu` renders the profile/account destination as a normal menu item and sign-out as a `danger` item. The danger item has its own margin, divider, text color, and danger-soft hover background. The semantic distinction is correct, but the row geometry and hover treatment do not feel like one control.

The shared menu header is currently a centered greeting string. Although callers provide the user email, the menu does not show it.

### Ghost selectors inherit form-field focus styling

The shared selector applies base form-field border and focus rules to every variant. The ghost trigger removes its resting border, but still inherits the common focus-visible border and outline. Focus restoration after closing the popover can therefore leave a visually heavy outer frame.

### Hero images are both preloaded and high priority

`HomeHero` and `AboutHero` set both `preload` and `fetchPriority="high"` on the same responsive `next/image`. The emitted preload has a correct `as="image"`, `imagesrcset`, and `imagesizes`, and the live responsive candidate matches the rendered image. A fresh production home-to-literature navigation did not reproduce the warning.

The warning is nevertheless tied to the explicit preload lifecycle. Client navigation and cache reuse can insert a new preload entry after the same image has already been satisfied, which Chrome can report as unused.

### There is no global loading page

`hhc-web` has no `loading.tsx`. The bare root performs a server-side locale redirect. Existing user-visible loading copy is scoped to the weekly-paper card/archive and the OAuth callback. The repository does not contain a full-page element that renders the exact standalone text `Loading` during ordinary page navigation.

### Japanese and Korean banner fonts are not defined

`HomeHero` and `AboutHero` currently choose `Ma Shan Zheng` only for `zh-Hans` and send every other locale to the banner-only `ChenYuluoyan` subset. That subset contains fixed Traditional Chinese and English hero copy, not complete Japanese or Korean glyph coverage. Adding `ja` and `ko` without an explicit mapping would therefore create browser-dependent fallback glyphs and visibly mixed typography.

## Locale Model

### Canonical locale sets

The shared preferences package will export explicit locale sets and types:

```ts
export const adminUiLocales = ['zh-Hant', 'zh-Hans', 'en'] as const
export type AdminUiLocale = (typeof adminUiLocales)[number]

export const productLocales = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'] as const
export type ProductLocale = (typeof productLocales)[number]

export const contentLocales = productLocales
export type ContentLocale = ProductLocale

export const messageLocales = productLocales
export type MessageLocale = ProductLocale

export const bulletinEditions = ['zh-Hant', 'zh-Hans', 'en'] as const
export type BulletinEdition = (typeof bulletinEditions)[number]
```

These names express ownership at call sites. No consumer should import an unqualified shared `Locale` after the migration.

Generated API clients retain the domain split: `ContentLocale` contains the five canonical content values, while `BulletinEdition` contains only `zh-Hant`, `zh-Hans`, and `en`. A deprecated `BulletinLocale` alias may temporarily point to `BulletinEdition` during consumer migration, but it must not contain `ja` or `ko`.

### Locale metadata registry

`frontend-platform` owns the frontend locale metadata used by selectors, CMS tabs, and locale-aware route generation:

```ts
type LocaleMetadata = {
  code: ProductLocale
  shortLabel: string
  nativeLabel: string
}
```

Consumer pages must derive locale options from the approved metadata and locale sets instead of maintaining page-local arrays. Admin filters that metadata through `adminUiLocales` for console chrome and uses the generated API `ContentLocale` for CMS content.

Generated API clients remain authoritative for backend content-locale enums. Backend services retain explicit allowlists and database constraints because locale validation is a trust-boundary concern, not frontend presentation metadata.

A contract test verifies that the frontend content registry and generated API `ContentLocale` contain the same values wherever they must match. Adding a future locale still requires reviewed product copy, legal/security templates, content, and backend migrations; the registry prevents repetitive UI wiring and accidental omissions, not those deliberate release gates.

### Detection behavior

Product detection evaluates browser languages in order:

1. `zh-Hans`, `zh-CN`, and `zh-SG` map to `zh-Hans`.
2. Other `zh-*` values map to `zh-Hant`.
3. `ja-*` maps to `ja`.
4. `ko-*` maps to `ko`.
5. `en-*` maps to `en`.
6. Unsupported languages fall back to `en`.

Admin detection uses the same Chinese rules, recognizes English, and falls back all other languages—including Japanese and Korean—to English.

### Preference cookies

- `hhc_locale` stores `ProductLocale`, remains scoped to `.alive.org.tw`, and keeps `hhc-web` and `account-fe` aligned.
- `hhc_admin_locale` stores `AdminUiLocale` and is host-only on `admin.alive.org.tw`.
- Admin ignores `hhc_locale` when choosing its interface language.
- The Admin header exposes the Compact Utility selector for the three Admin interface locales and writes `hhc_admin_locale` when the operator changes language.
- When `hhc_admin_locale` is absent, Admin performs Admin-specific browser detection. It does not copy `hhc_locale`; this avoids coupling the new host-only preference to an older cross-subdomain value.
- Existing three-locale `hhc_locale` values remain valid; no cookie migration is required.
- An invalid stored value is ignored and detection runs normally.

### Content availability and fallback

- Public CMS list and detail queries retain the existing per-resource fallback: prefer the requested locale, then use the published `zh-Hant` projection when that translation is missing.
- Fallback selects one complete published translation. It never mixes fields from the requested locale and Traditional Chinese.
- Every public content item exposes `resolvedLocale` and `availableLocales`. `resolvedLocale` is the locale of the selected complete projection; `availableLocales` contains only exact published translations.
- The public payload's `resolvedLocale` is authoritative for per-item or per-block `lang` metadata and locale-aware content formatting. A `ja` or `ko` route displaying fallback CMS content marks that content as `zh-Hant` and formats its content-owned date labels using `zh-Hant`.
- Public list/detail navigation stays in the requested route locale, so a fallback card on `/ja` links to `/ja/news/{slug}`. If an exact Japanese translation is absent, the detail page canonical points to the exact published `zh-Hant` URL and hreflang advertises only locales in `availableLocales`. Once an exact Japanese translation is published, canonical and hreflang update to include it.
- Admin completion and publish state remain exact-locale checks. A visible `zh-Hant` public fallback does not count as a Japanese or Korean translation in Admin.
- No new CMS fallback API or client-side fallback layer is part of this work; the implementation preserves and tests the current repository behavior.
- Japanese and Korean public routes are enabled only after essential static UI, account, notification, and legal copy is ready. CMS entries may use the existing `zh-Hant` fallback until reviewed translations are published.
- Campaign delivery resolves the recipient’s exact locale first and English second. It must not default a Japanese or Korean recipient to Traditional Chinese.
- Account security templates provide exact Japanese and Korean versions. English fallback remains a defensive path for malformed or future locale values, not normal `ja`/`ko` behavior.

## Locale Typography and Banner Fonts

Banner typography uses an exhaustive locale-to-font mapping rather than a Chinese/non-Chinese conditional:

| Locale | Banner source font | Behavior |
| --- | --- | --- |
| `zh-Hant` | Existing `ChenYuluoyan` banner subset | Unchanged. |
| `zh-Hans` | Existing `Ma Shan Zheng` banner subset | Unchanged. |
| `en` | Existing `ChenYuluoyan` banner subset | Unchanged. |
| `ja` | `Klee One` Regular | Warm, restrained pen-written character that remains mature at hero scale. |
| `ko` | `Nanum Pen Script` Regular | Natural handwritten Hangul with the closest visual warmth to the current HHC banner identity. |

The Japanese and Korean source fonts and their license notices are committed with the existing font assets. The existing deterministic subset process produces one local WOFF2 file per locale from the fixed source-controlled hero titles and subtitles. Production does not request Google Fonts or another font CDN.

Subsetting is treated as a modified font build. The Korean artifact must remove the OFL Reserved Font Names—including `Nanum`, `NanumPen`, and `Naver NanumPen`—from its primary user-visible metadata and use an HHC-specific family name while retaining the original copyright and OFL notice. The build fails if a reserved primary name remains. The product design still identifies Nanum Pen Script as the source font.

Each imported banner subset:

- stays below the existing 250 KiB per-font static budget;
- uses `display: swap` and `preload: false`;
- loads only when its locale-specific class is rendered;
- contains every glyph used by that locale's fixed banner copy, including punctuation and Latin characters;
- retains the source copyright and OFL metadata in both derived font files, while the Korean derivative removes every reserved primary family name;
- falls back to the locale's system sans stack only if the font file itself fails, not because the subset omitted an approved banner glyph.

Japanese and Korean retain the same hero image, color, alignment, and no-wrap headline direction. Font size and tracking are tuned per locale rather than inheriting Chinese spacing, and the approved fixed copy must not overflow at the supported 320px mobile viewport. Dynamic CMS text never uses a banner-only subset.

Font sources and licenses:

- [Klee One source and OFL license](https://github.com/google/fonts/tree/main/ofl/kleeone)
- [Nanum Pen Script source and OFL license](https://github.com/google/fonts/tree/main/ofl/nanumpenscript)

## Scripture Editions and Rights

The About history section displays Isaiah 49:1–3 and 49:5–6. These passages are source-controlled product content, not CMS translation output.

### Selected editions

| Locale | Edition | Decision basis |
| --- | --- | --- |
| `en` | New International Version, 2011 text (`NIV®`) | Preserve the edition already identified in the current site, with the publisher-required full attribution. |
| `ja` | 日本聖書協会『聖書 新共同訳』 | The Japan Bible Society still identifies it as the most-read Bible in Japan. The newer 2018 `聖書協会共同訳` aims to become the next standard but is not the documented current majority edition. |
| `ko` target | 대한성서공회 『성경전서 개역개정판』 (1998) | The Korean Bible Society identifies it as the Korean church's worship Bible. Until written permission and reviewed text are available, the Korean About page renders the existing English NIV passage instead. |

The Japanese evangelical alternative `聖書 新改訳2017` is intentionally not the default because this decision optimizes for the widest current national familiarity. It can replace `新共同訳` only through an explicit pastoral/content decision and a fresh rights review.

Sources:

- [Japan Bible Society: 新共同訳 is the most-read Bible in Japan](https://www.bible.or.jp/online.html)
- [Japan Bible Society: 2018 聖書協会共同訳 aims to be the next standard](https://www.bible.or.jp/online/jbsiv.html)
- [Korean Bible Society: 개역개정판 is the Korean church worship Bible](https://bible.bskorea.or.kr/about_us)

### Text integrity and publication gate

- A human editor copies Isaiah 49:1–3 and 49:5–6 verbatim from an authorized source and performs a second-person comparison before merge.
- Scripture text, edition labels, and copyright notices are excluded from LLM translation requests and cannot be regenerated through CMS translation assistance.
- The page preserves the publisher's wording and required attribution; line wrapping may change responsively, but words, punctuation, and verse scope may not be paraphrased or silently truncated.
- Japanese publication must identify `日本聖書協会『聖書 新共同訳』`, stay within the Japan Bible Society quotation limit, and report the production URL to its copyright contact before release.
- Korean `개역개정` publication is blocked until the Korean Bible Society grants written permission; its official guidance requires permission even for non-commercial partial quotation. Record the approval reference and required attribution in the release evidence.
- Until that Korean gate passes, only the scripture block falls back to the existing English NIV text. The block uses `lang="en"`, keeps the English NIV citation, and does not affect the locale of the surrounding Korean page.
- Every About page that actually renders NIV text—including the Korean fallback—must show Biblica's full NIV copyright and trademark notice on that page. The short `NIV` suffix alone is insufficient.
- English NIV display and the Korean NIV fallback require a recorded written permission or license from Biblica that covers this website. Because the website includes an AI-assisted CMS feature, HHC must disclose that architecture and receive written confirmation of the permitted separation: scripture is source-controlled and is never sent to Azure OpenAI.
- Existing Traditional and Simplified Chinese scripture text remains unchanged, but its exact edition, source, and current permission/attribution evidence must be inventoried before the five-locale public release. Any rights correction is a separate reviewed content change and must not silently rewrite the passage during this rollout.
- No unavailable edition is replaced with machine-translated scripture. `zh-Hant`, `zh-Hans`, and `en` scripture behavior remains unchanged; `ja` adds the reviewed `新共同訳` text; only `ko` uses the defined NIV fallback.

### About-page presentation and legal placement

The scripture source stays visually attached to the quotation as a short edition citation. Full Bible edition and copyright details live in a dedicated, anchor-linked section of the localized Terms of Use page, including the NIV notice, the Japanese source notice, and the future Korean notice after permission is granted.

That Terms section uses the stable `id="bible-quotations"` anchor in every locale. A route test verifies that the About footer link resolves to the section rather than merely loading the Terms page.

Publisher-required page-local wording is rendered only on the About page and only for the edition actually shown:

- `en` and the `ko` fallback show the full NIV notice;
- `ja` shows the required Japan Bible Society source/copyright wording;
- switching `ko` to `개역개정` later replaces both the passage and the page-local notice in the same reviewed change.

To preserve the About page's current visual hierarchy, this page-local notice is one subdued legal paragraph below the existing SiteFooter copyright/legal row, with a link to the Terms section. It uses the footer's small muted typography and content width, wraps naturally on mobile, and adds no card, heading, icon, background panel, or extra divider. It is not added to unrelated pages.

Rights sources:

- [Japan Bible Society scripture copyright policy](https://www.bible.or.jp/read/bible_copyright.html)
- [Korean Bible Society copyright notice](https://bible.bskorea.or.kr/copyright_notice)
- [Korean Bible Society permission FAQ](https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=mobile&wr_id=8)
- [Biblica NIV permissions](https://www.biblica.com/permissions/)

## Repository Responsibilities

### `frontend-platform`

- Export the explicit locale sets, locale types, detection helpers, and cookie serializers.
- Keep theme preferences independent of locale sets.
- Redesign `AccountMenu`, `Menu`, and `Select` using the Compact Utility behavior defined below.
- Add component tests for hover, open, selected, keyboard focus, danger semantics, and disabled states.
- Publish a versioned package release before consumer pull requests update dependencies.

### `hhc-web-api`

- Expand generic content, public projections, OpenAPI, and service validation to five content locales while enforcing exactly three weekly-paper editions.
- Keep migration 022 byte-for-byte immutable. Inventory legacy bulletin rows before any separate remediation; do not delete or relabel evidence during this rollout.
- Continue publishing exact per-locale public projections and preserve the existing requested-locale-to-`zh-Hant` public read fallback.
- Expose `resolvedLocale` and `availableLocales` on public content and normalize navigation links to the requested route locale.
- Generate five-locale bulletin notification messages from the three-edition issue: `ja`/`ko` message copy may fall back to English and links still expose only the three editions.
- Add CMS translation-preview endpoints and the server-side LLM adapter.
- Keep a versioned shared translation prompt with explicit Japanese and Korean voice rules.
- Use existing `cms:write` authorization for translation previews; this is an editing operation and does not grant publish rights.
- Write translation-generation audit events without storing draft content in logs.
- Make content writes locale-set safe before accepting Japanese or Korean rows: a write that omits an existing locale is rejected unless that locale is explicitly named for deletion. This prevents cached or rolled-back three-locale Admin clients from erasing newer translations.

### `admin-fe`

- Use `AdminUiLocale` for the console provider and console messages.
- Use API-generated `ContentLocale` for generic CMS content, `BulletinEdition` for weekly papers, and the appropriate five-value message/engagement locale for campaign and schedule editors.
- Add the three-language Admin header selector and persist it through `hhc_admin_locale`.
- Show five tabs/counts for generic CMS and message content, and exactly three edition tabs/counts for weekly papers.
- Add the approved “generate all missing translations” action to supported CMS editors.
- Preserve unsaved-change protection after generated values enter the local draft.
- Keep publish permissions and confirmation flows unchanged.

### `hhc-web`

- Add `ja` and `ko` message files, route params, metadata, alternate URLs, legal pages, locale labels, and locale detection.
- Request Japanese and Korean public content through the existing server fallback and render each returned item's resolved locale correctly.
- Build public CMS navigation from the requested route locale while deriving canonical/hreflang from `resolvedLocale` and `availableLocales`.
- Preserve server-side root locale redirect behavior.
- Consume the redesigned shared menu and selector.
- Replace hero `preload` with eager, high-priority image loading.
- Add a local licensed `Klee One` subset and a renamed, Nanum Pen Script-derived subset through the existing subset and static-budget workflow.
- Add the reviewed Japanese Isaiah text, Terms copyright section, and page-local About notices; render the English NIV block for Korean until the Korean publication gate passes.
- Do not add a global loading page.

### `account-fe`

- Add complete Japanese and Korean UI messages for login, registration, OAuth onboarding, profile, security, devices, notifications, recovery, and errors.
- Use `ProductLocale` and the shared `hhc_locale` cookie.
- Consume the redesigned shared menu and selector.
- Continue passing the chosen locale through registration, OAuth, recovery, verification, and notification-preference calls.

### `account-api`

- Accept `ja` and `ko` as valid notification and preference locales.
- Preserve locale through OAuth state, onboarding, verification, password reset, linked-account confirmation, and registration newsletter opt-in.
- Continue passing locale to `notification-api` and `engagement-api`; do not render mail itself.

### `engagement-api`

- Expand subscription, push subscription, campaign translation, delivery, and OpenAPI locale validation to five values.
- Replace database checks through forward-only migrations.
- Accept five-locale campaign translations and Admin input.
- Resolve campaign translation as exact locale, then English. If neither exists, fail that delivery with a bounded localization error rather than sending unrelated copy.

### `notification-api`

- Add reviewed Japanese and Korean templates for:
  - email verification;
  - password reset;
  - OAuth link confirmation;
  - first-time third-party-login verification code;
  - newsletter wrapper and unsubscribe copy;
  - Web Push wrapper copy where the template owns visible text.
- Keep security email templates source-controlled and human-reviewed.
- Add new immutable template versions for Japanese and Korean support; queued messages pinned to older versions continue rendering from those historical versions.
- Never call an LLM during notification delivery.
- Retain English fallback only for unknown locale values.

### `api-gateway`

- Verify existing Admin API routing, request-size limits, and 60-second upstream read timeout against the translation-preview endpoint.
- No gateway change is expected because translation calls remain ordinary authenticated Admin requests and each target locale is isolated.

## Shared Compact Utility Controls

### Account menu

The approved Compact Utility menu uses a 230–248px popover with a compact identity header and consistent action rows.

Identity header:

- Shows display name and email on two truncated lines.
- Does not repeat a second large avatar inside the panel.
- Uses left-aligned text and the same horizontal inset as menu rows.

Action rows:

- Use a consistent minimum height, padding, icon slot, radius, and motion.
- Profile/manage-account, return-to-site, and sign-out use the same hover and keyboard-focus background.
- Sign-out retains danger-colored text and icon, but does not use a differently shaped or differently moving hover surface.
- A divider may separate identity from actions; sign-out does not add its own floating margin or pseudo-element divider.

Avatar trigger:

- Uses a transparent resting surface.
- Hover and open states add a soft halo rather than changing image brightness.
- Mouse activation does not leave an outer ring after close.
- Keyboard `:focus-visible` remains clearly visible as an inset or tightly bounded ring.

The menu remains accessible through React Aria semantics, supports Escape and outside-click dismissal, restores focus to its trigger, and respects reduced motion.

Truncated display name and email remain available to assistive technology through an accessible identity label. The control remains usable at 200% zoom and in forced-colors mode.

### Select

The component retains two responsibility-specific variants:

#### Default form select

- Keeps a visible field border and 44px minimum height.
- Uses a single focus treatment; it must not combine border, outline, and box-shadow into multiple rings.
- Preserves labels, descriptions, disabled state, and validation behavior.

#### Utility select

- Replaces the existing ghost behavior name at the public API boundary or aliases it during migration.
- Has no border or background at rest.
- Uses a 40px minimum hit area, compact horizontal padding, and no layout shift between states.
- Hover and open states use a soft background and rotate the chevron.
- Mouse selection restores focus without showing a keyboard-only ring.
- Keyboard focus uses an inset focus indicator that does not create the unwanted exterior frame.

Popover/listbox:

- Uses the same compact row geometry as the account menu.
- Displays a check mark for the selected item.
- Distinguishes hover/focus from selection without stacking multiple outlines.
- Supports five-language labels: `繁中`, `简中`, `EN`, `日本語`, `한국어`.
- Uses a brief fade/vertical transition and disables it under reduced motion.
- Preserves light and dark theme tokens.

Consumer CSS may set placement or width, but must not restyle interaction states independently. Footer locale behavior belongs in the shared primitive.

Visible compact labels do not replace accessible full locale names. The trigger exposes the selected locale name, options expose `aria-selected`, and pointer-restored focus never suppresses keyboard `focus-visible` behavior.

## CMS Translation Assistance

### Product behavior

The approved interaction is **Generate all missing translations**. For generic CMS content, targets are `zh-Hans`, `en`, `ja`, and `ko`; for bulletin metadata, targets are only `zh-Hans` and `en`. A locale/edition is “missing” only when the saved resource has no corresponding row. A partially populated row is treated as existing and is skipped by the batch action; it can be regenerated only through the explicit per-language replacement preview.

1. The editor completes and saves the Traditional Chinese version.
2. Admin shows which allowed targets are empty: `zh-Hans`, `en`, `ja`, and `ko` for generic CMS, or `zh-Hans` and `en` for bulletin metadata.
3. The editor presses one action to generate every missing target.
4. Admin issues independent preview requests for the missing targets with a maximum concurrency of two.
5. Successful results populate the corresponding local draft tabs and mark the form dirty.
6. Failed targets remain empty and expose a per-language retry action.
7. The editor reviews and edits each result.
8. The normal Save Draft action persists all accepted translations and creates the existing revision/audit history.
9. Publishing remains a separate permission and confirmation.

Existing target text is never overwritten by the batch action. Re-generating a populated language requires entering that language and confirming a dedicated replace-preview action.

### Supported CMS fields

Initial LLM assistance covers:

- News: title, body, and image alternative text.
- History: the event text currently persisted as title/body.
- Video: title.
- Bulletin metadata: title and subtitle.

Slugs, IDs, display dates, event dates, YouTube IDs, asset IDs, layouts, flags, and uploaded files are not translated.

The first release intentionally excludes hidden or non-editable summary/date-label fields. Translation support expands only after Admin exposes a reviewable field and the same value survives its save normalization.

Weekly-paper PDF contents remain manual and have exactly three edition tabs. The former Japanese/Korean bulletin upload and publication requirement is superseded; those product routes link to the existing Traditional Chinese, Simplified Chinese, and English editions.

### API contracts

The browser never calls the LLM provider directly.

Website content preview:

```http
POST /api/admin/content/{module}/{contentId}/translation-previews/{targetLocale}
Authorization: existing Admin session
If-Match: "{contentVersion}"
Content-Type: application/json

{
  "sourceLocale": "zh-Hant",
  "replaceExisting": false
}
```

Bulletin metadata preview:

```http
POST /api/admin/bulletins/{issueId}/translation-previews/{targetLocale}
Authorization: existing Admin session
If-Match: "{issueVersion}"
Content-Type: application/json

{
  "sourceLocale": "zh-Hant",
  "replaceExisting": false
}
```

Success returns a typed translation preview and the source version. It does not update the resource.

```json
{
  "data": {
    "sourceLocale": "zh-Hant",
    "targetLocale": "en",
    "sourceVersion": 12,
    "translation": {
      "title": "Love Begins at Home",
      "subtitle": "..."
    }
  }
}
```

Error semantics:

- `400 invalid_translation_request`: invalid source/target, missing source text, unsupported module, or input limit exceeded.
- `403 forbidden`: missing `cms:write`.
- `404 not_found`: resource does not exist.
- `409 translation_exists`: target already contains content and `replaceExisting` is false.
- `412 version_mismatch`: source changed after the editor loaded it.
- `429 translation_rate_limited`: actor or deployment budget limit reached.
- `502 translation_provider_error`: provider returned an invalid or failed response.
- `504 translation_timeout`: the bounded provider request timed out.

The Admin batch action treats each target response independently and can therefore retain successful previews when another target fails.

The batch action always sends `replaceExisting: false`. The per-language re-generation action first shows an explicit replacement confirmation, then sends `replaceExisting: true`. This flag permits generation of a replacement preview only; it still does not persist or publish anything.

### Translation service boundary

`hhc-web-api` owns the translation boundary and calls Azure OpenAI directly through the Responses API. The implementation uses the Go standard `net/http` client and a focused Azure OpenAI client; it does not add a generic multi-provider framework or OpenAI SDK.

Deployment configuration provides:

- `CMS_TRANSLATION_ENABLED`, default `false`;
- `AZURE_OPENAI_ENDPOINT`, the approved Azure OpenAI resource origin;
- `AZURE_OPENAI_DEPLOYMENT`, the exact deployed multilingual model name;
- `AZURE_OPENAI_API_KEY`, mounted from the existing Key Vault secret path;
- a 20,000-character aggregate source limit;
- a 40-second Azure OpenAI client timeout;
- a 45-second translation handler deadline.

The Azure request is `POST {AZURE_OPENAI_ENDPOINT}/openai/v1/responses`, sends the configured deployment in `model`, sets `store: false` and `background: false`, enables no tools, and requests a strict JSON Schema through the Responses API text format. The production deployment must support multilingual Structured Outputs. Credentials never appear in browser configuration, logs, audit payloads, or repository files.

The provider request must:

- treat source content as untrusted text, not instructions;
- request a typed JSON result;
- translate meaning into natural, contemporary language used by local readers instead of preserving Traditional Chinese word order;
- preserve paragraph breaks, URLs, names, scripture references, and HHC terminology;
- preserve facts, theological meaning, and the author's intent without adding claims or promotional language;
- forbid commentary, explanations, Markdown fences, or fields outside the schema;
- use a versioned prompt stored with the backend code;
- run under the timeout hierarchy defined below.

### Translation timeout hierarchy

The existing server-wide `ReadTimeout` and `WriteTimeout` remain 30 seconds for ordinary endpoints. They are not increased globally merely to match the gateway.

The translation handlers extend only their current response write deadline with `http.NewResponseController(w).SetWriteDeadline(...)` before provider work begins:

| Boundary | Deadline | Purpose |
| --- | ---: | --- |
| Azure OpenAI HTTP client | 40 seconds | Stop provider work first. |
| Translation handler context | 45 seconds | Validate/map failure and prepare an HHC response. |
| Translation route write deadline | 50 seconds | Allow the handler to write the typed `504 translation_timeout`. |
| API gateway upstream read timeout | 60 seconds | Final edge ceiling; unchanged. |

Setting all layers to 60 seconds is intentionally rejected because simultaneous expiry turns an application timeout into an opaque gateway error. A route-specific extension preserves the tighter 30-second budget for every other API and leaves ten seconds between the service response ceiling and the gateway ceiling.

### Translation voice and register

“Natural” means warm, clear, and locally idiomatic, not slang-heavy or loose with meaning. The prompt selects register by target locale and field type:

- Japanese body copy defaults to natural modern `です・ます` prose. Titles and short labels use concise forms when that reads more naturally. Avoid Chinese sentence order, excessive nominalization, unnecessary honorifics, and word-for-word translation.
- Korean approachable public copy defaults to consistent `해요체`. Formal notices or historical/factual passages may use `합니다체` when the content type calls for it, but one field never mixes sentence-ending styles. Avoid translated-Chinese syntax and unnecessarily bureaucratic vocabulary.
- Titles remain concise; summaries read as natural introductions; image alternative text stays neutral and descriptive rather than promotional.
- Established Japanese and Korean Christian terminology is used consistently. Names, organizations, dates, URLs, and scripture references remain source-faithful.
- The model does not add emoji, slang, commentary, new facts, calls to action, or theological interpretation absent from the source.

Static product copy, legal documents, account security templates, and scripture remain human-authored or human-reviewed source files outside this CMS translation prompt. Product and security copy still follows natural locale-appropriate wording with the precision required by the message; legal copy keeps its appropriate formal register.

Before a prompt version is enabled in production, a fluent reviewer evaluates at least one Japanese and one Korean record from each supported generic CMS module (news, history, and video), plus one Simplified Chinese and one English bulletin-metadata preview. Each sample must pass meaning preservation, naturalness, register consistency, and terminology review. Exact-output snapshot tests are not used for subjective prose; contract tests cover the structured fields and safety rules, while the Admin preview remains the final editorial gate.

### Validation and overwrite protection

Before calling the provider, the backend:

- loads the saved resource itself;
- verifies the expected version;
- verifies that the Traditional Chinese source exists;
- verifies that source and target differ;
- rejects targets outside the endpoint's domain: four non-source targets for generic CMS and only `zh-Hans`/`en` for bulletin metadata;
- rejects populated target translations for the batch path;
- enforces per-field and aggregate source-size limits.

After the provider responds, the backend:

- parses the typed result;
- rejects missing required fields or unknown fields;
- enforces the same field-length constraints used by CMS writes;
- normalizes line endings without rewriting content;
- returns the preview without persistence.

Public renderers currently display CMS body text as escaped React text. Generated markup is therefore not executed. This invariant must remain covered by tests if rich text is introduced later.

### Security, privacy, cost, and audit

- Only authenticated `cms:write` actors may request translations.
- A PostgreSQL fixed-window limiter permits 10 requests per actor per minute and 60 requests per deployment per minute. Counter increments are atomic across replicas, and stale windows are deleted opportunistically. No Redis dependency is added.
- The API rejects empty and oversized source text before provider use.
- Provider calls use bounded timeouts and no automatic unbounded retry.
- Draft content may be unpublished and potentially sensitive. The Azure subscription, region, model deployment, data-processing terms, abuse-monitoring behavior, and retention configuration must be reviewed and recorded before `CMS_TRANSLATION_ENABLED=true` in production.
- Application logs and OpenTelemetry spans/metrics must not contain source or generated content.
- `cms_audit_event` records action, actor, resource, source version, source locale, target locale, provider/model identifier, prompt version, character count, duration, and outcome.
- Model output is advisory. Admin copy identifies it as AI-generated until the editor saves the draft.
- Runtime metrics record request count, latency, timeout, validation failure, provider failure, and generated character count by target locale, without content.

### Why translation stays synchronous

Each target locale is an independent preview request and the translation endpoint has the bounded route-specific deadline above. A synchronous call gives the editor an immediate result without adding job tables, polling, cleanup, or worker ownership.

A durable asynchronous translation job is justified only if measured production requests regularly exceed the timeout, editors need to leave and resume batches, or bulk backfill becomes a supported product workflow.

## Hero Image Loading

`HomeHero` and `AboutHero` will use:

```tsx
<Image
  ...
  loading="eager"
  fetchPriority="high"
  sizes="100vw"
/>
```

They will no longer set `preload`.

This keeps the above-the-fold image eager and high-priority while avoiding an explicit `<link rel="preload">` whose lifecycle can become redundant during client navigation and cache reuse.

Verification must confirm:

- no hero image preload link is emitted;
- the rendered image remains eager and high priority;
- the correct responsive candidate loads;
- home, about, and literature routes render without the unused-preload warning;
- Lighthouse mobile runs use the same production URL, cold cache, 4× CPU slowdown, and simulated slow 4G profile before and after the change;
- median LCP across three runs stays at or below 2.5 seconds and does not regress by more than 200 ms; CLS stays at or below 0.1.

If measured LCP regresses materially, investigate image sizing and server response timing before restoring an explicit preload.

## Loading-State Policy

- Keep the root locale redirect server-side.
- Do not add a global `loading.tsx` containing standalone text.
- Preserve component-scoped weekly-paper loading copy and `aria-live` behavior.
- Prefer layout-preserving skeletons for future route-level waits.
- Keep OAuth callback progress explicit because it represents an actual authentication operation, not ordinary page navigation.
- If a standalone central `Loading` screen is observed after release, capture the exact URL, navigation sequence, and deployed revision; it is not produced by the current application source.

## Data Migration

Migrations are forward-only and backward compatible with existing three-locale deployments.

`hhc-web-api` expands generic content and public-projection locale checks to five values while keeping bulletin versions at the three-value `BulletinEdition` boundary. The already-applied migration 022 is historical evidence and remains byte-for-byte immutable; legacy `ja`/`ko` bulletin rows are inventoried before any separate, reviewed remediation and are not silently deleted, relabelled, or rewritten.

Before those values are used, the content write contract adds `deleteLocales: ContentLocale[]` and compares the submitted locale set with persisted translations. Omitting an existing locale without naming it in `deleteLocales` returns `409 locale_set_mismatch`; the repository never reaches its delete-and-reinsert transaction. The upgraded Admin submits every existing translation it loaded and uses `deleteLocales` only after a dedicated confirmation. Cached or rolled-back three-locale Admin clients therefore fail closed instead of deleting Japanese or Korean rows.

`engagement-api` migrations expand locale checks for newsletter subscriptions, Web Push subscriptions, campaign deliveries, and other persisted recipient-locale fields.

No existing row value changes. New enum values are accepted only after the owning service code can validate and serve them.

Rollback does not remove Japanese or Korean values from database checks once data may exist. Application rollback must continue tolerating unknown/newer locale rows or the release sequence must retain a compatible previous revision.

## Release Sequence

Every repository uses its own branch, PR, CI, merge, release, and live smoke test.

1. **Contract safety in `hhc-web-api`**
   - locale-set-safe content writes;
   - `resolvedLocale` and `availableLocales` on public projections;
   - backward-compatibility tests before five-locale rows exist.
2. **Shared frontend foundation in `frontend-platform`**
   - locale model and Compact Utility controls;
   - package tests and packed-consumer checks;
   - publish the first package version for locale/preferences/UI changes.
3. **Backend five-locale compatibility**
   - `hhc-web-api`: five-locale content/message validation, three-edition weekly-paper contracts, bulletin notification copy, and rollback floor;
   - `engagement-api`: five-locale subscriptions/campaigns/deliveries and exact-to-English fallback;
   - `notification-api`: new immutable Japanese/Korean template versions;
   - `account-api`: accept and propagate Japanese/Korean locale;
   - verify `api-gateway` routing and the existing 60-second upstream timeout without changing it.
4. **Generated client publication in `frontend-platform`**
   - sync the deployed `hhc-web-api` OpenAPI contract;
   - regenerate the five-locale client;
   - run packed-consumer checks and publish the second package version.
5. **Azure OpenAI translation vertical slice**
   - provision the approved Azure OpenAI resource/deployment and Key Vault secret through reviewed infrastructure delivery;
   - release the disabled backend endpoint, limiter, audit, metrics, and route-specific timeout;
   - update `admin-fe`, add the Admin-only locale selector and translation preview UX, then enable translation after production smoke and fluent sample review.
6. **`account-fe`**
   - add Japanese/Korean UI and consume shared controls/locales;
   - release and smoke registration, OAuth onboarding, profile, recovery, and notification locale propagation before public website discovery.
7. **`hhc-web`**
   - add Japanese/Korean routes, copy, metadata, legal pages, selector, local handwritten banner subsets, resolved-locale CMS rendering, scripture presentation, and hero loading fix;
   - publish routes, sitemap, canonical, and alternate links only after the account and messaging dependencies are live.
8. **Content enablement**
   - seed and review Japanese and Korean CMS translations while preserving the published `zh-Hant` fallback for missing entries;
   - add the exact reviewed Japanese Isaiah text and required notices;
   - launch the Korean scripture block with the English NIV fallback, then replace it with exact reviewed `개역개정` text and notice only after written approval;
   - enable public discovery/alternate URLs only when the essential locale experience is complete.

Backend changes must be compatible with the existing three-locale frontends before consumer releases. Frontends must not send `ja` or `ko` until the relevant backend deployment and database migration are live.

## Verification and Acceptance

### Locale contracts

- Locale type tests distinguish Admin UI, product, and content locale sets.
- Product detection maps Japanese and Korean correctly; Admin detection falls them back to English.
- `hhc_locale=ja` affects website/account but not Admin.
- `hhc_admin_locale` never escapes the Admin host.
- Every public Japanese/Korean route emits correct `lang`, canonical, and alternate metadata.

### CMS and public content

- Admin console chrome remains available only in three languages.
- Generic content, campaign, and schedule editors expose five language tabs; the weekly-paper editor exposes exactly three edition tabs.
- Five-locale content can be created, revised, published, queried, unpublished, restored, and deleted.
- The former Japanese/Korean bulletin PDF lifecycle is superseded. Every product route, including `ja` and `ko`, exposes the same three valid edition links, and invalid/legacy edition values are never rendered.
- A missing public CMS translation resolves to the complete published `zh-Hant` projection; exact locale wins when both exist, and no response mixes fields across locales.
- Fallback CMS content exposes and renders `lang="zh-Hant"`, while Admin still reports the requested locale as incomplete.
- Japanese Isaiah uses `聖書 新共同訳`; Korean Isaiah uses the English NIV passage with `lang="en"` until approved `성경전서 개역개정판` text replaces it.
- Isaiah 49:1–3 and 49:5–6 match the authorized source character-for-character and are never LLM-generated.
- Japanese URL reporting and its required source notice are present before the Japanese route goes live.
- The English and Korean-fallback About pages show the required NIV page-local notice; full edition details are available from the linked Terms section.
- The About notice remains a single muted footer paragraph with no card, heading, icon, panel, or unrelated-page placement on desktop and mobile.
- Korean written permission is required before switching from NIV fallback to `개역개정`, not before launching the Korean route.

### Locale typography

- Japanese banners use the local `Klee One` subset; Korean banners use a local Nanum Pen Script-derived subset with an HHC-specific primary family name.
- Approved Japanese and Korean hero strings render without missing or mixed fallback glyphs.
- No production request is made to Google Fonts or another font CDN.
- Each banner subset remains below 250 KiB, is not globally preloaded, and passes desktop and 320px no-overflow checks.
- Dynamic CMS content remains on the locale system sans stack.

### Account and messaging

- Registration, OAuth onboarding, email verification, password reset, and OAuth link confirmation preserve `ja` and `ko`.
- Japanese users receive Japanese security emails; Korean users receive Korean security emails.
- Newsletter and Web Push subscriptions accept `ja` and `ko`.
- Campaign delivery resolves exact Japanese/Korean copy and uses English as the defined fallback.
- Unknown locales still fail safely or use the documented defensive fallback.

### Translation previews

- A saved Traditional Chinese source generates each missing locale.
- The batch action skips populated targets.
- A stale version returns `412` and does not call the provider.
- Oversized input, invalid targets, malformed provider JSON, provider timeout, and partial target failure are covered.
- Generated results only update the Admin local draft.
- Save Draft is still required; Publish remains separate.
- Logs and error reporting contain no source or generated content.
- Audit records contain metadata but no translated text.
- Japanese previews use natural contemporary Japanese and consistent field-appropriate register rather than literal Chinese syntax.
- Korean previews use natural contemporary Korean with consistent `해요체` or context-required `합니다체`, never a mixture within one field.
- Representative Japanese and Korean generic CMS samples, plus Simplified Chinese and English bulletin-metadata samples, pass fluent human review for meaning, naturalness, register, and terminology before the prompt version is released.

### Shared controls

- Avatar menu action rows have consistent geometry and hover treatment.
- Sign-out remains semantically dangerous without a mismatched hover surface.
- Utility selector has no resting border and no mouse-restored exterior ring.
- Keyboard focus remains visible.
- Selected list items expose state visually and semantically.
- Escape, outside click, focus restoration, disabled behavior, mobile hit areas, dark mode, and reduced motion pass component tests.

### Hero and loading

- Hero image is eager/high-priority without an image preload link.
- Browser console is clean on direct load and client navigation for home, about, and literature routes.
- LCP remains within budget.
- There is no global text-only loading page.
- Existing scoped loading and OAuth progress states remain accessible.

### Delivery

- Every affected repository has a focused PR with green required CI.
- Releases follow dependency order and produce immutable artifacts.
- Production smoke tests cover `www`, `account`, `admin`, Admin translation preview, security email rendering, subscription locale acceptance, and Japanese/Korean public content.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| A shared locale tuple leaks Japanese/Korean into Admin UI | Use explicit locale types and separate Admin cookie/detection. |
| Frontend ships before backend accepts new locale | Release backend compatibility first and smoke contracts before consumer rollout. |
| CMS fallback creates accidental mixed-language fields or false completion | Keep the existing whole-projection `zh-Hant` fallback, preserve the resolved locale in rendered `lang`, and calculate Admin completion from exact locales only. |
| Scripture is mistranslated or published without rights | Use fixed reviewed editions, exclude scripture from LLM input, require two-person text comparison, apply the Korean NIV fallback, and gate each edition switch on attribution/permission evidence. |
| Bible copyright wording overwhelms the About design | Keep the short source beside the quote, put complete edition details in Terms, and limit required page-local wording to one muted SiteFooter paragraph for the edition rendered. |
| Japanese/Korean banner glyphs fall back, violate a reserved name, or add excessive font cost | Use explicit local subsets, rename the Nanum-derived artifact, verify complete fixed-copy coverage, preserve the 250 KiB per-font budget, and disable global preload. |
| LLM output is literal, stiff, or changes meaning | Use locale- and field-specific register rules, validate structure, run fluent-speaker sample review, label output as generated, and require human review/save/publish. |
| Draft content leaks through provider/logs | Server-only credentials, approved provider retention, no content logging, bounded audit metadata. |
| Translation requests become costly or slow | Explicit user action, missing-only targets, size/rate limits, max concurrency two, per-target timeouts and metrics. |
| Schema rollback rejects persisted new locales | Keep migrations forward-compatible and do not remove locale values on rollback. |
| Removing preload regresses LCP | Preserve eager/high priority and compare measured LCP before and after release. |
| Removing all selector focus indicators harms keyboard users | Remove only mouse-restored exterior outlines; retain a compact `focus-visible` indicator. |

## Final Decisions

- Admin console interface: three locales.
- Website, account, CMS content, subscriptions, campaigns, and notifications: five locales.
- Weekly-paper PDFs: exactly three `BulletinEdition` values (`zh-Hant`, `zh-Hans`, `en`), independent of product/content/message locales.
- Avatar menu and selector visual direction: Compact Utility.
- CMS translation interaction: generate all missing translations from a saved Traditional Chinese source.
- LLM integration owner: `hhc-web-api`; provider: Azure OpenAI Responses API.
- Translation timeout: 40-second provider, 45-second handler, 50-second route write deadline, 60-second gateway; ordinary `hhc-web-api` endpoints remain at the existing 30-second server timeout.
- LLM output: preview only, human-reviewed, never auto-saved or auto-published.
- Security emails: reviewed Japanese/Korean templates, no runtime LLM.
- Public CMS fallback: preserve the existing requested-locale-to-`zh-Hant` whole-projection fallback; Admin completeness remains exact locale.
- Banner typography: local `Klee One` subset for Japanese and a renamed Nanum Pen Script-derived subset for Korean; no runtime font CDN.
- CMS translation voice: natural contemporary local expression with field-appropriate register, source-faithful meaning, and fluent human review before prompt release.
- Scripture: Japanese `聖書 新共同訳`; Korean scripture-only fallback to English NIV until approved `성경전서 개역개정판` text is available; never LLM-translated.
- Bible copyright presentation: short source beside the About quotation, one required muted page-local footer paragraph, and complete edition details in Terms.
- Hero image: eager and high priority, no explicit preload.
- Global loading page: not added.
