# HHC Download, Account, and Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve weekly-download feedback and Account device navigation, lock OAuth MFA behavior with a regression test, and add an opt-in Web Push channel without adding a third-party notification platform.

**Architecture:** UI fixes remain in their owning frontend repositories. OAuth continues to be owned by `account-api`; social sign-in bypasses password MFA by design. Web Push is a separate delivery channel owned by `notification-api`, while authenticated subscription management is exposed through `account-api`; the public website does not gain a second authentication SDK.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Go, PostgreSQL, Azure Service Bus, Web Push/VAPID.

## Global Constraints

- Keep the three locale download controls on one mobile row and hide unavailable versions.
- Download controls keep their dimensions, disable duplicate activation, and show only a spinner while preparing.
- MFA applies only to email/password authentication, not Google, Microsoft, or LINE OAuth.
- Reuse the shared `AccountMenu`; do not add a second menu implementation.
- Web Push permission is requested only after an explicit user action.
- Keep the existing notification outbox and queue until measured volume or SLOs require a separate queue.
- Google One Tap/FedCM is intentionally excluded.

---

### Task 1: Weekly download controls

**Files:**
- Modify: `src/components/ui/DownloadButton.tsx`
- Modify: `src/components/ui/DownloadButton.test.tsx`
- Modify: `src/components/literature-ministry/WeeklyArchive.tsx`
- Modify: `src/components/literature-ministry/WeeklyArchive.test.tsx`

**Interfaces:**
- Consumes: existing `DownloadButton` `href`, `label`, `className`, and `variant` props.
- Produces: a fixed-width busy state with `aria-busy`, duplicate-click prevention, and a three-column mobile version layout.

- [ ] Add failing component tests for an unchanged accessible label, busy/disabled state, duplicate-click prevention, and the mobile version-grid class.
- [ ] Run the focused Vitest files and confirm they fail for the missing behavior.
- [ ] Replace the pending copy swap with a spinner overlay while preserving the visible label's layout box.
- [ ] Replace the wrapping version container with a three-column grid below 860px.
- [ ] Run focused tests, then the hhc-web test, lint, and build commands.
- [ ] Commit and open a pull request.

### Task 2: OAuth MFA contract

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/account/account-api/internal/services/auth_service_test.go`

**Interfaces:**
- Consumes: `AuthService.processOAuthUser` and the existing OAuth test repository/token helpers.
- Produces: a regression test proving an MFA-enabled linked OAuth user receives a token pair without an MFA challenge.

- [ ] Add a failing or contract-locking test with an MFA-enabled linked user and an MFA service that fails if consulted.
- [ ] Run the focused Go test and verify the OAuth path succeeds without consulting MFA.
- [ ] Make no production change unless the test exposes a regression.
- [ ] Run `go test ./...`, commit, and open a pull request.

### Task 3: Account device activity and public-site navigation

**Files:**
- Modify: `/Users/rayselfs/Projects/hhc/account/account-fe/src/pages/DevicesPage.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-fe/src/pages/DevicesPage.test.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-fe/src/App.tsx`
- Modify: `/Users/rayselfs/Projects/hhc/account/account-fe/src/index.css`
- Modify: locale message files under `/Users/rayselfs/Projects/hhc/account/account-fe/src/i18n`

**Interfaces:**
- Consumes: existing `Device` API fields and shared `AccountMenu.manageAccountHref` action slot.
- Produces: grouped signed-in/recent device rows and a localized `教會網站` menu action pointing to the current-locale public site.

- [ ] Add failing tests for signed-in/recent grouping, current-device ordering, and the public-site menu link.
- [ ] Run focused Vitest tests and confirm the new assertions fail.
- [ ] Render one outer card with divided rows, clearer metadata hierarchy, and responsive actions without nested cards.
- [ ] Pass the localized public-site label and locale URL through the existing shared AccountMenu action slot.
- [ ] Run focused tests, then account-fe test, lint, and build commands.
- [ ] Commit and open a pull request.

### Task 4: Web Push backend channel

**Files:**
- Create or modify only the existing notification subscription, provider, migration, worker, and OpenAPI modules after inventorying current boundaries.
- Modify the existing account-api notification client and authenticated route modules.

**Interfaces:**
- Produces: register/unregister subscription endpoints, VAPID delivery, automatic revocation on HTTP 404/410, and retryable handling for 429/5xx.
- Account-api exposes authenticated user endpoints and forwards only the current user identifier and validated subscription payload.

- [ ] Add notification-api contract/store tests for subscription upsert, revoke, and user isolation.
- [ ] Add provider tests for success, permanent endpoint removal, and retryable responses.
- [ ] Add the minimal PostgreSQL migration and VAPID provider using the existing encryption and outbox patterns.
- [ ] Add account-api proxy tests and authenticated routes without exposing notification-api publicly.
- [ ] Run both Go test suites and document required VAPID environment variables.
- [ ] Commit and open separate pull requests per repository.

### Task 5: Account Web Push opt-in

**Files:**
- Modify the existing account-fe security/settings page and API client.
- Add the smallest service worker and manifest files supported by the current Vite build.

**Interfaces:**
- Consumes: Task 4 authenticated subscription endpoints and public VAPID key.
- Produces: explicit enable/disable controls, browser capability status, and service-worker notification display/click behavior.

- [ ] Add failing UI tests proving no permission request occurs on page load and that enabling is explicit.
- [ ] Add service-worker registration and Push API subscription conversion using browser-native APIs.
- [ ] Add localized unsupported/iOS Home Screen guidance and disable controls when unavailable.
- [ ] Run account-fe tests, lint, and build; perform a manual installed-PWA check on iOS separately.
- [ ] Commit and open a pull request.

## Self-Review

- Tasks 1-3 cover all approved immediate UI and authentication changes.
- Tasks 4-5 are isolated because they add persistence, secrets, and deployment requirements.
- Google One Tap is intentionally not implemented.
- No new frontend component library, notification SaaS, queue, or authentication SDK is introduced.
