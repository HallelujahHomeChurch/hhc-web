# Task 8 controlled passage markup

Independent Task4 reviewer confirmed Task8 has no capability API dependency, so it proceeds before gated Task7b. No package/lock changes.

The common DOM is the recovery anchors/text div, paragraph/span with sentence ID and scalar fragment bounds, mobile button/tabIndex/pressed/selected attributes. NoteReanchor and HighlightHistory roots retain tabIndex=0. RecoveryChoice has no root tabIndex. Legends, fieldset disabled policy, quotes, legacy checkbox/search selection, refs, useReaderSelection/clear, API actions and original mutation generation/retry remain caller-owned.

`selectionPassage` preserves original ranges (or creates full-sentence Unicode scalar ranges), returns original sentenceIds and catches invalid/noncontiguous quote as empty. It does not mutate input, validate permissions, clear selection, store recovery or generate IDs.

Migration sequence: first NoteReanchor (2/2 tests passed), then HighlightHistory and RecoveryChoice partial branch. Final 6 focused suites: 49/49 passed. Added controlled markup/scalar offsets/empty-invalid-contiguous helper assertions and HighlightHistory cancel/reopen/restore clear path. Existing NoteReanchor conflict Retry/reselection and Recovery original mutation behavior assertions retained.

Task4 final after independent Important correction: 45/45 focused tests passed. Source-field mismatch now preserves original pending-write lookup via document.documentId; React key on corrupt access payload may differ but does not change visible listing/availability or removal policy.

Full Web tests/build/browser and independent Task8 review remain separate pending receipts.
