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

**Acceptance:** Footer notification, YouTube, and Facebook controls are equal 44x44 circles; account-menu rows have identical geometry and sign out differs only by semantic color and separator.

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
- [ ] Generate a local Simplified Chinese display-font WOFF2 subset containing only fixed banner glyphs; keep the existing Traditional display subset.
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

**Repositories:** `admin-fe`, `asset-api`, `hhc-web-api`

- [ ] Display explicit upload stages: preparing file, uploading, attaching, and waiting for security scan.
- [ ] Add an AbortController timeout of two minutes to the signed Blob upload and 15 seconds to completion/attachment requests.
- [ ] Preserve the selected file and localized metadata after a retryable failure.
- [ ] Close the upload dialog after attachment succeeds; show scan status in the locale row with `通常約 1 分鐘` guidance.
- [ ] Keep bounded status polling and expose retry only for failed or timed-out states.
- [ ] Add a correlation ID across create-session, Blob upload, complete, attach, and scan logs without logging the signed URL or private filename.
- [ ] Reduce the asset scan job queue polling interval from 30 seconds to 10 seconds and compare queue pickup latency before and after deployment.
- [ ] Add a regression test that replaces the same locale twice, including retirement of an already-published version.

### Task 6: Frontend Sentry Error Monitoring

**Repositories:** `hhc-web`, `account-fe`, `admin-fe`

- [ ] Create separate Sentry projects for public web, account, and admin under the HHC organization.
- [ ] Capture runtime exceptions, React/Next errors, failed-request breadcrumbs, release, environment, and Git commit SHA.
- [ ] Upload source maps from CI and do not publish source maps as public build artifacts.
- [ ] Set `sendDefaultPii: false` and scrub cookies, authorization headers, email, tokens, signed URLs, request/response bodies, and query values.
- [ ] Disable Session Replay for Account and Admin; leave it disabled on public web until a separate privacy review approves masked replay.
- [ ] Start production performance tracing at 10% while retaining error events.
- [ ] Restrict trace propagation to HHC same-origin API routes and approved HHC subdomains.
- [ ] Update the privacy policy disclosure before production telemetry begins.

**Boundary:** Sentry is the frontend application-error view. It does not replace Log Analytics, ACA metrics, audit records, or backend operational logs.

### Task 7: Structured ACA Logs And Correlation

**Repositories:** `api-gateway`, all production Go services

- [ ] Standardize JSON logs with `service`, `environment`, `release`, `request_id`, `trace_id`, route template, method, status, duration, and stable error code.
- [ ] Generate or forward `X-HHC-Request-ID` at the gateway and return it to callers.
- [ ] Forward W3C `traceparent` and `tracestate` without treating them as authentication inputs.
- [ ] Exclude successful health-probe and static-asset requests from high-volume gateway access logs; retain failures and security events.
- [ ] Add saved KQL queries for request ID, trace ID, release, CSP violations, asset ID, bulletin issue ID, notification message ID, 5xx ratio, and slow requests.
- [ ] Keep security/admin audit records in their owning database with the documented retention policy rather than relying on expiring application logs.

### Task 8: Azure Monitor Metrics, Traces, And Alerts

**Runtime:** Azure Container Apps and Azure Monitor

- [ ] Create one workspace-based Application Insights resource linked to `alive-env-logs`.
- [ ] Enable the ACA managed OpenTelemetry agent and export backend application traces to Application Insights.
- [ ] Instrument the first high-value flows: account to Redis/PostgreSQL, CMS to asset, and engagement to notification.
- [ ] Capture HTTP and supported PostgreSQL, Redis, Blob, and messaging dependency spans without query text or payload data.
- [ ] Use 100% tracing during bounded staging verification, then start production sampling conservatively and adjust from measured ingestion.
- [ ] Add one Azure Workbook for traffic, 5xx ratio, p95 latency, restart count, replica count, queue age, scan latency, and notification delivery.
- [ ] Add multi-resource metric alerts for unavailable replicas, restart spikes, CPU/memory saturation, and sustained latency.
- [ ] Keep one-minute log-query alerts only for page-worthy failures; move lower-risk rules to five-minute evaluation.
- [ ] Add an ingestion-volume budget alert before the shared 5 GB monthly allowance can be unexpectedly exceeded.

### Task 9: Retention And Cost Guardrails

- [ ] Keep ACA console/system logs at 30 days of interactive retention.
- [ ] Set 90 days of total retention for ACA console/system tables, using long-term retention after the interactive window.
- [ ] Keep Application Insights tables within their included 90-day retention unless incident evidence justifies more.
- [ ] Review Azure Cost Management after seven and 30 days, grouped by Log Analytics ingestion, retention, metric alerts, and scheduled-query alerts.
- [ ] Record a baseline cost projection in the operations runbook.

**Initial estimate:**

- Sentry Developer: USD 0 while one-user and event/span quotas are sufficient.
- Current ACA log ingestion: likely USD 0 while the shared Azure Monitor 5 GB monthly allowance remains available.
- One to two additional GB of sampled traces: expected to remain inside that allowance.
- Ninety-day archive for the current ACA log volume: approximately USD 0.20-0.30 per month at steady state.
- Metrics and scheduled-query alerts: approximately USD 10-20 per month, depending primarily on evaluation frequency.
- If total monthly ingestion reaches 10 GB, approximately 5 GB becomes billable; at the observed East Asia retail rate near USD 4.03/GB, ingestion would be about USD 20 before alerts.

### Task 10: Verification, Runbooks, And Delivery

- [ ] Verify Sentry source-map resolution with a controlled, non-sensitive frontend exception in staging.
- [ ] Follow one request from frontend event to gateway request ID and backend trace ID.
- [ ] Verify one login, one bulletin replacement/scan, and one notification flow end to end.
- [ ] Confirm logs and traces contain no raw credentials, user content, email, signed URLs, or query values.
- [ ] Confirm CSP reports remain queryable after the logging changes.
- [ ] Update service runbooks with dashboard, KQL, alert, rollback, and cost links.
- [ ] Run repository-specific tests, lint, and builds before each PR.
- [ ] Merge each repository through required CI using squash merge and verify the production revision and route after deployment.

## Delivery Order

1. `frontend-platform`: shared icon and account-menu behavior.
2. `account-fe`: copy, title, and menu integration.
3. `hhc-web`: weekly labels, news copy, font/LCP work, and Sentry frontend integration.
4. `admin-fe`: account/access IA, title, bulletin progress, and Sentry frontend integration.
5. `hhc-web-api` and `asset-api`: upload correlation, replacement regression, and scan polling interval.
6. Gateway and Go services: structured logging and correlation headers.
7. Azure infrastructure: Application Insights, managed OTel, workbook, alerts, retention, and budget controls.
8. Production verification and runbook evidence.

## Completion Criteria

- Shared controls are visually and behaviorally consistent in light/dark and desktop/mobile layouts.
- Admin account and access workflows no longer depend on generic detail links or chip walls.
- Replacing an existing bulletin version has visible bounded progress and completes without an indefinite pending state.
- Public LCP improvement is measured from three comparable production runs.
- Frontend exceptions resolve to the deployed commit and source line without exposing PII.
- Logs, metrics, and traces cover the three production observability pillars and share request/trace correlation.
- Operational telemetry remains inside the documented initial cost range or has an explained, approved variance.
