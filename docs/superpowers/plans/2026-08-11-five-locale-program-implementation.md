# Five-Locale Website Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Japanese and Korean product/content support, shared control polish, Azure OpenAI CMS translation previews, scripture/font/legal handling, and the hero preload fix across the HHC website service group without breaking three-locale clients.

**Architecture:** This document is the coordinating release ledger. The executable work is split into five bounded plans so every PR is independently reviewable, releasable, and reversible. Producer contracts deploy before consumers; every repository uses its own branch, PR, green CI, squash merge, release workflow, and production smoke.

**Tech Stack:** TypeScript, React, Next.js, React Aria, Go 1.25, PostgreSQL, Azure Container Apps, Azure Key Vault, Azure OpenAI Responses API, OpenTelemetry, GitHub Actions

## Global Constraints

- Admin console chrome supports only `zh-Hant`, `zh-Hans`, and `en`.
- Website, account, CMS content, subscriptions, campaigns, and notifications support `zh-Hant`, `zh-Hans`, `en`, `ja`, and `ko`.
- **2026-08-11 domain correction:** weekly-paper `BulletinEdition` is independently and exactly `zh-Hant | zh-Hans | en`; Japanese/Korean routes and messages show the three edition links, and no Japanese/Korean PDF exists. Generic CMS translation targets remain `zh-Hans`/`en`/`ja`/`ko`; bulletin metadata preview targets only `zh-Hans`/`en`. Migration 022 is immutable, and legacy bulletin rows require inventory before any separate data remediation.
- Public CMS fallback remains one complete published `zh-Hant` projection; it never mixes fields.
- Generated text is preview-only and never auto-saved or auto-published.
- Scripture, legal copy, static product copy, and security email templates are never translated at runtime.
- Azure OpenAI timeout hierarchy is 40-second provider, 45-second handler, 50-second route write deadline, and 60-second gateway; ordinary API endpoints remain at 30 seconds.
- No new microservice, Redis dependency, translation job system, font CDN, or global `loading.tsx`.
- Every production change is delivered by PR, green CI, merge to `main`, release workflow, and live smoke.
- Azure resource/deployment/secret provisioning and publisher permissions remain external launch gates. Merge and release disabled-by-default compatibility code independently; never claim full locale launch or enable gated content without recorded evidence.

---

## Execution Plans

| Wave | Plan | Repositories | Exit gate |
| ---: | --- | --- | --- |
| 1 | [Locale Contract Safety and Shared Foundation](./2026-08-11-locale-contract-safety-and-shared-foundation.md) | `hhc-web-api`, `frontend-platform` | Old three-locale Admin cannot delete newer locales; shared packages are published. |
| 2 | [Five-Locale Backend Compatibility](./2026-08-11-five-locale-backend-compatibility.md) | `hhc-web-api`, `engagement-api`, `notification-api`, `account-api`, `frontend-platform` | Locale contracts accept five values while weekly-paper contracts enforce three editions; generated clients are published. |
| 3 | [Azure OpenAI CMS Translation](./2026-08-11-azure-openai-cms-translation.md) | `hhc-web-api`, `admin-fe` | Disabled-by-default translation slice passes production smoke and fluent review before enablement. |
| 4 | [Five-Locale Product Frontends](./2026-08-11-five-locale-product-frontends.md) | `account-fe`, `hhc-web` | Account releases first; website routes, controls, fonts, hero fix, fallback semantics, and legal UI pass. |
| 5 | [Content Rights and Launch Enablement](./2026-08-11-content-rights-and-launch-enablement.md) | operational evidence plus `hhc-web` content PRs | Rights evidence, reviewed copy, content, discovery, and cross-service production smoke are complete. |

## Program Release Ledger

### Task 1: Establish the release evidence directory

**Files:**
- Create: `docs/release-evidence/five-locale/README.md`

**Interfaces:**
- Consumes: merged PR URLs, immutable image/package versions, deployment revisions, provider and rights references.
- Produces: one evidence index used by every later wave.

- [ ] **Step 1: Add the evidence schema**

```markdown
| Wave | Repository | PR | CI | Artifact | Deployed revision | Smoke evidence | Rollback floor |
| --- | --- | --- | --- | --- | --- | --- | --- |
```

- [ ] **Step 2: Verify the document contains no credentials or unpublished CMS text**

Run: `rg -n "api[_-]?key|Bearer |AZURE_OPENAI_API_KEY|sourceText|translation" docs/release-evidence/five-locale/README.md`

Expected: no secret or content match.

- [ ] **Step 3: Commit on the coordinating documentation branch**

```bash
git add docs/release-evidence/five-locale/README.md
git commit -m "docs: add five-locale release ledger"
```

### Task 2: Execute waves in dependency order

**Files:**
- Modify: `docs/release-evidence/five-locale/README.md`

**Interfaces:**
- Consumes: exit gates from the five linked plans.
- Produces: approval to start the next wave.

- [ ] **Step 1: Complete Wave 1 and record both releases**

Expected: `hhc-web-api` contract-safety revision and the first `frontend-platform` package version are live before five-locale rows are accepted.

- [ ] **Step 2: Complete Wave 2 and record the compatibility floor**

Expected: each backend has a named first five-locale-compatible revision; rollback automation is prohibited from selecting an older revision after `ja` or `ko` data exists.

- [ ] **Step 3: Complete Wave 3 with translation disabled**

Expected: endpoint authorization, limiter, typed failures, content-free telemetry, Key Vault binding, and route-specific timeouts pass before `CMS_TRANSLATION_ENABLED=true`.

- [ ] **Step 4: Release `account-fe` before `hhc-web` in Wave 4**

Expected: Japanese/Korean registration, OAuth onboarding, recovery, profile, and notification preference smoke pass before public website discovery.

- [ ] **Step 5: Complete Wave 5 and enable public discovery**

Expected: static locale routes, sitemap, canonical/hreflang, reviewed content, publisher evidence, and cross-service smoke all pass.

### Task 3: Final cross-service acceptance

**Files:**
- Modify: `docs/release-evidence/five-locale/README.md`

**Interfaces:**
- Consumes: production URLs and released revisions from all waves.
- Produces: final launch decision.

- [ ] **Step 1: Run the production user journeys**

Verify `ja` and `ko` for: public root detection, login, first-time OAuth registration, email verification, password reset, profile locale update, CMS exact/fallback content, all three weekly-paper edition links/downloads, newsletter subscription, Web Push subscription, campaign delivery, generic CMS translation preview, and About scripture/legal links. Confirm no `ja`/`ko` bulletin edition is offered.

- [ ] **Step 2: Verify failure paths**

Verify: stale CMS version returns `412`; old Admin locale omission returns `409`; Azure timeout returns HHC `504` before gateway timeout; local rate limit returns `429`; missing CMS translation renders one `zh-Hant` projection with a correct canonical; no logs contain source/generated text.

- [ ] **Step 3: Record launch and rollback decision**

Record the exact compatible revision floor and the rollback command/runbook reference for each service. Do not remove `ja` or `ko` database constraints during rollback.

- [ ] **Step 4: Commit the completed evidence index through PR**

```bash
git add docs/release-evidence/five-locale/README.md
git commit -m "docs: record five-locale launch evidence"
```
