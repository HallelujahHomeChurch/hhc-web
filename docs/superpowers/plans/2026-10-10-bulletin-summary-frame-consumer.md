# Published bulletin frame consumer

Approved scope: use the released shared UI 1.0.56 in the reader; no source content,
saved renderer versions, font assets, permissions or other package pins change.

- Pin UI 1.0.56 and registry integrity in the lockfile; update the existing pin assertion.
- Run complete tests, lint, build and the repository Docker build.
- Independently review the complete branch once, then open a PR and require all CI.
- Merge through the existing release workflow; verify revision, health and reader route.
- This dependency release does not constitute PDF conversion or device acceptance.
