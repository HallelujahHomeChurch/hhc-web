# Account Legal Review Packet V1

Status: engineering first draft, not legal advice or counsel approval. Product and code release are intentionally independent from later wording review.

## Launch Draft

- Privacy Notice: `privacy-2026-09-11` — <https://www.alive.org.tw/zh-Hant/privacy-policy>
- Terms of Use: `terms-2026-09-07` — <https://www.alive.org.tw/zh-Hant/terms-of-use>
- Account registration and first-time OAuth linking display the Privacy Notice and, while enforcement is enabled, require acceptance of both exact versions.
- Acceptance evidence records the user, versions, locale, time, and request context through the existing Account policy contract.
- Authenticated data requests cover Account-attributable Account, Asset, Engagement, Notification, and Website watermark data.

## Engineering Basis Reviewed

The first draft was checked against the currently operative Taiwan Personal Data Protection Act, especially data-subject rights (Article 3), collection notice (Article 8), correction/cessation/deletion (Article 11), response periods (Article 13), non-public entity collection bases (Article 19), purpose limits and marketing opt-out (Article 20), and security safeguards (Article 27): <https://law.moj.gov.tw/LawClass/LawOldVer.aspx?pcode=I0050021>.

The Ministry page also shows later amendments whose effective date is not yet set; they were not treated as currently operative requirements: <https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=I0050021>.

## Counsel Review Questions

1. Confirm the legal identity and contact/address wording of the collecting entity in both documents.
2. Confirm each stated collection purpose, data category, legal basis, optional/required field consequence, recipient, region, retention period, and cross-border transfer statement.
3. Confirm whether consent is the correct basis for every Account action or whether acknowledgement plus another Article 19 basis is more accurate.
4. Confirm the scope and wording of deletion, restriction, legal holds, audit/security retention, backup expiry, minors, representatives, and deceased-account requests.
5. Confirm incident assessment and notification duties, timing, authority, and user-message requirements under the applicable effective law and contracts.
6. Review every `pending_external_review` item in `processor-register.md`, including DPAs, subprocessors, data location, transfer mechanism, and provider retention.
7. Confirm donation-specific terms, payment-provider disclosure, tax/receipt retention, refunds, fraud controls, and financial-record duties before donation launch. No donation data is included in this Account launch.

Counsel changes should normally update CMS legal text and increment the corresponding version. Code changes are needed only if counsel changes the evidence contract, interaction, data flow, owner scope, or retention behavior.

