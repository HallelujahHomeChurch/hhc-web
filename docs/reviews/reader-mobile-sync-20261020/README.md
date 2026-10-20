# Reader follow-up to #247

## Confirmed annotation failure

`usePrivateReader.mutate()` re-bound the opening `OnlineBulletinAccess` before every durable enqueue. The background pump calls `syncPrivateReplica()`, which renews that access and persists a newer receipt. The next enqueue then calls `bindOnlinePrivate()` with the old `validatedAt`; its existing stale-receipt guard correctly rejects it. The hook treats that rejection as a blocked journal, preventing subsequent highlights and notes.

A regression test with a genuinely newer receipt fails on #247 with `offline_stale_receipt`, then passes after removing the redundant per-write bind. Initialization and synchronization still establish the authorized binding; `enqueuePrivateMutation()` still checks account epoch, access, document and revision in its IDB transaction. No stale-receipt or authorization guard was weakened.

The previous unit tests and browser preview returned the same access object from every renewal, masking this lifecycle. The preview now rotates the receipt as well.

Transient sync failures previously resumed only after an online event, reload or manual retry. The pump now retries with a 1–30 second exponential delay, preserves original mutation IDs and cancels its timer on unmount. Durable transient failures stay in the quiet sync state. Account/login failures and actual conflicts retain their existing recovery behavior. Memory-only fallback still warns about unsaved data.

## UI findings and changes

- Typography used the fixed notes/contents frame. In the 390 × 844 synthetic browser, it occupied 776px. It now uses content height (about 301px in that same easy-mode case), leaving the article visible while adjusting type.
- The shared reader-sheet icon rule removed borders and forced typography controls to 44px width. Typography now uses secondary buttons with explicit full-cell width and borders; other reader icons retain their existing styling.
- Keyboard screenshots show exposed article content below search and notes. The sheet previously combined a visual-viewport height with a separately calculated fixed-position bottom inset. It now uses one visual-viewport overlay frame with an absolutely positioned child. Search keeps an opaque layout-height surface while sizing its interactive area to the visual viewport. This is a targeted layout correction; the precise native iOS animation/panning behavior has not been reproduced on hardware.

## Evidence and acceptance boundaries

- Regression before fix: newer-receipt test fails with `offline_stale_receipt`.
- Targeted coverage: consecutive highlights followed by a new note after receipt renewal; automatic immutable-ID replay for durable and memory queues; scheduled-retry cancellation; viewport resize/offset positioning.
- Synthetic Chromium DOM measurements: typography frame 390 × 300.59, four bordered controls about 165px wide; increasing type updates the visible article to 20px while its first paragraph remains above the card. At visual height 400 and offset 20, notes overlay spans y=20–420 and sheet spans y=68–420; search controls span y=32–408 and its opaque surface extends beyond the visible area.
- Screenshot capture timed out twice, including a raw capture. DOM geometry and semantic interactions are evidence, not visual or native keyboard acceptance.
- iPhone Chrome/Safari/PWA keyboard, IME composition, safe-area transitions and real-account cross-device acceptance remain outstanding. No production private data was mutated and no user screenshots are included in the repository.

Local/CI results are recorded in the follow-up PR. No merge or release is part of this change's authorization.
