# Editor clipping follow-up to #249

The latest phone screenshot shows a correctly raised sheet/footer but a focus ring clipped at the textarea's scrollport edges. This is distinct from the already resolved synchronization flicker.

The editor still reserved 9rem (144px) for the textarea even when its whole scroll body was only about 152px tall. The quote, label, gaps and counter then overflowed. The resize handler aligned the field's border to the scrollport edge, excluding padding; the focus outline extended another 5px outside that border despite only 3px of padding.

The textarea now shrinks to 3.5rem (retaining a full text line plus padding), the quote shares available space (with its own scrolling), and the focus outline is inset like the existing reader search control. The counter moves to the non-scrolling action row. Resize scrolling respects body padding. No viewport positioning or synchronization code changes.

Validation:

- The editor unit test covers padded bottom/top reveal, focus retention, observer cleanup and the counter's accessible description outside the scroll body. Existing save/error/conflict/Unicode-limit tests remain.
- `geometry.json` is synthetic Chromium evidence at 390px width, visual viewport heights 844, 400, 336, 300, 260 and back to 336. Assertions require the field including its inset focus outline to fit inside the padded body, counter/footer to remain visible, focus/text to survive, and the label to remain visible at heights >=336. At the shortest height, context may scroll while the input and action row remain available.
- A 320px fresh-page check keeps input, counter and buttons within the screen. A separate live emulation width change retained a stale house-overlay page-width value; that check timed out and is not claimed as rotation acceptance.
- Editing an existing anchored synthetic note and saving at the reduced visual height updates the fixture store and closes the editor.

`Page.captureScreenshot` timed out again. No automated visual screenshot or native iPhone Chrome/WebKit keyboard acceptance is claimed. No production private data or user screenshots are included here.
