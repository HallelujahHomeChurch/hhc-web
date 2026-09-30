# Weekly Template V1 asset provenance

Prepared 2026-10-01. This bundle has not been released or visually accepted.
Do not mutate published URLs: changed bytes need a new content-hashed filename;
changed typography/layout needs a new template/renderer version.

## Font sources

All three fonts originate from `google/fonts` commit
`9710da1eacb3be272583c3224dcb70f9da6eadbb`, licensed under SIL OFL 1.1.
Exact source URLs and SHA-256 values are in `manifest.json`. The complete
copyright/license notices are bundled as content-hashed TXT files.
No embedded PDF fonts, original image pixels, sermon text or member metadata
were copied into this public bundle. Fixed public QR destinations are documented
separately below.

| Role | Source | Derived family | Weight | Unicode cmap entries |
| --- | --- | --- | --- | --- |
| Body/reference/foreign text | Noto Serif TC variable | HHC Weekly Serif | 400 | 20,748 |
| Scripture | LXGW WenKai TC Regular | HHC Weekly Kai | 400 | 22,401 |
| Emphasis | LXGW WenKai TC Bold | HHC Weekly Kai | 700 | 22,401 |

These are legal approximations of the printed fonts, not reproductions of
New Ming, BiauKai or the proprietary emphasis face. Font scale, spacing and
readability must pass the original-PDF/shared-renderer acceptance gate.
Full upstream cmaps are retained; no sample-specific text subsetting is used.
Missing future glyphs must be detected by layout validation, not silently
replaced with platform-dependent glyphs. The three compressed fonts total
14,309,056 bytes and load only in the reader/editor, not the global site shell.

## Derivation

Generation used local FontTools 4.60.2 and its installed Brotli codec:

1. Verify each downloaded TTF against the source SHA-256 in the manifest.
2. Open with `TTFont(source, recalcTimestamp=False)`; for Noto instantiate
   `instantiateVariableFont(font, {'wght': 400}, inplace=True)`.
3. Set `font.flavor = 'woff2'` and save to a temporary WOFF2; no glyph deletion.
4. Reopen that WOFF2 with `recalcTimestamp=False`; rename primary name IDs
   `1, 2, 3, 4, 6, 16, 17` as follows, removing old records for each ID and
   setting a Windows Unicode English record (`platformID=3, platEncID=1,
   langID=0x409`):
   - `1/16`: derived family from the table above;
   - `2/17`: `Regular` or `Bold`;
   - `3`: `family + '-' + subfamily`;
   - `4`: `family + ' ' + subfamily`;
   - `6`: family with spaces removed + `'-' + subfamily`.
5. Save WOFF2 again; retain all copyright/license name records. Verify weight,
   family and cmap counts after decoding; name by the final byte SHA-256.
6. Copy complete upstream OFL files with only trailing spaces normalized.
   Noto's upstream license SHA-256 is unchanged; WenKai's original license
   SHA-256 is `4fff27d35db0e22cd81d58da6f20e09f415cf354a3338e3cf1fc0eb9222c7174`.

Run `node scripts/verify-weekly-template-assets.mjs --base-ref origin/main`
before commit. CI verifies actual bytes, provenance, complete role mapping,
license presence, unlisted files and append-only history, without downloading
or regenerating upstream fonts.

## Church-owned decoration

The content-hashed logo is a byte-identical copy of
`public/assets/brand/logo.png`, already approved in `ASSET_RIGHTS.md`.
Other fixed labels, rules, page numbers and masthead composition belong to the
shared code-owned renderer; they are not extracted dynamic components.

The static bundle is public. It contains no weekly bulletin/member content.

## Fixed public QR graphics

The three payloads were read locally from the 1739 cover using native barcode
recognition, then rebuilt as plain vector QR graphics with four-module quiet
zones and high error correction. No original PDF image pixels or centered
photo/icon overlays were copied. Exact public payloads are each asset's
`sourceUrl` in the manifest: the church website and its two public YouTube pages.
`scripts/generate-weekly-template-qr.py` uses the existing ReportLab QR encoder.
The verifier accepts only that generator's non-executable closed SVG grammar.
