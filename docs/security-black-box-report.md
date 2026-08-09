# Production black-box security report

Checked on 2026-08-09 against the anonymous production surfaces for
`www.alive.org.tw`, `account.alive.org.tw`, and `admin.alive.org.tw`.

## Scope and safety

- Used anonymous GET, HEAD, and deliberately wrong-method requests only.
- Checked public response headers, route ownership, CORS rejection, error-body
  disclosure, and TLS certificates.
- Ran the OWASP ZAP baseline passive scan against the public Traditional
  Chinese site for one minute. It discovered 190 URLs.
- Did not brute force, fuzz authenticated operations, mutate production data,
  or scan private service addresses.

## Deployed versions

| Component | Commit | Production revision |
| --- | --- | --- |
| `engagement-api` | `a87da32ce2a3bd7f7bfd2362b4b659ac9be86321` | `engagement-api--0000009` |
| `hhc-web-api` | `0c353558a8dde6f9325f71e20c5eb06d0cee650d` | `hhc-web-api--0000023` |
| `account-api` | `1b0ff44303410ce67e87a59681d563fc6cec571c` | `account-api--0000037` |
| `admin-fe` | `2bb62287a30f94284b039a3847a869d7bef9210e` | `admin-fe--0000029` |
| `hhc-web` | `973d2deaf9d966335c905878884a6b6d6d4dfb08` | `hhc-web--0000028` |
| `api-gateway` | `2457af3f9d9d74acbb688b3a8b8e99ea3a06ac1a` | `api-gateway--0000076` |

The follow-up `hhc-web` verification commit removes the framework
`X-Powered-By` header and adds this report. Its final revision is verified in
the release record rather than represented as the performance baseline build.

## Verified boundaries

| Check | Result |
| --- | --- |
| `www` account-management API | `404 application/json` |
| Wrong method on public session route | `403 application/json` |
| Wrong method on account login route | `403 application/json` |
| Anonymous admin content API | `401 application/json` |
| Forged Dapr caller on `/priv/account/*` | `404 application/json` |
| Unknown public API route | `404 application/json` |
| Untrusted `Origin` on public session route | no `Access-Control-Allow-Origin` |
| Error-body internal hostname, loopback, Dapr, database, stack trace scan | no match |

The gateway emits HSTS, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and
a restrictive Permissions Policy on all three hosts. Account and Admin also
emit `X-Robots-Tag: noindex, nofollow, noarchive`; the public site intentionally
does not.

## TLS

All three hosts present hostname-specific DigiCert/GeoTrust certificates.

| Host | Valid until |
| --- | --- |
| `www.alive.org.tw` | 2026-11-24 23:59:59 UTC |
| `account.alive.org.tw` | 2027-01-29 23:59:59 UTC |
| `admin.alive.org.tw` | 2027-01-30 23:59:59 UTC |

## ZAP baseline

The passive baseline reported 0 failures, 6 warning categories, and 61 passing
rules.

- `X-Powered-By`: fixed by `poweredByHeader: false` in this follow-up.
- Missing CSP: confirmed and deferred as described below.
- Non-storable/cache-control: public dynamic CMS pages currently use Next's
  private no-store response. This is a performance/cacheability issue, not a
  sensitive-data cache leak.
- Modern web application: informational.
- Missing COEP: intentionally not enabled because the public site loads
  cross-origin YouTube thumbnails. Enabling isolation without migrating those
  assets would break content and provides no current product requirement.
- Encoded Next image URLs reported as 404 were crawler parsing false positives;
  browser and Lighthouse image requests succeeded.

## CSP decision

A guessed global CSP was not deployed. The production source inventory is:

- scripts and generated styles from the same origin, including Next inline
  bootstrap content;
- fonts and service worker from the same origin;
- images from the same origin and `https://i.ytimg.com`;
- browser API calls to same-origin Account and Engagement gateway routes;
- inline style attributes used for CMS background images.

A strict policy therefore requires a nonce-capable Next request path and
removal of inline style attributes. A follow-up now adds a cache-compatible
Report-Only policy, a bounded and sanitized report endpoint, and gateway rate
limiting. It intentionally does not add a root-layout nonce because Next would
then dynamically render every document and undo public caching. Enforcement
remains a separate promotion after production reports identify the remaining
inline dependencies.

## Residual risk

- Authenticated admin/account workflows were covered by repository tests and
  deployment smoke, not by destructive production scanning.
- Real iPhone PWA notification delivery and bulletin publish confirmation still
  require a user-device acceptance check.
- Public dynamic cacheability and strict CSP remain explicit follow-up work.
