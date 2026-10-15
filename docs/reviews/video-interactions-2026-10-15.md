# Member video interactions

Adds desired-state likes, canonical/timed sharing, one-level plain-text comments, own edit/delete, reporting and member viewing telemetry. Private authorization remains in the existing client/Gateway/CMS flow. Telemetry observes the player and never changes playback position, pause, speed, quality or DVR intent.

Independent review found and fixed stale polling overwriting an acknowledged like, and comment edit/delete CAS recovery after a lost response. Reconciliation preserves the user's draft, refreshes the loaded range and recognizes already-applied edits/deletions.

Local validation: 146 files / 1,212 tests, Next production build, lint (one pre-existing LegalRequiredNavigation warning, no errors). New tests cover uncertain comment identity, like/poll ordering, committed edit response loss, timed URL bounds and playback credit. Existing player/search/session tests remain included. No real OBS or production browser acceptance claimed.

Dependency gate: officially publish hhc-web-client 1.0.66, then update the manifest/lock and rerun clean-checkout CI. Current local node_modules uses a packed producer artifact only; no local file dependency is committed. CMS interaction and analytics flags default off independently. Deploy compatible video-v1 DSR support before enabling either.
