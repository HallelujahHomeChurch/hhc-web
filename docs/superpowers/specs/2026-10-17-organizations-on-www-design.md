# Small-group management on WWW

Approved in this chat on 2026-10-17, including explicit authorization to implement. Existing Account #118 and WWW #221 stay unmerged; this work carries their changes into separate isolated branches.

Move the existing management feature, its scoped API clients, translations, tests and styles from Account into WWW. Reuse WWW authentication/access-token refresh, locale routes and shell. Do not introduce another shared package, iframe, React Router dependency or business API change.

WWW has localized /organizations, /organizations/:unitId and /organizations/:unitId/members/:memberId. Add a permission-aware desktop navigation item and mobile item immediately before My (after member videos when available). Remove management links from both avatar menus and all Account navigation/feature search. Preserve existing access policy: current church membership plus active delegated responsibility. Cached navigation is presentation only. Loading, denied, unavailable/retry and revoked access remain distinct. Never render prior-account private data after identity changes.

The entry uses the existing AboutHero banner and image. Exact Traditional Chinese title: 小家管理. Exact subtitle: 陪人是一生最高的成就. Translate remaining locales. Inner unit/member pages retain compact breadcrumbs and one primary heading, without a large banner. Reuse the management list/table/dialog layouts from Account #118, including terminal-unit columns, mobile action row, pagination of at most 50 members, idempotency and response validation.

The shared header ExpandableSearchField searches members only in a unit directory, preserving existing debounce, abort and page reset. Other page search behavior is unchanged. All private fetches remain browser-only and no-store; management pages are noindex/nofollow and absent from sitemap. Preserve the recent mobile search fix and avatar alignment.

Gateway adds exact WWW management and unit-notification routes, protected with the same human JWT/delegation boundary. Never expose archive/restore or a wildcard private route. Account legacy management URLs redirect to equivalent localized WWW URLs with fixed origin and recognized path shapes, preserving bookmarks. Notification delivery and its current Account /profile click destination are unchanged.

Delivery: three reviewed PRs with required CI passing. No merge, release, production writes or infrastructure changes. Keep unmerged worktrees.
