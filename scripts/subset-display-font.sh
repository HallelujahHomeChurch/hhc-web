#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_font="$root/src/assets/fonts/chenyuluoyan/ChenYuluoyan-2.0-Thin.woff2"
output_font="$root/src/assets/fonts/chenyuluoyan/ChenYuluoyan-HHC-Banners.woff2"
sc_source_font="$root/src/assets/fonts/ma-shan-zheng/MaShanZheng-Regular.ttf"
sc_output_font="$root/src/assets/fonts/ma-shan-zheng/MaShanZheng-HHC-Banners.woff2"
text_file="$(mktemp)"
sc_text_file="$(mktemp)"
trap 'rm -f "$text_file" "$sc_text_file"' EXIT

python3 - "$root" "$text_file" "$sc_text_file" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
sc_output = pathlib.Path(sys.argv[3])
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

text = []
for locale in ('zh-Hant', 'en'):
    messages = json.loads((root / 'src/i18n/locales' / f'{locale}.json').read_text())
    text.extend(messages[section][key] for section, key in fields)

output.write_text(''.join(text) + ' 0123456789.,!?-–—:;()[]/&', encoding='utf-8')

messages = json.loads((root / 'src/i18n/locales/zh-Hans.json').read_text())
sc_output.write_text(
    ''.join(messages[section][key] for section, key in fields) + ' 0123456789.,!?-–—:;()[]/&',
    encoding='utf-8',
)
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

python3 - "$output_font" <<'PY'
from fontTools.ttLib import TTFont
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
font = TTFont(path)
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

font.save(path)

verified = TTFont(path)
visible_names = {record.toUnicode() for record in verified['name'].names if record.nameID in replacement}
if any('chenyuluoyan' in value.lower() or '辰宇落雁' in value for value in visible_names):
    raise SystemExit('Reserved font name remains in the subset metadata')
PY

wc -c "$output_font" "$sc_output_font"
