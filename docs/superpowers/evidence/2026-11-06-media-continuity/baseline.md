# Media continuity execution baseline

2026-11-06 (Asia/Taipei). Fresh `origin/main` bases:

| Repository | SHA |
| --- | --- |
| hhc-web | 0b71550bda986fd7d932440b9e5e5704ba2807f0 |
| frontend-platform | 9c29470cc4dec61ace525bb62fdea6bce32b70fb |
| hhc-web-api | 4c385df133205d2ef4f9abc20bb4de1956d5c7b7 |
| api-gateway | 88c96cedfadf9e212d2dcde1b29dd2b747984df0 |

The website and API advanced beyond the design baseline. The website change registers Web Push subscriptions before binding accounts. The API changes prepare private CMS locations and release transitions.

## Timeline

The shared UI started at 1.1.19. Regression tests reproduced the missing marker with an unknown live window and with live windows of 45 and 90 seconds. After the fix, 470 shared UI tests, UI type checks and the UI build passed. Chromium confirmed 24px horizontal inset, 44px hit target and a right-aligned disabled marker at 320, 390 and 844px in inline and viewport fullscreen fixtures. The production player and iPhone system back gesture are pending real-device verification.

## YouTube and real devices

[YouTube Premium Help](https://support.google.com/youtube/answer/6308116) documents cross-device resume. [YouTube desktop Miniplayer Help](https://support.google.com/youtube/answer/9162927) documents playback across pages, switching from thumbnails, four-corner dragging and corner resizing. HHC returns to the video section on minimize and uses its own explicit progress ownership. iPhone YouTube App version, layout, gesture comparison, and HHC live/VOD baseline and lock-screen checks are pending.

## Delivery and implementation checkpoint

- Timeline [frontend-platform #204](https://github.com/HallelujahHomeChurch/frontend-platform/pull/204) merged and the [1.1.20 package release](https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/42178355507) succeeded. Local workspace build, tests, lint, package contracts, pack, and packed consumer builds completed. The website adopted the exact package in [hhc-web #347](https://github.com/HallelujahHomeChurch/hhc-web/pull/347) with green CI. The [website release](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/42181378644) succeeded from merge SHA `7e5ecb86df18e521fe1a2ae104a5227e483913c7`. ACA `hhc-web--0000290` is Healthy and Running with 100% latest-revision traffic. Image digest `sha256:ae1d8e20a15933ead8c61036940d5ec8ea72fba839df1cd42d14216b1dde94c5`. Private ingress, maintenance, About, and member video entry route smoke passed.
- [hhc-web-api #437](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/437) adds migration 108 and protected progress routes. Isolated PostgreSQL 17 passed concurrent first claim, stale ended, rewind, sequence deduplication, idempotent claim retry, completed tombstone, replacement package, expiry purge, account cleanup, and the recording interaction regression. HTTP body and OpenAPI contract tests passed locally.
- A first-claim replay with a null generation could otherwise recreate purged progress. GET now supplies a two-minute signed claim token scoped to the account, recording, media version and generation. Reuse it for retries within that intent. Archived broadcasts include the applied public range revision in the opaque VOD media version. A claim obtains authoritative VOD duration before acquiring the write transaction and rechecks the version under lock.
- [api-gateway #258](https://github.com/HallelujahHomeChurch/api-gateway/pull/258) has exact routes, generated config and negative runtime cases. Route generation and route contract tests passed. CI failed three attempts in existing Account HTTPS tests. The reconnect failure reproduced on the original base; a test-only synchronization fix passed 15 consecutive local race runs. Gateway policy, full race suite, vet, and image build passed after the test fix. The subsequent candidate-image security scan failed, so the PR stays draft.
- [frontend-platform #205](https://github.com/HallelujahHomeChurch/frontend-platform/pull/205) adds the generated progress client and optional minimize button/downward gesture. It targets 1.1.21. The SDK suite and focused player tests passed locally. API and Gateway releases precede publication.
- The website working branch contains the media document privacy gate and VOD session extraction. Its focused member-video and privacy tests and TypeScript passed locally. The standalone host test retained identical video/audio nodes and parent across slot changes. The host is not mounted in the application yet. Persistent watch/mini host, cross-device client sync, card, two-browser and physical-device acceptance, and the 24-hour observation window remain outstanding.


## Local load probe

One disposable PostgreSQL 17 run staggered 100 synthetic accounts at 150 ms intervals, first with existing playback heartbeat only and then with heartbeat plus progress. The progress store measured p95 82.9 ms and p99 143.4 ms, with zero connection-pool wait recorded. The heartbeat-only baseline had two transaction-capacity rejections and much higher tail latency, so this run does not pass the capacity gate. Repeat under controlled host load with lock-wait and HTTP latency measurements before enabling progress traffic.

## Frontend integration and release checkpoint

- Shared planning baseline `73ee1af2a1ff828d72421a73626f45ff4ce04a6f`, website base `b672e75db4de79346e55f05320de7ce54a36d928`. Engineering work is tracked in [hhc-web #352](https://github.com/HallelujahHomeChurch/hhc-web/issues/352).
- One account-fenced layout host owns live and VOD media. Watch and mini change geometry on the same video/audio nodes. Component tests exercise both, including logout. The Chromium progress fixture uses two isolated contexts, actual media clocks and a synthetic progress API, and confirms that B takes ownership after playing while stale A writes stop and A's clock advances.
- The 100-account PostgreSQL 17 rerun used 150 ms stagger, ten open connections, and one interval each for heartbeat-only and heartbeat plus progress. Heartbeat p95/p99 were 10.1/15.2 ms and 11.1/13.0 ms respectively. Progress p95/p99 were 5.9/7.6 ms. Neither run had capacity rejections or pool waits. This is repository-level latency on the local host. HTTP end-to-end latency and lock waits were not measured.
- Gateway's earlier image gate failed on zlib CVE-2026-85091. [Gateway #259](https://github.com/HallelujahHomeChurch/api-gateway/pull/259) patched the base. The rebased [Gateway #258](https://github.com/HallelujahHomeChurch/api-gateway/pull/258) passed CI, including the candidate-image scan and runtime routing verification.
- Remaining acceptance includes native iPhone edge gestures, background audio ownership through two grant renewals, live transition, and the real-device soak. Synthetic browser playback uses a canvas media stream.

A second disposable-database run sampled lock waits every 25 ms. Neither
heartbeat-only nor mixed traffic observed a lock waiter in 594 samples per
interval, and neither recorded a pool wait or a capacity rejection. Progress
p95/p99 were 8.0/9.5 ms. This sampling cannot exclude lock waits shorter than its
sampling interval.
