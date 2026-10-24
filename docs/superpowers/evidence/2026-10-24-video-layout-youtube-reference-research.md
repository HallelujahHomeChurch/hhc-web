# YouTube references for the member-video layout analysis

Date: 2026-10-24
Status: Research evidence only; implementation and product decisions remain pending.

## Reference boundary

The user supplied six desktop YouTube screenshots dated 2026-10-24 and explicitly selected the native YouTube app as the mobile reference. Desktop web, mobile web, and the native app must be treated as separate surfaces. A responsive browser viewport does not verify the native app.

This research inspected first-party YouTube Help pages, the TeamYouTube visual-update announcement, and its embedded promotional images. No installed iOS or Android app was operated. No comments, reactions, account settings, production content, or infrastructure were changed. The announcement images illustrate the 2025 design; they do not establish the exact UI currently delivered to the user's app account in October 2026.

## Primary sources inspected

1. [Post and interact with comments — iPhone and iPad](https://support.google.com/youtube/answer/6000964?co=GENIE.Platform%3DiOS&hl=en), retrieved 2026-10-24.
2. [Post and interact with comments — Android phone and tablet](https://support.google.com/youtube/answer/6000964?co=GENIE.Platform%3DAndroid&hl=en), retrieved 2026-10-24.
3. [New Visual Updates for YouTube: A More Expressive and Intuitive Experience](https://support.google.com/youtube/thread/380540176?hl=en), posted by Rob — TeamYouTube, identified on the page as a Google Employee, 2025-10-14; last edited 2025-10-15. Read through the actual browser DOM because the search parser returned an empty shell.
4. [Official mobile comments illustration embedded in that announcement](https://storage.googleapis.com/support-forums-api/attachment/thread-380540176-5606961893163681394.png), directly viewed as an image.
5. [Official player illustration embedded in that announcement](https://storage.googleapis.com/support-forums-api/attachment/thread-380540176-5606961893163682235.png), directly viewed; useful to distinguish player controls from comment controls.
6. [YouTube — Apple App Store, Google developer listing](https://apps.apple.com/us/app/youtube/id544007664) and [YouTube — Google Play](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en), inspected for official product provenance. These store pages did not provide sufficient inspected evidence of the requested keyboard, selected-reaction, or information-card states.

## What the official Help pages establish

Both platform-specific pages document entering comments from the preview below the video, selecting the comment-entry control, entering text, and sending. They document Reply beneath a comment and distinguish Back to the comments section from X to the video. They also describe threaded replies, reaction icons, and a More menu for editing or deleting one's own comment. This supports a mobile comments/replies navigation hierarchy rather than assuming that the desktop inline expansion is the mobile app interaction. The pages do not specify exact geometry, persistent composer positioning, keyboard transitions, or reaction colors. [Sources 1–2](https://support.google.com/youtube/answer/6000964?co=GENIE.Platform%3DiOS&hl=en).

## What the 2025 announcement establishes

TeamYouTube announced a global rollout starting the week of 2025-10-13. It described refreshed player controls across device categories, content-specific video-like animations, and structured comment threading in a replies panel. It does not state in the inspected announcement how many nesting levels exist, whether every current account receives identical behavior, or an exact iOS/Android-specific reply transition. A secondary claim of a three-level limit was not independently established through the inspected primary sources and must not be stated as verified. [Source 3](https://support.google.com/youtube/thread/380540176?hl=en).

## Direct visual evidence from the official mobile illustration

The following observations concern the illustration itself, not a live installed app:

| Element | Directly visible |
| --- | --- |
| Viewing context | The video remains visible above the comments surface. |
| Panel | A drag handle, Comments heading, and top-right X appear above the list. |
| Sorting | Top, Timed, and Newest chips appear in the illustration. Timed is evidence of that YouTube example, not an HHC feature requirement. |
| Comment composition | Avatar sits in a left column. Author/time, body, and actions share a right text column. |
| Thread entry | A curved line leads to a reply-count entry with a right chevron. |
| Reaction row | Outline like/dislike icons and a neutral like number have no persistent button background in the shown unselected state. |
| Composer | A bottom strip contains the viewer avatar and a gray rounded comment-entry field, distinct from the desktop underline field. |

No keyboard, focused editor, selected reaction, expanded reply subview, or video information card is shown. Exact CSS-pixel sizes cannot be derived from this scaled promotional artwork. [Source 4](https://storage.googleapis.com/support-forums-api/attachment/thread-380540176-5606961893163681394.png).

## Consequences for the HHC analysis

These are HHC design recommendations or unresolved decisions, not claims about YouTube's current implementation:

- Treat the user's single-underline composer requirement as confirmed for the supplied desktop reference. Mobile needs an explicit choice between the app-style bottom composer and carrying the underline treatment across both devices; the references differ visibly.
- Use a mobile comments surface with a stable header, separately scrolling list, and reachable composer. A reply view with Back and X is the closest supported app interaction. Returning must restore the root list's scroll position and draft; closing must restore focus to the comments entry without restarting playback.
- A native-app reference does not require implementing drag gestures or adjustable panel heights unless the user wants that interaction. A visible drag handle should not promise a gesture that does not work.
- Keep the existing Top/Newest capability. The official image's Timed chip is not a reason to invent timestamp-linked comments.
- Desktop connectors and inline expand/hide can coexist with a mobile reply subview. The storage model and API do not necessarily need to mirror the visual nesting; the main analysis must verify which reply-target relationships HHC already exposes before claiming exact nested parity is possible.
- Preserve HHC's permissions, moderation, member-only visibility, reaction desired-state updates, mutation retry semantics, and existing privacy behavior. None of these research references authorizes changing them.
- Scope icon-only selected color to the reaction icon and preserve the number's typography. The exact selected fill/color on mobile is a user design decision unless a current native screenshot verifies it.
- The desired `觀看次數：1.8萬次 2天前` information row is supported by the user's desktop screenshot and instruction. This research did not verify that same row inside the current native app, so do not label it as measured app parity.

## Outstanding evidence and product decisions

1. Choose the mobile composer treatment: official app illustration's bottom rounded field, or the explicitly requested underline applied to mobile too.
2. Confirm mobile replies as a subview within the comments surface, including Back versus X behavior, rather than desktop inline expansion.
3. Confirm whether visual reply-to-reply nesting is required in addition to the existing single root-thread data model. The primary sources inspected do not settle the desired HHC depth.
4. Confirm whether panel resizing/drag-to-dismiss is part of the requested experience or only the initial panel appearance and navigation.
5. Determine selected reaction color/fill, compact number rounding, exact-date expansion, and live/scheduled metadata from the HHC product requirements rather than extrapolating from unrelated app states.

Physical-device acceptance remains necessary for iOS/Android keyboard occlusion, safe areas, panel scroll ownership, focus restoration, draft preservation, and uninterrupted video playback. Browser emulation can check layout and state transitions but cannot close those native/browser-engine gates.

No product code or test files were changed, and no test suite, HHC browser smoke, or native-device acceptance was run by this research task.
