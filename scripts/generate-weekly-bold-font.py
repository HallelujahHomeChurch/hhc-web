"""Build the reader presentation's true Serif 700; never replace pinned v1 assets."""
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

URL = 'https://raw.githubusercontent.com/google/fonts/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/notoseriftc/NotoSerifTC%5Bwght%5D.ttf'
SOURCE_SHA = '0077e18f57c6908f4a000969880940bdb0dad057c0e8d98b49dc364c3d1b09c6'
source = urlopen(URL, timeout=60).read()
assert hashlib.sha256(source).hexdigest() == SOURCE_SHA, 'source_hash_mismatch'
font = instantiateVariableFont(TTFont(io.BytesIO(source), recalcTimestamp=False), {'wght': 700}, inplace=True)
assert 'fvar' not in font and font['OS/2'].usWeightClass == 700, 'not_true_bold'
for identifier, name in ((1, 'HHC Weekly Serif'), (2, 'Bold'), (4, 'HHC Weekly Serif Bold'), (6, 'HHCWeeklySerif-Bold')):
    font['name'].removeNames(nameID=identifier)
    font['name'].setName(name, identifier, 3, 1, 0x409)
font.flavor = 'woff2'
output = io.BytesIO()
font.save(output)
data = output.getvalue()
sha = hashlib.sha256(data).hexdigest()
root = Path(__file__).resolve().parent.parent / 'public/assets/weekly/v2'
root.mkdir(parents=True, exist_ok=True)
(root / f'body-bold-{sha}.woff2').write_bytes(data)
print(json.dumps({'url': f'/assets/weekly/v2/body-bold-{sha}.woff2', 'sha256': sha, 'sizeBytes': len(data), 'sourceUrl': URL, 'sourceSha256': SOURCE_SHA}))
