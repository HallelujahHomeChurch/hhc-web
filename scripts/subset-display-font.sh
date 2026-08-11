#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_font="$root/src/assets/fonts/chenyuluoyan/ChenYuluoyan-2.0-Thin.woff2"
output_font="$root/src/assets/fonts/chenyuluoyan/ChenYuluoyan-HHC-Banners.woff2"
sc_source_font="$root/src/assets/fonts/ma-shan-zheng/MaShanZheng-Regular.ttf"
sc_output_font="$root/src/assets/fonts/ma-shan-zheng/MaShanZheng-HHC-Banners.woff2"
ja_source_font="$root/src/assets/fonts/klee-one/KleeOne-Regular.ttf"
ja_output_font="$root/src/assets/fonts/klee-one/KleeOne-HHC-Banners.woff2"
ja_license="$root/src/assets/fonts/klee-one/OFL.txt"
ko_source_font="$root/src/assets/fonts/hhc-pen-hangul/NanumPenScript-Regular.ttf"
ko_output_font="$root/src/assets/fonts/hhc-pen-hangul/HHC-Pen-Hangul-Banners.woff2"
ko_license="$root/src/assets/fonts/hhc-pen-hangul/OFL.txt"
text_file="$(mktemp)"
sc_text_file="$(mktemp)"
ja_text_file="$(mktemp)"
ko_text_file="$(mktemp)"
trap 'rm -f "$text_file" "$sc_text_file" "$ja_text_file" "$ko_text_file"' EXIT

python3 - "$ja_source_font" "$ja_license" "$ko_source_font" "$ko_license" <<'PY'
import hashlib
import pathlib
import sys

expected = {
    pathlib.Path(sys.argv[1]): 'bf4063f030cc2ae6adf0a11424a1888e5c0eb4438f1f6d02f52294af868e9b3a',
    pathlib.Path(sys.argv[2]): 'a9363bf2eeebb1699d0c272f75b2e7a3ac3625c4f9dd53cead0e213ec4e00fb5',
    pathlib.Path(sys.argv[3]): '6f0d1ab29c7894010dc88831fb7a0a51edb79136e450344183de5b1a8b52bd43',
    pathlib.Path(sys.argv[4]): '90f6a909ffb2af7f6422ea20042a26180fe5520cba80bbbf75a5e660320d7924',
}
for path, digest in expected.items():
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise SystemExit(f'Pinned font source or license hash mismatch: {path}')
PY

python3 - "$root" "$text_file" "$sc_text_file" "$ja_text_file" "$ko_text_file" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
sc_output = pathlib.Path(sys.argv[3])
ja_output = pathlib.Path(sys.argv[4])
ko_output = pathlib.Path(sys.argv[5])
fields = (
    ('home', 'heroTitle'),
    ('home', 'heroSubtitle'),
    ('news', 'title'),
    ('news', 'heroSubtitle'),
    ('about', 'heroTitle'),
    ('about', 'heroSubtitle'),
    ('literatureMinistry', 'heroTitle'),
    ('literatureMinistry', 'heroSubtitle'),
)

def banner_text(locale):
    messages = json.loads((root / 'src/i18n/locales' / f'{locale}.json').read_text())
    return ''.join(messages[section][key] for section, key in fields)

punctuation = ' 0123456789.,!?-:;()[]/&'
output.write_text(banner_text('zh-Hant') + banner_text('en') + punctuation + '–—', encoding='utf-8')
sc_output.write_text(banner_text('zh-Hans') + punctuation + '–—', encoding='utf-8')
ja_output.write_text(banner_text('ja') + punctuation, encoding='utf-8')
ko_output.write_text(banner_text('ko') + punctuation, encoding='utf-8')
PY

python3 -m fontTools.subset "$source_font" \
  --output-file="$output_font" \
  --flavor=woff2 \
  --text-file="$text_file" \
  --layout-features='*' \
  --name-IDs='*' \
  --name-legacy \
  --name-languages='*' \
  --notdef-glyph \
  --notdef-outline \
  --recommended-glyphs

python3 -m fontTools.subset "$sc_source_font" \
  --output-file="$sc_output_font" \
  --flavor=woff2 \
  --text-file="$sc_text_file" \
  --layout-features='*' \
  --name-IDs='*' \
  --name-legacy \
  --name-languages='*' \
  --notdef-glyph \
  --notdef-outline \
  --recommended-glyphs

python3 -m fontTools.subset "$ja_source_font" \
  --output-file="$ja_output_font" \
  --flavor=woff2 \
  --text-file="$ja_text_file" \
  --layout-features='*' \
  --name-IDs='*' \
  --name-legacy \
  --name-languages='*' \
  --notdef-glyph \
  --notdef-outline \
  --recommended-glyphs

python3 -m fontTools.subset "$ko_source_font" \
  --output-file="$ko_output_font" \
  --flavor=woff2 \
  --text-file="$ko_text_file" \
  --layout-features='*' \
  --name-IDs='*' \
  --name-legacy \
  --name-languages='*' \
  --notdef-glyph \
  --notdef-outline \
  --recommended-glyphs

python3 - "$output_font" "$ja_output_font" "$ko_output_font" "$ja_text_file" "$ko_text_file" <<'PY'
from fontTools.ttLib import TTFont
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
font = TTFont(path, recalcTimestamp=False)
names = font['name']
replacement = {
    1: 'HHC Banner Script',
    3: '1.0;HHC;HHCBannerScript-Regular',
    4: 'HHC Banner Script Regular',
    6: 'HHCBannerScript-Regular',
    16: 'HHC Banner Script',
    17: 'Regular',
}
for name_id, value in replacement.items():
    names.removeNames(nameID=name_id)
    names.setName(value, name_id, 3, 1, 0x409)
    names.setName(value, name_id, 1, 0, 0)

# Preserve the already-published subset timestamp so regeneration remains byte-for-byte stable.
font['head'].modified = 3869186442
font.save(path)

ko_path = pathlib.Path(sys.argv[3])
ko_font = TTFont(ko_path, recalcTimestamp=False)
ko_names = ko_font['name']
ko_replacement = {
    1: 'HHC Pen Hangul',
    3: '1.0;HHC;HHCPenHangul-Regular',
    4: 'HHC Pen Hangul Regular',
    6: 'HHCPenHangul-Regular',
    16: 'HHC Pen Hangul',
    17: 'Regular',
}
for name_id, value in ko_replacement.items():
    ko_names.removeNames(nameID=name_id)
    ko_names.setName(value, name_id, 3, 1, 0x409)
    ko_names.setName(value, name_id, 1, 0, 0)
ko_font.save(ko_path)

verified = TTFont(path, recalcTimestamp=False)
visible_names = {record.toUnicode() for record in verified['name'].names if record.nameID in replacement}
if any('chenyuluoyan' in value.lower() or '辰宇落雁' in value for value in visible_names):
    raise SystemExit('Reserved font name remains in the subset metadata')

def verify_banner_font(font_path, text_path, copyright_fragment, expected_family=None):
    font = TTFont(font_path, recalcTimestamp=False)
    cmap = font.getBestCmap()
    missing = sorted({character for character in text_path.read_text(encoding='utf-8') if ord(character) not in cmap})
    if missing:
        raise SystemExit(f'Missing banner glyphs in {font_path}: {"".join(missing)}')

    names = font['name'].names
    copyright_names = {record.toUnicode() for record in names if record.nameID == 0}
    license_names = {record.toUnicode() for record in names if record.nameID == 13}
    if not any(copyright_fragment in value for value in copyright_names):
        raise SystemExit(f'Copyright metadata missing from {font_path}')
    if not any('SIL Open Font License' in value for value in license_names):
        raise SystemExit(f'OFL metadata missing from {font_path}')
    if font_path.stat().st_size >= 250 * 1024:
        raise SystemExit(f'Banner subset exceeds 250 KiB: {font_path}')

    if expected_family is not None:
        family_names = {record.toUnicode() for record in names if record.nameID in (1, 16)}
        if family_names != {expected_family}:
            raise SystemExit(f'Unexpected primary family names in {font_path}: {sorted(family_names)}')
        primary_names = {record.toUnicode() for record in names if record.nameID in ko_replacement}
        forbidden = ('nanum', 'naver nanum', 'nanumpen', 'naver nanumpen')
        if any(fragment in value.lower() for value in primary_names for fragment in forbidden):
            raise SystemExit(f'Reserved Nanum primary name remains in {font_path}')

verify_banner_font(
    pathlib.Path(sys.argv[2]),
    pathlib.Path(sys.argv[4]),
    'Copyright 2020 The Klee Project Authors',
)
verify_banner_font(
    ko_path,
    pathlib.Path(sys.argv[5]),
    'Copyright © 2010 NHN Corporation',
    expected_family='HHC Pen Hangul',
)
PY

wc -c "$output_font" "$sc_output_font" "$ja_output_font" "$ko_output_font"
