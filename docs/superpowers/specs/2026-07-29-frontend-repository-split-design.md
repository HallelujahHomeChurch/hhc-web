# Frontend Repository Split Design

## Purpose

Split the current frontend monorepo into independently owned application
repositories while keeping shared UI and browser infrastructure in one
versioned source.

The target repositories are:

- `HallelujahHomeChurch/hhc-web`
- `HallelujahHomeChurch/account-fe`
- `HallelujahHomeChurch/admin-fe`
- `HallelujahHomeChurch/frontend-platform`

Each application must install, test, build, release, and roll back without
checking out another application repository.

## Repository Ownership

### `hhc-web`

Owns only the public Next.js website:

- source currently under `apps/web`
- public website tests and runtime image
- website-specific assets, localization, metadata, and legal pages
- its own deployment pipeline

The application moves to the repository root. `apps/account`, `apps/admin`,
and the shared workspace packages are removed after all consumers use
published packages.

### `account-fe`

Owns only the Vite account console:

- source currently under `apps/account`
- account login, profile, security, LINE binding, and device UI
- its own tests, image, and deployment pipeline
- deployment target `account-fe`

The application moves to the repository root.

### `admin-fe`

Owns only the Vite admin console:

- source currently under `apps/admin`
- account administration and website content management UI
- its own tests, image, and deployment pipeline
- deployment target `admin-fe`

The application moves to the repository root.

### `frontend-platform`

Owns the shared source currently under:

- `packages/ui`
- `packages/preferences`
- `packages/account-client`
- `packages/hhc-web-client`

It is a package workspace, not an application runtime. It has no ACA
deployment and does not proxy APIs.

## Package Distribution

Shared packages are published to GitHub Packages under the organization
namespace:

- `@hallelujahhomechurch/ui`
- `@hallelujahhomechurch/preferences`
- `@hallelujahhomechurch/account-client`
- `@hallelujahhomechurch/hhc-web-client`

All packages use one release version initially. The first release is
`0.1.0`. Consumers pin an exact version; ranges such as `^0.1.0` and
`workspace:*` are not used across repositories.

Releases are tag-driven:

1. Package tests, lint, typecheck, and builds pass.
2. Package versions are updated in one commit.
3. Tag `vX.Y.Z` triggers `pnpm publish -r`.
4. Each consuming repository receives a normal dependency update commit.

Do not add Changesets, Renovate, or a custom release service until manual
version bumps become a measured maintenance problem.

## Published Package Contract

Published packages must be normal installable artifacts, not workspace source
aliases:

- remove `private: true` from publishable package manifests
- set `publishConfig.registry` to `https://npm.pkg.github.com`
- link package metadata to `HallelujahHomeChurch/frontend-platform`
- compile JavaScript and declarations into `dist`
- publish only runtime files, declarations, CSS, README, and package metadata
- point package `exports` at `dist`; consumers must not import `src/*`
- resolve catalog and workspace protocol values before publication
- keep React and React DOM as peer dependencies for `ui`

`pnpm pack` output is installed into clean Vite and Next.js smoke fixtures
before the first publish. This verifies JavaScript, declaration, CSS, ESM,
and server-build compatibility without relying on workspace resolution.

## Authentication And Access

GitHub Actions publishes with the source repository `GITHUB_TOKEN` and:

```yaml
permissions:
  contents: read
  packages: write
```

The `hhc-web`, `account-fe`, and `admin-fe` repositories receive explicit
read access to all four packages. Their workflows install with their own
`GITHUB_TOKEN` and `packages: read`.

Local development uses a classic GitHub PAT with `read:packages` in the
developer's user-level npm configuration. Tokens are never committed to a
repository. Each repository commits only the scope-to-registry mapping:

```ini
@hallelujahhomechurch:registry=https://npm.pkg.github.com
```

## History Preservation

The split must preserve relevant file history:

- `frontend-platform` retains history for the four `packages/*` paths.
- `account-fe` retains history for `apps/account`.
- `admin-fe` retains history for `apps/admin`.
- `hhc-web` retains its existing repository history and removes extracted
  paths only after consumer repositories pass verification.

History extraction happens in temporary clones. Existing local repositories
and remote branches are not rewritten. The destination repositories are
currently empty, so their initial `main` branches may use filtered history.

## Build Shape

Each application repository contains:

- one root `package.json`
- one lockfile
- TypeScript, Vite or Next.js configuration at root
- tests and source at root
- one application Dockerfile
- one application deployment pipeline

The application repositories must not use pnpm workspace references after
the cutover.

`frontend-platform` remains a pnpm workspace because it intentionally
contains multiple packages.

## Deployment

Repository pushes have one deployment owner:

| Repository | Image | ACA target |
| --- | --- | --- |
| `hhc-web` | `alive/hhc-web` | `hhc-web` |
| `account-fe` | `alive/account-fe` | `account-fe` |
| `admin-fe` | `alive/admin-fe` | `admin-fe` |
| `frontend-platform` | none | none |

The existing three-application matrix is removed from `hhc-web`.

Creating ACA resources is separate from splitting source repositories.
Application pipelines verify and build immediately, but deployment is
enabled only when the corresponding ACA resource and service connection
exist.

## Migration Order

1. Extract and publish `frontend-platform@0.1.0`.
2. Extract `account-fe`, replace shared imports, verify, and push `main`.
3. Extract `admin-fe`, replace shared imports, verify, and push `main`.
4. Convert `hhc-web` to a single root application using published packages.
5. Verify all three application builds from clean installs.
6. Remove the old monorepo paths and matrix pipeline from `hhc-web`.
7. Push `hhc-web/main`.

This order keeps the current monorepo buildable until both extracted
applications and shared packages are available.

## Documentation Cutover

The split updates architecture and operations documents that currently say
`hhc-web` owns the Admin UI or that all three applications share one source
repository. At minimum update:

- service catalog and ownership design
- rendering and delivery design
- frontend and CMS roadmap
- office Compose source/build instructions
- release and deployment runbooks

The resulting ownership statement is:

- `hhc-web` owns only the public website UI
- `account-fe` owns the account console
- `admin-fe` owns the admin and website content console
- `frontend-platform` owns shared frontend packages

## Rollback

No existing remote history is force-pushed.

- Keep the current monorepo paths until all destination repositories pass
  clean package installs, tests, builds, and image builds.
- Keep package `0.1.0` immutable after publication.
- Application dependency updates are ordinary commits and can be reverted.
- Do not enable an application deployment stage until its ACA target exists.
- If cutover verification fails, continue using the current `hhc-web` build;
  destination repositories remain non-production until corrected.

## Verification

### `frontend-platform`

- `pnpm install --frozen-lockfile`
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- package tarball smoke test for all exports

### Applications

- clean authenticated package install
- tests
- lint
- production build
- Docker image build
- no `workspace:*` dependency
- no imports from another application repository

### Cutover

- Account and Admin retain existing routes and mock modes.
- Light/dark, locale cookies, account menu, Drawer, Dialog, and Menu remain
  visually and behaviorally consistent.
- `hhc-web` contains no Account or Admin application source after cutover.
- All four remote `main` branches point to the verified split state.

## Rejected Alternatives

### Copy shared packages into every application

Rejected because UI, theme, locale, and authentication behavior would drift
across three repositories.

### Git submodules

Rejected because checkout, CI, dependency updates, and release rollback
become less predictable than normal package versions.

### Keep application repositories as subtree mirrors

Rejected because the repositories would not be independent owners; the
monorepo would remain the real source of truth.
