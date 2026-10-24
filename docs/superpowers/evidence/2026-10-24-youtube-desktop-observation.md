# YouTube desktop watch-page observation

Date: 2026-10-24. Status: live browser/DOM reference evidence; no product implementation.

## Source and method

The browser found the same video as the user's screenshots: [YouTube watch page](https://www.youtube.com/watch?v=TG8Iu6zUycs). The title and description matched the supplied crops, as did the root discussion and its nested replies. The displayed view count had increased since the screenshot; counts are observed data, not visual constants.

Ego Browser task 45 opened the public watch page, paused playback, expanded the root reply thread, opened an empty targeted reply editor, closed it, and expanded video information. No comment was submitted and no reaction, subscription, playlist, report, account setting, or channel setting was changed. The selected comment reaction already existed when the page was opened; observing it did not require clicking Like. The task was finished and its agent-created page closed.

Measurements came from rendered DOM bounds and computed styles in the desktop web application, including a verified 1440x960 CSS-pixel viewport with DPR 1. The normal browser pane also presented a 735x363 CSS-pixel viewport with DPR 2. The narrow surface was still desktop YouTube, not the native mobile app. Some JavaScript-driven compact presentation persisted across viewport changes, so state-dependent measurements are identified rather than treated as universal design tokens.

Screenshot capture failed through both the high-level screenshot method and a CDP fallback. There is no new screenshot artifact from this session. Existing user screenshots supply the visual reference; live semantic snapshots and computed styles supplement them. Pointer interception affected some scripted clicks; the reply editor and information expansion were subsequently confirmed through visible DOM state. The sorting popup was not successfully inspected. No physical iOS or Android app was operated.

The browser tool displayed an available Ego Lite update. No upgrade was performed.

## Stable measurements in the inspected dark-theme discussion

| Element | Observed value |
| --- | --- |
| Root avatar | 36x36 CSS px |
| Reply avatar, including the deeper reply | 24x24 CSS px |
| Avatar-to-content gap | 16px |
| Ordinary author | 12px, weight 500, line-height 18px |
| Relative time | 12px, weight 400, line-height 18px |
| Comment body | 14px, weight 400, line-height 20px |
| Reaction SVG | 18x18px |
| Comment reaction visible button | 32x32px, transparent persistent background |
| Comment reaction count | 12px/18px, weight 400, muted `rgb(170,170,170)` |
| Selected comment thumb | Filled icon, `rgb(241,241,241)`; count remains muted |
| Reply action text | 12px, weight 500; 32px visible action row |
| Reply-count/hide control | 14px, weight 500; 40px visible height |
| Ordinary foreground | `rgb(241,241,241)` |
| Secondary foreground | `rgb(170,170,170)` |
| Thread connector | 1px `rgb(63,63,63)`; curved junction radius 16px |
| Latin font declaration | `Roboto, Arial, sans-serif` |

These replace earlier proposed desktop values of 40px root avatars and 13px authors. They describe the inspected variant and are not a claim about every account, device, locale or YouTube experiment. Preserve HHC's required accessible hit areas while matching visible geometry; do not blindly copy the 32px hit target to touch layouts.

Measured horizontal relationships relative to the root avatar's left edge:

- Root text starts at +52px: 36px avatar plus 16px gap.
- First-level reply avatar starts at +48px; its text starts at +88px.
- The observed second-level reply avatar starts at +84px; its text starts at +124px.
- A reply's 24px avatar and 16px content gap account for 40px within that row. Further visual indentation in this sample is 36px.
- The root connector tracks the avatar center; deeper connectors track the smaller reply avatar center. The line begins below the avatar, rather than passing behind it.

Do not hardcode row height: multiline content, edited markers and an open editor change it. The observed single-line root and reply examples had compact header/body/actions spacing, with about 12px between adjacent reply blocks.

## Reply presentation and count meaning

The collapsed root showed a preview avatar, separator, a count, and a down chevron. Expanding displayed two first-level replies and one second-level reply. A hide-replies control appeared after the expanded thread. More-menu controls occupied each row's trailing edge near the identity line rather than the reaction row.

The root label was 3 replies: two direct children plus one deeper descendant. It was not a count of only the next level. Preserve the existing whole-thread root `replyCount`; new direct-child pagination counts cannot substitute for the visible reply total. See the [contract analysis](2026-10-24-nested-comment-contract-analysis.md).

This small thread revealed its deeper reply when the root opened. It did not demonstrate that every intermediate branch starts collapsed, the maximum supported depth, independent branch pagination, or behavior after deleting/hiding an intermediate reply. The user's approved per-level expansion requirement must be implemented explicitly, without mislabeling untested behavior as a live observation.

## Composer

The unfocused composer was a compact underline entry with an avatar; its placeholder used 14px text and 20px line-height. The observed compact variant's underline container was 25px high with a 1px translucent border. Its compact composer avatar measured 24px, while the user's desktop crop shows a larger entry avatar; preserve the supplied reference as the target for that desktop state rather than declaring the compact measurement universal.

Opening Reply on a reply displayed a focused, single-line editor with the target handle inside the editing line, plus Cancel and Reply actions below. The editor used 14px text and 20px line-height. No text was entered or sent. A mention target was prefilled by YouTube itself.

HHC should preserve its existing `replyToId` semantics and separate target metadata. A non-editable target chip can visually match the line without inventing rich-text parsing, copying a YouTube channel model, or adding mention notifications. Existing multiline input, length limits, retry identity and error handling remain required.

## Video reactions and information

The video's Like control already had a gray translucent pill background in its unselected state: 40px visible height, 14px text, weight 500, `rgba(255,255,255,0.1)` background. This differs from the transparent comment reaction controls. The requested no-added-background rule is therefore interpreted as no new selected background: keep the video's base pill, and keep comment reactions transparent. Do not recolor count text on selection. The selected video state was not toggled or verified in this session.

The information card used a 12px radius and 12px inner inset. Its dark-theme background was also `rgba(255,255,255,0.1)`. Both metadata and description used 14px text and 20px line-height; metadata weight was 500 and body weight 400. This is more compact than HHC's current 16px inset, description top margin and 1.6 line-height.

Collapsed information showed compact views and relative age. Expanding changed it to the full view count and an exact date, confirming the proposed behavior. The collapsed more-content action was inline with the description preview; the expanded collapse action used a compact text treatment. HHC's separate 44px button row and extra description margin are additional visual gaps to address while retaining accessible controls.

The title measured 20px, weight 700, line-height 28px. The comment heading and sort label shared one row; the visible sort label was 14px, weight 500. Do not infer the heading text's size from its H2 wrapper alone, because formatted descendants override container typography.

YouTube's channel, video Dislike, Save, Download, chapters and other unrelated controls are not authorization to add those HHC capabilities. Reproduce the existing HHC controls' relevant styling and the approved discussion behavior.

## Acceptance consequences and limits

- Use near-identical reference geometry, theme-appropriate neutral colors and icon fill rather than a branded reinterpretation.
- Update root/reply skeletons and preview avatars to the same row anatomy.
- Use an aligned desktop heading/sort control; the current native select's visible selected-value layout differs from the reference and should use an existing house menu presentation if available.
- Keep root reply totals, direct-child page counts and non-root descendant totals distinct. Counts must include unloaded visible replies and exclude removed personal content under the agreed policy.
- Match the compact information-card flow, including the inline preview affordance, without relying on all descriptions being long or nonempty.
- Localize labels while preserving relative visual hierarchy. Light-theme values and the native app's focused keyboard state were not measured live here.
- The supported source facts do not settle intermediate-delete/hide policy. Recommend anonymous structural placeholders preserving descendants and position, with removed text/identity/avatar excluded and placeholders excluded from visible comment totals. Root hiding continues to suppress the whole thread.

No HHC product files, tests, migration, PR, package release or production deployment were changed by this observation. Browser interaction and DOM measurements are reference evidence, not implementation, pixel-comparison or physical-device acceptance.
