# Member video interactions

Adds desired-state likes, canonical/timed sharing, one-level plain-text comments, own edit/delete, reporting and member viewing telemetry. Private authorization remains in the existing client/Gateway/CMS flow. Telemetry observes the player and never changes playback position, pause, speed, quality or DVR intent.

Independent review found and fixed stale polling overwriting an acknowledged like, and comment edit/delete CAS recovery after a lost response. Reconciliation preserves the user's draft, refreshes the loaded range and recognizes already-applied edits/deletions.

Local validation: 146 files / 1,212 tests, Next production build, lint (one pre-existing LegalRequiredNavigation warning, no errors). New tests cover uncertain comment identity, like/poll ordering, committed edit response loss, timed URL bounds and playback credit. Existing player/search/session tests remain included. No real OBS or production browser acceptance claimed.

Dependency gate resolved: hhc-web-client 1.0.66 is officially published from frontend-platform commit 68ade4cea150785964895107aaed96363a8264d2 (release run 38736582097). The manifest/lock now pin that registry artifact, and a clean install replaces the earlier local packed producer. Updated CI remains required; no local file dependency is committed. CMS interaction and analytics flags default off independently. Deploy compatible video-v1 DSR support before enabling either.

Official registry validation: clean frozen install, 146 files / 1,212 tests, Next production build and static performance budgets passed. Lint retains one existing LegalRequiredNavigation warning and no errors. The dependency pin assertion was updated from 1.0.61 to the released 1.0.66. No playback logic changed.
