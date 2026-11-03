# Transparent background playback implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the shared player and website integration.

**Goal:** Normal video controls start playback; locking the screen continues sound without another mode, button or preparation status.

**Architecture:** A ready protected audio derivative is the continuous audible owner from the normal Play gesture. The existing video remains the muted visual presentation. A single playback media ref supplies controls, bookmark, telemetry and sharing. Hidden transitions never create or restart audio; returning visible synchronizes video to audio.

**Tech Stack:** React/TypeScript, existing native HLS and hls.js, existing Account/CMS/Cookie/Worker authorization.

**Spec:** User correction on 2026-11-03: unchanged operations, only added ability to turn off the screen. This supersedes the former manual audio-mode requirement and accepts continued implementation.

## Constraints and review focus

- No new visible audio mode/status/recheck controls in any locale.
- No hidden autoplay workaround, second audible source, secret logging or authorization change.
- Initial derivative readiness is latched per session; later readiness cannot replace a playing source. Revocation removes the capability immediately.
- Audio failure falls back to ordinary video once at the saved position; video failure then uses existing error handling.
- Device lockscreen, headphones, interruptions and native fullscreen compatibility require actual device evidence, not desktop mocks.

## Tasks

- [x] Shared UI: add backgroundAudioUrl and playbackMediaRef props; test direct gesture, hidden video pause, foreground sync, all existing controls, quality changes, cleanup and MediaSession ownership; publish reviewed package1.1.13 after full CI.
- [x] Website: regression test no extra controls; remove manual AudioPlayer/mode/readiness UI and dead translations; keep original HlsPlayer, pass initial-ready derivative and shared media ref. Test renewal preserves media, late readiness does not adopt, missing derivative falls back once, denied/expiry stops both, active audio supplies sharing time.
- [ ] Run focused red/green, full tests/lint/build/static budgets and independent review; use native CI/CD after published dependency pin.
- [ ] Verify deployed revision/digest, protected/public routes, desktop controls/background and physical iPhone normalPlay→lock→unlock. Keep missing device/long-duration evidence explicitly open.
