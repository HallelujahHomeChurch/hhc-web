# HHC Web Handled Error Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture swallowed HHC Web operational failures in privacy-safe Sentry events and prevent repeated access-token requests during a server Retry-After window.

**Architecture:** Replace the client-only React SDK with the matching Next.js SDK while preserving the existing sanitizer and source-map pipeline. Route caught failures through one small helper, exclude expected control flow, and keep access tokens in document memory with a document-local 429 cooldown.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@sentry/nextjs` 10.69.0, Vitest

**Spec:** `docs/superpowers/specs/2026-09-15-hhc-web-handled-error-observability-design.md`

## Global Constraints

- Do not persist or broadcast bearer tokens.
- Do not raise Account API rate limits or add automatic retries.
- Do not add Sentry Session Replay or server performance tracing.
- Do not send user identity, credentials, request bodies, or URL query/fragment data.
- Do not duplicate CSP reports into Sentry.
- Keep the existing release and source-map upload workflow.

---

### Task 1: Next.js Sentry Runtime And Shared Capture Helper

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/instrumentation-client.ts`
- Create: `src/instrumentation.ts`
- Create: `src/sentry.server.config.ts`
- Create: `src/app/global-error.tsx`
- Create: `src/app/global-error.test.tsx`
- Modify: `src/lib/observability.ts`
- Modify: `src/lib/observability.test.ts`

**Interfaces:**
- Consumes: existing `sanitizeSentryEvent` and `sanitizeBreadcrumb` privacy hooks.
- Produces: `captureHandledError(error, {operation, level, tags})` for client and server catch sites.

- [ ] **Step 1: Write failing helper and global-boundary tests**

Mock `@sentry/nextjs`, call `captureHandledError(new Error('failed'), {operation: 'weekly.archive', tags: {status: 503}})`, and assert one isolated capture with only bounded scalar context. Render the global error boundary and assert it captures the supplied error.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `corepack pnpm vitest run src/lib/observability.test.ts src/app/global-error.test.tsx`

Expected: FAIL because the helper, Next.js SDK dependency, and boundary do not exist.

- [ ] **Step 3: Implement the minimal runtime integration**

Replace `@sentry/react` with `@sentry/nextjs` at `10.69.0`. Initialize browser Sentry with the existing options, initialize server Sentry with `tracesSampleRate: 0`, export `onRequestError = Sentry.captureRequestError`, and add a minimal global error boundary which captures once in an effect.

- [ ] **Step 4: Implement the shared capture helper**

Add the exact interface from the design. Use `Sentry.withScope`, `scope.setLevel`, `scope.setTag('operation', operation)`, and scalar tag filtering before `Sentry.captureException(error instanceof Error ? error : new Error(String(error)))`.

- [ ] **Step 5: Run focused tests**

Run: `corepack pnpm vitest run src/lib/observability.test.ts src/app/global-error.test.tsx`

Expected: PASS.

### Task 2: Client Handled-Failure Coverage

**Files:**
- Modify: `src/components/home/WeeklyCard.tsx`
- Modify: `src/components/literature-ministry/WeeklyArchive.tsx`
- Modify: `src/components/ui/DownloadButton.tsx`
- Modify: `src/components/layout/AccountControl.tsx`
- Modify: `src/components/layout/WebOAuthCallback.tsx`
- Modify: `src/components/layout/WebPushControl.tsx`
- Modify: `src/components/statements/StatementProvider.tsx`
- Modify: `src/components/newsletter/UnsubscribePanel.tsx`
- Modify: their existing colocated tests

**Interfaces:**
- Consumes: `captureHandledError` from Task 1.
- Produces: one privacy-safe Sentry event for each user-visible client failure, excluding aborts and expected user decisions.

- [ ] **Step 1: Add failing assertions to representative component tests**

Mock `captureHandledError` and assert operation tags for weekly archive, Account bulletin access, OAuth exchange, bulletin download, Web Push setup, active statement fetch, and unsubscribe network/5xx failures. Assert abort, notification denial, OAuth `login_required`, and unsubscribe 400 do not capture.

- [ ] **Step 2: Run focused component tests and verify failure**

Run: `corepack pnpm vitest run src/components/home/WeeklyCard.test.tsx src/components/literature-ministry/WeeklyArchive.test.tsx src/components/ui/DownloadButton.test.tsx src/components/layout/AccountControl.test.tsx src/components/layout/WebOAuthCallback.test.tsx src/components/layout/WebPushControl.test.tsx src/components/statements/StatementProvider.test.tsx src/components/newsletter/UnsubscribePanel.test.tsx`

Expected: FAIL on missing captures.

- [ ] **Step 3: Add captures at the existing catch boundaries**

Preserve every current UI state transition. Pass only operation, status/code where the typed error exposes them, locale, member mode, and retry attempt. Never attach callback URLs, OAuth values, access tokens, push subscriptions, or download URLs.

- [ ] **Step 4: Run focused component tests**

Run the command from Step 2.

Expected: PASS.

### Task 3: Server Fallback Coverage

**Files:**
- Modify: `src/app/[locale]/about/page.tsx`
- Modify: `src/app/[locale]/news/[slug]/page.tsx`
- Modify: `src/app/[locale]/news/page.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `src/features/home/api.ts`
- Modify: `src/features/locations/api.ts`
- Modify: `src/features/pages/api.ts`
- Modify: `src/features/site-layout/api.ts`
- Modify: `src/features/weekly/access.ts`
- Modify: relevant existing page/feature tests

**Interfaces:**
- Consumes: `captureHandledError` from Task 1.
- Produces: warning-level evidence for hidden server fallbacks and error-level evidence for user-visible server degradation.

- [ ] **Step 1: Add failing assertions for representative fallbacks**

Mock `captureHandledError`; assert home content, location, CMS migration, site-layout terminal fallback, news page, timeline, sitemap news, and bulletin-access fail-closed paths capture. Assert PageNotFound and expected availability omission remain excluded where they intentionally control routing/indexing.

- [ ] **Step 2: Run focused server/page tests and verify failure**

Run the smallest existing page and feature test files covering those paths with `corepack pnpm vitest run`.

Expected: FAIL on missing captures.

- [ ] **Step 3: Add captures without changing fallback results**

Capture immediately before returning each existing fallback. Use operation and locale only; preserve existing `notFound`, fallback content, empty collection, and sitemap behavior.

- [ ] **Step 4: Run focused server/page tests**

Run the command selected in Step 2.

Expected: PASS.

### Task 4: Access-Token Retry-After Cooldown

**Files:**
- Modify: `src/lib/browser-bootstrap.ts`
- Modify: `src/lib/browser-bootstrap.test.ts`

**Interfaces:**
- Consumes: `AccountSessionError` and the token endpoint `Retry-After` response header.
- Produces: unchanged `AccountSessionClient` behavior plus document-local suppression of access-token mint requests until the server deadline.

- [ ] **Step 1: Write the failing cooldown test**

Return a 429 access-token response with `Retry-After: 60`, call `issueAccessToken` twice, and assert the second call rejects with status 429 without a second CSRF/token network pair. Advance time beyond 60 seconds and assert issuance resumes.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `corepack pnpm vitest run src/lib/browser-bootstrap.test.ts`

Expected: FAIL because the second call currently reaches the network.

- [ ] **Step 3: Implement response-aware document cooldown**

Wrap only the existing account-client fetcher. Parse delta-seconds or HTTP-date `Retry-After` when `/session/access-token` returns 429, store the deadline in module memory, and locally reject early calls with `new AccountSessionError(429, 'RATE_LIMITED')`. Clear the deadline on successful issuance and account-session reset.

- [ ] **Step 4: Run the focused test**

Run: `corepack pnpm vitest run src/lib/browser-bootstrap.test.ts`

Expected: PASS with existing cache/concurrency tests unchanged.

### Task 5: Repository Verification

**Files:**
- Modify only files required by failures discovered in verification.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: a reviewable branch with production build evidence.

- [ ] **Step 1: Run the complete test suite**

Run: `corepack pnpm test:run`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `corepack pnpm lint`

Expected: PASS.

- [ ] **Step 3: Run the production build**

Run: `corepack pnpm build`

Expected: PASS with client and server Sentry initialization compiled.

- [ ] **Step 4: Review the diff and privacy boundary**

Run: `git diff --check` and search changed code for email, token, OAuth state/code/verifier, Authorization, cookie, request body, full URL, query, and push-subscription context passed to Sentry.

Expected: no whitespace errors and no sensitive Sentry context.

- [ ] **Step 5: Commit the verified implementation**

Run: `git add <reviewed files> && git commit -m "fix: report handled web failures"`.
