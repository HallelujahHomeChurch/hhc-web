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
