# Complete-line follow-up to #252

Before deploying #252, an additional check found the quote's 25% height could leave less than one line of content after its padding. Its scrollport was only about 36.5px high at a 336px visual height, while one padded line needed 53.2px. The #252 release was cancelled before deployment; the healthy production revision stayed unchanged.

Keep a 3rem quote minimum and use 0.5rem vertical padding. This allows one full line (45.2px including padding/borders), while longer quotes still scroll and the textarea retains its own full-line minimum. This follow-up changes one CSS declaration; all editor logic and tests from #252 remain unchanged.

Ego's screenshot capture timed out. An alternate Chrome browser preview successfully captured `336px.png` using only synthetic fixture data. `geometry.json` checks both quote and input line height including padding/borders, inset focus outline, padded field bounds, fixed footer/counter, and focus/text retention at 844/400/336/300/260/336px heights and 390px width. The initial multi-resize pass read a stale frame and was rejected; final measurements wait for the house modal's viewport style update before reading geometry.

At 336px, quote, label, input, counter and buttons are visible. At 260px, context scrolls while the whole input and action row remain visible. Saving the edited anchored fixture note closes the editor and shows the exact text in the notes list.

This is desktop Chromium geometry/visual evidence, not native iPhone Chrome/WebKit keyboard acceptance. No production private data or user screenshot is committed.
