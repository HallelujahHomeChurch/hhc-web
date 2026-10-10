# B1 Mac browser validation — 2026-10-10

Local candidate evidence, not deployment or physical Windows acceptance.

The Asset `TestBroadcastRealDecodedRangeAndDerivatives` fixture produces 29.97 fps, 900-frame
segments at all three physical resolutions, with original-capture timecode and
phase colors. Its Worker exports the public `[8,20)` projection without rewriting
init/segment bytes. The original 72 fragments passed complete hash/media checks;
the public projection contains 12 fragments per rendition. Measured original
origin is240.261s; playlist duration is360.36s.

The Website's actual HlsPlayer/Hls.js1.7.3 ran in Ego Chromium against these exported
files served from the same local origin. A temporary fixture route was removed
before commit. No production cookies, tokens or signed URLs were used.

Observed:

- Initial decoded 854×480 frame at member time6.903931s; original burned-in time
  about247.21s and green public-phase strip. Seekable interval starts at0.
- Auto subsequently decoded1080p on the available local connection.
- Paused manual480p tail seek reached355.359999s, with4 decoded frames and0 drops.
- Switching paused playback to1080p retained355.359999s and pause; seeking back
  decoded time5s in1080p. No media errors.
- Playlist duration360.36s; MSE reported360.399999s after tail audio append. This
  is a40ms media-tail difference, not truncation or invented segments.
- With actual decoded media and a simulated advancing upstream projection,
  follow-live moved automatically from60.110703s to330.376047s, decoding1080p,
  without reload or pressing Back to live;29 frames,0 drops at the sample.
- Repeating the projection transition after explicitly pausing/seeking to5s
  retained5s and paused480p. Unit tests additionally retain rate and quality.
- Waiting panel1440px/390px had no horizontal overflow. Countdown reached zero
  and stayed Waiting; it did not start media itself.

Limits: projection advancement is synthetic, not an actual OBS outage or Worker
upload backlog. It does not pass or replace Windows capture807adeb7faa8f073c4e6251baf6aa65e,
its five-minute outage/ten-minute recovery test, or normal service-load acceptance.
Safari native HLS, physical mobile, production grants/CSP and real worker latency
remain deployment/device checks. CLI/C1 wire/media validation are unchanged.

## Recovering-state follow-up

Windows shared-load evidence (`hhc-obs-plugin@1b736b5`, capture
`85a97e39455d279eb9cc23deb4b44fc3`) exposed a caller gate: LiveRecordingPlayer
only enabled HlsPlayer following in `live`, although `recovering` already had a
verified playable edge. The added regression failed before enabling following
for both live and recovering. The HlsPlayer seekable/verified intersection,
30-second margin, followLive intent, unpaused check and 60-second jump threshold
are unchanged; ending/ended remain ineligible. All 77 player tests passed after
this change, plus lint/build/static budgets.

The decoded browser observations above exercised the underlying follow mechanism
before this one-line caller fix. They are not a new decoded recovering-state run
or proof of the production shared-load gate; Windows must repeat the actual
scenario after deployment.

## Quality-switch frame continuity — 2026-10-10 follow-up

Manual rendition/Auto changes still rebuild MSE to preserve the earlier ended-VOD
quality and duration fix. The player now holds the last decoded frame in an
in-memory canvas through reattachment/native source reload, revealing the video
only after position restoration and a ready, non-seeking frame. The canvas stays
below the watermark and controls, exports no image and clears on error/source
change/unmount. Browsers unable to capture a frame retain the prior fallback.

Local Chromium, actual HLS.js 1.7.3 and a generated 12.012-second 29.97 fps fixture:

- Paused Auto/1080p → 480p: `emptied`/readyState 0 and metadata/readyState 1 kept
  the 1920px held frame; `seeked` revealed decoded 854×480 at 5s, paused, 1.5×.
- Paused 480p → 1080p: the 854px held frame persisted through reload (sampled
  opaque canvas pixel `[255,133,20,255]`); decoded 1920×1080 returned at 5s,
  paused, 1.5×, with four decoded frames reported.
- Playing 1080p → Auto: reattachment retained the held frame, then resumed
  decoded 480p at the switch position (~6.52s), unpaused at 1.5×; duration stayed
  12.011999s and no video error was reported. Auto remains adaptive.

These are decoded-media/event/canvas observations, not a Windows or Safari pass.
Whole-page screenshot capture timed out during the follow-up; no compositor-level
no-flash claim is made. Regression tests cover native/MSE, rapid reselection,
position/rate/pause preservation, capture failure and source/error cleanup. The
temporary fixture route and public media link were removed before commit. Repeat
real Windows and Safari quality switches, including 480p natural end → seek back
→ 1080p → Auto, after deployment. No wire, encoder or validation changes.
