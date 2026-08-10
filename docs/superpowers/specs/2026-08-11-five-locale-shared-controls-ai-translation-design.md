# Five-Locale Products, Shared Controls, and CMS Translation Design

**Date:** 2026-08-11

**Status:** Approved design

**Coordinating repository:** `hhc-web`

**Affected repositories:** `frontend-platform`, `hhc-web`, `account-fe`, `admin-fe`, `hhc-web-api`, `account-api`, `engagement-api`, `notification-api`

**Read-only verification target:** `api-gateway`

## Summary

HHC will support Traditional Chinese, Simplified Chinese, English, Japanese, and Korean across the public website, account experience, CMS content, subscriptions, campaigns, and user-facing notifications. The Admin console interface itself remains Traditional Chinese, Simplified Chinese, and English because its operators do not need Japanese or Korean console copy.

The current single locale tuple cannot represent those different responsibilities. The implementation must split Admin interface locales from product and content locales before adding Japanese and Korean.

The same work will refine the shared avatar menu and selector primitives using the approved **Compact Utility** direction, remove the redundant hero image preload that produces browser warnings, and preserve the current server-rendered navigation without adding a global loading page.

CMS editors will also be able to generate missing language drafts from a saved Traditional Chinese source through an LLM API. Generated text is a reviewable preview only: it never overwrites existing translations, saves automatically, or publishes automatically.

## Goals

1. Keep the Admin console interface limited to `zh-Hant`, `zh-Hans`, and `en`.
2. Support `zh-Hant`, `zh-Hans`, `en`, `ja`, and `ko` in `hhc-web` and `account-fe`.
3. Let Admin editors create and publish all five content locales, including Japanese and Korean weekly-paper PDF slots.
4. Carry Japanese and Korean through account security email, newsletter, campaign, Web Push, and subscription contracts.
5. Give CMS editors an explicit, audited way to generate missing translations from Traditional Chinese without weakening the existing draft, revision, or publish boundaries.
6. Make the shared avatar menu and selector visually consistent, accessible, compact, and reusable by all three frontends.
7. Remove the hero image preload warning without regressing above-the-fold image priority.
8. Avoid adding a global text-only loading page.

## Non-Goals

- Translating weekly-paper PDF contents. Editors continue to upload one PDF per content locale.
- Generating account security emails with an LLM at send time.
- Automatically translating static product copy, privacy policies, or terms at runtime. Those translations remain reviewed source files.
- Automatically translating campaign/newsletter copy in the first CMS translation release. Campaign schemas and editors become five-locale capable, but LLM assistance starts with website CMS text and bulletin metadata.
- Creating a translation microservice.
- Automatically saving or publishing generated text.
- Replacing the current authentication, publication, revision, asset, or notification service boundaries.
- Introducing a global `loading.tsx` or client-side locale redirect page.

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
```

These names express ownership at call sites. No consumer should import an unqualified shared `Locale` after the migration.

Generated API clients may retain a domain-specific name such as `BulletinLocale` or `ContentLocale`, but its enum must contain the five canonical content values.

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
- Existing three-locale `hhc_locale` values remain valid; no cookie migration is required.
- An invalid stored value is ignored and detection runs normally.

### Content availability and fallback

- Public CMS queries use exact locale projections. A missing Japanese translation is not silently replaced with Chinese or English inside a Japanese page.
- Japanese and Korean public routes are enabled only after essential static copy and initial CMS translations are ready.
- Campaign delivery resolves the recipient’s exact locale first and English second. It must not default a Japanese or Korean recipient to Traditional Chinese.
- Account security templates provide exact Japanese and Korean versions. English fallback remains a defensive path for malformed or future locale values, not normal `ja`/`ko` behavior.

## Repository Responsibilities

### `frontend-platform`

- Export the explicit locale sets, locale types, detection helpers, and cookie serializers.
- Keep theme preferences independent of locale sets.
- Redesign `AccountMenu`, `Menu`, and `Select` using the Compact Utility behavior defined below.
- Add component tests for hover, open, selected, keyboard focus, danger semantics, and disabled states.
- Publish a versioned package release before consumer pull requests update dependencies.

### `hhc-web-api`

- Expand content, bulletin, public projection, OpenAPI, and service validation to five content locales.
- Add forward-only PostgreSQL migrations that replace three-value locale checks with five-value checks.
- Continue publishing exact per-locale public projections.
- Add CMS translation-preview endpoints and the server-side LLM adapter.
- Use existing `cms:write` authorization for translation previews; this is an editing operation and does not grant publish rights.
- Write translation-generation audit events without storing draft content in logs.

### `admin-fe`

- Use `AdminUiLocale` for the console provider and console messages.
- Use API-generated `ContentLocale` for content, bulletin, campaign, and schedule editors.
- Show five content tabs and five-language completion counts.
- Add the approved “generate all missing translations” action to supported CMS editors.
- Preserve unsaved-change protection after generated values enter the local draft.
- Keep publish permissions and confirmation flows unchanged.

### `hhc-web`

- Add `ja` and `ko` message files, route params, metadata, alternate URLs, legal pages, locale labels, and locale detection.
- Fetch exact Japanese and Korean public projections.
- Preserve server-side root locale redirect behavior.
- Consume the redesigned shared menu and selector.
- Replace hero `preload` with eager, high-priority image loading.
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

## CMS Translation Assistance

### Product behavior

The approved interaction is **Generate all missing translations**.

1. The editor completes and saves the Traditional Chinese version.
2. Admin shows which of `zh-Hans`, `en`, `ja`, and `ko` are empty.
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

- News: title, summary when present, body, and image alternative text.
- History: event/title, body, and date label when present.
- Video: title and summary when present.
- Bulletin metadata: title and subtitle.

Slugs, IDs, display dates, event dates, YouTube IDs, asset IDs, layouts, flags, and uploaded files are not translated.

Weekly-paper PDF contents remain manual. The Japanese and Korean bulletin tabs can upload and publish their own PDFs after metadata is generated or entered.

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
    "targetLocale": "ja",
    "sourceVersion": 12,
    "translation": {
      "title": "愛は家庭から始まる",
      "summary": "",
      "body": "...",
      "imageAlt": "..."
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

`hhc-web-api` owns a small internal translator contract that accepts typed source fields and one target locale. Provider-specific request/response code stays behind that contract.

Deployment configuration names the provider endpoint, model, timeout, and source-character limit. Credentials come from the existing secret-management path and never appear in browser configuration, logs, audit payloads, or repository files.

The provider request must:

- treat source content as untrusted text, not instructions;
- request a typed JSON result;
- preserve paragraph breaks, URLs, names, scripture references, and HHC terminology;
- forbid commentary, explanations, Markdown fences, or fields outside the schema;
- use a versioned prompt stored with the backend code;
- run under an overall timeout shorter than the gateway upstream timeout.

### Validation and overwrite protection

Before calling the provider, the backend:

- loads the saved resource itself;
- verifies the expected version;
- verifies that the Traditional Chinese source exists;
- verifies that source and target differ;
- rejects targets outside the five content locales;
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
- Rate limits apply per actor and deployment.
- The API rejects empty and oversized source text before provider use.
- Provider calls use bounded timeouts and no automatic unbounded retry.
- Draft content may be unpublished and potentially sensitive; production provider selection must meet HHC data-processing and retention requirements.
- Application logs and Sentry events must not contain source or generated content.
- `cms_audit_event` records action, actor, resource, source version, source locale, target locale, provider/model identifier, prompt version, character count, duration, and outcome.
- Model output is advisory. Admin copy identifies it as AI-generated until the editor saves the draft.
- Runtime metrics record request count, latency, timeout, validation failure, provider failure, and generated character count by target locale, without content.

### Why translation stays synchronous

Each target locale is an independent preview request and the gateway already allows a 60-second upstream read. A bounded synchronous call gives the editor an immediate result without adding job tables, polling, cleanup, or worker ownership.

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
- mobile and desktop LCP do not regress beyond the agreed performance budget.

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

`hhc-web-api` migrations expand locale checks for content translations, bulletin versions, public projections, and any related revision/projection records that constrain locale values.

`engagement-api` migrations expand locale checks for newsletter subscriptions, Web Push subscriptions, campaign deliveries, and other persisted recipient-locale fields.

No existing row value changes. New enum values are accepted only after the owning service code can validate and serve them.

Rollback does not remove Japanese or Korean values from database checks once data may exist. Application rollback must continue tolerating unknown/newer locale rows or the release sequence must retain a compatible previous revision.

## Release Sequence

Every repository uses its own branch, PR, CI, merge, release, and live smoke test.

1. **`frontend-platform`**
   - locale model and Compact Utility controls;
   - package tests and packed-consumer checks;
   - publish the new package version.
2. **Backend compatibility**
   - `hhc-web-api`: five-locale contracts/migrations and translation preview;
   - `engagement-api`: five-locale subscriptions/campaigns/deliveries;
   - `notification-api`: reviewed Japanese/Korean templates;
   - `account-api`: accept and propagate Japanese/Korean locale;
   - verify `api-gateway` routing/timeouts without changing it unless evidence requires a patch.
3. **`admin-fe`**
   - update shared packages and generated client;
   - keep console UI at three locales;
   - expose five content locales and translation-preview workflow.
4. **`hhc-web`**
   - add Japanese/Korean routes, copy, metadata, legal pages, selector, exact CMS queries, and hero loading fix.
5. **`account-fe`**
   - add Japanese/Korean UI and consume shared controls/locales.
6. **Content enablement**
   - seed/review essential Japanese and Korean CMS content;
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
- Content, bulletin, campaign, and schedule editors expose five language tabs.
- Five-locale content can be created, revised, published, queried, unpublished, restored, and deleted.
- Japanese and Korean bulletin PDFs can be uploaded, scanned, granted, published, downloaded, revoked, and replaced.
- A locale with no published translation does not silently display a different language.

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
| Japanese/Korean pages mix languages | Use exact content projections and enable routes after initial content is ready. |
| LLM output changes meaning, names, or scripture references | Preserve a strict prompt, validate structure, label output as generated, and require human review/save/publish. |
| Draft content leaks through provider/logs | Server-only credentials, approved provider retention, no content logging, bounded audit metadata. |
| Translation requests become costly or slow | Explicit user action, missing-only targets, size/rate limits, max concurrency two, per-target timeouts and metrics. |
| Schema rollback rejects persisted new locales | Keep migrations forward-compatible and do not remove locale values on rollback. |
| Removing preload regresses LCP | Preserve eager/high priority and compare measured LCP before and after release. |
| Removing all selector focus indicators harms keyboard users | Remove only mouse-restored exterior outlines; retain a compact `focus-visible` indicator. |

## Final Decisions

- Admin console interface: three locales.
- Website, account, CMS content, subscriptions, campaigns, and notifications: five locales.
- Avatar menu and selector visual direction: Compact Utility.
- CMS translation interaction: generate all missing translations from a saved Traditional Chinese source.
- LLM integration owner: `hhc-web-api`.
- LLM output: preview only, human-reviewed, never auto-saved or auto-published.
- Security emails: reviewed Japanese/Korean templates, no runtime LLM.
- Hero image: eager and high priority, no explicit preload.
- Global loading page: not added.
