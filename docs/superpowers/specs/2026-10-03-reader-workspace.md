# Weekly reader workspace — approved direction

## Scope

The user approved this direction in the conversation on 2026-10-03. Implement
locally in the existing `review/weekly-reader-20260930` worktree. Stop before
merge or release. Do not change bulletin content, immutable renderer assets,
membership rules, offline receipts, or annotation contracts.

## Reader shell

- Home returns to the locale's literature-ministry listing.
- First row: Home and closeable tabs for bulletins the member has opened. Tabs
  scroll horizontally on narrow screens. Do not manufacture archive tabs.
- Second row: persistent, compact tools. Do not hide supported tools behind an
  overflow menu. Page navigation, search, notes, offline access, and applicable
  presentation controls remain discoverable. Tool content may open in a panel.
- Use shared UI Button/IconButton and existing Lucide icons, theme tokens,
  visible focus states, accessible labels, and 44px touch targets.
- Retain native text selection and contextual yellow/red/blue, clear, copy,
  note actions. Do not introduce handwriting or decorative inactive controls.
- Five website locales translate controls; bulletin contentLocale is independent.

## Desktop and iPad

- Retain source-page boundaries and reconstructed text, not an embedded PDF.
- Remove fit-page/fit-width controls and the width-fit mode. Initial paper scale
  fits a complete page inside the available reader viewport.
- Vertical continuous pages is the default. Horizontal mode displays one page.
  Switching direction preserves the current source page and clears transient
  selection only after unsaved-note protection succeeds.
- Horizontal side arrows are centered at the reader's left/right edges, fade on
  hover/focus, and are absent at their respective boundaries. Touch users have
  visible toolbar page navigation as well as guarded swipe navigation.
- Zoom modifies paper only. Modifier-wheel and trackpad pinch, plus touch pinch
  on tablets, anchor at the gesture focal point. At increased scale, users can
  pan without changing pages. Tools retain their size.
- Keep text selection available: one-finger native selection must not silently
  become a page drag. Cancel swipe when more than one pointer participated, a
  selection exists, an editor is active, or content is zoomed.
- Provide accessible small zoom-in/out controls, not fit-mode controls. Start at
  a 1x fitted baseline, clamp relative zoom to 1–4x. Resize recomputes baseline
  while retaining relative zoom and current page.

## Mobile

- Retain ebook reflow and continuous document scrolling, with original-page
  mapping and page/section navigation. Do not add paper mode or horizontal mode.
- Same Home/tab/tool shell, without paper-only zoom/direction controls.
- Leave browser/native mobile pinch and scrolling untouched. Do not set a global
  viewport restriction or prevent gestures outside the desktop/tablet paper area.

## State, safety, and verification

- Tab identity includes series, contentLocale, and issue; account identity scopes
  storage. Session storage holds identifiers and local view preferences, never
  bulletin bodies, note text, access receipts, or member-only titles.
- Only the active reader mounts an authorized session. Switching tabs must pass
  existing access validation; an old tab does not confer authorization.
- Opening another bulletin in the same browser session adds a tab. Switching a
  tab navigates to its canonical URL. Close active tab selects a neighbor;
  closing the last tab returns Home. Handle denied/unavailable documents without
  trapping the member in a tab they cannot close.
- Unsaved notes can cancel Home, tab switching, active-tab closing, and mode
  changes. Flush pending reading position through the existing private-state
  mutation pipeline before a permitted navigation.
- Restore each document's position automatically. Never let an initial scroll
  observation overwrite saved progress before restoration completes.
- Paper page count/content stay unchanged. Each visible page keeps its watermark,
  and highlights/note indicators retain correct coordinates after zoom and scroll.
- Desktop/mobile browser verification is not iOS/Android real-device acceptance.
  The latter remains an explicit delivery gate, not a simulated success claim.
