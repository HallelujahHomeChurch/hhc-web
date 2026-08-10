# Platform UI, Performance, Upload, And Observability Improvement Plan

> **For agentic workers:** Execute this plan task by task. Keep each repository change in its own focused PR and require CI before squash merge.

**Goal:** Correct the confirmed shared UI, account/admin usability, weekly upload, public performance, and production observability gaps without adding another self-hosted operations platform.

**Architecture:** Keep product ownership unchanged. `frontend-platform` owns shared interaction primitives, each frontend owns product copy and layout, `asset-api` owns scan execution, and Azure Monitor owns ACA logs, metrics, alerts, and backend traces. Sentry Developer is limited to frontend/runtime error diagnosis. OpenTelemetry propagates W3C trace context through the gateway and Go services.

**Related baseline:**

- `docs/superpowers/plans/2026-08-10-public-performance-and-csp-hardening.md`
- `docs/performance-baseline.md`
- `docs/security-black-box-report.md`
- `docs/superpowers/specs/2026-07-08-hhc-platform-slo-observability-and-runbook-design.md`

## Confirmed Production Baseline

- `alive-env` sends ACA console and system logs to `alive-env-logs`.
- `ContainerAppConsoleLogs_CL` and `ContainerAppSystemLogs_CL` use the Analytics plan with 30-day retention and no long-term archive.
- Recent 30-day ingestion is approximately 561 MB of console logs and 25 MB of system logs.
- ACA platform metrics exist, but production alert coverage is concentrated on notification services.
- The ACA environment has no managed OpenTelemetry configuration and the `alive` resource group has no production Application Insights resource.
- CSP Report-Only delivery is active. A bounded synthetic report returned 204 and appeared in ACA logs with sanitized origin/path fields.
- Public mobile Lighthouse measured LCP near 9.4 seconds. The optimized hero response is small; render-blocking CJK font CSS is the larger confirmed cost.
- Bulletin replacement requests that reached the server completed successfully. The perceived stall is dominated by missing client progress/timeout behavior and an asset scan job that polls its queue every 30 seconds.

## Global Constraints

- Do not replace Log Analytics with ELK, Loki, Grafana, or Jaeger at the current volume.
- Do not duplicate all ACA logs into Sentry.
- Do not enable Session Replay on Account or Admin.
- Do not log cookies, tokens, passwords, email addresses, request bodies, signed URLs, or full query strings.
- Treat stdout JSON in Log Analytics as the only application-log pipeline, Azure native metrics as the platform-metric source, OpenTelemetry/Application Insights as the backend-trace pipeline, Sentry as the browser-error/Web-Vitals view, and owning databases as the audit source.
- Do not export application logs through OpenTelemetry or install a second Application Insights SDK beside the OpenTelemetry SDK.
- Use one correlation contract: a shared 32-hex trace ID across sampled Sentry browser spans and Azure backend traces, a gateway-issued request ID for every HTTP request, and stable domain IDs for queued or long-running workflows.
- Keep CSP in Report-Only until organic reports are clean for 48-72 hours and the unrelated Next `NoFallbackError` bursts are understood.
- Preserve React Aria keyboard navigation, outside click, Escape, focus restore, and visible keyboard focus.
- Preserve queue and ClamAV scanning; do not bypass scanning or replace bounded polling with WebSocket infrastructure.

---

### Task 1: Shared Icon Button And Account Menu

**Repository:** `frontend-platform`

- [ ] Make `IconButton` dimensions stable for every size: equal inline/block size, zero padding, `aspect-ratio: 1`, `border-radius: 50%`, and no flex shrink.
- [ ] Keep avatar hover inside the image boundary and keyboard focus as an inset coral ring.
- [ ] Give every account-menu item the same full-width hit area, padding, radius, and alignment.
- [ ] Use primary-soft hover for normal actions and danger-soft hover for sign out; add a separator before sign out.
- [ ] Replace external menu-item focus outlines with an accessible inset focus treatment.
- [ ] Add light/dark, pointer, keyboard, Escape, outside-click, and focus-restore component tests.
- [ ] Extend the existing CMS client request methods with an optional `AbortSignal` for create-session and complete/attach calls so Task 5 does not require a second shared-package release.
- [ ] Merge through CI, publish one new immutable package version, and verify the package registry before updating consumers. Pin the exact version and frozen lockfile in `hhc-web`, `account-fe`, and `admin-fe`; rollback by restoring the previous pinned version.

**Acceptance:** Footer notification, YouTube, and Facebook controls are equal 44x44 circles; account-menu rows have identical geometry and sign out differs only by semantic color and separator. All three consumers install the same published package version with frozen lockfiles.

### Task 2: Account Copy, Title, And Menu Integration

**Repository:** `account-fe`

- [ ] Rename `教會網站` to `官網`, `教会网站` to `官网`, and `Church website` to `Official site`.
- [ ] Set the initial and runtime titles to `帳戶 | 哈利路亞家教會`, with Simplified Chinese and English equivalents.
- [ ] Consume the corrected shared account-menu states without app-specific outline overrides.
- [ ] Update locale and title tests.

### Task 3: Public Weekly Labels, News Copy, And LCP

**Repository:** `hhc-web`

- [ ] Treat weekly version names as file-language identity rather than UI translation: `繁中`, `简中`, and `English` in every site locale.
- [ ] Remove the redundant locale-specific `versionLabels` messages and test all three site locales.
- [ ] Remove the final punctuation from all three latest-news banner subtitles.
- [ ] Replace Noto Sans TC/SC body webfonts with the system CJK sans stack.
- [ ] Obtain the official Simplified Chinese display-font source and license, commit the required license notice, then generate a deterministic local WOFF2 subset containing only fixed banner glyphs; keep the existing Traditional display subset.
- [ ] Do not block removal of the Noto body webfonts if the Simplified display-font source or license is not ready; retain the current fallback for that one display string.
- [ ] Keep Inter for Latin content and avoid subsetting dynamic CMS body content.
- [ ] Re-run three mobile Lighthouse samples and record the median in `docs/performance-baseline.md`.

**Targets:** No CLS regression; mobile LCP below 4 seconds, with 2.5 seconds retained as the desired target.

### Task 4: Admin Account And Access Information Architecture

**Repository:** `admin-fe`

- [ ] Set the initial and runtime titles to `管理中心 | 哈利路亞家教會`, with Simplified Chinese and English equivalents.
- [ ] Remove the visible `使用者詳細資料` table header and text link.
- [ ] Use a right-aligned edit icon action with tooltip and an email-specific accessible label.
- [ ] Use the selected user's name or email as the edit-page title.
- [ ] Rebuild the user edit page as one single-column settings flow: account, login methods, roles, advanced direct permissions, and account state.
- [ ] Let administrators edit role selections locally and save the minimal add/remove diff through existing APIs.
- [ ] Keep direct permissions separate and collapsed by default; clearly distinguish inherited and direct permissions.
- [ ] Move account enable/disable into the bottom danger area with explicit confirmation.
- [ ] Align Users, Roles, Permissions, and OAuth clients with the website-content list pattern: shared toolbar, async states, table frame, sticky header, pagination, and icon actions.
- [ ] Preserve horizontal, non-wrapping mobile tables rather than converting management rows into nested cards.

### Task 5: Bulletin Replacement Progress And Scan Latency

**Repositories:** `frontend-platform`, `admin-fe`, `asset-api`, `hhc-web-api`

- [ ] Display explicit upload stages: preparing file, uploading, attaching, and waiting for security scan.
- [ ] Add an AbortController timeout of two minutes to the signed Blob upload and 15 seconds to completion/attachment requests.
- [ ] Preserve the selected file and localized metadata after a retryable failure.
- [ ] Close the upload dialog after attachment succeeds; show scan status in the locale row with `通常約 1 分鐘` guidance.
- [ ] Keep bounded status polling and expose retry only for failed or timed-out states.
- [ ] Use the existing `asset_id` across create-session, Blob upload, complete, attach, and scan logs without logging the signed URL or private filename; do not add another database correlation field.
- [ ] Reduce the asset scan job queue polling interval from 30 seconds to 10 seconds and compare queue pickup latency before and after deployment.
- [ ] Keep existing backend replacement/grant-retirement coverage. Add the missing Admin flow regression for replacing the same locale twice, Blob timeout, completion retry, dialog closure, pending/clean scan states, and retaining the selected file/title after a retryable failure.

### Task 6: Frontend Sentry Error Monitoring

**Repositories:** `hhc-web`, `account-fe`, `admin-fe`

- [ ] Create separate Sentry projects for public web, account, and admin under the HHC organization.
- [ ] Add CSP Report-Only baselines to Account and Admin before enabling their Sentry DSNs; record current first-party violations and add only each project's exact regional ingest origin.
- [ ] Capture runtime exceptions, React/Next errors, failed-request breadcrumbs, release, environment, and Git commit SHA.
- [ ] Use `SENTRY_RELEASE=${GITHUB_SHA}` and upload source maps from the same production build that creates the deployed image; inject the organization token as a BuildKit secret, then remove source maps from the runtime image.
- [ ] Use an organization token restricted to `org:ci`; add `org:read` only if the selected CLI operation proves it is required.
- [ ] Set `sendDefaultPii: false`, `includeLocalVariables: false` for the Next server, and implement shared `beforeSend`, `beforeSendTransaction`, and `beforeBreadcrumb` sanitizers.
- [ ] Remove URL query/hash values, cookies, authorization headers, user/email fields, form data, request/response bodies, OAuth codes, verification/reset tokens, and Blob SAS values before events leave the app.
- [ ] Enable Sentry server-side default data scrubbing, IP-address scrubbing, and explicit sensitive-field rules as a second layer.
- [ ] Disable Session Replay for Account and Admin; leave it disabled on public web until a separate privacy review approves masked replay.
- [ ] Keep Sentry server performance tracing disabled; start browser performance tracing at 10% while retaining error events.
- [ ] Propagate `sentry-trace` only to approved HHC API routes. Capture the response `X-HHC-Request-ID` as a sanitized Sentry breadcrumb/tag so unsampled and partial traces remain diagnosable.
- [ ] Add only the exact regional ingest origin from each project DSN to CSP `connect-src`; do not use a wildcard Sentry origin.
- [ ] Keep CSP reports in Log Analytics rather than duplicating them into Sentry; accept a bounded Reporting API batch, emit one sanitized JSON record per violation, and retain no query values.
- [ ] Publish the updated privacy-policy disclosure before enabling production DSNs.
- [ ] Verify scrubbers with controlled OAuth code, verification token, reset token, email, query/hash, and SAS URL values and assert that no original value reaches Sentry.

**Boundary:** Sentry is the frontend application-error view. It does not replace Log Analytics, ACA metrics, audit records, or backend operational logs.

### Task 7: Structured ACA Logs And Correlation

**Repositories:** `api-gateway`, all production Go services

- [ ] Standardize JSON logs with `service`, `environment`, `release`, `request_id`, `trace_id`, route template, method, status, duration, and stable error code.
- [ ] Generate a new bounded `X-HHC-Request-ID` at every public gateway entry, pass it to every upstream, include it in access logs, return it to callers, and expose it through CORS where required.
- [ ] Ignore external `X-HHC-Request-ID`, `traceparent`, and `tracestate` at the public boundary. On approved frontend API routes only, strictly validate the untrusted `sentry-trace` header, convert its trace ID, parent span ID, and sampled flag into W3C `traceparent`, then remove Sentry-specific tracing headers before proxying upstream.
- [ ] If `sentry-trace` is absent or invalid, let the first instrumented backend service create a new W3C trace. Never use trace context for authentication, authorization, rate limiting, or other security decisions.
- [ ] Preserve the W3C trace ID across trusted service-to-service HTTP and messaging calls; attach stable `asset_id`, `bulletin_id`, `notification_id`, or equivalent domain IDs where asynchronous work may outlive or split a trace.
- [ ] Add regression tests for newline injection, oversized correlation values, and malformed trace headers.
- [ ] Remove duplicate forwarded-IP fields and raw User-Agent values from routine access logs; keep normalized browser/OS or full network context only for explicitly documented security events.
- [ ] Do not emit raw user/device identifiers in operational logs; use a stable non-reversible correlation value only where diagnosis requires it.
- [ ] Exclude successful health-probe and static-asset requests from high-volume gateway access logs; retain failures and security events.
- [ ] Add saved KQL queries for request ID, trace ID, release, CSP violations, asset ID, bulletin issue ID, notification message ID, 5xx ratio, and slow requests.
- [ ] Keep security/admin audit records in their owning database with the documented retention policy rather than relying on expiring application logs.

### Task 8: Azure Monitor Metrics, Traces, And Alerts

**Runtime:** Azure Container Apps and Azure Monitor

**Infrastructure owner:** `api-gateway/infra/observability.bicep` with a separate manually triggered workflow. Individual service releases must not mutate the shared ACA environment.

- [ ] Capture the current ACA environment configuration and run Bicep what-if before every environment-level change; document the command or deployment that restores the previous configuration.
- [ ] Create one workspace-based Application Insights resource linked to `alive-env-logs`.
- [ ] Instrument one bounded `hhc-web-api` to `asset-api` staging flow first with the Go OpenTelemetry SDK, HTTP instrumentation, and OTLP gRPC exporter; set `service.name`, `service.version`, and `deployment.environment.name`.
- [ ] Enable only the ACA managed OpenTelemetry trace destination to Application Insights. Keep logs in stdout/Log Analytics and metrics in Azure native metrics.
- [ ] Verify telemetry export is fail-open and that an unavailable collector never fails or delays a business request.
- [ ] Instrument the remaining high-value flows only after the staging flow is verified: account to Redis/PostgreSQL, CMS to asset, and engagement to notification.
- [ ] Capture HTTP and supported PostgreSQL, Redis, Blob, and messaging dependency spans without query text or payload data.
- [ ] Use a parent-based trace-ID-ratio sampler at the first instrumented backend service; downstream services honor the parent sampled flag.
- [ ] Use 100% tracing only during a time-bounded staging verification. Start Sentry browser tracing and backend root sampling at the same 10% production rate, preserve incoming sampled flags, and review ingestion after seven days.
- [ ] Add one Azure Workbook for traffic, 5xx ratio, p95 latency, restart count, replica count, queue age, scan latency, and notification delivery.
- [ ] Inventory existing alerts first, including owner, action group, evaluation frequency, runbook, and estimated monthly cost; reuse `RecommendedAlertRules-AG-1` and remove or avoid duplicates.
- [ ] Initially alert only on public unavailability, sustained 5xx, unusable JWKS, and scan backlog; dashboard CPU/memory/restart/latency signals until measured thresholds justify paging.
- [ ] Every alert must have an owner, minimum-volume/no-data behavior, runbook, and controlled trigger verification. Keep one-minute log-query alerts only for page-worthy failures.
- [ ] Treat Log Analytics as the incident source of truth and traces as diagnostic assistance; add a low-frequency synthetic trace check because the managed agent is a single-replica, best-effort pipeline.
- [ ] Add an ingestion-volume budget alert before the shared 5 GB monthly allowance can be unexpectedly exceeded.
- [ ] Configure an Application Insights daily cap as a final cost guardrail, with an alert before the cap is reached rather than treating the cap as normal flow control.

### Task 9: Retention And Cost Guardrails

- [ ] Keep ACA console/system logs at 30 days of interactive retention.
- [ ] Do not enable ACA long-term retention initially; review individual tables after seven and 30 days and extend only a table with a documented incident or compliance need.
- [ ] Keep Application Insights tables within their included 90-day retention unless incident evidence justifies more.
- [ ] Review Azure Cost Management after seven and 30 days, grouped by Log Analytics ingestion, retention, metric alerts, and scheduled-query alerts.
- [ ] Record a baseline cost projection in the operations runbook.

**Initial estimate:**

- Sentry Developer: USD 0 while one-user and event/span quotas are sufficient.
- Current ACA log ingestion: likely USD 0 while the shared Azure Monitor 5 GB monthly allowance remains available.
- One to two additional GB of sampled traces: expected to remain inside that allowance.
- Metrics and scheduled-query alerts: approximately USD 10-20 per month, depending primarily on evaluation frequency.
- Actual billable ingestion depends on the subscription's active allowance and pricing meter; replace estimates with Cost Management data after seven and 30 days.

### Task 10: Verification, Runbooks, And Delivery

- [ ] Before each repository task, fetch `origin/main` and create a new focused `codex/*` branch from that exact commit; do not reuse unrelated local feature branches.
- [ ] Verify Sentry source-map resolution with a controlled, non-sensitive frontend exception in staging.
- [ ] Verify a sampled browser request has the same 32-hex trace ID in Sentry and Application Insights, with the gateway request ID available in both systems.
- [ ] Verify an unsampled request remains traceable through `X-HHC-Request-ID`, and one queued workflow remains traceable through its stable domain ID.
- [ ] Verify one login, one bulletin replacement/scan, and one notification flow end to end.
- [ ] Verify one bulletin replacement can be followed through Admin, CMS, Asset, and scan logs using the existing `asset_id`; do not add a database correlation column.
- [ ] Disable the OpenTelemetry destination during a controlled staging request and verify the API remains healthy and latency does not materially regress.
- [ ] Confirm logs and traces contain no raw credentials, user content, email, signed URLs, or query values.
- [ ] Confirm CSP reports remain queryable after the logging changes.
- [ ] Update service runbooks with dashboard, KQL, alert, rollback, and cost links.
- [ ] Record Bicep what-if output and a tested disable/rollback procedure for every ACA environment-level observability change.
- [ ] Run repository-specific tests, lint, and builds before each PR.
- [ ] Merge each repository through required CI using squash merge and verify the production revision and route after deployment.

## Delivery Order

1. Synchronize every repository from `origin/main`; create isolated task branches.
2. `frontend-platform`: shared icon/account-menu behavior and CMS-client timeout contract; publish one verified package version.
3. `account-fe`, `hhc-web`, and `admin-fe`: pin the same shared version and update their lockfiles.
4. `account-fe`: copy, title, and menu integration.
5. `hhc-web`: weekly labels, news copy, and font/LCP work.
6. `admin-fe`: account/access IA, title, and bulletin progress.
7. `hhc-web-api` and `asset-api`: upload correlation, Admin-focused replacement regression, and scan polling interval.
8. Gateway and Go services: PII-safe structured logging, trusted request IDs, and backend trace context.
9. `api-gateway` infrastructure workflow: Application Insights and a bounded staging OpenTelemetry trace flow.
10. `hhc-web`, `account-fe`, and `admin-fe`: CSP/Sentry integration after correlation and privacy controls exist.
11. Azure infrastructure: workbook, deduplicated alerts, and budget controls.
12. Production verification and runbook evidence.

## Completion Criteria

- Shared controls are visually and behaviorally consistent in light/dark and desktop/mobile layouts.
- One published `frontend-platform` version is pinned by all three frontend consumers and installs with frozen lockfiles.
- Admin account and access workflows no longer depend on generic detail links or chip walls.
- Replacing an existing bulletin version has visible bounded progress and completes without an indefinite pending state.
- Public LCP improvement is measured from three comparable production runs.
- Frontend exceptions resolve to the deployed commit and source line without exposing PII.
- Account and Admin CSP Report-Only policies allow expected traffic without permitting wildcard Sentry origins.
- Logs, metrics, and traces cover the three production observability pillars; sampled Sentry browser spans and Azure backend traces share a trace ID, while request and domain IDs provide fallback correlation.
- OpenTelemetry exporter failure is fail-open, and every shared Azure environment change has a reviewed what-if and explicit rollback.
- Operational telemetry remains inside the documented initial cost range or has an explained, approved variance.
