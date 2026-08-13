# Multilingual SEO And X-Default Design

## Goal

Let Google index and select the Traditional Chinese, Simplified Chinese,
English, Japanese, and Korean website versions independently without making
the bare domain represent one language for every crawler.

## Current Problem

`GET /` always redirects after locale detection. Googlebot normally sends no
`Accept-Language`, so the shared detector falls back to English and the bare
domain redirects to `/en`. Google then sees English title, description, body,
and address content when it starts from the canonical host.

Changing the empty-header fallback from English to Traditional Chinese would
only move the bias. It would not create a language-neutral discovery entry for
Japanese, Korean, or other searchers.

## Decision

Use `/` as a crawlable `x-default` language entry:

- A valid `hhc_locale` cookie redirects with `307` to that locale.
- A supported `Accept-Language` redirects with `307` to the best supported
  locale using the existing detector.
- No supported language signal returns `200` and renders a small language
  selector linking to all five localized home pages.
- Localized URLs never redirect because of browser language.
- Every localized URL remains self-canonical.

The neutral entry is a fallback and discovery surface, not a sixth content
locale. It does not receive CMS content, navigation, or application controls.

## Request Behavior

| Request | Result |
| --- | --- |
| `GET /`, `hhc_locale=ja` | `307 /ja` |
| `GET /`, `Accept-Language: ko-KR` | `307 /ko` |
| `GET /`, `Accept-Language: en-US` | `307 /en` |
| `GET /`, `Accept-Language: zh-TW` | `307 /zh-Hant` |
| `GET /`, no cookie or language header | `200` neutral selector |
| `GET /`, unsupported languages only | `200` neutral selector |
| `GET /ja` from an English browser | `200 /ja`; no redirect |

## SEO Contract

Localized home pages publish this alternate set:

```html
<link rel="alternate" hreflang="zh-Hant" href="https://www.alive.org.tw/zh-Hant">
<link rel="alternate" hreflang="zh-Hans" href="https://www.alive.org.tw/zh-Hans">
<link rel="alternate" hreflang="en" href="https://www.alive.org.tw/en">
<link rel="alternate" hreflang="ja" href="https://www.alive.org.tw/ja">
<link rel="alternate" hreflang="ko" href="https://www.alive.org.tw/ko">
<link rel="alternate" hreflang="x-default" href="https://www.alive.org.tw/">
```

`x-default` is added only to the home-page alternate group. Other fixed routes
keep their existing locale alternates. CMS detail routes continue to list only
the published locales in `availableLocales`; missing translations are never
advertised.

The neutral root is canonical to `https://www.alive.org.tw/`. Each localized
home page remains canonical to itself. No language version is canonicalized to
another language.

## Neutral Entry

The root page renders the existing logo, the stable `HHC` label, and five
native-language links sourced from the existing locale registry. It uses
`lang="und"` at the document level because the page has no primary language;
each language link sets its own `lang` and `hreflang`.

The page includes one `WebSite` JSON-LD node:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "url": "https://www.alive.org.tw/",
  "name": "哈利路亞家教會",
  "alternateName": [
    "Hallelujah Home Church",
    "ハレルヤ・ホームチャーチ",
    "할렐루야 가정교회",
    "HHC"
  ]
}
```

Google supports one site name per domain, not one site name per locale
subdirectory. The structured data supplies brand alternatives but does not
promise that Google will localize the small site-name label. Localized title
links and snippets remain controlled by each localized page's visible content
and metadata.

## Error And Cache Behavior

- Keep temporary redirects; do not use `301` or `308` for negotiated locale
  destinations.
- Keep `/` request-dependent and non-cacheable across users.
- Invalid locale cookies are ignored.
- Malformed or unsupported language headers render the neutral entry.
- The selector uses ordinary links and works without JavaScript.

## Verification

- Unit-test cookie priority, all five supported language families, missing
  headers, unsupported headers, and mixed unsupported/supported headers.
- Unit-test `x-default` on home alternates and its absence on non-home routes.
- Render-test the neutral page links, metadata, and JSON-LD.
- Verify `/` uses `lang="und"` while localized routes retain their locale.
- Run the full test, lint, and production build gates.
- After merge and CI/CD deployment, smoke-test all five localized home pages,
  the root negotiation matrix, canonical links, alternates, sitemap, and
  structured data before requesting recrawl in Search Console.

## Non-Goals

- No new SEO library or locale dependency.
- No IP geolocation.
- No middleware rewrite.
- No backend, CMS, gateway, or database change.
- No automatic redirect away from an explicit localized URL.
- No promise that Google will display a different domain-level site name for
  each language.
