# Weekly reader: native text-range annotations

Approved direction: user requested a new plan and implementation on 2026-10-03 after reviewing the Goodnotes-style proposal. Implement inline in the existing unmerged isolated worktrees. Stop before merge; do not publish or enable the production reader gate.

## Product contract

- Replace click-to-toggle whole sentences with native continuous text selection. Mouse drag and keyboard selection on desktop; OS long-press and handles on touch. A full sentence remains selectable, but no separate sentence mode or disconnected multi-selection.
- Desktop tools anchor near the selection; touch tools dock above the safe area. Same actions, order and semantics: yellow/red/blue as one group, clear, copy, note. Preserve site tokens, legal fonts, five UI locales and independent bulletin language.
- Support partial text, consecutive sentences and paragraphs within the mounted paper page, or the mobile reading flow. No automatic page-turn selection, handwriting, custom handles, magnifier or lasso.
- Capture stable anchors before toolbar focus or note input collapses the DOM selection. An outside tap/click and Escape dismiss transient selection, not saved data. Toolbar events must not dismiss their own selection. Native drag/handles must not trigger page swipe.
- Apply replaces color only in the selected range. Clear removes only intersecting highlighting, not notes. Copy uses selected text and existing attribution. Successful actions exit selection; failures preserve retry context. Pending writes reuse their original mutation IDs.
- Notes retain the exact quote/range; opening notes does not require a highlight. Do not silently discard dirty notes when closing, changing page, rotating, revalidating or logging in. Preserve account/revision-bound recovery and conflict resolution.
- Saved highlights remain visible after dismissal/reload. Tap an existing marked range to manage it; notes remain reachable through markers and the notes list.

## Data and safety

- Canonical anchor: `{sentenceId, start, end}`, half-open Unicode scalar offsets, not DOM UTF-16 or pixel coordinates. Range selection includes at most 500 unique sentence anchors in semantic order. Validate DOM fragments against canonical text; reject foreign, hidden/inert, out-of-bounds, surrogate-split and discontinuous selections rather than guessing.
- Retain stable sentence IDs. Add optional ranges to existing highlight/clear/note payloads. Missing ranges retain legacy whole-sentence behavior; explicitly empty ranges are invalid. Preserve old private data.
- Retain one highlight row per sentence, with additive bounded JSON segments `{start,end,color}`. Absent segments mean legacy full sentence; populated segments are authoritative. Normalize adjacent equal colors; never expand a partial highlight silently.
- Notes gain optional range anchors with original per-anchor quotes. Preserve ranges only through verified identical text/unique exact mappings; otherwise retain quote/text as inactive/reanchor-required. Unconfirmed range writes must not be blindly rebased by sentence-only offline mapping.
- Extend canonical OpenAPI, generated client, Go domain, persistence/migrations, private export and offline/recovery together. Existing entitlement, subject fence, no-store, logout cleanup and PDF publication remain unchanged.

## Acceptance

- Baseline: old preview intentionally returns `local_fixture_read_only` / 503 for writes; it is not an interaction acceptance environment. Outside dismissal is missing from current UI.
- Test both rejected and acknowledged actions, offline durable enqueue, partial overlap/clear, emoji/CJK/nested typography, paper fragments, focus transfer, note draft protection and revision mismatch.
- A clearly labelled local fixture may simulate writes only in memory and only on loopback, reusing mutation logic. It must not claim membership/cloud/offline/release acceptance. Real API persistence has separate integration tests.
- Test desktop, mobile layout and tablet pointer/touch. Real iPhone Safari, Android Chrome and installed PWA must be reported separately from emulation; lack of physical hardware remains an explicit acceptance gate.
- Preserve prior source-page/content equality, cover ending at weekly verse, watermark readability and member access. Existing desktop shadow/margin and mobile ebook refinements stay in the final layout task, not mixed into range algorithms.
