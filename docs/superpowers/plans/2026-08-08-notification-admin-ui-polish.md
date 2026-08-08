# Notification And Admin UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make campaign delivery inspection scale predictably, preserve subscriber locale, and align HHC footer, mobile Admin, Toast, and Switch interactions across products.

**Architecture:** Keep campaign delivery details server-paginated and optimize the existing PostgreSQL access path instead of introducing a second statistics store. Put reusable interaction behavior in `frontend-platform`, while each app owns product layout and localized copy. Existing authenticated and gateway boundaries remain unchanged.

**Tech Stack:** Go, PostgreSQL, React, TypeScript, React Aria Components, CSS, Vitest, Testing Library.

## Global Constraints

- Work on `codex/notification-admin-ui-polish`; never commit or push directly to `main`.
- Do not add a cursor API, statistics service, animation library, or new i18n framework.
- Campaign delivery pages remain capped at 100 rows and default to 20 rows.
- Web Push action URLs remain same-origin root-relative paths.
- Respect `prefers-reduced-motion` and existing light/dark semantic tokens.
- Each repository is independently testable and released only through its pull request CI/CD path.

---

### Task 1: Engagement Delivery Query And Locale Correctness

**Repository:** `/Users/rayselfs/Projects/hhc/engagement-api`

**Files:**
- Create: `internal/migrations/sql/009_campaign_delivery_query_indexes.sql`
- Modify: `internal/campaigns/models.go`
- Modify: `internal/campaigns/store.go`
- Modify: `internal/push/store.go`
- Test: `internal/migrations/migrations_test.go`
- Test: `internal/campaigns/store_test.go`
- Test: `internal/push/store_test.go`

**Interfaces:**
- `DeliveryPage` continues returning `items`, `page`, `perPage`, `total`, and `summary`, and adds `campaignStatus` so Admin polling needs only one request.
- Existing `POST /api/engagement/v1/push/subscriptions` remains the only locale refresh contract: registering the same installation is an idempotent upsert that refreshes locale and subscription payload.
- The delivery query orders by `updated_at DESC, recipient_id` for deterministic pagination.

- [ ] Write failing migration tests asserting indexes for `(campaign_id, updated_at DESC, recipient_id)` and `(campaign_id, status)`.
- [ ] Run the migration tests and verify they fail because the indexes are absent.
- [ ] Add migration 009; embedded migrations are discovered in filename order and require no registry edit.
- [ ] Write failing store tests for deterministic delivery ordering, campaign status in `DeliveryPage`, and idempotent active subscription locale refresh.
- [ ] Run focused store tests and verify the intended failures.
- [ ] Implement deterministic delivery ordering and return campaign status from the existing campaign lookup.
- [ ] Confirm the existing registration upsert refreshes locale without creating a second row or exposing user IDs.
- [ ] Run `go test ./internal/migrations ./internal/campaigns ./internal/push`.
- [ ] Run `go test ./...`.
- [ ] Commit `perf: optimize campaign delivery queries`.

### Task 2: Public Footer Grouping And Push Locale Refresh

**Repository:** `/Users/rayselfs/Projects/hhc/hhc-web`

**Files:**
- Modify: `src/components/layout/SiteFooter.tsx`
- Modify: `src/components/layout/WebPushControl.tsx`
- Test: matching component tests under `src/components/layout`
- Modify: this plan checklist as work completes

**Interfaces:**
- Footer renders `footer-preference-controls` and `footer-social-controls` as separate semantic groups.
- Both groups use 12px internal spacing; mobile uses a full-width row with preferences left and social links right.
- An existing active browser subscription refreshes its stored locale idempotently after initialization and whenever `locale` changes.

- [ ] Write failing footer tests that distinguish the two groups and assert mobile alignment classes.
- [ ] Write a failing Web Push test proving an existing subscription refreshes locale without recreating the PushSubscription.
- [ ] Run focused tests and verify the failures.
- [ ] Implement nested footer groups and remove the flat `contents` social wrapper.
- [ ] Add locale refresh after existing subscription detection, retrying only through the existing error boundary.
- [ ] Run focused component tests, lint, and build.
- [ ] Commit `fix: group footer controls and sync push locale`.

### Task 3: Shared Toast, Switch, And Table Primitives

**Repository:** `/Users/rayselfs/Projects/hhc/frontend-platform`

**Files:**
- Modify: `packages/ui/src/data.tsx`
- Modify: `packages/ui/src/controls.tsx`
- Modify: `packages/ui/src/styles.css`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/src/primitives.stories.tsx`
- Test: relevant package UI tests

**Interfaces:**
- `Switch` accepts `isSelected`, `onChange`, `isDisabled`, `label`, and optional description/className while delegating semantics to React Aria.
- Toast notices support entering, visible, and exiting states; dismissal waits for the 150ms exit transition.
- Toast queue shows at most three notices, pauses timeout during pointer hover or keyboard focus, and uses semantic icons.
- `DataTableFrame` provides a mobile horizontal-scroll affordance without forcing cell wrapping policy.

- [ ] Write failing Switch keyboard, disabled, and change tests.
- [ ] Write failing Toast queue, timed exit, pause, and manual dismissal tests with fake timers.
- [ ] Write failing structural test for the table scroll affordance.
- [ ] Run focused tests and verify the failures.
- [ ] Implement the React Aria Switch without adding dependencies.
- [ ] Implement Toast lifecycle, semantic Lucide icons, queue limit, and hover/focus pause.
- [ ] Add 200ms enter, 150ms exit, Switch thumb transition, and reduced-motion overrides.
- [ ] Add mobile table edge affordance while preserving the existing sticky table header.
- [ ] Update Storybook states for light/dark, enabled/disabled/saving, and all Toast tones.
- [ ] Run package tests, lint, and build.
- [ ] Commit `feat: refine shared feedback controls`.

### Task 4: Admin Mobile Tables And Contextual Editor Header

**Repository:** `/Users/rayselfs/Projects/hhc/account/admin-fe`

**Files:**
- Modify: `src/components/AppLayout.tsx`
- Create or modify: a route metadata helper under `src/lib`
- Modify: `src/index.css`
- Modify: list tables under `src/pages`
- Modify: editor headers under `src/pages`
- Test: `src/App.test.tsx` and focused component tests

**Interfaces:**
- Mobile list routes retain the HHC brand.
- Mobile create/edit/detail routes replace the brand label with a localized concise contextual title.
- Editor content exposes one action row: Back on the left, primary action on the right, overflow for lower-frequency actions when needed.
- Table columns use `data-column-kind="meta|primary|action"`; meta/action do not wrap, primary columns truncate at a stable minimum width.

- [ ] Write failing route metadata tests for list, create, edit, and detail paths.
- [ ] Write failing rendering tests proving mobile contextual title replaces only the brand text on editor routes.
- [ ] Write failing table structure tests for meta, primary, and action columns.
- [ ] Run focused tests and verify the failures.
- [ ] Implement route metadata and contextual mobile app header without changing desktop branding.
- [ ] Rework editor header CSS into one compact Back/actions row below the 60px app header; remove the current multi-row mobile grid override.
- [ ] Apply column semantics to campaign, schedule, content, user, access, OAuth, and bulletin tables.
- [ ] Set table-specific minimum widths and single-line ellipsis for primary cells; retain horizontal scrolling and sticky headers.
- [ ] Verify 375px, 768px, and desktop layouts with screenshots.
- [ ] Run tests, lint, and build.
- [ ] Commit `feat: improve admin mobile workspaces`.

### Task 5: Account Newsletter Switch Integration

**Repository:** `/Users/rayselfs/Projects/hhc/account/account-fe`

**Files:**
- Modify: notification preference page/component under `src`
- Remove: obsolete local Switch CSS from `src/index.css` or its owning stylesheet
- Test: matching profile notification tests

**Interfaces:**
- Newsletter preference uses shared `Switch`.
- The UI updates optimistically, remains disabled while saving, rolls back on failure, and displays localized success/error Toast feedback.

- [ ] Write failing tests for optimistic selection, saving lockout, success Toast, and failed-request rollback.
- [ ] Run focused tests and verify the failures.
- [ ] Replace the hand-written checkbox switch with the shared Switch.
- [ ] Implement optimistic state and rollback without changing the account API contract.
- [ ] Remove superseded local switch styles.
- [ ] Run tests, lint, and build.
- [ ] Commit `feat: refine notification preferences`.

### Task 6: Cross-Repository Verification And Delivery

- [ ] Review every diff against this plan and remove unrelated changes.
- [ ] Run `go test ./...` in `engagement-api`.
- [ ] Run test, lint, and build commands in `frontend-platform`, `hhc-web`, `admin-fe`, and `account-fe`.
- [ ] Confirm no secret, generated build output, `.superpowers`, or local runtime data is staged.
- [ ] Push each feature branch and create one focused pull request per repository.
- [ ] Wait for required CI checks; fix failures on the same branch.
- [ ] Squash merge only after all required checks pass; deployment follows each repository's main-branch workflow.
