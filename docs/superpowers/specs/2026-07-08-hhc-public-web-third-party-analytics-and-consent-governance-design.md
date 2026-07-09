# HHC Public Web Third-Party, Analytics, And Consent Governance Design

This spec defines how `hhc-web`, `hhc-web-api`, `api-gateway`, and the CMS should govern third-party links, embeds, public analytics, consent, and browser allowlists for the public website.

The current public site already links to YouTube, Facebook, Google Maps, weekly PDFs, and public image assets. Future phases may add embedded videos, maps, analytics, tag scripts, newsletter forms, event registration, donation checkout, or richer LINE entry points. These integrations can quietly weaken privacy, CSP, performance, and editorial safety unless they are treated as an explicit platform boundary.

The goal is to make third-party integrations useful but boring: registered, reviewed, observable, privacy-minimized, and reversible without creating a premature `analytics-api`, `consent-api`, `tag-manager-api`, or third-party proxy service.

## Related Specs

- `docs/superpowers/specs/2026-07-08-hhc-web-browser-security-boundary-and-http-headers-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-data-classification-privacy-retention-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-configuration-feature-flag-and-release-control-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-site-settings-navigation-and-shared-layout-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-cms-structured-content-blocks-and-renderer-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-accessibility-performance-and-media-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-public-web-seo-url-and-discoverability-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-rendering-and-delivery-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-abuse-prevention-rate-limit-and-quota-design.md`
- `docs/superpowers/specs/2026-07-08-hhc-web-future-domain-extension-strategy.md`

External alignment:

- W3C Privacy Principles: `https://www.w3.org/TR/privacy-principles/`
- OWASP Third Party JavaScript Management Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html`
- OWASP Content Security Policy Cheat Sheet: `https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html`
- MDN Subresource Integrity: `https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity`
- YouTube Privacy Enhanced Mode help: `https://support.google.com/youtube/answer/171780`

## Core Decision

V1 does not add any of these services:

- `analytics-api`
- `consent-api`
- `tag-manager-api`
- `third-party-api`
- `embed-api`
- `tracking-api`

Third-party governance is split by existing ownership:

| Concern | Owner | Reason |
| --- | --- | --- |
| Public rendering and lazy-loading behavior | `hhc-web` | Browser behavior is a frontend responsibility |
| CMS-entered external links and embed declarations | `hhc-web-api` | Editorial data must be validated before publish |
| CSP, CORS, headers, and route allowlists | `api-gateway` plus app headers | Browser policy is an edge and app delivery boundary |
| Analytics provider enablement | platform config | Runtime integration must not be editable by CMS admins |
| Consent UI and public preference cookie | `hhc-web` | Consent prompt is browser UI state in v1 |
| Consent-sensitive submission workflows | future owning domain | Contact, newsletter, event, donation consent belongs to the domain that owns the data |
| Third-party registry | platform governance document plus config | Provider changes need review, not a new runtime service |

This keeps the architecture aligned with the earlier rule: add a service only when it owns a durable business capability, independent data lifecycle, independent deployment cadence, or materially different risk domain.

## Non-Goals

This spec does not define legal text for any jurisdiction. Privacy policy wording still needs owner review.

This spec does not implement membership, newsletter, event registration, donations, or pastoral workflows. Those domains require their own consent and retention appendices before launch.

This spec does not allow CMS users to paste arbitrary JavaScript, iframes, tracking pixels, or provider widgets.

## Provider Registry

Every third-party public-web integration must have a registry entry before production use.

Registry fields:

| Field | Required | Notes |
| --- | --- | --- |
| `provider_id` | yes | Stable id such as `youtube`, `google_maps`, `facebook`, `plausible`, or `application_insights` |
| `display_name` | yes | Human-readable provider name |
| `purpose` | yes | Video, map, social link, analytics, error telemetry, donation checkout, etc. |
| `integration_type` | yes | `external_link`, `embed`, `script`, `pixel`, `form_post`, `webhook`, `server_side` |
| `data_categories` | yes | Public content, device data, IP address, click event, form data, payment metadata, etc. |
| `route_scope` | yes | Public routes where it may appear |
| `default_state` | yes | `enabled`, `disabled`, or `consent_required` |
| `cms_allowed` | yes | Whether CMS editors can reference it |
| `allowed_hosts` | yes | Hostname allowlist for links, embeds, scripts, frames, images, or connect endpoints |
| `csp_directives` | yes | Required `script-src`, `frame-src`, `img-src`, `connect-src`, or `media-src` additions |
| `sri_required` | conditional | Required for static third-party script assets when feasible |
| `sandbox_required` | conditional | Required for iframes unless provider breaks essential behavior |
| `consent_category` | yes | `essential`, `functional`, `analytics`, `marketing`, `payment`, or `none` |
| `owner` | yes | Platform, web, CMS, account, engagement, donation, etc. |
| `privacy_policy_note` | yes | What must be disclosed in privacy policy or site notice |
| `rollback_action` | yes | Disable flag, remove CSP host, replace embed with link, or remove script |

V1 approved registry:

| Provider | Integration | V1 state | CMS allowed | Notes |
| --- | --- | --- | --- | --- |
| YouTube channel/video | external link | enabled | yes, as link or video metadata | Use direct links and local/asset thumbnails by default |
| YouTube embed | embed | disabled by default | no arbitrary iframe | Enable only through a structured video block with click-to-load |
| Google Maps | external link | enabled | yes, as location map link | Prefer outbound map links over embedded maps in v1 |
| Google Maps embed | embed | disabled by default | no arbitrary iframe | Enable only through structured location block if needed |
| Facebook page | external link | enabled | yes, as social link | No Facebook script widgets in v1 |
| Public asset CDN/Blob route | media link | enabled | yes through `asset-api` ids | Do not expose Blob/SAS URLs |
| Application Insights browser SDK | script/connect | disabled by default | no | Prefer server-side telemetry for v1 public pages |
| Privacy-first analytics provider | script or server-side | disabled by default | no | Add only after registry, consent, CSP, and privacy review |
| Tag manager | script | not approved in v1 | no | Too broad for current public-site needs |

## External Link Governance

External links are allowed only as data, never as raw HTML.

CMS and site settings validators must enforce:

- `https://` for public external links unless a specific scheme is approved.
- No `javascript:`, `data:`, `vbscript:`, `file:`, or custom app schemes.
- No private IP ranges, loopback hosts, local network hosts, or internal service DNS names.
- No `www.alive.org.tw/priv/*`, admin-only routes, provider admin dashboards, Blob SAS URLs, direct storage URLs, or raw upload URLs.
- No URL parameters that carry tokens, one-time codes, raw emails, phone numbers, LINE ids, or other private identifiers.
- Optional campaign parameters must be allowlisted per provider and purpose.
- User-visible link text must describe the destination.
- External links opened in a new tab must use `rel="noopener noreferrer"`.
- Social and map links must use registry-approved hosts.

`hhc-web-api` stores the canonical URL as editorial data. `hhc-web` renders it through typed components such as `ExternalLink`, `VideoLink`, `MapLink`, or `SocialLink`.

Do not let structured content blocks render arbitrary `<a>` attributes from editor input.

## Embed Governance

V1 should prefer external links and local/asset-managed thumbnails instead of third-party iframes.

Embeds are allowed only through structured block types:

- `videoEmbed`
- `mapEmbed`
- future `donationCheckout`
- future `eventRegistrationWidget`

Each embed block must map to a registry-approved provider and include only provider-specific ids or normalized URLs. The renderer builds the iframe or script URL from safe templates.

Common embed rules:

- Do not store raw iframe HTML in CMS.
- Do not let editors set arbitrary `src`, `srcdoc`, event handlers, inline scripts, or iframe permissions.
- Use lazy loading.
- Use a static placeholder until the user chooses to load the provider if the provider is not essential to the page.
- Use `sandbox` for iframes where supported.
- Use a narrow `allow` attribute. Avoid camera, microphone, payment, clipboard, and geolocation unless required by a reviewed feature.
- Use `referrerpolicy` appropriate to the provider and feature.
- Disable autoplay by default.
- Define the required `frame-src` CSP host in the provider registry.
- Provide accessible title text for iframe content.
- Provide a fallback external link.

### YouTube

Default v1 behavior:

- Show video cards using local data or CMS video metadata.
- Use YouTube links for navigation to the channel or video.
- Use locally served or asset-managed thumbnails where practical.

If inline playback is enabled:

- Use a structured `videoEmbed` block.
- Load the iframe only after user activation.
- Use the privacy-enhanced embed host where compatible.
- Show a short notice before loading the player that content is provided by YouTube.
- Add only the required `frame-src` and `img-src` hosts.
- Keep the route usable without the iframe.

### Google Maps

Default v1 behavior:

- Render church locations with address text and a `View map` external link.
- Do not embed an interactive map by default.

If map embed is enabled:

- Use a structured `mapEmbed` block tied to a location id.
- Load only after user activation.
- Provide address text and a normal map link as fallback.
- Do not allow arbitrary user-supplied map query strings.

## Third-Party JavaScript

Third-party JavaScript is a security boundary, not a CMS feature.

Rules:

- CMS cannot add third-party scripts.
- Runtime third-party scripts must be declared in platform config and registry.
- Public pages default to no third-party script beyond the app bundle.
- Script host allowlists must be reflected in CSP.
- Static third-party scripts require Subresource Integrity where feasible.
- Dynamic third-party loaders require a stronger review because SRI cannot fully constrain what they load later.
- Tag managers are not allowed in v1 because they turn one approved script into a runtime script deployment system.
- If a future tag manager is approved, it needs a separate release gate, owner, environment separation, publish workflow, and CSP strategy.

Preferred alternatives:

- Use server-side operational telemetry for reliability.
- Use privacy-first, aggregate analytics before adopting identity-linked analytics.
- Use direct provider APIs from owning backend services only when the service owns the data and retention policy.

## Public Analytics Policy

V1 public website analytics are optional. The default production posture is:

- operational logs, metrics, and traces for reliability
- no public marketing pixel
- no tag manager
- no cross-site identity tracking
- no analytics cookies unless explicitly approved
- no CMS-editable analytics snippets

If public analytics are added, choose the lowest-data design that answers the real question.

Acceptable analytics questions:

- Which public pages are broken or slow?
- Which pages are most visited in aggregate?
- Are weekly bulletin downloads failing?
- Which locales are used?
- Which browser/device classes have layout or performance problems?

Questions that require extra review:

- individual visitor journey tracking
- cross-site identity
- remarketing audiences
- ad conversion pixels
- tying public reads to account identity
- collecting exact IP addresses into analytics stores
- sending LINE identifiers or account ids to analytics providers

Preferred v1 model:

1. Server-side operational metrics from `hhc-web`, `api-gateway`, `hhc-web-api`, and `asset-api`.
2. Aggregate public page analytics without cookies if a provider is adopted.
3. Consent-gated browser analytics only when product value clearly justifies it.

Analytics events must be public-safe:

| Event | Allowed Data | Prohibited Data |
| --- | --- | --- |
| `public.page_view` | route template, locale, response status, coarse device class | account id, email, exact IP, LINE id, full URL with query, referrer with private query |
| `public.weekly_download_click` | issue date, locale, file type | direct Blob URL, SAS token, user id |
| `public.external_link_click` | provider id, route template, locale | full destination query if it may contain private data |
| `public.video_open` | provider id, video id, locale | YouTube account identity, raw referrer with private query |
| `public.error` | route template, component id, sanitized error class | stack traces containing secrets, user-entered content |

Use route templates instead of raw paths when a future route may contain slugs with private or sensitive names.

## Consent Model

V1 consent is browser-local and public-site scoped.

Consent storage:

- Store only category choices and version, not user identity.
- Use a host-scoped public preference cookie on `www.alive.org.tw`.
- Cookie value must not include email, account id, LINE id, IP address, or provider id.
- Consent cookie is readable by `hhc-web` because it is UI preference state, not a session secret.
- Use `SameSite=Lax` and `Secure` in HTTPS.
- Expire or refresh according to policy review.

Consent categories:

| Category | Example | Default |
| --- | --- | --- |
| `essential` | locale cookie, security headers, operational logs | always on |
| `functional` | user-activated YouTube or map embed preference | off until user action if provider loads remote content |
| `analytics` | aggregate page analytics provider | off unless approved as no-consent aggregate by policy |
| `marketing` | ad pixels, remarketing, social widgets | not approved in v1 |
| `payment` | provider checkout widget | future domain-specific consent and disclosure |

The consent UI must:

- be available in all supported locales
- avoid dark patterns
- allow reject non-essential categories
- allow changing choices later
- not block essential public content
- not load non-essential scripts before the relevant choice is made

Click-to-load embeds can be treated as feature-level consent for that provider on that page. If a persistent provider preference is stored, it must be part of the consent model.

## Privacy Policy And Disclosure

The privacy policy must stay aligned with actual integrations.

Before enabling a new third-party provider, update:

- provider registry entry
- privacy policy or public notice text
- CSP allowlist
- consent category
- rollout verification evidence
- rollback plan

Do not mention providers in privacy policy that are not actually used unless the text clearly describes future or conditional usage.

Do not enable providers that are not reflected in privacy policy or a user-visible notice.

## CMS Authoring Rules

CMS editors can:

- choose registry-approved social links
- choose registry-approved map links
- reference video ids or normalized video URLs through structured blocks
- reference public assets through `asset-api` ids
- enter plain external links that pass URL validation

CMS editors cannot:

- paste scripts
- paste iframe HTML
- change CSP
- add analytics providers
- add tag manager containers
- add provider API keys
- add checkout widgets
- link to admin/provider dashboards
- publish Blob/SAS URLs
- create hidden tracking pixels

Admin preview must render placeholders for disabled or consent-gated embeds. Preview must not load third-party providers unless the editor explicitly activates the preview embed.

## API And Schema Implications

`hhc-web-api` can keep this inside existing CMS/site-settings tables in v1.

Recommended fields for structured blocks and site settings:

```text
provider_id
integration_type
external_url
provider_resource_id
display_label
consent_category
open_in_new_tab
tracking_params_json
validation_status
last_validated_at
```

The publish validator checks:

- provider id exists in the registry
- URL host is allowlisted
- integration type is allowed for the block type
- consent category matches provider registry
- required fallback text is present
- no forbidden URL schemes or secret-like query keys exist

Do not store provider secrets in CMS tables. Provider API keys belong to Key Vault, ACA secrets, or the owning backend service.

## Browser Headers And CSP

The browser security boundary spec remains the source of truth for full header profiles. This spec adds third-party review rules.

CSP changes require:

- provider registry entry
- route scope
- justification
- rollout in report-only before enforce when practical
- test that unrelated routes do not gain the provider host
- rollback plan

Directive guidance:

| Integration | CSP Area |
| --- | --- |
| YouTube iframe | `frame-src`, possibly `img-src` for thumbnails |
| Google Maps iframe | `frame-src`, possibly `img-src` |
| Analytics browser SDK | `script-src`, `connect-src` |
| Public asset routes | normal same-origin asset policy |
| Social outbound links | no CSP expansion needed |

Avoid broad directives such as:

- `script-src *`
- `frame-src *`
- `connect-src *`
- broad `https:` allowlists
- adding provider hosts globally when only one route needs them

## Performance And Accessibility

Third-party integrations must not dominate the public website's first load.

Rules:

- No third-party iframe or analytics script in the first paint path unless explicitly approved.
- Use static placeholders for videos and maps.
- Reserve dimensions for embed containers to avoid layout shift.
- Provide text equivalents and external-link fallbacks.
- Make consent and click-to-load controls keyboard accessible.
- Do not block page content while third-party providers are unavailable.
- Measure provider impact in staging before production rollout.

## SEO

Third-party embeds must not be the only source of public content.

For videos:

- Store public title, summary, thumbnail, provider id, provider video id, and canonical link in CMS or projection.
- Render crawlable title and summary without loading YouTube.
- Use structured data only when content ownership and metadata are accurate.

For locations:

- Render church name, address, and map link as normal HTML.
- Do not depend on an iframe for address discoverability.

For weekly PDFs:

- Public download URLs remain owned by `asset-api` or `hhc-web-api` public route contracts.
- Do not link browsers or bots directly to Blob/SAS URLs.

## LINE Bot Implications

LINE bot workflows must not depend on browser-only consent or third-party client scripts.

Allowed:

- send a weekly bulletin public download route from `hhc-web-api`
- send a YouTube public link if a command returns video metadata
- send a Google Maps public link for a location command

Not allowed:

- send Blob/SAS URLs
- send tracking-link variants that identify a LINE group or user
- bypass `hhc-web-api` to scrape CMS content or storage
- rely on browser consent state for bot responses

If link click attribution is needed for LINE later, design it in the owning domain with explicit privacy, retention, and abuse controls. Do not hide LINE identifiers in query strings.

## Operational Controls

Feature flags:

| Flag | Owner | Purpose |
| --- | --- | --- |
| `publicEmbeds.youtube.enabled` | web/platform | Enables structured YouTube embed rendering |
| `publicEmbeds.maps.enabled` | web/platform | Enables structured map embed rendering |
| `publicAnalytics.enabled` | platform | Enables approved public analytics provider |
| `publicConsent.banner.enabled` | web/platform | Enables consent UI |
| `thirdParty.failClosed` | platform | Blocks unregistered providers in production |

Kill switches:

- disable public analytics
- replace embeds with external links
- remove provider host from CSP
- block provider resource rendering in `hhc-web`
- reject publish for affected provider ids until reviewed

Logs and metrics:

- count blocked unregistered provider references
- count CMS publish validation failures by rule
- count third-party script load failures if analytics is enabled
- count user-activated embeds by provider in aggregate
- alert on CSP violations involving unregistered hosts

Do not log raw full URLs when query strings may contain personal data or tokens.

## Rollout Sequence

1. Create provider registry in documentation and config.
2. Add URL/provider validation to `hhc-web-api` publish paths.
3. Add typed render components in `hhc-web`.
4. Keep current YouTube, Facebook, and map behavior as external links.
5. Add CSP tests proving no broad wildcard directives are required.
6. Add public privacy policy consistency check.
7. If embeds are needed, launch click-to-load placeholders first.
8. If analytics is needed, start with aggregate no-cookie analytics or server-side metrics.
9. Add consent UI before any non-essential browser script or provider cookie flow.
10. Run staging verification with provider disabled, provider slow, CSP violation, and rollback cases.

## Testing Requirements

Unit tests:

- URL scheme allow/deny.
- Host allowlist.
- Private IP and internal host rejection.
- Blob/SAS URL rejection.
- Provider registry validation.
- Structured block renderer rejects raw iframe/script fields.
- Consent cookie parse/build.

Integration tests:

- CMS publish rejects unregistered provider.
- CMS publish rejects arbitrary iframe HTML.
- Public page renders external link fallback without loading iframe.
- YouTube embed placeholder loads iframe only after user activation.
- Map embed placeholder loads iframe only after user activation.
- Analytics script is absent when disabled.
- Consent reject keeps non-essential scripts unloaded.
- CSP headers include only route-needed provider hosts.
- Privacy policy/provider registry consistency check passes.

Browser tests:

- Keyboard access for consent controls and click-to-load controls.
- No layout shift beyond accepted threshold after embed activation.
- External links include safe `rel` attributes.
- Public pages remain usable when provider requests fail.

Security tests:

- No `script-src *`, `frame-src *`, or broad `connect-src *`.
- No CMS-authored script execution.
- No local/private/internal URL publish.
- No full raw URL with private query logged.
- No Blob/SAS URL appears in rendered HTML.

## Acceptance Criteria

- Third-party provider registry exists before production provider use.
- CMS can publish approved external links but cannot publish arbitrary scripts, iframes, Blob/SAS URLs, or internal/admin URLs.
- Current YouTube, Facebook, and map integrations are represented as external links with safe rendering rules.
- Future YouTube or map embeds use structured blocks and click-to-load behavior.
- Public analytics is off by default or explicitly governed by provider registry, config, CSP, privacy notice, and consent rules.
- Tag manager is not approved in v1.
- Consent UI exists before non-essential third-party scripts or persistent provider preferences are enabled.
- CSP changes are provider-scoped, route-scoped, tested, and reversible.
- LINE bot responses use public contracts and do not leak tracking identifiers, Blob/SAS URLs, or browser-only consent assumptions.
- Rollout verification includes provider-disabled, CSP violation, consent reject, CMS validation failure, and rollback evidence.
