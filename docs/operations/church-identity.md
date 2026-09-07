# Church website identity

The website and HHC Account services identify Hallelujah Home Church as their
operator. Licensed content retains its original rights holders. Church history,
existing weekly papers, third-party scripture notices, and unrelated CMS edits
are outside this change.

On 2026-09-07, all expected old values in the ten locale/page patches matched
the public API projections (version 2 for both pages in all five locales).
CMS drafts have not been changed or verified; re-read their versions before saving.

## Delivery

1. Review and release the frontend PR through normal CI/CD. Home v2 and the
   unavailable-API fallback read `site.copyrightHolder` from the five locale files.
2. Separately preview the current CMS drafts and published revisions of
   `privacy-policy` and `terms-of-use`. The accompanying
   `church-identity-cms-preview.json` lists only changed fields for each locale.
   Each `translationPatch` uses JSON Patch paths relative to a single CMS
   translation object; it is review data, not an API request body.
3. Match the locale, template, section heading, and every `test` value against
   the current draft before replacing a field. If any value differs, stop and
   reconcile it; do not overwrite whole translations from the locale files.
   Preserve unrelated edits and preview them before publication. Use the actual
   publication date for `updatedAt` if it differs from the prepared date.
4. After approval of the CMS preview, save through the existing CMS editor or
   admin API with its current version/`If-Match`, review, and publish both pages.
   Do not bypass the CMS using SQL or the content-import job.
5. If the legacy site-layout path remains in use, preview its five
   `copyrightHolder` values and change them to the matching `site.name` values
   in `src/i18n/locales/*.json` through the existing settings workflow. The other
   layout fields must remain unchanged.
6. Verify the deployed frontend revision and `/health`, all five locale footers,
   both legal pages in all locales, and the unchanged association founding event
   on About. A frontend release alone does not update CMS legal content.

The backend's `2026-08-28-public-content-pages-v1` seed is an immutable historical
import with recorded hashes. Do not rewrite it or replay it to change published
content; it inserts drafts and rejects conflicting prior runs. For any fresh
bootstrap using that seed, apply the reviewed CMS edits before first publication.

Rollback CMS content by restoring the previous revision to draft and publishing
through the normal workflow; roll back the frontend through its release workflow.
