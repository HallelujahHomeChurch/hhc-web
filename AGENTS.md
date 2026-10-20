# Repository Instructions

## Delivery Policy

- Treat `main` as the production branch. Do not commit or push directly to `main`.
- Create a focused branch for every task and submit changes through a pull request.
- CI must pass before merge. Do not bypass, ignore, or merge around a failing required check.
- Keep changes small and reviewable, and use squash merge unless the repository explicitly requires another strategy.
- For deployable applications and services, a merge to `main` is the release boundary: build an immutable artifact, deploy it through CI/CD, then verify health and the production route.
- Never deploy an unmerged local commit or replace the CI/CD path with an ad hoc production command.
- If deployment fails, preserve the last healthy revision, report the failure, and use the repository rollback path.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Architecture and local verification

- Next.js public website with localized published-content views and authenticated member experiences. APIs own business authorization; browser permissions and feature flags only control presentation.
- `src/app` owns routes/layouts, `src/features` product domains (including weekly-reader, member-videos and organizations), `src/components` shared presentation, `src/lib` adapters/helpers and `src/i18n` localization. Reuse published frontend-platform clients/UI instead of rewriting immutable renderers or API DTOs.
- Read [README.md](README.md), [package.json](package.json), [next.config.ts](next.config.ts), [.github/workflows/ci.yml](.github/workflows/ci.yml). Use manifest Node/pnpm versions; `corepack pnpm install --frozen-lockfile` needs authorized GitHub Packages access via existing NODE_AUTH_TOKEN configuration. `corepack pnpm dev` starts Next; server-only HHC_WEB_API_BASE_URL and local ACCOUNT_API_PROXY_TARGET select task-local APIs. Production routing belongs to Gateway.
- Run `corepack pnpm test:run`, `corepack pnpm lint`, `corepack pnpm build`, `corepack pnpm perf:static`. test:run includes template-asset checks before Vitest. Banner glyph tests also require README's pinned FontTools/Brotli; image/renderer/native acceptance remains separate.
- Preserve private media authorization, account-bound cache/logout fences and immutable reader resources. Never send private media through public image/service-worker caches. Build-time reader flags, real API dependencies and approved publication are separate from UI development.

The commands above are source-defined entrypoints, not a record of successful execution. Report installation, local tests, Linux startup, CI and live acceptance separately.

## Multi-repository Codex tasks

Read the checked-out `hhc-planning/AGENTS.md` and
`hhc-planning/docs/cloud-environments.md` first and record its revision.
Sibling repositories do not inherit it automatically. This repository owns its
setup/tests; use the task’s smallest runtime set and preserve active writers in
isolated worktrees. Follow explicit review/merge/deployment authority. Pure human
documentation uses lightweight checks; source, workflow/configuration, executable
skills and mixed changes retain full verification.
