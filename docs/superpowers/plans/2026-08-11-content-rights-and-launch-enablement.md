# Content Rights and Launch Enablement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supply reviewed Japanese/Korean content, publisher evidence, scripture/legal presentation, and final discovery gates for the five-locale launch.

**Architecture:** Rights and fluent-language review are release evidence, not runtime services. Scripture remains source-controlled and isolated from Azure OpenAI. Public discovery is enabled only after account, messaging, content, fonts, legal copy, and production smoke are complete.

**Tech Stack:** Reviewed JSON/source content, Next.js legal/About components, CMS publication workflow, GitHub PR evidence

## Global Constraints

- English NIV and Korean NIV fallback require recorded Biblica permission/license for this AI-enabled website architecture.
- Japanese uses exact 日本聖書協会『聖書 新共同訳』 text, stays within the site-wide quotation limit, carries required attribution, and reports the final URL.
- Korean remains exact English NIV with `lang="en"` until written permission and reviewed `개역개정판` text exist.
- Traditional/Simplified Chinese scripture text is unchanged; only edition/source/permission evidence is inventoried.
- Scripture is never machine-translated or sent to Azure OpenAI.
- Every generated CMS item is reviewed by a fluent target-language reviewer before publication.

---

### Task 1: Complete publisher and edition evidence

**Files:**
- Create: `docs/release-evidence/five-locale/scripture-rights.md`

**Interfaces:**
- Produces: release gates `biblicaApproved`, `jbsReported`, `kbsApproved`, and Chinese edition inventory.

- [ ] **Step 1: Request Biblica written permission/license**

Describe the exact displayed NIV verses, public website URLs, non-commercial church context, and the AI-assisted CMS architecture. State explicitly that NIV text is source-controlled, excluded from prompts, and never sent to Azure OpenAI. Record the permission/license reference and required notice wording; do not commit private correspondence or contact data.

- [ ] **Step 2: Inventory existing Chinese editions without changing text**

For `zh-Hant` and `zh-Hans`, record exact edition, authorized source, passage scope, copyright owner, permission basis, and required attribution. If the evidence requires a correction, open a separate content PR; do not combine a silent text change with locale infrastructure.

- [ ] **Step 3: Record Japanese requirements**

Record 新共同訳 edition/copyright wording, total HHC website verse count, final URL-reporting address, and two-person character comparison requirement.

- [ ] **Step 4: Record Korean status**

Mark `개역개정판` as blocked until the Korean Bible Society written approval reference, exact authorized text, and required attribution are present. This does not block the Korean route; it keeps the scripture block on approved NIV fallback.

- [ ] **Step 5: Commit evidence through PR**

```bash
git add docs/release-evidence/five-locale/scripture-rights.md
git commit -m "docs: record scripture rights gates"
```

### Task 2: Add stable Terms scripture section and About notices

**Repository:** `hhc-web`

**Files:**
- Modify: `src/components/legal/LegalDocument.tsx`
- Modify: `src/components/legal/LegalPageShell.test.tsx`
- Modify: `src/app/[locale]/terms-of-use/page.tsx`
- Modify: `src/app/[locale]/about/page.tsx`
- Modify: `src/components/layout/SiteFooter.tsx`
- Modify: `src/components/layout/SiteFooter.test.tsx`
- Modify: `src/i18n/locales/zh-Hant.json`
- Modify: `src/i18n/locales/zh-Hans.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`

**Interfaces:**
- Produces: stable `id="bible-quotations"`; one edition-specific muted About footer paragraph; Terms link resolving to the anchor.

- [ ] **Step 1: Add failing legal presentation tests**

Assert the Terms anchor exists in all five locales; About links to it; English and Korean fallback show the approved full NIV notice; Japanese shows the required JBS source/copyright wording; unrelated pages do not render the extra paragraph. Assert there is no card, heading, icon, panel, or extra divider.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test:run -- src/components/legal src/components/layout/SiteFooter.test.tsx src/i18n/legal-content.test.ts`

Expected: FAIL because the stable anchor and edition-aware paragraph are absent.

- [ ] **Step 3: Implement anchor and edition-aware notice data**

Let legal section data carry an optional stable ID; render `bible-quotations` only for that section. Pass the actually rendered scripture edition to the About footer notice; do not infer it solely from page locale because Korean initially renders NIV.

- [ ] **Step 4: Run verification and commit**

Run: `pnpm test:run && pnpm build && pnpm lint`

```bash
git add src/components/legal src/components/layout src/app src/i18n
git commit -m "feat: add scripture rights presentation"
```

Do not merge until the notice wording matches recorded publisher evidence.

### Task 3: Add exact Japanese scripture and Korean NIV fallback

**Repository:** `hhc-web`

**Files:**
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`
- Modify: `src/app/[locale]/about/page.tsx`
- Modify: `src/components/about/HistoryTimeline.test.tsx`

**Interfaces:**
- Produces: exact Japanese 新共同訳 Isaiah 49:1–3 and 49:5–6; Korean block reuses the approved English NIV source object and sets `lang="en"`.

- [ ] **Step 1: Add failing edition/fallback tests**

Assert Japanese edition label and character checksum from the authorized reviewed source. Assert Korean does not contain a machine-translated scripture field and renders the same source string/checksum as English NIV with `lang="en"` while surrounding page remains `lang="ko"`.

- [ ] **Step 2: Perform two-person source comparison**

One editor enters the authorized Japanese text; a second reviewer compares Isaiah 49:1–3 and 49:5–6 character-for-character, including punctuation and verse omissions. Record reviewer/date/checksum in release evidence, not personal details in application code.

- [ ] **Step 3: Implement source reuse for Korean fallback**

Reference the English scripture content object rather than copying or translating it into `ko.json`. Keep Korean page UI/citation copy localized while the scripture text and edition notice remain English/NIV.

- [ ] **Step 4: Run verification and commit**

Run: `pnpm test:run && pnpm build && pnpm lint`

```bash
git add src/i18n/locales/ja.json src/i18n/locales/ko.json 'src/app/[locale]/about/page.tsx' src/components/about/HistoryTimeline.test.tsx
git commit -m "feat: add Japanese scripture and Korean NIV fallback"
```

### Task 4: Establish fluent-review terminology and acceptance

**Files:**
- Create: `docs/content/five-locale-terminology.md`
- Create: `docs/release-evidence/five-locale/language-review.md`

**Interfaces:**
- Produces: source-controlled HHC name/Christian terminology guidance and per-record review evidence.

- [ ] **Step 1: Add the minimum glossary**

Record only terms that must remain consistent: organization/church names, ministry names, pastoral titles, common scripture-reference formatting, and approved Japanese/Korean Christian terminology. Do not build a terminology service.

- [ ] **Step 2: Define per-record review checks**

For each static file, notification template, banner string, and generated CMS record, record locale, reviewer role, meaning pass, naturalness pass, register pass, terminology pass, and publication approval. Do not copy unpublished content into evidence.

- [ ] **Step 3: Commit through PR**

```bash
git add docs/content/five-locale-terminology.md docs/release-evidence/five-locale/language-review.md
git commit -m "docs: define Japanese and Korean language review"
```

### Task 5: Populate and publish five-locale CMS content

**Systems:** `admin-fe`, `hhc-web-api`, production CMS

**Files:**
- Modify: `docs/release-evidence/five-locale/language-review.md`

**Interfaces:**
- Consumes: translation preview feature and normal revision/publish workflow.
- Produces: exact published locale projections and retained `zh-Hant` fallback for missing records.

- [ ] **Step 1: Generate only missing previews**

Start from saved `zh-Hant`; generate `zh-Hans`, `en`, `ja`, and `ko` missing rows. Never replace a populated row through the batch action.

- [ ] **Step 2: Review and save each locale**

Fluent reviewer edits Japanese/Korean before Save Draft. Verify no source fact, date, name, URL, scripture reference, or theological meaning changed.

- [ ] **Step 3: Publish through existing permissions**

Use normal Save Draft, revision, publish confirmation, asset scan/grant, and bulletin PDF workflow. LLM preview success is not publish approval.

- [ ] **Step 4: Verify exact and fallback records**

Confirm exact locale wins where published; missing locale returns the whole `zh-Hant` projection, `resolvedLocale="zh-Hant"`, and does not count as complete in Admin.

### Task 6: Enable public discovery and complete launch smoke

**Repository:** `hhc-web` plus production services

**Files:**
- Modify: `docs/release-evidence/five-locale/README.md`

**Interfaces:**
- Consumes: all prior plan exit gates.
- Produces: public Japanese/Korean discovery and final launch decision.

- [ ] **Step 1: Confirm dependency gates**

Require live account, notification, engagement, API client, Admin, website, Azure translation, font, scripture, and legal evidence. Require Biblica/JBS evidence; Korean KBS approval is optional only because Korean scripture remains NIV fallback.

- [ ] **Step 2: Verify sitemap/canonical/hreflang**

Static pages advertise five locales. Dynamic content advertises only exact `availableLocales`; fallback pages canonicalize to the selected exact locale and never create duplicate-language hreflang entries.

- [ ] **Step 3: Run cross-service production journeys**

Run the exact acceptance list from the coordinating program plan for `ja` and `ko`, including third-party first-login registration, security email rendering, newsletter/Web Push, campaign exact-to-English fallback, CMS preview failure paths, bulletin PDF, About notices, and font/network checks.

- [ ] **Step 4: Record rollout and rollback floors**

Keep `ja`/`ko` database constraints on rollback. Roll back application revisions only to the recorded compatible floor and preserve already-published locale data.
