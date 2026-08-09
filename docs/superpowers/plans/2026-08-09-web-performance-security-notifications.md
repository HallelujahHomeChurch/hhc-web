# HHC Web Performance, PWA, Security, And Bulletin Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce public-site first-load cost, make the iPhone installed-PWA navigation feel native, align Web Push controls with the shared design system, send one reliable notification after a weekly bulletin is actually published, and lock the public/account/gateway security boundaries with repeatable verification.

**Architecture:** Keep product and service ownership unchanged. `hhc-web` owns public presentation and browser subscription UX; `admin-fe` records an editor's notification intent; `hhc-web-api` owns bulletin publication and emits a durable post-publication outbox event; `engagement-api` snapshots recipients and creates campaigns; `notification-api` remains the existing delivery/queue capability. Security changes remain at the owning boundary: public route exposure and headers in `api-gateway`, CSRF/session enforcement in `account-api`, and SEO metadata in `hhc-web`.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, React Aria Components, Tailwind CSS 4, Go, PostgreSQL, Nginx, Dapr service invocation, Azure Container Apps, Vitest, Go tests, Lighthouse, and safe HTTP black-box checks.

## Global Constraints

- `main` is production in every repository. Use one focused `codex/` branch and pull request per repository; never deploy an unmerged local commit.
- Reuse `@hallelujahhomechurch/ui`, the existing hhc-web publication outbox, engagement campaigns, and notification delivery queue. Do not add another component library, queue, notification provider, CMS service, or analytics service.
- Preserve light/dark semantic tokens, all three locales, keyboard interaction, focus visibility, `prefers-reduced-motion`, and minimum 44px mobile touch targets.
- The iPhone floating navigation applies only to iOS/iPhone standalone PWA mode. Normal mobile Safari/Chrome keeps the current full-width mobile tab bar.
- A bulletin notification is opt-in at publish confirmation, defaults on until that bulletin has queued its first notification, and can be sent at most once automatically per bulletin issue.
- Publication success and notification success are independent. A notification failure must never unpublish or roll back a successfully published PDF.
- Missing notification translations fall back to `zh-Hant`; if `zh-Hant` is unavailable at the first publication, use the locale being published.
- Public Web Push campaigns target all active push subscriptions. Recipient locale is selected from the subscription snapshot.
- `notification-api` requires no production-code change for this plan; its current queue, provider, retry, and per-recipient idempotency contracts are reused.
- Do not introduce speculative caching infrastructure. Use Next fetch caching, the existing public projection API, and deterministic static-asset budgets.
- Black-box security verification is non-destructive: safe HTTP methods, header/routing checks, TLS inspection, and an OWASP ZAP baseline only. No brute force, destructive fuzzing, or authenticated data mutation.

## Delivery Order

1. Capture production baseline and add deterministic budgets.
2. Reduce font and image/LCP cost.
3. Collapse duplicate public-content reads.
4. Implement iPhone standalone-PWA navigation.
5. Release shared notification controls, then consume them in hhc-web.
6. Add the bulletin publish-notification flow from engagement idempotency outward to Admin.
7. Harden and verify Gateway/Account security contracts.
8. Run production performance and black-box verification after all deployments.

Each task below is independently reviewable. Tasks 1-4 can ship without the notification tasks. Task 6 must publish the shared UI package before Task 7 updates hhc-web. The notification flow must ship in the order `engagement-api -> hhc-web-api client/worker -> frontend-platform client -> admin-fe`.

---

### Task 1: Production Baseline And Static Performance Budgets

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Create: `scripts/check-static-budgets.mjs`
- Modify: `package.json`
- Create: `docs/performance-baseline.md`
- Test: `scripts/check-static-budgets.node-test.mjs`

**Interfaces:**
- `pnpm perf:static` exits non-zero when the imported local display font exceeds 250 KiB, the home hero source exceeds 200 KiB, or a forbidden full display-font import returns.
- `docs/performance-baseline.md` records one reproducible production run for `/zh-Hant`, `/zh-Hans`, and `/en`: status, transferred bytes, FCP, LCP, CLS, INP/TBT proxy, and Lighthouse category scores.

- [ ] Add a failing Node test using temporary files to prove each budget violation exits non-zero and a compliant fixture passes.
- [ ] Run `node --test scripts/check-static-budgets.node-test.mjs` and confirm it fails because the checker is absent.
- [ ] Implement the checker with Node standard library only; inspect the actual font imported by `src/app/fonts.ts` rather than every licensed source file retained in the repository.
- [ ] Add `"perf:static": "node scripts/check-static-budgets.mjs"` and run it once to capture the expected pre-optimization font failure.
- [ ] Record the pre-change production baseline using the same Chrome/Lighthouse version, simulated mobile profile, and URLs in `docs/performance-baseline.md`.
- [ ] Run `pnpm test:run`, `pnpm lint`, and `pnpm build`.
- [ ] Commit `test: add web performance budgets` and open the hhc-web pull request only after Tasks 2-4 are included.

### Task 2: Display Font Subset And Route-Safe Typography

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Create: `src/assets/fonts/chenyuluoyan/ChenYuluoyan-HHC-Banners.woff2`
- Create: `scripts/subset-display-font.sh`
- Modify: `src/app/fonts.ts`
- Modify: `src/components/home/HomeHero.tsx`
- Modify: `src/components/about/AboutHero.tsx`
- Modify: `src/components/about/HistoryTimeline.tsx`
- Test: `src/components/home/HomeHero.test.tsx`
- Test: `src/components/about/AboutHero.test.tsx`
- Test: `scripts/check-static-budgets.node-test.mjs`

**Interfaces:**
- `chenyuLuoyanBanner` replaces the current 4.79 MiB `chenyuLuoyan` import for fixed Traditional Chinese/English hero strings.
- The subset contains the union of fixed `heroTitle` and `heroSubtitle` characters from `zh-Hant.json` and `en.json`, plus ASCII punctuation and digits used by hero copy.
- Dynamic CMS history text no longer depends on the banner-only subset; it uses the locale sans stack so future content cannot display missing glyphs.

- [ ] Add failing component tests asserting Traditional Chinese/English heroes use the banner font and dynamic history does not use `font-display`.
- [ ] Run the focused tests and confirm the dynamic-history assertion fails.
- [ ] Implement `scripts/subset-display-font.sh` with `python3 -m fontTools.subset`, `--flavor=woff2`, the explicit generated glyph text, and output path above; retain the original licensed font source but stop importing it at runtime.
- [ ] Generate and commit the subset, keeping `license.txt` unchanged.
- [ ] Rename the Next local-font export to `chenyuLuoyanBanner` and update fixed hero consumers.
- [ ] Remove `font-display` from dynamic history content and use the existing locale sans tokens.
- [ ] Reduce Noto/Inter weights only when `rg` confirms the weight is unused; do not alter visible hierarchy merely to reduce files.
- [ ] Run focused tests and `pnpm perf:static`; confirm the imported local display font is at most 250 KiB.
- [ ] Run `pnpm test:run`, `pnpm lint`, and `pnpm build`.

### Task 3: Hero LCP And Responsive Image Delivery

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Modify: `next.config.ts`
- Modify: `src/components/home/HomeHero.tsx`
- Modify: `src/components/about/AboutHero.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/home/HomeHero.test.tsx`
- Test: `src/components/about/AboutHero.test.tsx`

**Interfaces:**
- Hero artwork is a real Next `<Image fill>` with explicit `sizes="100vw"`, `priority`, meaningful alt handling, and a separate CSS overlay layer.
- Next image optimization is enabled for the standalone runtime; generated responsive images may use WebP/AVIF while the committed source remains the rollback artifact.
- Layout dimensions remain fixed before image decode, so the change cannot add CLS.

- [ ] Add failing tests asserting hero artwork renders as an image with `sizes="100vw"`, priority/fetch priority, and no CSS `backgroundImage` source.
- [ ] Run the focused tests and confirm they fail against the current CSS background.
- [ ] Replace the background image with an absolutely positioned `<Image fill>` and keep the semantic text above an overlay pseudo-element.
- [ ] Remove `images.unoptimized: true`; configure only the image formats and device sizes required by current 375/768/1440 layouts.
- [ ] Preserve the existing hero min-height and content positioning in light/dark modes.
- [ ] Verify 375px, 768px, and 1440px screenshots for crop, text contrast, and zero overlap.
- [ ] Run focused tests, `pnpm perf:static`, `pnpm test:run`, `pnpm lint`, and `pnpm build`.

### Task 4: One Home Projection Read And Stable Public Cache Policy

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Create: `src/features/home/api.ts`
- Create: `src/features/home/api.test.ts`
- Modify: `src/features/news/api.ts`
- Modify: `src/features/videos/api.ts`
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/features/content/client.ts`
- Modify: `src/components/home/WeeklyCard.tsx`
- Modify: `src/features/weekly/public-api.ts`
- Test: matching home/news/video/weekly tests

**Interfaces:**
- `getHomeContent(locale, client?)` calls `client.getHome(locale)` exactly once and returns `{news, videos}` mapped to existing `NewsItem[]` and `VideoItem[]` types.
- Server public-content requests retain `next: {revalidate: 60}` and do not use `no-store`.
- The weekly card keeps its independent `/bulletins?page=1&pageSize=1` request because weekly data is not part of `/home`; it gains no extra request on rerender or locale-stable state changes.

- [ ] Add a failing unit test with a counting fake client proving one `getHome` invocation returns both mapped collections.
- [ ] Add a WeeklyCard test proving one request per locale/retry key and abort on unmount.
- [ ] Run focused tests and confirm the home request-count test fails against separate `getHomeNews`/`getVideos` calls.
- [ ] Implement `getHomeContent` and update the home page to await it once; preserve independent error presentation by mapping a failed home projection to both empty sections with localized errors.
- [ ] Remove duplicate home-specific wrappers after all callers migrate; retain list/detail news APIs.
- [ ] Keep the 60-second server revalidation contract and ensure public API errors are not cached as successful mock content.
- [ ] Run focused tests, `pnpm test:run`, `pnpm lint`, and `pnpm build`.

### Task 5: iPhone Standalone-PWA Floating Navigation

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Create: `src/lib/pwa-capabilities.ts`
- Create: `src/lib/pwa-capabilities.test.ts`
- Modify: `src/components/layout/WebPushControl.tsx`
- Modify: `src/components/layout/SiteHeader.tsx`
- Modify: `src/components/layout/SiteHeader.test.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `isIOSDevice(navigatorLike)` and `isStandaloneWebApp(windowLike, navigatorLike)` are the only PWA capability helpers; WebPush and navigation consume the same detection logic.
- `SiteHeader` exposes `data-ios-standalone="true"` only after client capability detection; server markup remains deterministic.
- iPhone standalone mode renders a centered floating pill with 64px visual height, 12px horizontal viewport margin, `max-width: 420px`, `bottom: max(10px, env(safe-area-inset-bottom))`, full `999px` radius, translucent semantic canvas, blur, and three equal tabs.

- [ ] Add capability tests for iPhone Safari, iPhone standalone, iPad/desktop, Android standalone, and missing `matchMedia`.
- [ ] Add SiteHeader tests proving the attribute is absent by default and enabled only for iPhone standalone.
- [ ] Run focused tests and confirm the helper/attribute tests fail.
- [ ] Extract current duplicated iOS/standalone checks from `WebPushControl` into `pwa-capabilities.ts`.
- [ ] Add the iPhone standalone data attribute without changing route navigation or account-menu behavior.
- [ ] Implement the floating pill only under the attribute; keep normal mobile web styles unchanged.
- [ ] Preserve current scroll-direction hide/show behavior and move the hidden pill fully below its floating offset.
- [ ] Set body bottom padding for both normal and floating variants so content and controls remain reachable.
- [ ] Add reduced-motion overrides that remove transform animation without changing visibility state.
- [ ] Verify installed iPhone PWA portrait/landscape and 375px browser screenshots; record real-device verification separately from automated tests.
- [ ] Run focused tests, `pnpm test:run`, `pnpm lint`, and `pnpm build`.

### Task 6: Shared 44px Soft Icon Button

**Repository:** `/Users/rayselfs/Projects/hhc/frontend-platform`

**Files:**
- Modify: `packages/ui/src/controls.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/primitives.stories.tsx`
- Modify: `packages/ui/src/primitives.test.tsx`
- Modify: `packages/ui/package.json`

**Interfaces:**
- `ButtonVariant` adds `soft` using existing primary-soft semantic tokens.
- `ButtonProps.size` adds `lg`; `IconButton size="lg"` is exactly 44x44px with zero inline padding.
- Pointer, hover, keyboard focus, pending/disabled, dark mode, and reduced-motion behavior remain owned by the shared component.

- [ ] Add failing React Aria tests for `IconButton variant="soft" size="lg"`, pointer class ownership, keyboard focus, and disabled behavior.
- [ ] Add Storybook states for light/dark, hover, focus-visible, pending, and disabled 44px icon buttons.
- [ ] Run `pnpm --filter @hallelujahhomechurch/ui test:run` and confirm the new API assertions fail.
- [ ] Extend the existing Button/IconButton implementation and CSS without adding another component.
- [ ] Run UI tests, lint, build, and Storybook build.
- [ ] Bump all frontend-platform workspace packages from `0.6.0` to `0.6.1` and release them through frontend-platform CI/CD; do not publish manually from the workstation.
- [ ] Commit `feat: add large soft icon button` and merge only after package CI passes.

### Task 7: hhc-web Web Push Control Shared-UI Migration

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/components/layout/WebPushControl.tsx`
- Modify: `src/components/layout/WebPushControl.test.tsx`
- Modify: `src/components/layout/SiteFooter.tsx`
- Test: `src/components/layout/SiteFooter.test.tsx`

**Interfaces:**
- The footer subscription trigger and prompt dismiss action use shared `IconButton`.
- Prompt `稍後` and enable actions use shared `Button`.
- `WebPushControl` retains only browser capability, permission, service worker, subscription, account binding, and prompt-state logic.
- Notification, YouTube, and Facebook controls remain 44px circles with 12px spacing inside their respective preference/social groups.

- [ ] Upgrade all frontend-platform packages used by hhc-web to the same `0.6.1` release and regenerate the lockfile.
- [ ] Add failing tests asserting the trigger/dismiss controls carry shared UI classes and that disabled subscription state uses shared disabled semantics.
- [ ] Run focused tests and confirm current native buttons fail the shared-UI assertions.
- [ ] Replace native interactive elements with shared controls while preserving labels, titles, `aria-live`, permission timing, and auto-prompt behavior.
- [ ] Remove local cursor/hover/disabled classes now owned by shared UI; do not add a global `button { cursor: pointer }` rule.
- [ ] Verify footer grouping and 44px alignment at 375px and desktop in light/dark modes.
- [ ] Run focused tests, `pnpm test:run`, `pnpm lint`, and `pnpm build`.

### Task 8: Idempotent Engagement Campaign Creation

**Repository:** `/Users/rayselfs/Projects/hhc/engagement-api`

**Files:**
- Create: `internal/migrations/sql/010_campaign_create_idempotency.sql`
- Modify: `internal/campaigns/store.go`
- Modify: `internal/httpapi/handler.go`
- Modify: `docs/openapi.yaml`
- Test: `internal/migrations/migrations_test.go`
- Test: `internal/campaigns/store_test.go`
- Test: `internal/httpapi/handler_test.go`

**Interfaces:**
- `POST /priv/campaigns` accepts optional `Idempotency-Key` and scopes it by authenticated `X-HHC-Caller-App-Id`.
- Replaying the same caller/key with the same normalized request returns the original campaign.
- Replaying the same caller/key with different content returns `409 ENG_IDEMPOTENCY_CONFLICT`.
- Existing requests without the header preserve current draft-creation behavior.

- [ ] Add migration tests for nullable `source_caller`, `idempotency_key`, request fingerprint, and a partial unique index on `(source_caller, idempotency_key)`.
- [ ] Add store tests for first create, exact replay, conflicting replay, and the same key from another caller.
- [ ] Add handler tests proving missing caller remains unauthorized and header values are not accepted from the JSON body.
- [ ] Run focused tests and confirm they fail before migration/store support exists.
- [ ] Implement request normalization/fingerprinting with the Go standard library and persist the caller-scoped key.
- [ ] Return the existing campaign for an exact replay without creating deliveries or changing timestamps.
- [ ] Document the header and 409 response in OpenAPI.
- [ ] Run `go test ./internal/migrations ./internal/campaigns ./internal/httpapi` and `go test ./...`.
- [ ] Commit `feat: make campaign creation idempotent`, open the engagement-api PR, and deploy before Task 9.

### Task 9: Durable Post-Publication Bulletin Notification

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web-api`

**Files:**
- Create: `internal/migrations/sql/021_bulletin_notification_state.sql`
- Modify: `internal/bulletins/types.go`
- Modify: `internal/bulletins/service.go`
- Modify: `internal/postgres/repository.go`
- Modify: `internal/publication/types.go`
- Modify: `internal/publication/worker.go`
- Modify: `internal/engagementclient/client.go`
- Modify: `cmd/server/main.go`
- Modify: `openapi.yaml`
- Test: `internal/bulletins/service_test.go`
- Test: `internal/postgres/repository_integration_test.go`
- Test: `internal/publication/worker_test.go`
- Test: `internal/engagementclient/client_test.go`

**Interfaces:**
- Bulletin publish input becomes `{locale: BulletinLocale, notifySubscribers?: boolean}`; absent remains `false` for backward compatibility.
- Bulletin issue responses add `notificationStatus: "not_requested" | "pending" | "queued" | "failed"`, optional `notificationQueuedAt`, and optional safe `notificationErrorCode`.
- Successful PDF publication and projection updates commit first with a `bulletin.notification.queue` outbox event in the same transaction when notification was requested and the issue has never queued one.
- The notification event uses `Idempotency-Key: bulletin:{issueId}:web-push`, creates one `web_push`/`all` campaign, and queues it through engagement-api.

- [ ] Add service tests proving publish intent reaches the repository and omitted intent remains false.
- [ ] Add migration/integration tests for default notification state and one outbox event across publication retries and later locale publication.
- [ ] Add worker tests for successful campaign create/send, exact retry, engagement timeout, create conflict, already-sent response, and terminal invalid payload.
- [ ] Run focused tests and confirm the new contract and event tests fail.
- [ ] Add issue notification state and carry `notifySubscribers` in the durable publication payload.
- [ ] In `CompletePublish`, update public projections and insert the notification event atomically; do not call engagement-api inside the database transaction.
- [ ] Build translations from available bulletin versions. Use locale-specific subject `第 {issueNumber} 期週報已發布` equivalents, body from subtitle then title, and action URL `/{locale}/literature-ministry`; fill missing locales from `zh-Hant`, then the triggering locale.
- [ ] Extend the publication worker to process the notification event through a narrow engagement client. Accept create replay and already-queued send as success.
- [ ] Mark notification state `queued` only after engagement accepts the campaign; retain publication status `published` when notification retries or fails.
- [ ] Expose only a stable error code to Admin; keep upstream response bodies and credentials out of logs.
- [ ] Update OpenAPI and regenerate/verify server contract tests.
- [ ] Run focused packages and `GOCACHE=/private/tmp/hhc-web-api-go-build-cache go test ./...`.
- [ ] Commit `feat: notify subscribers after bulletin publication`, open the hhc-web-api PR, and deploy before Task 10.

### Task 10: Admin Bulletin Notification Intent And Status

**Repositories:**
- `/Users/rayselfs/Projects/hhc/frontend-platform`
- `/Users/rayselfs/Projects/hhc/account/admin-fe`

**Files:**
- Regenerate: `packages/hhc-web-client/src/generated.ts`
- Modify: `packages/hhc-web-client/src/client.ts`
- Test: `packages/hhc-web-client/src/client.test.ts`
- Modify: `admin-fe/src/lib/cms-api.ts`
- Modify: `admin-fe/src/lib/mock-cms-api.ts`
- Modify: `admin-fe/src/pages/BulletinDetailPage.tsx`
- Modify: `admin-fe/src/pages/BulletinDetailPage.test.tsx`
- Modify: `admin-fe/src/preferences/locale-context.tsx`
- Test: `admin-fe/src/App.test.tsx`

**Interfaces:**
- `publishBulletin(id, version, locale, {notifySubscribers})` sends the new optional field.
- The publish Dialog shows a shared Switch labelled `發佈成功後通知訂閱者` in all three UI locales.
- Switch default is on while issue `notificationStatus` is `not_requested` or `failed`; after `queued`, the Dialog shows a read-only `已通知訂閱者` status and sends `false` for later locale publications.
- Admin reports publication queued immediately and refreshes the issue's independent notification state through existing publication polling; it does not claim all recipient deliveries succeeded.

- [ ] Regenerate the client from the deployed hhc-web-api OpenAPI and add a client test for `notifySubscribers` serialization.
- [ ] Bump all frontend-platform workspace packages from `0.6.1` to `0.6.2`, release the generated-client change through CI/CD, then update admin-fe dependencies and lockfile to `0.6.2`.
- [ ] Add failing Admin tests for default-on first notification, user opt-out, already-queued display, failed-state retry option, and three-locale copy.
- [ ] Run focused tests and confirm current publish Dialog lacks these controls.
- [ ] Add the shared Switch to the existing publication Modal without nesting another card or adding custom campaign fields.
- [ ] Show derived notification subject/body preview only as concise read-only copy; editing/re-sending remains in the existing Campaign area.
- [ ] Keep unpublish behavior unchanged and never offer automatic notification from unpublish.
- [ ] Run `pnpm test -- --run`, `pnpm lint`, and `pnpm build` in admin-fe.
- [ ] Commit `feat: add bulletin publication notifications`, open the admin-fe PR, and deploy after its client package.

### Task 11: Gateway Route And Browser Security Contracts

**Repository:** `/Users/rayselfs/Projects/hhc/account/api-gateway`

**Files:**
- Modify: `nginx.conf`
- Create: `conf.d/common/security-headers.conf`
- Modify: `conf.d/default.conf`
- Modify: `scripts/test-www-routing.sh`
- Modify: `scripts/test-auth-routing.sh`
- Modify: `scripts/runtime-smoke.sh`

**Interfaces:**
- `www` continues exposing only explicit public content, canonical `/assets/*`, newsletter unsubscribe, push config/subscription, and the minimal account session/bind/logout routes already listed in `default.conf`.
- `account` and `admin` responses include `X-Robots-Tag: noindex, nofollow, noarchive` without applying it to `www`.
- All hosts retain HSTS, `nosniff`, strict referrer policy, and frame denial; add a conservative `Permissions-Policy` denying unused camera, microphone, geolocation, payment, and USB capabilities.
- CSP is added only after route-specific source inventory and runtime tests; do not deploy a guessed global policy that breaks Next hydration, OAuth, YouTube thumbnails/embeds, or asset images.

- [ ] Add failing shell assertions for account/admin `X-Robots-Tag`, Permissions Policy, explicit www allowlist, method restrictions, `/priv/*` denial, and unknown `/api/*` 404.
- [ ] Run routing scripts and confirm only the new header assertions fail.
- [ ] Move shared static security headers into the common include without weakening existing HSTS/X-Frame behavior.
- [ ] Add host-specific noindex headers to account/admin server blocks only.
- [ ] Inventory current script/style/connect/img/frame sources from production responses. Add a per-host CSP only when every required source is represented and runtime tests pass; otherwise record CSP as deferred rather than shipping `unsafe-*` expansion as nominal hardening.
- [ ] Extend runtime smoke to verify headers and methods through the deployed hostnames.
- [ ] Run `docker build`, container `nginx -t`, all `scripts/test-*.sh`, and `scripts/runtime-smoke.sh` against a local container.
- [ ] Commit `security: harden browser and route boundaries`, open the gateway PR, and deploy with its existing rollback path.

### Task 12: Account CSRF And Session Boundary Verification

**Repository:** `/Users/rayselfs/Projects/hhc/account/account-api`

**Files:**
- Modify only if a failing contract is found: `internal/middleware/csrf_middleware.go`
- Modify: `internal/middleware/csrf_middleware_test.go`
- Modify: `internal/middleware/cors_test.go`
- Modify: `internal/routes/routes_test.go`
- Modify: `internal/handlers/auth_handler_test.go`
- Modify: `docs/API.md`

**Interfaces:**
- Unsafe browser requests require a valid signed `__csrf_token` host cookie and matching `X-CSRF-Token` header.
- CSRF cookie remains host-only, `SameSite=Strict`, `Secure` in production, and readable by the owning frontend.
- Session access-token, logout, logout-all, push binding, newsletter preference, social linking, password/MFA, profile, and admin mutation routes remain CSRF protected.
- CORS accepts only configured HHC origins and never reflects arbitrary origins or combines credentials with `*`.

- [ ] Add a route table test enumerating every unsafe browser endpoint and asserting the expected CSRF middleware group.
- [ ] Add tests for valid same-origin request, missing cookie, missing header, mismatch, expiry, hostile Origin, unconfigured sibling subdomain, and production cookie attributes.
- [ ] Run focused tests. If all pass against current implementation, keep production middleware unchanged and commit only contract-locking tests/docs.
- [ ] If a test exposes a real gap, fix it once in shared middleware/route grouping rather than adding handler-specific checks.
- [ ] Reconcile `docs/API.md` token lifetime and cookie attributes with `Config.CSRFTokenMaxAge`; remove stale contradictory examples.
- [ ] Run `GOCACHE=/private/tmp/account-api-go-build-cache go test ./internal/middleware ./internal/routes ./internal/handlers` and `go test ./...`.
- [ ] Commit `test: lock browser csrf boundaries`, open the account-api PR, and deploy only if production code changes.

### Task 13: Final Production Performance And Safe Black-Box Verification

**Repositories:** all repositories changed by Tasks 1-12.

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/hhc-web/docs/performance-baseline.md`
- Create: `/Users/rayselfs/Projects/hhc/hhc-web/docs/security-black-box-report.md`
- Modify: this plan checklist as each release completes

**Acceptance Criteria:**
- The imported local display subset is no more than 250 KiB and the original 4.79 MiB font is absent from production route requests.
- Simulated-mobile `/zh-Hant` Lighthouse has no regression in accessibility, best practices, or SEO; target Performance is at least 90 and LCP at most 2.5 seconds. Any environmental miss is reported with measured cause rather than hidden.
- Home server rendering performs one `/home?locale=...` content request; weekly remains one separate latest-bulletin request.
- Normal mobile web and iPhone standalone PWA both retain reachable navigation, safe-area spacing, keyboard focus, and reduced-motion behavior.
- Footer notification controls use shared UI and 44px targets.
- Publishing one bulletin with notification enabled creates one campaign only after publication completes; retries and later locale publication do not create another campaign.
- Account/admin are noindex; unknown/private/API routes remain closed; no secret, stack trace, internal hostname, Dapr token, Blob URL, or provider response body is exposed.

- [ ] Confirm every repository PR CI is green before merge; use squash merge and wait for main-branch deployment.
- [ ] Deploy in dependency order: frontend-platform UI, hhc-web performance/PWA; engagement-api; hhc-web-api; frontend-platform generated client; admin-fe; api-gateway; account-api only if changed.
- [ ] After each deploy, verify health and preserve the last healthy ACA revision until the next dependency is proven.
- [ ] Re-run Lighthouse three times per locale and record the median in `performance-baseline.md`.
- [ ] Run safe header/TLS/method/route checks against `www`, `account`, and `admin`; run OWASP ZAP baseline against anonymous public/login pages only.
- [ ] Manually verify iPhone installed-PWA navigation, Web Push opt-in/off, bulletin notification click target, and locale fallback.
- [ ] Record findings, false positives, residual risks, and exact deployed commit SHAs in `security-black-box-report.md`.
- [ ] Close the plan only when all production checks pass or every accepted residual risk has an owner and explicit follow-up issue.

## Rollback Plan

- Frontend visual/performance changes: reactivate the previous ACA revision; no data rollback is required.
- Shared UI/client packages: consumers pin the last known-good package version; never overwrite an existing package version.
- Engagement idempotency migration: additive nullable columns/index remain compatible with old binaries; roll back the app revision without dropping data.
- Bulletin notification migration: additive state remains ignored by old binaries; disable notification intent in Admin or roll back hhc-web-api while publication continues normally.
- Gateway headers/routes: restore the previous immutable gateway image/revision immediately if OAuth, Next hydration, asset delivery, or public APIs fail.
- Account CSRF: preserve the current behavior unless a failing contract proves a gap; if changed, roll back the account-api revision together with any gateway dependency.

## Self-Review

- The plan covers all nine approved areas: fonts, LCP/images, public caching, iPhone PWA navigation, shared notification controls, bulletin notifications, Gateway/Account security, low-cost cleanup, and final performance/black-box verification.
- Service ownership remains unchanged. No new microservice, queue, notification provider, page builder, or runtime analytics dependency is introduced.
- Automatic bulletin notification is issue-level and exactly-once; manual resend remains an engagement campaign operation.
- Notification failure cannot alter publication state.
- The plan distinguishes automated tests, lab measurements, deployed smoke checks, and real iPhone/PWA proof.
- No task requires direct pushes to `main`, manual production image deployment, or destructive production testing.
