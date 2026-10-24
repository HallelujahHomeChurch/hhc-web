# Threaded comments: package and gateway delivery dependencies

Date: 2026-10-24
Scope: Read-only source research for the coordinated API / shared-client / Website change. No product source, CI workflow, dependency manifest, lockfile, tag, registry, infrastructure, or production data was changed by this research.

## Source baseline

| Repository | Inspected revision |
| --- | --- |
| frontend-platform | Task worktree starting HEAD `2e58d00122a753492481a0898b8bd8d769aafdb8` |
| hhc-web | Task worktree starting HEAD `6d37ad19e1fe85cbc21256d791f0134e91c759c8` |
| api-gateway | `origin/main` `e73264427210b9072aed2cd98a61ec453c0f47da`, read with `git show`; the older primary checkout was not changed |

The planning entry documents were read through existing authorized GitHub access at immutable revision `ea3f3afebf4433c074c0a4d2e392e380dc4b7f83`. Private planning text is not reproduced here. This document records source-defined processes and historical repository evidence; it does not claim fresh registry publication, current PR checks, deployed revisions, or live acceptance.

## Finding: candidate SDK verification exists, but it is separate from the normal Web CI

The existing shared-platform pipeline already verifies an unpublished package candidate without publishing it:

- The root scripts require build/test/lint, generated contracts, package contracts, packing, and packed-consumer checks. Package versions are coordinated across all seven packages; `check-package-contracts.mjs:14–25` enforces root/package version equality and the GitHub Packages registry.
- `scripts/pack-packages.mjs:7–15` creates local package archives. `scripts/test-packed-consumers.mjs:20–40` copies those archives into a disposable directory and creates `file:` dependencies there. Its generated Vite and Next applications use archive overrides (`:58–72`, `:171–188`) and are built before that temporary directory is removed (`:263–266`). These are synthetic consumers, not the actual full Website application.
- Shared-platform PR CI runs the generated checks, `check:packages`, `pack:packages`, and `test:consumers` in `.github/workflows/ci.yml:75–83`. It retains the renderer preparation, same-run receipt, shard and aggregate gates. An SDK-only change does not authorize skipping those gates.

Sources: [shared PR CI](https://github.com/HallelujahHomeChurch/frontend-platform/blob/2e58d00122a753492481a0898b8bd8d769aafdb8/.github/workflows/ci.yml#L75), [packed-consumer harness](https://github.com/HallelujahHomeChurch/frontend-platform/blob/2e58d00122a753492481a0898b8bd8d769aafdb8/scripts/test-packed-consumers.mjs#L20), [package contracts](https://github.com/HallelujahHomeChurch/frontend-platform/blob/2e58d00122a753492481a0898b8bd8d769aafdb8/scripts/check-package-contracts.mjs#L14).

The actual Website CI has a different input contract:

- `package.json` pins `@hallelujahhomechurch/hhc-web-client` to registry version `1.1.0`; `pnpm-lock.yaml` contains the registry tarball URL and integrity. `src/i18n/locales.test.ts:38–45` asserts the exact HHC package pins.
- `.github/workflows/ci.yml:65–80` performs a frozen registry install, full tests, lint and production build. `:100–124` builds the ordinary Dockerfile with registry access.
- `Dockerfile:9–10` copies the tracked manifest/lockfile and performs another frozen install before application sources are copied. An ignored local `node_modules` candidate is not an input to that Docker install.
- No inspected Web workflow step checks out the candidate shared-platform branch, downloads its candidate packages, or applies a candidate override. No supported candidate input was found in the existing CI/Docker path.

Sources: [Website CI](https://github.com/HallelujahHomeChurch/hhc-web/blob/6d37ad19e1fe85cbc21256d791f0134e91c759c8/.github/workflows/ci.yml#L65), [Docker install](https://github.com/HallelujahHomeChurch/hhc-web/blob/6d37ad19e1fe85cbc21256d791f0134e91c759c8/Dockerfile#L9), [exact-package assertion](https://github.com/HallelujahHomeChurch/hhc-web/blob/6d37ad19e1fe85cbc21256d791f0134e91c759c8/src/i18n/locales.test.ts#L38).

The old SDK cannot be made to request `view=threaded` merely by casting a new option at the Web call site. Its `listRecordingComments` implementation explicitly constructs the query using cursor, limit, parentId, order and refresh. `createMemberVideoApi` forwards that method directly as `comments`. A type assertion cannot add query serialization at runtime. Sources: [SDK method](https://github.com/HallelujahHomeChurch/frontend-platform/blob/2e58d00122a753492481a0898b8bd8d769aafdb8/packages/hhc-web-client/src/client.ts#L288), [Web adapter](https://github.com/HallelujahHomeChurch/hhc-web/blob/6d37ad19e1fe85cbc21256d791f0134e91c759c8/src/features/member-videos/api.ts#L37).

## Existing release policy and direct precedent

`frontend-platform/README.md:87–88` requires consumers to install exact registry versions. Its source-candidate sections explicitly separate local packed evidence from publication (`:360–372`, `:385–387`). The release workflow starts only from `v*` tags (`.github/workflows/release.yml:3–5`), checks that the tag matches the coordinated version and is included in `origin/main` (`:43–46`), and only lets the publisher write packages after independent validation (`:106–141`). An unmerged feature tag therefore is not a supported publication route.

There is an exact historical example for this same feature family:

- `docs/release-evidence/member-video-watch-20261017/verification.md:25–28` records SDK publication before the real registry Web pin. The initial ignored candidate copy was local evidence only.
- `:41`, `:50`, and `:53` record that the Web registry build failed on missing candidate contracts while local candidate builds passed. That build was described as failed/blocked, not reclassified as success.
- `:61` records the later actual publication and registry integration before final Web checks.
- `docs/reviews/2026-10-19-reader-dependency-integration.md:21–25` independently records the same order: publication first, then manifest/lock/assertion update, clean frozen install without an ignored candidate, and normal exact-head Web CI. Its `:59–69` distinguishes registry integrity from local archive hashes and verifies the real installed artifact after authorized publication.

Sources: [same-feature delivery evidence](https://github.com/HallelujahHomeChurch/hhc-web/blob/6d37ad19e1fe85cbc21256d791f0134e91c759c8/docs/release-evidence/member-video-watch-20261017/verification.md#L21), [reader dependency precedent](https://github.com/HallelujahHomeChurch/hhc-web/blob/6d37ad19e1fe85cbc21256d791f0134e91c759c8/docs/reviews/2026-10-19-reader-dependency-integration.md#L17), [SDK release gate](https://github.com/HallelujahHomeChurch/frontend-platform/blob/2e58d00122a753492481a0898b8bd8d769aafdb8/.github/workflows/release.yml#L43).

## Recommended default at a stop-before-merge/publication boundary

1. Complete the compatible API change and shared SDK change, their tests and required PR CI. Extend the existing packed-consumer contract usage to cover the new typed option/response as appropriate; keep all ordinary shared-platform checks.
2. Verify the actual Web source locally against the exact built/packed SDK candidate in an explicitly temporary, ignored environment. Record the SDK source HEAD, archive hash, Web HEAD, commands, and results. Preserve the tracked production manifest/lockfile and exact-version assertion. This remains local integration evidence.
3. Open or retain the Web PR as a dependent Draft. Run the ordinary required CI and report its actual outcome. If the code requires the unpublished SDK contract and registry build fails, leave that check failed/blocked. Do not claim that the full coordinated delivery has reached green Web CI.
4. After a later explicit authorization for producer merge/publication, use the normal API release and shared-platform reviewed-main/tag workflow. Verify the real registry artifact, choose the actual published exact version, update only the corresponding consumer pin/lock/assertion, remove the ignored candidate, and rerun clean install plus all normal Web/image/required CI before merge.

There is currently no inspected, supported route that both consumes an unpublished SDK runtime change in the actual Website required CI and leaves the normal dependency/CI inputs unchanged. This is a real publication dependency, not a missing test command. A deliberately old-SDK-compatible implementation could change that dependency, but needs architectural review and real behavior checks; it must not silently omit `view=threaded`, duplicate the SDK HTTP client, add cast-only pretend support, or weaken validation merely to obtain green CI.

Do not invent a future registry version, publish a feature tag, commit a local `file:`/`link:`/Git dependency into the production manifest, replace registry integrity with a candidate hash, alter CI to inject the package, or waive a failed build. A new pre-release integration workflow would itself be a separately reviewed workflow change and is outside this research/default path.

## Gateway: no routing change required for the new read query

At Gateway revision `e73264427210b9072aed2cd98a61ec453c0f47da`, the exact comments collection route already forwards queries:

| Evidence | Implication |
| --- | --- |
| `conf.d/api/www/42-recordings.conf:39–41` matches the existing UUID comments collection and allows GET/POST. | `GET .../comments?view=threaded` uses the existing route/method. |
| `:40` rejects percent escapes only before the first `?`. | The path-normalization guard does not reject an ordinary new query name. |
| `:39–54` contains no `$args` rejection or query-name allowlist; `:54` uses `proxy_pass $hhc_web_api_base$uri$is_args$args`. | The original query string, including `view=threaded`, is passed to CMS. |
| `:48–53` retains its route ID, protected include, disabled proxy retries and private/no-store response policy. | Threaded reads do not require changing auth or cache policy. |
| `conf.d/default.conf:212–227` sends the auth subrequest to `/verify` with token/required-scope/route headers; `internal/verifier/handler.go:58–135` verifies those inputs and admission, without consulting original query names. | No verifier-level `view` query allowlist was found. |
| `conf.d/common/protected.conf:17–29` strips the public bearer token and injects verified identity. | Existing downstream trust handling stays intact. |

Sources: [comments route](https://github.com/HallelujahHomeChurch/api-gateway/blob/e73264427210b9072aed2cd98a61ec453c0f47da/conf.d/api/www/42-recordings.conf#L39), [WWW auth subrequest](https://github.com/HallelujahHomeChurch/api-gateway/blob/e73264427210b9072aed2cd98a61ec453c0f47da/conf.d/default.conf#L212), [verifier](https://github.com/HallelujahHomeChurch/api-gateway/blob/e73264427210b9072aed2cd98a61ec453c0f47da/internal/verifier/handler.go#L58), [trusted identity forwarding](https://github.com/HallelujahHomeChurch/api-gateway/blob/e73264427210b9072aed2cd98a61ec453c0f47da/conf.d/common/protected.conf#L17).

The neighboring mutation/reaction endpoints deliberately reject query strings; that does not apply to the comments collection GET. CMS must validate the new `view` value and cursor/parent semantics. Do not add a Gateway PR solely for this query. This is source inspection only: no current deployed Gateway revision, image-backed forwarding test, or live authenticated threaded read was verified in this research.

## Verification performed

Read local instructions, README/manifests, CI and release definitions, candidate-consumer scripts, owning SDK/Web adapter implementations, and existing release evidence. Read Gateway sources from the explicit `origin/main` object. Checked that this evidence document was absent before creating it. No installation, test suite, package packing, GitHub Actions run, publication or production request was performed by this research task.
