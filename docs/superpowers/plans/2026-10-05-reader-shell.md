# Reader shell implementation plan

> For agentic workers: use superpowers:executing-plans. User approved the in-chat design and explicitly requested implementation; continue in the existing isolated worktree, without merge or release.

**Goal:** Full-viewport reader with stable title tabs, right-side submitted search, website-aligned mobile controls, chapter navigation and typography settings.
**Architecture:** Keep canonical document, annotations, access and offline contracts unchanged. Use existing reader components and the website's scroll/presentation rules, listening to the reader viewport rather than window. No new dependencies.
**Tech Stack:** React, TypeScript, existing shared UI, CSS, Vitest.
**Spec:** Approved conversation on 2026-10-05: search right drawer; mobile chapter arrows and pull gestures; original PDF page lookup still aligns the first visible source fragment at the reading top.

## Global constraints
- Desktop/iPad paper rendering remains unchanged; phone uses four ebook chapters.
- Mobile tools: contents, typography, theme, notes, offline. Website browser bar and iPhone standalone capsule styling.
- Search submits explicitly; preserve query/results, close and focus destination on result activation. Do not search mobile-hidden production details.
- Tabs always use titles; account-scoped session metadata is purged on logout/account changes.
- Desktop page arrows only in horizontal mode, fixed at viewport sides, solid surfaces. Mobile arrows are compact in-flow chapter boundaries.
- No production mutation, merge, or release. Real-device touch/PWA acceptance remains separate.

## Review focus
- Source page beginning inside a sentence or a hidden production block: preserve scalar offset, skip invisible fragments.
- Font changes: maintain visible text anchor; recompute highlight and note geometry.
- Mobile panel/keyboard/selection: lock chrome visible and prevent gesture conflicts.
- Programmatic page/search navigation: do not trigger scroll-hide lifecycle.
- Long titles and narrow screens: tabs scroll independently of fixed home/search controls.

## Tasks
- [x] 1. Search and tabs: failing tests for submit-only list, result navigation, hidden mobile details, stable saved titles and account cleanup; implement and run targeted tests.
- [x] 2. Phone controls: test bounded/persisted type preferences and shared scroll behavior; implement settings, website-aligned bottom tools, panel locking and full-viewport shell.
- [x] 3. Navigation: test mobile chapter boundaries and original fragment alignment with hidden credits; implement in-flow arrows and horizontal-only desktop arrows.
- [x] 4. Verify: full tests, lint, build; desktop/mobile demo DOM/geometry and interaction smoke. Preserve unmerged worktree.

## Verification (2026-10-05)
- All 675 tests across 118 files passed; production build passed. ESLint has no errors and one existing LegalRequiredNavigation warning. `git diff --check` passed.
- Review fixes: transparent mobile chrome wrapper prevents a residual header strip; expanded tabbar remains opaque; keyboard focus can reveal hidden chrome; desktop search transfers focus to its destination.
- Browser DOM/geometry checks confirmed search submission/result navigation, persisted typography, opaque expanded header, hidden header bottom at zero with content receiving hit tests, and upward-scroll restoration.
- Screenshot capture was unavailable; visual and physical iOS/Android/PWA gesture acceptance remain pending. No merge or release.
