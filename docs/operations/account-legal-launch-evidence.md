# Account Legal Operations Launch Evidence

This ledger separates implementation, CI, merge, release, live, authenticated, and destructive-operation evidence. It contains no secrets or personal data.

## Baseline — 2026-09-12

| Gate | Evidence | Status |
| --- | --- | --- |
| Public legal draft | Privacy `privacy-2026-09-11`; Terms `terms-2026-09-07`; both URLs returned published content | verified |
| Production Account capability before launch | Registration enabled; policy enforcement false; DSR false; Terms reported `terms-2026-08-04`; Privacy reported `privacy-2026-09-11` | verified |
| Retention dry run | Execution `asset-retention-dmfvm3e`; 28 selected; 6,670,547 bytes; 0 deleted; 0 failed; backlog 28 | verified |
| Retention predicate | Existing active `line.group.media-sync` assets created by `hhc-line-function-bot`, not deleted, not exempt, expired by collection policy | verified |
| Retention schedule | Manual trigger; recurring schedule disabled | verified |

## Delivery Record

| Repository | Change | PR / merge | CI / release | Live evidence |
| --- | --- | --- | --- | --- |
| `account-fe` | Always-visible Account collection notice | [PR #56](https://github.com/HallelujahHomeChurch/account-fe/pull/56); merge `baae43cd4ba9013140eac7d96d46c02791ea89e9` | [CI 34688641677](https://github.com/HallelujahHomeChurch/account-fe/actions/runs/34688641677) and [Production Release 34688711324](https://github.com/HallelujahHomeChurch/account-fe/actions/runs/34688711324) succeeded | Registration displayed the localized collection notice and separate versioned Terms/Privacy acceptance; submission remained gated until acceptance and Turnstile |
| `hhc-web` | Runbooks, processor register, legal packet, evidence | [PR #87](https://github.com/HallelujahHomeChurch/hhc-web/pull/87); merge `7f1c2514e669eab8f965f8a06e433ea44d3e5484` | [CI 34688641979](https://github.com/HallelujahHomeChurch/hhc-web/actions/runs/34688641979) succeeded; docs-only, so no runtime release | Documentation only |
| `account-api` | Policy and DSR enabled; versions aligned; Key Vault DSR key | [PR #77](https://github.com/HallelujahHomeChurch/account-api/pull/77); merge `43d123cd1e7cfa317d685f85d4ee1f7d044bbd5c` | [CI 34688641229](https://github.com/HallelujahHomeChurch/account-api/actions/runs/34688641229) and [Production Release 34689001334](https://github.com/HallelujahHomeChurch/account-api/actions/runs/34689001334) succeeded | Revision `account-api--0000080`; image `alive.azurecr.io/alive/account-api@sha256:f5726db9ddf6ab8030ad8b4a2d0cda63ec057ce679fb14d13d11251860d039e9`; live capability reports policy and DSR enabled with exact versions; both policy URLs returned 200; authenticated DSR page exposed export, correction, restriction, and deletion actions without creating a request |
| `asset-api` | Manual retention apply enabled; schedule remains disabled | [PR #64](https://github.com/HallelujahHomeChurch/asset-api/pull/64); merge `21855dc4d1b665e5a5802f568f0afe4b5140db2e` | [CI 34688991729](https://github.com/HallelujahHomeChurch/asset-api/actions/runs/34688991729) and [Production Release 34689165187](https://github.com/HallelujahHomeChurch/asset-api/actions/runs/34689165187) succeeded | API revision `asset-api--0000056`; retention job image `alive.azurecr.io/alive/asset-api@sha256:e736eceb6709bd25233771408b7709050b73834765fdc3e80fc1e0d88d858d18`; Manual trigger; apply true; recurring schedule absent |

## Production Reconciliation — 2026-09-12

| Gate | Evidence | Status |
| --- | --- | --- |
| Account capability | `policy.enforced=true`, `dsr.enabled=true`, Terms `terms-2026-09-07`, Privacy `privacy-2026-09-11`, registration enabled | verified |
| DSR key | Key Vault secret `account-dsr-subject-hmac-key`, version `d8616d071bdb43e898dd7651cb5ccdfc`, enabled; value was never printed or committed | verified |
| Registration notice | Live Traditional Chinese registration showed the standalone collection notice plus enforced versioned acceptance | verified |
| Authenticated DSR | Existing authenticated session reached `/data-requests` and displayed export, correction, restriction, and deletion actions; no request was submitted | verified |
| Pre-apply dry run | Execution `asset-retention-m9l7i5v`; 28 selected; 6,670,547 bytes; 0 deleted; 0 failed; backlog 28; scope exactly matched baseline | verified |
| Bounded retention apply | Execution `asset-retention-755g48w`; scanned 28; deleted 28; exempt skipped 0; already removed 0; failed items 0; failed batches 0; backlog 0 | verified |
| Post-apply dry run | Execution `asset-retention-9wibd9c`; scanned 0; deleted 0; failed items 0; failed batches 0; backlog 0 | verified |
| Recurring retention | Schedule remains disabled; future execution requires an explicit manual start | verified |

## Final Status

The engineering launch gate is complete. Legal wording and processor-contract review remain an independent counsel workstream; they do not block the released code or current feature flags. Counsel changes that alter wording only should publish a new CMS version. Contract, evidence, interaction, data-flow, or retention changes require a new engineering change.
