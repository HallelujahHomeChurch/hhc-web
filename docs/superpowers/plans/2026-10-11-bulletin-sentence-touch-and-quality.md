# Bulletin sentence touch and conversion quality implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, with a fresh whole-branch reviewer before merge.

**Goal:** Reliable sentence-tap selection on mobile, precise existing annotations preserved, and finish the pending conversion/admin release.

**Architecture:** One shared selection hook chooses sentence taps for mobile and native text ranges for desktop/iPad. Persist existing sentence/range contracts unchanged; use the existing saved-highlights and notes panels to edit partial annotations. Publish immutable V10 renderer before consumers, then API producer; Simplified generation creates drafts only after Traditional review and native proof are ready.

**Tech Stack:** React/TypeScript, existing shared UI, Go/PostgreSQL, immutable Playwright layout renderer.

**Spec:** Approved design in this chat, 2026-10-11: mobile sentence selection, desktop precise ranges, remove obsolete mobile selection patches, complete previous quality work and release.

## Global Constraints

- No native selection on mobile bulletin text; note inputs remain editable.
- Tap toggles sentences, multi-selection uses existing ordered IDs; blank taps dismiss; scroll is never selection.
- Preserve existing partial highlight/note ranges, offline/auth/revision fences and manual publication.
- Do not modify immutable V1–V9 artifacts, automatically accept PDF comparisons, or publish bulletin contents.
- Use focused branches and green CI/CD; producer release follows consumers.

## Review Focus

- Scroll ending over text must not select; repeated selection/dismissal must remain usable.
- Non-contiguous sentence selections must use ID mutations, not the contiguous range API.
- Partial desktop highlights/notes remain exact and manageable from mobile panels.
- Overlay/reanchor forms, account revalidation and device-mode changes must not leak selection state.
- Explicit inline font sizes below the dense-cover floor must fail closed; incoming PDF and audited queue fences must remain intact.

### Task 1: Shared selection lifecycle

Files: rename `src/features/weekly-reader/useTextSelection.ts` and its test to `useReaderSelection`; modify `WeeklyReader.tsx`, `NoteReanchor.tsx`, `RangeHighlights.tsx` and reader CSS/tests.

Interfaces: `useReaderSelection(root, sentences, initial, locked, mode = 'text')`; result retains selection/setSelection/clear/clearIf/selecting. Sentence mode emits IDs without ranges; existing exact range selections remain supported.

- [x] Add failing tests for taps, multi-toggle, distant dismissal, drag suppression, native-selection exclusion and locked controls.
- [x] Implement sentence mode and delete old touchstart/touchend/native-handle coordination; retain native mouse/keyboard selection.
- [x] Wire mobile mode, custom selection paint and mobile note-reanchor; verify existing exact-range management and full-sentence mutations.
- [x] Run full web tests, lint/build and independent review; verify touch interactions through DOM and record screenshot capture limitation.

### Task 2: Finish immutable renderer and automatic Simplified drafts

Files: existing isolated `bulletin-dense-cover-v10-20261011`, `bulletin-conversion-quality-20261011`, `bulletin-review-flow-20261011` diffs.

Interfaces: V10 digest/package exports, audited conversion queue with existing source/proof fences; admin uses existing status API.

- [x] Verify reviewer regression RED; enforce 9pt effective inline floor and public V10 digest export.
- [x] Verify native dense/ordinary fixtures, full package tests and original immutable chain; review and publish package/renderer 1.0.61.
- [ ] Pin consumers, verify admin waiting/converting/ready/recovery UI, run full suites, release web/admin.
- [ ] Verify API audit/idempotency/clean-proof/review/source fences, migrations and full race suite; pin immutable renderer and platform commit, release API.

### Task 3: Release verification

- [ ] Verify exact deployed revisions and live reader/admin/API routes without adopting or publishing content.
- [ ] Record what still needs physical-device acceptance; remove only clean owned temporary worktrees after release verification.

## Execution ledger

- Native inline execution authorized by user; no additional approval pause.
- Prior web PR 203 deployed but physical mobile selection acceptance failed; replace the obsolete touch-native approach rather than add another patch.
- Existing partial annotation management reuses HighlightsPanel and NotesPanel, avoiding competing sentence/range tap targets.
