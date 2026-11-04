# Background handoff integration implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for shared implementation and independent review; root owns consumer integration and delivery.

**Goal:** Preserve normal foreground video/seek synchronization while automatically carrying sound through screen lock, using the physically accepted synthetic prototype. User accepts a brief lock/unlock handoff pause.

**Architecture:** Foreground video owns both picture and sound; audio remains muted standby. Hidden audio becomes owner. Return uses a fixed bookmark and current user intent, briefly pauses to restore video, then returns ownership. No ongoing video drift correction, speed chasing, or new user controls.

**Tech stack:** Existing React/TypeScript shared player, hls.js/native HLS, website member video integration and native GitHub CI/CD.

## Scope and compatibility

Shared use-background-audio/HlsPlayer/PlayerChrome/MediaSession own handoff and active media refs. Preserve ordinary VOD/live, existing protected session validation, fullscreen, user mute/volume/speed/seek intent, quality restore, auth cleanup and single fallback. Website sharing, grant renewal, derivative removal and errors must use active-owner bookmarks. Existing backend/API/asset generation contracts do not change. No additional historical generation.

## Delivery tasks

- [x] Shared regression tests first; implement approved ownership/handoff with cancellation and stale play guards. Cover foreground seek, fixed return, rapid visibility, paused return, pause/seek during return, mute/speed, quality rebuild, MediaSession, error/unmount/auth cleanup, ordinary/live boundaries.
- [x] Consumer regressions for foreground/background sharing, authority renewal/revocation, derivative removal, fallback bookmark and in-flight Cookie exchange. Published final dependency only; temporary local test alias must not ship.
- [x] Independent source/contract review. All repository local checks pass. Coordinated shared package version1.1.16 (root +7 packages), PR and all required CI; merge/tag native publication.
- [ ] Website consumes actual published1.1.16, full tests/lint/build/static budgets, PR and required CI, merge/native release. Verify exact image/revision, health and public/auth smoke.
- [ ] Browser actual member recording seeks/foreground/background/return/share and ordinary no-derivative fallback. Physical iPhone actual recording seek, lock20s/unlock20s, accepted brief handoff pause. Do not substitute synthetic result for production phone acceptance.
- [ ] Record immutable release evidence and remaining broader-plan boundaries. Clean only this task's clean merged/released/smoked worktrees after no follow-up remains.

User explicitly authorized implementation, testing, release and acceptance on2026-11-05; no repeated delivery approval needed. Browser recreation authorized for this validation only. Device-only outcomes require user response. Historical audio generation and real live archive samples remain separate approval/evidence gates.
