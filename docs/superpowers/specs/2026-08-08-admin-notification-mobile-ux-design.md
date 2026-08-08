# Admin Notification Mobile UX Design

## Goal

Make notification administration searchable and efficient while giving the Admin console a coherent mobile-app interaction model. Web push notifications gain an explicit click behavior, including a dismiss-only option that never opens or focuses the website.

## Search

- The Admin header search appears on `/campaigns` and `/campaign-schedules` in addition to existing searchable routes.
- Campaign search is server-side and stored in the `q` URL parameter. It searches the internal campaign name and translated subject/body text, resets pagination to page one, and preserves the existing 300 ms debounce.
- PostgreSQL uses `pg_trgm` GIN indexes for substring and CJK-friendly matching. Count and list queries use the same predicate.
- The campaign list keeps the current page visible while the next request is loading and ignores stale responses.
- Schedule search is client-side in this phase because the schedule endpoint returns a bounded operational list. It still uses `q` in the URL for consistent navigation and refresh behavior.

## Mobile Header Search

- `ExpandableSearchField` gains an explicit `mobileBehavior="header-overlay"` option.
- On viewports up to 960 px, the collapsed 40 px search trigger remains immediately left of the account avatar.
- When expanded, it is positioned inside the sticky header from 16 px at the left edge to 68 px at the right edge. It covers the hamburger trigger and brand without moving the avatar or changing header height.
- The overlay uses the opaque canvas surface, 180 ms width/opacity transitions, and supports Escape, outside click, focus restore, and reduced motion.

## Mobile Actions

- Only page toolbars, editor headers, and row-level actions become icon-only at up to 760 px. Desktop retains icon plus text.
- Dialog confirmation buttons remain text buttons. Filters and field controls retain text labels.
- Mobile action targets are 44 x 44 px with at least 8 px gaps, stable hover/press states, and required accessible labels.
- Mappings: create=`Plus`, back=`ArrowLeft`, save=`Save`, publish/send=`Send`, unpublish=`CloudOff`, revisions=`History`, duplicate=`Copy`, retry=`RefreshCw`, upload/replace=`Upload`, delete=`Trash2`.
- Pending actions keep the same dimensions and replace their icon with a spinner. No layout shift is allowed.
- Existing table edit/delete icon actions remain unchanged.

## Push Click Behavior

Each localized web-push translation supports:

- `home`: click opens the localized website home page. This is the default.
- `url`: click opens a validated same-origin relative URL. The URL field is visible and required only in this mode.
- `dismiss`: click closes the notification and performs no focus, navigation, or window opening.

The API stores `clickBehavior` inside the existing translations JSON, so no campaign table migration is needed. Legacy translations remain compatible: a legacy non-empty `actionUrl` means `url`; otherwise they mean `home`. Email translations ignore click behavior.

The service worker continues to reject external origins. The notification payload includes both `clickBehavior` and the normalized `actionUrl`. Dismiss-only clicks call `notification.close()` and return without examining clients.

## Visual Direction

- Preserve the approved HHC warm canvas, coral primary, teal success, Inter/Noto typography, and compact operational density.
- Do not introduce a new palette, decorative cards, or mobile-only visual language.
- Search expansion is the single pronounced motion. Other controls use restrained color/opacity transitions.
- Verify light/dark modes at 375, 768, 1024, and 1440 px, with reduced motion and keyboard-only interaction.

## Repositories

- `frontend-platform`: shared expandable search behavior.
- `admin-fe`: routes, query state, responsive actions, and conditional click controls.
- `engagement-api`: campaign search and click-behavior validation/payload.
- `hhc-web-api`: OpenAPI query/translation contract only; proxy behavior remains unchanged.
- `hhc-web`: service-worker click behavior and tests.

