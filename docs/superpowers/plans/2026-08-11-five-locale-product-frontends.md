# Five-Locale Product Frontends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release a complete Japanese/Korean account experience first, then release public website routes with correct locale semantics, shared controls, local handwritten fonts, and clean hero loading.

**Architecture:** Both frontends consume the released shared locale/UI packages. `account-fe` releases first so every public login/registration path already supports the new locale. `hhc-web` keeps server-side locale routing, uses API `resolvedLocale`/`availableLocales` for fallback and SEO, and loads fixed-copy local font subsets only on the matching locale.

**Tech Stack:** React, Vite, Next.js, TypeScript, next-intl, React Aria shared packages, Vitest, Playwright/Lighthouse production smoke

## Global Constraints

- No frontend sends `ja`/`ko` until backend compatibility is live.
- No runtime LLM calls from either frontend.
- No global `loading.tsx` or central text-only Loading page.
- Public CMS fallback remains `zh-Hant`; only the fallback block uses `lang="zh-Hant"`.
- Japanese/Korean banner fonts are local WOFF2 subsets under 250 KiB each with `display: swap` and `preload: false`.
- Public website discovery is released only after account and messaging smoke pass.

---

### Task 1: Add complete Japanese and Korean account locale support

**Repository:** `account-fe`

**Files:**
- Modify: `src/i18n/locales.ts`
- Modify: `src/i18n/locales.test.ts`
- Modify: `src/i18n/locale-context.tsx`
- Modify: `src/i18n/locale-context.test.tsx`
- Modify: `src/i18n/messages.ts`
- Modify: `src/components/LanguageSelector.tsx`
- Modify: `src/components/LanguageSelector.test.tsx`
- Modify: `src/pages/LoginPage.test.tsx`
- Modify: `src/pages/RegisterPage.test.tsx`
- Modify: `src/pages/OAuthOnboardingPage.test.tsx`
- Modify: `src/pages/OAuthCallbackPage.test.tsx`
- Modify: `src/pages/OAuthLinkPage.test.tsx`
- Modify: `src/pages/VerifyEmailPage.test.tsx`
- Modify: `src/pages/ForgotPasswordPage.test.tsx`
- Modify: `src/pages/ResetPasswordPage.test.tsx`
- Modify: `src/pages/ProfilePage.test.tsx`
- Modify: `src/pages/SecurityPage.test.tsx`
- Modify: `src/pages/DevicesPage.test.tsx`
- Modify: `src/pages/NotificationsPage.test.tsx`

**Interfaces:**
- Consumes: shared `ProductLocale`, `productLocales`, `localeMetadata`, and `hhc_locale` helpers.
- Produces: complete message maps satisfying `Record<ProductLocale, Messages>` and exact locale propagation through existing APIs.

- [ ] **Step 1: Add failing locale/detection tests**

Test cookie-first `ja`/`ko`, browser `ja-*`/`ko-*`, selector labels/accessibility, invalid-cookie fallback, and `.alive.org.tw` product cookie persistence.

- [ ] **Step 2: Add compile-time message completeness**

Keep one canonical `Messages` shape and make `messages` satisfy `Record<ProductLocale, Messages>`. TypeScript build must fail for every missing Japanese/Korean key.

- [ ] **Step 3: Add page behavior tests in both locales**

Cover login, third-party login on login/register, first-time OAuth registration, email verification, reset, profile, security, devices, notifications, recovery errors, and locale sent to the API. Assert no protected page renders before auth bootstrap resolves.

- [ ] **Step 4: Run tests and confirm failure**

Run: `pnpm test:run && pnpm build`

Expected: FAIL until `ja`/`ko` copy and locale wiring are complete.

- [ ] **Step 5: Add reviewed natural copy and shared controls**

Japanese uses contemporary natural product language; Korean uses consistent approachable product language. Security/error copy remains precise. Consume shared `AccountMenu` and utility `Select`; remove consumer-specific hover/focus overrides.

- [ ] **Step 6: Run full verification and commit**

Run: `pnpm test:run && pnpm build && pnpm lint`

```bash
git add src
git commit -m "feat: add Japanese and Korean account experience"
```

Merge, release, and production-smoke every auth flow before starting public website discovery.

### Task 2: Add Japanese/Korean website routes and static copy

**Repository:** `hhc-web`

**Files:**
- Modify: `src/i18n/locales.ts`
- Modify: `src/i18n/locales.test.ts`
- Modify: `src/i18n/messages.ts`
- Create: `src/i18n/locales/ja.json`
- Create: `src/i18n/locales/ko.json`
- Modify: `src/lib/root-locale.ts`
- Modify: `src/lib/root-locale.test.ts`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/[locale]/layout.test.tsx`
- Modify: `src/app/manifest.test.ts`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/sitemap.test.ts`
- Modify: `src/lib/seo.ts`
- Modify: `src/lib/seo.test.ts`

**Interfaces:**
- Consumes: shared `ProductLocale`, `productLocales`, locale metadata/detection.
- Produces: statically generated `ja`/`ko` routes with correct `lang`, canonical, metadata, manifest, and static-page alternates.

- [ ] **Step 1: Add failing route and message-schema tests**

Assert JSON key parity with `zh-Hant`, Japanese/Korean route params, server-side root detection, `lang`, canonical, and static page alternates. Assert no `loading.tsx` is introduced.

- [ ] **Step 2: Run tests and confirm failure**

Run: `pnpm test:run`

Expected: FAIL because `ja`/`ko` are absent.

- [ ] **Step 3: Add reviewed static product/legal copy**

Create full locale files with natural Japanese/Korean copy. Keep legal register formal and source-controlled. Do not generate them through the CMS preview endpoint.

- [ ] **Step 4: Implement route/detection metadata**

Derive route params and static alternates from `productLocales`. Keep the root redirect server-side. Do not add client locale redirect logic.

- [ ] **Step 5: Run verification and commit**

Run: `pnpm test:run && pnpm build && pnpm lint && pnpm perf:static`

```bash
git add src/i18n src/lib src/app
git commit -m "feat: add Japanese and Korean website routes"
```

### Task 3: Render public CMS fallback with resolved locale and exact SEO

**Repository:** `hhc-web`

**Files:**
- Modify: `src/features/history/types.ts`
- Modify: `src/features/history/api.ts`
- Modify: `src/features/history/api.test.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/news/api.test.ts`
- Modify: `src/features/videos/api.ts`
- Modify: `src/features/videos/api.test.ts`
- Modify: `src/features/home/api.ts`
- Modify: `src/features/home/api.test.ts`
- Modify: `src/components/about/HistoryTimeline.tsx`
- Modify: `src/components/about/HistoryTimeline.test.tsx`
- Modify: `src/components/home/NewsSection.tsx`
- Modify: `src/components/home/NewsSection.test.tsx`
- Modify: `src/components/home/VideoSection.tsx`
- Modify: `src/components/home/VideoSection.test.tsx`
- Modify: `src/app/[locale]/news/[slug]/page.tsx`
- Modify: `src/app/[locale]/news/page.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/sitemap.test.ts`

**Interfaces:**
- Consumes: generated `resolvedLocale`, `availableLocales`, and request-locale `href`.
- Produces: locale-aware view models carrying both requested and resolved locale.

- [ ] **Step 1: Add failing mapper/render tests**

For a Japanese request resolved to `zh-Hant`, assert Traditional Chinese date formatting, HistoryTimeline event, home NewsSection card, VideoSection card, and news detail each set `lang="zh-Hant"`; links remain under `/ja`, canonical is `/zh-Hant/news/...`, and hreflang/sitemap omit Japanese until exact publication. Assert surrounding page chrome remains Japanese. Assert exact Japanese wins and restores Japanese canonical/hreflang.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm test:run -- src/features src/app/sitemap.test.ts`

Expected: FAIL because mappers use the requested locale and discard availability metadata.

- [ ] **Step 3: Preserve contract metadata through view models**

Format content-owned dates with `resolvedLocale`; keep surrounding navigation/chrome in the route locale. Build canonical/hreflang from exact `availableLocales`, never from all product locales for a dynamic content item.

- [ ] **Step 4: Run full verification and commit**

Run: `pnpm test:run && pnpm build && pnpm lint`

```bash
git add src/features src/app/[locale]/news src/app/sitemap.ts
git commit -m "fix: preserve CMS fallback language semantics"
```

### Task 4: Consume Compact Utility controls

**Repository:** `hhc-web`

**Files:**
- Modify: `src/components/layout/LanguageSwitcher.tsx`
- Modify: `src/components/layout/AccountControl.tsx`
- Modify: `src/components/layout/AccountControl.test.tsx`
- Modify: `src/components/layout/SiteHeader.tsx`
- Modify: `src/components/layout/SiteHeader.test.tsx`
- Modify: `src/components/layout/SiteFooter.tsx`
- Modify: `src/components/layout/SiteFooter.test.tsx`
- Modify: `src/components/legal/LegalPageShell.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: released shared `AccountMenu` and `Select variant="utility"`.
- Produces: consistent account and locale controls without consumer interaction overrides.

- [ ] **Step 1: Add failing consumer tests**

Assert five locale options, accessible full locale names, selected state, keyboard/pointer focus behavior, 200% zoom-safe layout classes, and consistent AccountMenu actions.

- [ ] **Step 2: Remove consumer-specific interaction CSS and use shared variants**

Update `LanguageSwitcher`, `AccountControl`, `SiteHeader`, `SiteFooter`, and `LegalPageShell` to use the released utility variant. In `src/app/globals.css`, retain only header/footer/legal placement, responsive width, alignment, and spacing rules; delete consumer overrides for hover, open, focus, selected, danger, disabled, forced-colors, and reduced-motion states because the shared package owns them.

- [ ] **Step 3: Run tests and commit**

Run: `pnpm test:run && pnpm build && pnpm lint`

```bash
git add src/components src/app
git commit -m "refactor: consume shared utility controls"
```

### Task 5: Remove redundant hero preload without weakening priority

**Repository:** `hhc-web`

**Files:**
- Modify: `src/components/home/HomeHero.tsx`
- Modify: `src/components/about/AboutHero.tsx`
- Modify: `src/components/hero-image.test.tsx`

**Interfaces:**
- Produces: `loading="eager"`, `fetchPriority="high"`, `sizes="100vw"`, no `preload` prop/link.

- [ ] **Step 1: Update tests first**

Assert eager/high-priority responsive image and absence of emitted preload behavior for both heroes.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm test:run -- src/components/hero-image.test.tsx`

Expected: FAIL while `preload` remains.

- [ ] **Step 3: Remove only explicit preload and verify**

Run: `pnpm test:run && pnpm build && pnpm lint`

- [ ] **Step 4: Commit**

```bash
git add src/components/home/HomeHero.tsx src/components/about/AboutHero.tsx src/components/hero-image.test.tsx
git commit -m "fix: avoid redundant hero image preload"
```

### Task 6: Add local Japanese and Korean handwritten banner subsets

**Repository:** `hhc-web`

**Files:**
- Modify: `scripts/subset-display-font.sh`
- Modify: `scripts/check-static-budgets.mjs`
- Modify: `scripts/check-static-budgets.node-test.mjs`
- Modify: `src/app/fonts.ts`
- Modify: `src/components/home/HomeHero.tsx`
- Modify: `src/components/about/AboutHero.tsx`
- Modify: `src/components/display-font.test.tsx`
- Create: `src/assets/fonts/klee-one/KleeOne-Regular.ttf`
- Create: `src/assets/fonts/klee-one/KleeOne-HHC-Banners.woff2`
- Create: `src/assets/fonts/klee-one/OFL.txt`
- Create: `src/assets/fonts/hhc-pen-hangul/HHC-Pen-Hangul-Banners.woff2`
- Create: `src/assets/fonts/hhc-pen-hangul/NanumPenScript-Regular.ttf`
- Create: `src/assets/fonts/hhc-pen-hangul/OFL.txt`
- Create: `src/assets/fonts/hhc-pen-hangul/SOURCE.md`

**Interfaces:**
- Produces: exhaustive locale-to-banner-font mapping; Korean primary family metadata `HHC Pen Hangul` with source recorded as Nanum Pen Script.

- [ ] **Step 1: Add failing glyph/license/budget tests**

Assert all fixed Japanese/Korean hero characters exist, each WOFF2 is below 250 KiB, neither globally preloads, both retain copyright/OFL metadata, and the Korean primary name contains none of `Nanum`, `Naver Nanum`, `NanumPen`, `Naver NanumPen`.

- [ ] **Step 2: Extend the existing deterministic subset script**

Use the exact reviewed hero title/subtitle strings as subset input. Reuse the existing fonttools path and budget checker; do not add another pipeline or runtime CDN.

- [ ] **Step 3: Add exhaustive font selection**

Map `zh-Hant/en → ChenYuluoyan`, `zh-Hans → Ma Shan Zheng`, `ja → Klee One subset`, and `ko → HHC Pen Hangul subset`. Use locale-specific size/tracking and system sans fallback.

- [ ] **Step 4: Run static/font and application verification**

Run: `pnpm test:run && pnpm perf:static && pnpm build && pnpm lint`

Expected: PASS with no missing glyph or budget failure.

- [ ] **Step 5: Commit**

```bash
git add scripts src/app/fonts.ts src/components src/assets/fonts
git commit -m "feat: add Japanese and Korean banner fonts"
```

### Task 7: Production performance and console smoke

**Repository:** `hhc-web`

**Files:**
- Modify: `docs/release-evidence/five-locale/README.md`

**Interfaces:**
- Consumes: production `www` revision.
- Produces: route, console, font-network, and performance evidence.

- [ ] **Step 1: Verify direct and client navigation**

Check home, about, and literature in `zh-Hant`, `ja`, and `ko`; no unused-preload warning, font CDN request, mixed glyph, or global Loading screen.

- [ ] **Step 2: Run repeatable performance comparison**

Use cold cache, simulated slow 4G, and 4× CPU slowdown. Record median of three runs: LCP ≤2.5s, regression ≤200ms, CLS ≤0.1.

- [ ] **Step 3: Verify 320px, 200% zoom, forced colors, dark mode, and reduced motion**

Record screenshots/evidence for hero overflow, selectors, avatar menu, and legal footer placement.
