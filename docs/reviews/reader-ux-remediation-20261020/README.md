# Reader UX remediation — 2026-10-20

Follow-up to PR #247 and subsequent keyboard fixes. All browser evidence uses
synthetic content in the existing `reader-professional-20261019/preview.mjs`
fixture; no private member data is included.

## Behavior coverage

| Reported behavior | Resolution / regression evidence |
| --- | --- |
| Keyboard raises the whole card and exposes the bulletin below | Keep the opaque sheet surface at layout height; size its dialog and scrolling editor to visual viewport height. Synthetic geometry below; native iPhone acceptance remains open. |
| X and Cancel disagree about selection | Mark the note form and portal overlay as selection controls; browser Cancel now preserves selection, matching X. Both paths covered by component tests. |
| Mobile TOC disclosures too close | Scope 44px minimum targets and padding into the portal sheet. Measured all three summaries at 45.59px. |
| My Notes selected category background | Primary solid slider background with on-primary text. Browser computed color matches primary #b64e45 in dark mode. |
| Repeating the active highlight color | Clear the selected range; browser fixture yellow active → click yellow → no highlights. Toolbar regression test. |
| Return to online bulletin tab | Home and last-tab closure use `literature-ministry?mode=online` while retaining leave guards. |
| Long reanchor form hides its actions | Scroll the body and keep actions in the footer. Long fixture: body client 660px / scroll 962px, footer bottom 827px in 844px viewport. |
| Sync disables bookmark navigation | Separate navigation availability from write availability; slow highlight request regression. Export keeps its existing snapshot-consistency gate. |
| Filter with no results reports no saved content | Use no-match copy for filtered notes/highlights; keep true-empty copy for empty collections. |
| Resize resets notes tab/query | Own category and search state in ReaderDocument. Browser drawer → 1200px aside preserved category and query. Restore bookmark actions to the bookmark category. |
| Notes/search jump to first page of a split sentence | Carry canonical scalar offsets through selection, search, deferred taps and page resolution. Emoji, combining characters, compatibility forms and contextual lowercasing tested. Hidden production-credit note jumps require paper-mode confirmation. |
| Recovery closes lose newly merged text | Keep per-mutation drafts in ReaderDocument; preserve across close/back/Keep reading and protect reader/tab departure. Clear only on accepted recovery action or confirmed departure. Original pending mutations remain protected. |
| Cancelled bookmark deletion leaves an editor | Clear the cancelled delete draft; navigation immediately usable without a second Cancel or dirty-close prompt. |

## Keyboard and typography evidence

At a 390 × 844 CSS pixel viewport, changing the portal's existing
`--visual-viewport-height` models the layout input used by React Aria. This is
**not** an emulated iOS keyboard, browser zoom, panning or compositor test.

| Visual height | Opaque card bottom | Editor footer bottom |
| ---: | ---: | ---: |
| 844 | 844 | 827 |
| 400 | 844 | 385 |
| 336 | 844 | 321 |
| 260 | 844 | 245 |
| 844 restored | 844 | 827 |

Before the fix, visual height 336px also moved the card bottom to 336px.
After the fix, [the screenshot](keyboard-synthetic.png) shows the complete
opaque surface with controls above the simulated keyboard boundary.
Screenshots were taken after entrance animation opacity reached 1.

[Typography](typography.png) remains compact: 300.59px high, bottom 844px;
font and line-height buttons are 48px high with 1px borders, leaving the text
preview visible above the card. Existing receipt rotation, sequential writes,
and quiet background-sync behavior are retained.

## Verification and limitations

- Full local suite before the final review corrections: 182 files / 1,499 tests passed.
- Production build, static budgets and release policy checks passed.
- TypeScript passed; lint has zero errors and three pre-existing warnings.
- Final review added guards for closed recovery drafts and restored bookmark
  category, and corrected contextual lowercasing in exact search offsets.
  Targeted regressions passed; CI validates the final complete tree.
- Independent implementation review inspected state ownership, guards, search
  offsets and CSS after the two discovery rounds.
- Physical iPhone Chrome keyboard, zoom/panning, safe-area rotation and real
  account end-to-end acceptance are not yet verified. CI and synthetic browser
  evidence must not be presented as that acceptance.
