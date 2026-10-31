/**
 * Build-time static params for CMS-backed locale pages.
 *
 * `next build` has no content API, so prerendering these pages for every locale
 * would bake the built-in fallback into the image and serve it (as STALE) to the
 * first visitor of each locale on each replica after every deploy. Returning a
 * non-locale sentinel overrides the locale layout's build paths (an empty list
 * would inherit them); it reaches `notFound()` before any CMS read, so real
 * locales render on demand and then follow the page's normal ISR revalidation.
 */
export function onDemandLocaleParams() {
  return [{locale: '__isr__'}];
}
