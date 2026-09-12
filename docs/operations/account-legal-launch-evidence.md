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
| `account-fe` | Always-visible Account collection notice | awaiting delivery | awaiting delivery | awaiting delivery |
| `hhc-web` | Runbooks, processor register, legal packet, evidence | awaiting delivery | awaiting delivery | Documentation only |
| `account-api` | Policy and DSR enabled; versions aligned; Key Vault DSR key | awaiting delivery | awaiting delivery | awaiting delivery |
| `asset-api` | Manual retention apply enabled; schedule remains disabled | awaiting delivery | awaiting delivery | awaiting delivery |

## Final Reconciliation

Final status remains open until the table records immutable merge/release identifiers, production Account capability reports `policy.enforced=true` and `dsr.enabled=true` with the exact versions, the collection notice is visible, authenticated DSR access succeeds, and the bounded retention execution has exact selected/deleted/skipped/failed/backlog counts.

