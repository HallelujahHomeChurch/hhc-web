# Reader layout stability implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute the already approved four-point refinement inline, then one independent branch review.

**Goal:** Unify exit wording and loading chrome; eliminate mobile note-row churn and asymmetric chapter-edge spacing.

**Architecture:** Reuse AlertDialog and ReaderLoading. Reconcile mobile note hosts in place before paint; keep mobile chapter layout independent of desktop PDF geometry. Scope spacing changes to mobile ebook chapter edges.

**Tech Stack:** React 19, Next 16, existing HHC UI, Vitest, reader-scoped CSS.

**Spec:** User-approved four-point analysis immediately preceding this request.

## Global Constraints

- Every exit confirmation uses existing localized exitConfirm (Traditional Chinese: 離開); preserve destinations and unsaved-note protection.
- Loading always retains a header silhouette; never expose member content or enable actions during authorization validation.
- Existing notes, exact annotation ranges, source-page progress, font roles and desktop paper geometry remain unchanged.
- Chapter arrows remain ghost controls in independent compact rows, with 44px touch targets. Reserve toolbar/safe-area occlusion once.
- No dependencies, service contracts, bulletin data or infrastructure changes.

## Review Focus

- Progress responses may replace notes with equivalent arrays: retain existing note rows and buttons.
- Note deletion, chapter changes and switching to desktop must remove obsolete hosts.
- A pending exit dialog must remain operable during authorization validation.
- Font loading and offline cold launch must use the same visual loading boundary without leaking content.
- Browser/PWA safe areas and hidden chrome must not cover arrows; desktop remains unchanged.

### Task 1: Stable notes and shared exit wording

**Files:** NoteIndicators.tsx/test.tsx, WeeklyReader.tsx/test.tsx, useReaderExitGuard.ts/test.tsx, five locale JSON files.

**Interfaces:** Consumes existing notes, root and layoutKey; produces stable mobile host identity without changing annotation payloads.

- [ ] Write regressions for equivalent note arrays, geometry-only updates, deletion and immediate visible note targets; test Home and Back use exitConfirm.
- [ ] Run targeted Vitest; expect identity/wording failures on baseline.
- [ ] Reconcile mobile hosts using a boundary-to-host map in a layout effect, clean on unmount/mode change; separate mobile layout keys from PDF page/scale; remove unused exitHome localization.
- [ ] Run targeted tests; expect all pass, including exact ranges and exit cancellation.
- [ ] Commit fix.

### Task 2: Consistent loading and chapter-edge spacing

**Files:** ReaderLoading.tsx/test.tsx, WeeklyReader.tsx/test.tsx, OfflineReaderShell.tsx, reader.css.

**Interfaces:** Consumes existing loading component and validated reader state; adds a content-free header to root loading while keeping all authorization guards.

- [ ] Write loading regressions for checking, document fetch, validation and font fetch; expect missing header silhouette on baseline checking/validation.
- [ ] Keep a header in root loading masks; keep font loading inside the stage. Use existing theme, icons and tab dimensions, no private title in validation mask.
- [ ] Normalize first/last ebook element margins and vertical padding; keep arrow rows centered and reserve mobile/PWA toolbar occlusion only once.
- [ ] Run whole test suite, lint, build, static budgets, release-policy test, Docker build and smoke; expect exit 0.
- [ ] Batch browser checks: desktop and mobile, loading security, note host identity, cover/body/back chapter edges, light/dark and safe-area reservations.
- [ ] Commit; independent branch review, fix blocking findings with regression tests; PR, green CI, squash merge, CI/CD release and live revision/health/reader smoke.
