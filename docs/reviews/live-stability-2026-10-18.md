# Live stability candidate — 2026-10-18

Status: **not merged, not released, not deployed**. The user explicitly requires stopping before merge while Windows is using the live system. Nothing in this report authorizes a production change or claims device acceptance.

## Scope and evidence

The production observation used recording `2796ca13-51b1-4817-ac49-795848d68437`, capture `dce3101b54b15a24624316eeb7e3e5b4`, epoch 1. It was read-only. The 59 browser samples from 11:32:09–11:36:59 Asia/Taipei showed advancing decoded playback and no MediaError, but 41 gray and only 18 red live-indicator samples. That is a presentation/follow-target inconsistency, not evidence that all network or player stalls are fixed.

In 268 confirmation receipts, the maximum confirmation gap was 15.036 seconds. All seven sampled Console interruptions occurred 11–13 seconds after the latest confirmation, with another confirmation arriving 0.2–2.6 seconds later. S10's nominal 10.01-second interval was too strict for displaying signal loss. The display grace is extended by ten seconds; the authoritative D1 End timeout/cutoff is unchanged.

The observed capture-clock-to-playlist-edge proxy was approximately 24–69 seconds, median 44 seconds. A 90-second player reserve projects roughly 114–159 seconds overall under that observed load. This is **not** a glass-to-glass measurement or a hard latency guarantee. Sustained upload/validation backlog cannot be fixed by adding player delay.

## Changes

- One shared UI player supplies Studio staff preview and member playback. Their grant/cookie scopes, media URL guards and member-only watermark/telemetry remain separate.
- Live indicator, seekbar endpoint and Return to live use the same verified safe target. Healthy following displays the slider at the right edge without falsifying the actual media currentTime.
- A fresh automatic live entry waits for the 90-second reserve. Explicit DVR, saved playback intent and ended short recordings are not blocked by that startup wait.
- Automatic recovery only advances an actively following, playing 1x viewer. It does not rewind or override DVR, pause or non-1x playback. Forward controls cannot move backward when already beyond the safe target.
- Preview grant renewal and bounded media retry retain position, pause, rate and quality. Old generation callbacks cannot cancel a required retry or restore an old source.
- Remove the member below-title estimated-delay row; use the player live control. Correct desktop pill radius and reduce mobile visible playback controls while preserving touch targets.
- Keep the key selector/reset/copy geometry stable. Polling depends on capture/epoch identity rather than a fresh binding object. Redundant loading status is screen-reader-only on both initial and background loads; real errors remain visible.
- Refresh a direct-live `signal_grace` interruption through the existing authorized signal read, under the existing broadcast lock, without waiting for the slow projection loop. Reads cannot close input or move the cutoff.

## Local browser evidence

Chromium used isolated local synthetic 29.97 fps / 10.01-second fMP4 playlists; no live production controls were changed. The fixed packed UI candidate SHA-256 is `92140c0e594ab7c34b76ad577f8a97d2743d55926eb7ac58fd1a026a62091169`.

- Fresh startup: real seekable end grew naturally from 60.096 through 70.101 and 80.107 seconds while currentTime stayed 0 and paused=true. At 90.112 seconds playback started automatically; sampled frames increased 19→235 with no MediaError.
- Verified playlist catch-up: position advanced 27.314→60.163 while the safe target advanced; playback stayed 1x, decoded frames advanced and red live/slider endpoint agreed. This is a synthetic verified-waterline advance, not a production transport fault-injection test.
- DVR/pause: position 71.168595, paused=true and rate=1.5 were unchanged while the playlist edge advanced 170.197→210.210.
- Rapid quality selections 480p→1080p→Auto retained that position, pause and 1.5x; final decoded dimensions 1920×1080, readyState=4, MediaError=null.
- Admin rendered the shared player and actually decoded 1920×1080. Twelve key-row geometry samples stayed identical during polling; video frames advanced 960→1258. Clicking the selector again closes it. Waiting, interruption and ending layouts were also inspected.
- Mobile Chromium touch emulation verified the smaller visible playback controls and 44-pixel hit targets. It does not substitute for native iOS Safari.

Local screenshot/sample evidence is retained under `.artifacts/live-stability-20261018/` in the workspace, not embedded as production evidence or uploaded media.

## Review and release gates

| Repository | PR | Gate |
| --- | --- | --- |
| Asset | [115](https://github.com/HallelujahHomeChurch/asset-api/pull/115) | full required CI passed on a861f5e |
| CMS | [258](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/258) | 90-second classifier alignment; full required CI passed on 4652579 |
| Shared UI | [135](https://github.com/HallelujahHomeChurch/frontend-platform/pull/135) | candidate UI 1.0.76; required CI and later publication |
| Admin | [266](https://github.com/HallelujahHomeChurch/admin-fe/pull/266) | draft; depends on unpublished shared player |
| Website | [232](https://github.com/HallelujahHomeChurch/hhc-web/pull/232) | draft; depends on unpublished shared player |

Consumer manifests intentionally retain the current registry version until the producer is published. Local packed-candidate tests do not make clean consumer CI green: the old registry package has no `./player` export. Do not bypass that failure or merge either consumer. After separate merge approval, publish the shared package through its normal release workflow, pin the actual published exact version in each consumer, regenerate registry lockfiles, then rerun required CI before consumer merge.

K3/B1/C1/D1/S10 wire, 30000/1001 fps, 300-frame/10.01-second segments, digest, idempotency, public boundaries and complete media validation remain unchanged. No OBS plugin change is needed for this batch.

## Fixed candidate versions and checks

- Asset: `a861f5e4f65b0d53a138bf3b456213fbd6dddf6f`, CI `39095667030` passed.
- CMS: `46525796674bfcf8f2019e0e946d1a2e9e3a4f7e`, CI `39096639471` passed (11 checks).
- Shared UI: `a95ce70cc218aa70cf511d9ea9c41f9f389cbaaf`, CI `39096801512` as of 2026-10-18 12:33 Asia/Taipei: prepare passed, three required renderer jobs still running; 333 local UI tests, including 138 player tests, plus build/lint/contracts and packed Node/Vite/Next consumer smoke passed.
- Admin: `f6dc91fa2508ba2b3e42bbcbb123f9c90d12f744`; 72 targeted candidate tests and the final full 128-file / 1339-test suite passed; build and source lint passed. Registry CI `39096660987` failed only the four suites importing the unpublished player export; the dependency gate is not waived.
- Website: implementation `86cc97660adfd53ea251514d582966b1b452be2d` plus this documentation commit; final packed-candidate full suite passed 165 files / 1273 tests, Next production build passed, lint had zero errors and one pre-existing navigation warning. Registry CI `39096241592` failed because the released UI package does not export `./player`; it is not waived.

No deployment revision or release is claimed for these candidates.

## Minimal Windows handoff — blocked until deployment

This batch is not yet deployed; do not treat current production behavior as a retest of it. Keep existing results and do not repeat accepted long recordings. Once Mac supplies actual deployment revisions and confirms a safe testing window:

1. Use the existing key and normal candidate plugin for one short S10 live session. Record actual plugin/platform revisions, recording/capture IDs and timestamps with timezone.
2. Observe the original Console and member page without reload: continuously decoded resolution, currentTime/frames, playlist/verified edge, seekable/buffered ranges, red/gray state and slider endpoint. Measure stable latency with source timecode; report distribution and accumulation rather than only a badge.
3. Confirm the Console key row does not shift during polling; its preview uses the shared controls, normal signal confirmation jitter does not show a false interruption, and real signal loss/recovery still appears.
4. Briefly interrupt and restore transport while following live. Confirm automatic forward recovery within verified/public bounds. Separately confirm DVR, pause and 1.5x are retained; no forced jump or backward recovery.
5. Check desktop live pill, mobile smaller controls, removed delay row, and quality changes/preview renewal retaining position and intent. iOS Safari is an independent real-device gate.
6. Stop normally and check the same URL transitions to complete replay. Do not rerun the full 2.5-hour recording, reset keys, manually publish or delete diagnostic recordings for this UI batch.

Historical 379/388-second delay failures and weak-network/uncached-seek limits retain their previous verdicts. Local Chromium media decoding is not iOS Safari or production Windows acceptance.
