# Frontend Repository Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the frontend monorepo into independently buildable `hhc-web`, `account-fe`, `admin-fe`, and `frontend-platform` repositories without duplicating shared UI or browser infrastructure.

**Architecture:** `frontend-platform` publishes four compiled private npm packages to GitHub Packages. Each application repository contains one root application and pins an exact package version. Native `git subtree` history extraction avoids rewriting the existing `hhc-web` remote.

**Tech Stack:** pnpm 10.12.1, TypeScript 6.0.3, React 19.2.7, Vite 8, Next.js 16, GitHub Packages, GitHub Actions, Azure Pipelines, Docker.

## Global Constraints

- Preserve relevant app and package git history; never force-push existing remote history.
- Package names use the `@hallelujahhomechurch` GitHub organization scope.
- The first shared release is exactly `0.1.0`; consumers pin exact versions.
- Published packages export compiled `dist` JavaScript, declarations, and CSS, never `src/*`.
- Do not add Changesets, Renovate, submodules, or a custom release service.
- Keep current monorepo paths until all destination repositories pass clean verification.
- Do not enable frontend deployment stages until their ACA targets exist.
- TypeScript remains `6.0.3`; only OpenAPI code generation may use the isolated `5.9.3` catalog.

---

### Task 1: Record The Split And Build Native History Branches

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-frontend-repository-split.md`
- Produce temporary git refs: `split/account`, `split/admin`, `split/ui`, `split/preferences`, `split/account-client`, `split/hhc-web-client`

**Interfaces:**
- Consumes: current `hhc-web/origin/main`
- Produces: native subtree refs used by Tasks 2-4

- [ ] **Step 1: Verify source and destination state**

Run:

```bash
git fetch origin
git status --short --branch
gh repo view HallelujahHomeChurch/frontend-platform --json isEmpty
gh repo view HallelujahHomeChurch/account-fe --json isEmpty
gh repo view HallelujahHomeChurch/admin-fe --json isEmpty
```

Expected: source worktree is clean and all three destination repositories report `isEmpty: true`.

- [ ] **Step 2: Create history refs with native git subtree**

Run from the source repository:

```bash
git subtree split --prefix=apps/account -b split/account
git subtree split --prefix=apps/admin -b split/admin
git subtree split --prefix=packages/ui -b split/ui
git subtree split --prefix=packages/preferences -b split/preferences
git subtree split --prefix=packages/account-client -b split/account-client
git subtree split --prefix=packages/hhc-web-client -b split/hhc-web-client
```

Expected: all six refs resolve and `git log --follow` shows source history.

- [ ] **Step 3: Commit plan state**

```bash
git add docs/superpowers/plans/2026-07-29-frontend-repository-split.md
git commit -m "docs: plan frontend repository split"
```

### Task 2: Build And Publish `frontend-platform`

**Files:**
- Create in destination root: `package.json`
- Create in destination root: `pnpm-workspace.yaml`
- Create in destination root: `pnpm-lock.yaml`
- Create in destination root: `.npmrc`
- Create in destination root: `.gitignore`
- Create in destination root: `README.md`
- Create in destination root: `.github/workflows/ci.yml`
- Create in destination root: `.github/workflows/release.yml`
- Modify: `packages/*/package.json`
- Modify: `packages/account-client/tsconfig.json`
- Create: `packages/hhc-web-client/tsconfig.json`
- Create: `packages/hhc-web-client/tsconfig.build.json`

**Interfaces:**
- Produces: `@hallelujahhomechurch/{ui,preferences,account-client,hhc-web-client}@0.1.0`
- Consumers: Tasks 3-5

- [ ] **Step 1: Assemble package histories**

Create a temporary clone of the empty destination, add one bootstrap commit,
then add each split ref with `git subtree add --prefix=packages/<name>`.

Expected: `git log --all -- packages/ui/src/index.ts` includes the original UI commits.

- [ ] **Step 2: Add package artifact contract tests**

Create `scripts/check-package-tarballs.mjs` that:

1. reads every `packages/*/package.json`
2. asserts `private !== true`
3. asserts `files` includes `dist`
4. asserts every export target starts with `./dist/`
5. asserts package names start with `@hallelujahhomechurch/`

Run:

```bash
node scripts/check-package-tarballs.mjs
```

Expected: FAIL against the extracted manifests.

- [ ] **Step 3: Make all packages publishable**

Set package names, repository metadata, `files`, `publishConfig`, and `dist`
exports. Add emitting TypeScript builds for account and web clients. Copy
`packages/ui/src/styles.css` to `packages/ui/dist/styles.css` during build.

Run:

```bash
pnpm install
pnpm test
pnpm lint
pnpm build
node scripts/check-package-tarballs.mjs
```

Expected: all commands pass.

- [ ] **Step 4: Pack and inspect artifacts**

Run:

```bash
pnpm -r pack --pack-destination ../../artifacts
node scripts/test-packed-consumers.mjs
```

`scripts/test-packed-consumers.mjs` creates disposable Vite and Next fixtures,
installs the four tarballs, imports every public export plus UI CSS, and runs
both production builds.

Expected: four tarballs contain no `src` or test files, expose JavaScript,
declarations, and UI CSS from `dist`, and build in both consumer runtimes.

- [ ] **Step 5: Add CI and tag release**

CI runs install, test, lint, build, and artifact checks. Release runs only on
`v*` tags with `contents: read` and `packages: write`, then executes:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
pnpm publish -r --no-git-checks
```

- [ ] **Step 6: Verify and push**

```bash
git diff --check
git status --short
git push origin main
git tag v0.1.0
git push origin v0.1.0
gh run watch --repo HallelujahHomeChurch/frontend-platform --exit-status
```

Expected: CI and package release succeed.

- [ ] **Step 7: Grant consumer workflow access**

In each package's GitHub settings, add `hhc-web`, `account-fe`, and
`admin-fe` under **Manage Actions access** with read access. Verify from one
consumer workflow using:

```bash
pnpm view @hallelujahhomechurch/ui@0.1.0 version \
  --registry=https://npm.pkg.github.com
```

Expected: `0.1.0`.

### Task 3: Extract `account-fe`

**Files:**
- Promote all files from source `apps/account` to destination root
- Modify: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `.npmrc`
- Modify: `Dockerfile`
- Create: `.github/workflows/ci.yml`
- Create: `azure-pipelines.yml`
- Modify imports under `src/**`

**Interfaces:**
- Consumes: shared package version `0.1.0`
- Produces: independently buildable Account application

- [ ] **Step 1: Push preserved Account history to the empty destination**

```bash
git push git@github.com:HallelujahHomeChurch/account-fe.git split/account:main
```

Clone destination into the split workspace and create
`codex/standalone-account-fe`.

- [ ] **Step 2: Write standalone contract test**

Create `scripts/check-standalone.mjs` that asserts:

- no dependency value starts with `workspace:`
- no dependency name starts with `@hhc/`
- Dockerfile contains no `apps/account` or `packages/`

Run and expect failure before migration.

- [ ] **Step 3: Replace workspace dependencies**

Replace imports and dependencies with:

```json
"@hallelujahhomechurch/account-client": "0.1.0",
"@hallelujahhomechurch/preferences": "0.1.0",
"@hallelujahhomechurch/ui": "0.1.0"
```

Add the GitHub Packages scope mapping, root package manager metadata, and a
standalone Docker build. The Docker build installs packages using a BuildKit
secret mounted as `/root/.npmrc`; no token appears in Dockerfile arguments,
image layers, or committed files.

- [ ] **Step 4: Verify application**

```bash
pnpm install
pnpm test -- --run
pnpm lint
pnpm build
node scripts/check-standalone.mjs
docker build -t account-fe:split .
```

Expected: all commands pass.

- [ ] **Step 5: Add independent CI and guarded Azure pipeline**

GitHub CI runs install, test, lint, build, and Docker build with
`packages: read`. It generates a temporary authenticated npmrc from
`GITHUB_TOKEN` and passes it to Docker BuildKit as a secret. Azure deployment
remains conditional until ACA `account-fe` exists and a read-only GitHub
Packages token is available through a protected secret variable.

- [ ] **Step 6: Commit and update remote main**

Commit task-sized changes, push the feature branch, create a PR, wait for CI,
and merge to `main`.

### Task 4: Extract `admin-fe`

**Files:**
- Promote all files from source `apps/admin` to destination root
- Modify: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `.npmrc`
- Modify: `Dockerfile`
- Create: `.github/workflows/ci.yml`
- Create: `azure-pipelines.yml`
- Modify imports under `src/**`

**Interfaces:**
- Consumes: all four shared packages at `0.1.0`
- Produces: independently buildable Admin application

- [ ] **Step 1: Push preserved Admin history to destination**

```bash
git push git@github.com:HallelujahHomeChurch/admin-fe.git split/admin:main
```

Clone destination and create `codex/standalone-admin-fe`.

- [ ] **Step 2: Add the Admin standalone contract**

Create `scripts/check-standalone.mjs` that asserts:

- no dependency value starts with `workspace:`
- no dependency name starts with `@hhc/`
- Dockerfile contains no `apps/admin` or `packages/`

Run and expect failure before migration.

- [ ] **Step 3: Replace workspace dependencies**

Pin:

```json
"@hallelujahhomechurch/account-client": "0.1.0",
"@hallelujahhomechurch/hhc-web-client": "0.1.0",
"@hallelujahhomechurch/preferences": "0.1.0",
"@hallelujahhomechurch/ui": "0.1.0"
```

- [ ] **Step 4: Verify application**

```bash
pnpm install
pnpm test -- --run
pnpm lint
pnpm build
node scripts/check-standalone.mjs
docker build -t admin-fe:split .
```

- [ ] **Step 5: Add CI, guarded deployment, and merge**

Add package read permission, build verification, BuildKit npmrc secret
handling, and conditional Azure deployment. Push PR, wait for CI, and merge
to `main`.

### Task 5: Contract `hhc-web` To The Public Application

**Files:**
- Move: `apps/web/*` to repository root
- Modify: root `package.json`
- Modify: root `pnpm-lock.yaml`
- Modify: root `.npmrc`
- Modify: root `Dockerfile`
- Modify: root `azure-pipelines.yml`
- Delete after verification: `apps/account/**`
- Delete after verification: `apps/admin/**`
- Delete after verification: `packages/**`
- Delete: obsolete `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: all four shared packages at `0.1.0`
- Produces: public-web-only repository and deployment pipeline

- [ ] **Step 1: Add repository-boundary test**

Create `scripts/check-repository-boundary.mjs` asserting:

- `apps/account`, `apps/admin`, and `packages` do not exist
- no `workspace:` or `@hhc/` dependencies remain
- Azure pipeline has no account/admin matrix entries

Run and expect failure before contraction.

- [ ] **Step 2: Move public app and pin shared packages**

Use `git mv` for the public app, rewrite root scripts and package imports,
then generate a standalone lockfile.

- [ ] **Step 3: Simplify Docker and Azure pipeline**

Build only `alive/hhc-web`; deploy only ACA `hhc-web` when that resource
exists. Remove Account and Admin matrices. Use the same BuildKit npmrc secret
contract as the Vite applications.

- [ ] **Step 4: Remove extracted source only after consumers pass**

Delete old Account, Admin, and package workspace paths. Update Compose build
contexts to sibling repositories.

- [ ] **Step 5: Verify public application**

```bash
pnpm install
pnpm test -- --run
pnpm lint
pnpm build
node scripts/check-repository-boundary.mjs
docker build -t hhc-web:split .
```

- [ ] **Step 6: Commit and update remote main**

Push PR, wait for CI, and merge to `main`.

### Task 6: Update Architecture And Integration Documentation

**Files:**
- Modify: service catalog and ownership design
- Modify: rendering and delivery design
- Modify: frontend/CMS roadmap
- Modify: office Compose runbook and setup scripts
- Modify: release/deployment documentation

**Interfaces:**
- Produces: source ownership and checkout instructions matching the split

- [ ] **Step 1: Replace obsolete ownership statements**

Document:

- `hhc-web` owns public website UI
- `account-fe` owns Account UI
- `admin-fe` owns Admin/CMS UI
- `frontend-platform` owns shared packages

- [ ] **Step 2: Update local integration paths**

Compose uses sibling checkout contexts:

```text
../hhc-web
../account/account-fe
../account/admin-fe
```

No runtime service names or public routes change.

- [ ] **Step 3: Run documentation drift checks**

```bash
rg -n "apps/account|apps/admin|pnpm --filter @hhc/(account|admin)" docs compose scripts
git diff --check
```

Expected: no active instruction depends on the removed monorepo paths.

### Task 7: Final Cross-Repository Verification

**Files:**
- No source changes unless verification finds a defect

**Interfaces:**
- Produces: verified remote `main` state for all four repositories

- [ ] **Step 1: Verify clean installs**

Remove only generated dependency/build directories in disposable clones,
then run the full verification suite in all four repositories.

- [ ] **Step 2: Verify package and source ownership**

```bash
gh api repos/HallelujahHomeChurch/frontend-platform/commits/main
gh api repos/HallelujahHomeChurch/account-fe/commits/main
gh api repos/HallelujahHomeChurch/admin-fe/commits/main
gh api repos/HallelujahHomeChurch/hhc-web/commits/main
```

Expected: all four `main` refs contain the verified split commits.

- [ ] **Step 3: Record deployment boundary**

Confirm frontend ACA resources separately. Do not claim deployment from a
successful source split. The next platform task is Account API deployment,
followed by Account and Admin frontend deployment.
