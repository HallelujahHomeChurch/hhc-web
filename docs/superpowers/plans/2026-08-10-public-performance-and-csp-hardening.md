# Public Performance And CSP Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce public-page transfer and paint time, then add a measurable CSP without weakening script protection or breaking Next.js hydration.

**Architecture:** Keep CMS fetching and account state boundaries unchanged. Optimize images through `next/image`, stop preloading every locale body font, restore 60-second ISR, and enforce static budgets. Deliver a cache-compatible CSP in Report-Only mode; do not add a root-layout nonce because it would force every document request into dynamic rendering.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Vitest, next/image, Nginx.

## Global Constraints

- Report-Only may temporarily allow Next's inline bootstrap; production enforcement requires a separate rendering-boundary decision.
- Do not move account, engagement, asset, or CMS ownership into the frontend.
- Keep YouTube thumbnails working from `https://i.ytimg.com`.
- Keep light/dark theme bootstrap before first paint.
- Production enforcement is a separate promotion after Report-Only evidence is clean.

---

### Task 1: Responsive public images and font loading

**Files:**
- Modify: `next.config.ts`
- Modify: `src/app/fonts.ts`
- Modify: `src/components/home/NewsSection.tsx`
- Modify: `src/components/home/VideoSection.tsx`
- Test: `src/components/home/NewsSection.test.tsx`
- Test: `src/components/home/VideoSection.test.tsx`
- Modify: `scripts/check-static-budgets.mjs`
- Test: `scripts/check-static-budgets.node-test.mjs`

- [x] Add failing component tests requiring responsive image markup and no inline background URL.
- [x] Add a failing static-budget test that rejects eager locale body-font preloads.
- [x] Configure only the required remote image origins and qualities.
- [x] Replace list-card CSS backgrounds with responsive `next/image` output.
- [x] Disable eager preload for locale body fonts and use `swap` for readable first paint.
- [x] Run focused tests and static budgets.

### Task 2: CSP policy and Report-Only delivery

**Files:**
- Create: `src/lib/csp.ts`
- Test: `src/lib/csp.test.ts`
- Modify: `next.config.ts`
- Create: `src/app/csp-report/route.ts`
- Test: `src/app/csp-report/route.test.ts`
- Modify: `account/api-gateway/nginx.conf`
- Modify: `account/api-gateway/conf.d/default.conf`

- [x] Add failing tests for default, script, style, image, connection, worker, object, base, form, and frame directives.
- [x] Allow only the origins used by current public images and same-origin APIs.
- [x] Send the policy as `Content-Security-Policy-Report-Only` without per-request nonce generation.
- [x] Accept only bounded CSP reports and sanitize logged URLs.
- [x] Route only `POST /csp-report` through the gateway with a 16 KiB body limit and dedicated rate limit.
- [x] Run a local production browser check and capture CSP violations.

### Task 3: Cache and payload restoration

**Files:**
- Modify: `src/app/[locale]/page.tsx`
- Modify: `src/app/[locale]/about/page.tsx`
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/lib/root-locale.ts`
- Test: `src/lib/root-locale.test.ts`

- [x] Replace forced dynamic rendering with 60-second ISR where the route does not depend on request state.
- [x] Redirect the bare domain on the server instead of waiting for hydration.
- [x] Send only the `site` translation namespace to client components.
- [x] Use variable body fonts and keep display fonts non-blocking.
- [x] Add a 400 KiB generated CSS budget after production build.

### Task 4: Verification and delivery

**Files:**
- Modify: `docs/performance-baseline.md`
- Modify: `docs/security-black-box-report.md`

- [x] Run unit tests, lint, static budgets, and production build.
- [x] Compare build output and local response headers against the baseline.
- [ ] Run production Lighthouse checks for all three locales after deployment.
- [x] Record exact gains, unresolved violations, and whether CSP remains Report-Only.
- [ ] Commit, push, open a PR, and wait for required CI checks.
