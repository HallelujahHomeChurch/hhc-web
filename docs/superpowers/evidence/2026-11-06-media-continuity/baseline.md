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

- Timeline [frontend-platform #204](https://github.com/HallelujahHomeChurch/frontend-platform/pull/204) merged and the [1.1.20 package release](https://github.com/HallelujahHomeChurch/frontend-platform/actions/runs/42178355507) succeeded. Local workspace build, tests, lint, package contracts, pack, and packed consumer builds completed. The website adopted the exact package in [hhc-web #347](https://github.com/HallelujahHomeChurch/hhc-web/pull/347) with green CI. The [website release](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/42181378644) is the deployment evidence.
- [hhc-web-api #437](https://github.com/HallelujahHomeChurch/hhc-web-api/pull/437) adds migration 108 and protected progress routes. Isolated PostgreSQL 17 passed concurrent first claim, stale ended, rewind, sequence deduplication, idempotent claim retry, completed tombstone, replacement package, expiry purge, account cleanup, and the recording interaction regression. HTTP body and OpenAPI contract tests passed locally.
- A first-claim replay with a null generation could otherwise recreate purged progress. GET now supplies a two-minute signed claim token scoped to the account, recording, media version and generation. Reuse it for retries within that intent. Archived broadcasts include the applied public range revision in the opaque VOD media version. A claim obtains authoritative VOD duration before acquiring the write transaction and rechecks the version under lock.
- [api-gateway #258](https://github.com/HallelujahHomeChurch/api-gateway/pull/258) has exact routes, generated config and negative runtime cases. Route generation and route contract tests passed. CI failed three attempts in existing Account HTTPS timing tests. This PR remains a draft.
- [frontend-platform #205](https://github.com/HallelujahHomeChurch/frontend-platform/pull/205) adds the generated progress client and optional minimize button/downward gesture. It targets 1.1.21. The SDK suite and focused player tests passed locally. API and Gateway releases precede publication.
- The website working branch contains the media document privacy gate and VOD session extraction. Its focused member-video and privacy tests and TypeScript passed locally. Persistent watch/mini host, cross-device client sync, card, two-browser and physical-device acceptance, and the 24-hour observation window remain outstanding.
