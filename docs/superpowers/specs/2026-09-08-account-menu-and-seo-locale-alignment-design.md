# HHC Account Menu and SEO Locale Alignment Design

**Date:** 2026-09-08

## Goal

Deliver two related public-navigation corrections:

1. publish the domain-wide Google site name as Traditional Chinese
   `哈利路亞家教會`, while keeping each localized page title and description in
   its own language; and
2. align authenticated avatar-menu destinations across the public website,
   Account, Admin, and Presenter Web according to the current product and the
   user's effective Admin permissions.

## Scope and repositories

| Repository | Change |
| --- | --- |
| `hhc-web` | Correct root site-name signals and retain the existing reference avatar menu. |
| `account-fe` | Add public website, Presenter, and conditional Admin destinations. |
| `admin-fe` | Add public website and Presenter destinations; retain Account management. |
| `hhc-presenter` | Add Web-only public website, conditional Admin, and Account destinations to the existing lower-left user menu. |

`frontend-platform`, Account API, gateway, CMS APIs, and deployment
infrastructure are unchanged. Existing session responses already provide
`permissions`, the shared `AccountMenu` already accepts ordered links, and the
shared Account client already provides `canAccessAdmin` to its current web
consumers.

Each repository uses a separate branch, PR, CI result, merge, release, and live
verification. No release or production mutation is implied by completing local
implementation.

## Avatar-menu contract

### Destination matrix

| Current product | Public website | Presenter | Admin | Account |
| --- | --- | --- | --- | --- |
| Public website | Hidden | Visible | Visible only with Admin access | Visible |
| Account | Visible | Visible | Visible only with Admin access | Hidden |
| Admin | Visible | Visible | Hidden | Visible |
| Presenter Web | Visible | Hidden | Visible only with Admin access | Visible |

The current product is never repeated in its own menu. Product destinations are
shown only to authenticated users. Presenter remains a public application;
`presenter:cloud:use` controls its cloud-document capability and does not hide
the Presenter destination.

Admin visibility uses the canonical effective-permission policy:

- Account, Admin, and public web import `canAccessAdmin` from the released
  Account client.
- Presenter does not add the private registry package solely for one predicate.
  Its existing shared authentication module receives the same readable Admin
  capability matrix and legacy aliases, with a focused contract test. This
  avoids CI/package-release coupling while keeping behavior explicit and
  verified.

### Link destinations and localization

- Public website: the active UI locale's home page.
- Presenter: `https://client.alive.org.tw/`.
- Admin: `https://admin.alive.org.tw/`.
- Account: `https://account.alive.org.tw/profile`.

Account and Admin use their current locale when linking to the public website.
Presenter maps `zh-TW` to `zh-Hant`, `zh-CN` to `zh-Hans`, and `en` to `en`.
All user-facing labels are added to every locale already supported by each
application; no locale is added or removed.

### Presenter placement and runtime boundary

Presenter keeps its existing lower-left avatar trigger. In Web mode, the
authenticated menu order is:

1. identity;
2. sign out;
3. Presenter preferences and keyboard shortcuts;
4. public website, conditional Admin, and Account links;
5. About and close actions.

Existing separators continue to distinguish these groups. This is the approved
"Presenter tools first" arrangement. Electron does not show the new product
links; its current menu and external-navigation behavior remain unchanged.

## SEO site-name contract

Google supports one site name per domain or subdomain, not one per locale
subdirectory. The domain-wide preferred site name is therefore exactly
`哈利路亞家教會`.

The neutral root page publishes consistent site-name signals:

- `WebSite.name = 哈利路亞家教會`;
- root `og:site_name = 哈利路亞家教會`;
- root title and other homepage references do not contradict that preference;
- localized full names are removed from `WebSite.alternateName`, so Google is
  not invited to choose a different language as the domain site name.

Localized organization aliases remain in `Organization.alternateName` for
entity recognition. Locale-owned page title, description, visible text,
canonical URL, `hreflang`, `x-default`, sitemap, and redirect behavior remain
unchanged:

| Locale URL | Localized title language |
| --- | --- |
| `/zh-Hant` | Traditional Chinese |
| `/zh-Hans` | Simplified Chinese |
| `/en` | English |
| `/ja` | Japanese |
| `/ko` | Korean |

Google may rewrite a title or snippet and may take days or weeks to recrawl.
The implementation controls the source signals; it cannot guarantee Google's
display timing.

## Error and security behavior

- Missing or malformed permissions retain each application's current
  unavailable/denied behavior; no link defaults to authorized.
- Product links contain no token, return URL, or user data.
- Admin remains responsible for its own route guard and backend authorization;
  hiding a link is navigation policy, not an authorization boundary.
- Presenter Web uses ordinary HTTPS navigation. Electron is out of scope and
  receives no new navigation path.

## Verification

Tests are written before product changes and must fail for the missing or
incorrect behavior.

- `hhc-web`: rendered root metadata and JSON-LD assert the Traditional Chinese
  domain name and absence of cross-language `WebSite` alternatives; all five
  localized metadata contracts remain unchanged; full test, lint, and build.
- `account-fe`: authenticated ordinary/Admin menu matrices, locale labels and
  destinations; full test, lint, and build.
- `admin-fe`: menu order and destinations; full test, lint, and build.
- `hhc-presenter`: Web ordinary/Admin matrices, approved placement, Electron
  non-regression, and locale mapping; full tests, lint, typecheck, and build.

After separately authorized releases, verify the deployed revision and live
menu behavior in each product. For SEO, fetch `/` as Googlebot, verify the five
localized pages, then use Search Console URL Inspection and request recrawl only
with explicit production/Search Console authorization.

## Deliberate omissions

- No centralized navigation service or new shared menu-builder abstraction.
- No locale-specific subdomains solely to obtain localized Google site names.
- No new Presenter dependency on `@hallelujahhomechurch/account-client`.
- No desktop Presenter menu change.
- No backend permission or OAuth contract change.
