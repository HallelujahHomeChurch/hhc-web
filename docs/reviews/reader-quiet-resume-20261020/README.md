# Quiet resume and keyboard follow-up to #248

The user's new phone screenshot still showed generic pending-operation confirmation and synchronization recovery controls. They also reported repeated layout flashes and continuing iPhone Chrome keyboard rendering failures. The successful #248 release and HTTP checks did not establish these device flows.

## Synchronization

The existing recovery path deliberately required confirmation for return-only mutations. A restored non-bookmark action was inserted into a memory journal, but automatic pumping was gated on durable storage. Offline-copy initialization could also retain an already-acknowledged return action. Both states could expose manual retry even though the original immutable mutation ID can be confirmed automatically.

Resume now automatically pumps the original non-bookmark ID, retains unknown data until acknowledgement, reconciles a durable queue's completed return action, and retains return-only intent even when an offline document exists. No account/epoch/revision guard or server conflict handling is bypassed. The real recovery UI remains available for action/paused results; this change does not automatically resolve content conflicts or change bookmark's online-only contract.

A normal local write briefly populated pendingMutation before persistence; Recovery rendered its entry whenever that value existed and busy was false. Background progress could therefore insert/remove a button and change the reader's layout on every write. Pending journal activity no longer creates a recovery entry, routine sync captions are removed, and exceptional mobile feedback overlays the document rather than resizing it. Storage-failure warnings and unsaved-exit protection remain.

Tests cover automatic replay on remount, offline-copy return-only recovery, clearing an acknowledged durable return action without duplicate sending, preserving a newer editor draft during automatic replay, and observing that a normal durable write never inserts feedback text.

## Editor and keyboard

Reader sheets overrode React Aria's viewport/scroll model with a fixed frame and custom visualViewport offsets. The textarea also auto-focused before modal setup. A synthetic check further reproduced a clipped textarea even when the frame and footer were within the reduced viewport: its bottom was about 373px while its scroll area ended at 314px.

Mobile noncompact sheets now use a page-sized absolute underlay and sticky content using the house modal's existing page/visual-viewport CSS properties. This follows the installed React Aria behavior and upstream modal recipe, rather than maintaining a second keyboard-position controller. Editable sheets use available height immediately, respect safe-area padding, and enter with opacity rather than translating a focused input. Focus occurs after modal layout setup; an editor-local ResizeObserver reveals the focused textarea only when the scroll area resizes, without scrolling the window or changing focus. Textarea minimum height is bounded by the actual available body.

Primary implementation references inspected:

- Installed react-aria 3.51.0 usePreventScroll and useViewportSize; react-aria-components 1.20.0 Modal.
- https://github.com/adobe/react-spectrum/pull/8888
- https://github.com/adobe/react-spectrum/blob/main/starters/docs/src/Modal.css

## Evidence limits

`geometry.json` records synthetic Chromium checks at visual heights 260, 300, 400 and 844. Each final check requires the complete textarea to fit in its scroll area and the footer to fit within the viewport. Earlier 260px and 400px candidates clipped the field and were not accepted. Focus remains on the textarea and the draft is retained.

Browser automation experienced a stopped evaluation while emulating the iOS branch; the first UA override did not consistently override platform metadata. The retained measurements are explicitly Chromium layout tests, not native iPhone or WebKit acceptance. No iOS simulator is installed on this host. The reported iPhone Chrome rendering issue still requires device confirmation after delivery; there is no claim of native keyboard verification.

No production private reads/writes or user screenshots are included in this evidence. Full local and CI results are recorded in the PR.
