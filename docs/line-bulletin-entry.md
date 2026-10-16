# LINE bulletin entry and legal return

The member archive accepts `series` plus `contentLocale` to select one edition's
latest issue, and an optional positive 32-bit `issueNumber` for an exact issue.
`mode=online|pdf` selects the requested presentation. UI language remains the path
locale. No LINE identity, Account identity, token or callback is accepted in these
selectors; the current website session always owns authorization.

An invalid, incomplete, duplicated or unauthorized target never silently falls back
to another issue or edition. A valid target requests only that authorized edition,
retains its selectors when switching PDF/online tabs and provides an explicit way
back to the archive. Online publication and the reader rollout flag remain separate:
reader-disabled returns show an unavailable notice and retain the PDF entry. No
automatic download or reader mutation occurs.

Discovery and the existing transient PDF fallback preserve the same issue filter.
A mismatched exact-issue response is rejected. The existing authorization-dependent
API instance, account-bound result keys and abort lifecycle remain in force.

Legal-required navigation preserves only the fixed production origin, approved
content paths and allowlisted selectors. Reader routes are also preserved; identity,
redirect, token, fragment and unknown query fields are rejected. Account FE uses the
same validation contract before accepting the return. Its additive allowlist must
ship before this navigation consumer, and the website target contract must ship
before the Bot emits exact target links. No build-time reader flag is enabled here.

Focused tests cover authorized English content under a Traditional Chinese UI,
exact/latest selectors, tab continuity, invalid/ungranted targets, PDF fallback,
mismatched API data and legal-return rejection cases. Live LINE in-app-browser and
cross-account acceptance remain separate from these local tests.
