# Production performance baseline

Measured on 2026-08-09 against the production routes after `hhc-web` commit
`973d2deaf9d966335c905878884a6b6d6d4dfb08` was deployed as revision
`hhc-web--0000028`.

## Method

- Lighthouse 13.4.1 with Google Chrome 151.0.7922.108 and its simulated-mobile defaults.
- Pre-change values are the single production run captured before deployment.
- Post-change values are the median of three consecutive production runs per locale.
- TBT is recorded as the lab proxy because Lighthouse does not produce field INP.
- Transfer is Lighthouse total byte weight, not only the HTML document.

## Lighthouse

| Locale | Phase | Performance | FCP | LCP | CLS | TBT | Transfer |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `zh-Hant` | Before | 58 | 5.14 s | 10.55 s | 0.008 | 5 ms | 8.41 MB |
| `zh-Hant` | After median | 71 | 3.46 s | 5.58 s | 0.008 | 9 ms | 3.17 MB |
| `zh-Hans` | Before | 55 | 14.90 s | 45.65 s | 0.008 | 8 ms | 9.59 MB |
| `zh-Hans` | After median | 56 | 10.58 s | 16.43 s | 0.000 | 51 ms | 3.54 MB |
| `en` | Before | 59 | 6.61 s | 32.71 s | 0.010 | 11 ms | 8.05 MB |
| `en` | After median | 58 | 7.02 s | 11.62 s | 0.000 | 19 ms | 2.81 MB |

| Locale | Accessibility before/after | Best practices before/after | SEO before/after |
| --- | ---: | ---: | ---: |
| `zh-Hant` | 96 / 96 | 100 / 100 | 100 / 100 |
| `zh-Hans` | 96 / 96 | 96 / 100 | 100 / 100 |
| `en` | 96 / 96 | 96 / 100 | 100 / 100 |

## HTTP document check

Three production requests per locale remained stable. The table records the
median post-change request and the pre-change reference.

| Locale | HTML before/after | TTFB before/after | Total before/after |
| --- | ---: | ---: | ---: |
| `zh-Hant` | 66.1 / 69.0 KB | 191 / 186 ms | 287 / 269 ms |
| `zh-Hans` | 66.1 / 68.9 KB | 184 / 180 ms | 299 / 271 ms |
| `en` | 67.8 / 70.6 KB | 228 / 181 ms | 340 / 276 ms |

## Result

- Total transferred bytes fell by 62% for Traditional Chinese, 63% for
  Simplified Chinese, and 65% for English.
- The subset display font and optimized hero substantially reduced LCP without
  regressing accessibility, best-practices, SEO, or layout stability.
- The target Performance score of 90 and LCP of 2.5 seconds was not met. The
  largest remaining transfers are two CMS image derivatives (about 548 KiB and
  286 KiB), generated CSS (about 414 KiB combined), and locale body-font files.
  Simplified Chinese also showed consistently higher network-bound paint time.
- A later performance task should serve smaller list-card image derivatives and
  review locale font preloads. Those changes are not hidden inside this release
  because they change the asset and typography contracts.

## 2026-08-10 follow-up (local verification)

- Home and About now use 60-second ISR instead of forced dynamic rendering.
- The bare-domain locale redirect runs on the server, without a client loading screen.
- Home news and video thumbnails use responsive Next image output at quality 70.
- Body fonts no longer preload and use variable weights with `font-display: swap`.
- Generated production CSS is 348,950 bytes and is guarded by a 400 KiB build budget.
- The localized homepage response is 43,138 bytes locally and returns `s-maxage=60`.

Production Lighthouse numbers remain unchanged in this document until the PR is deployed and the same three-run method can be repeated.
