"""Generate the full licensed TW-Kai base-plane webfont before template V1 release."""
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile
from fontTools.ttLib import TTFont

archive, license_path = map(Path, sys.argv[1:])
with zipfile.ZipFile(archive) as bundle:
    source = bundle.read('TW-Kai-98_1.ttf')
source_hash = 'd5e8d7d8743c5cf816bdeb393a443f65105a8130266a04c19560e1d3401b28f0'
assert hashlib.sha256(source).hexdigest() == source_hash, 'unexpected_source_version'
font = TTFont(io.BytesIO(source), recalcTimestamp=False)
coverage = set(font.getBestCmap())
assert set(map(ord, '創世記神說我們要照著祂的形像造男造女')) <= coverage
family = 'HHC Weekly Scripture'
for identifier, value in {1:family,16:family,2:'Regular',17:'Regular',3:family+'-Regular',4:family+' Regular',6:'HHCWeeklyScripture-Regular'}.items():
    font['name'].removeNames(nameID=identifier)
    font['name'].setName(value,identifier,3,1,0x409)
font.flavor = 'woff2'
output = io.BytesIO()
font.save(output)
data = output.getvalue()
assert set(TTFont(io.BytesIO(data)).getBestCmap()) == coverage, 'lost_glyphs'
checksum = hashlib.sha256(data).hexdigest()
copyrights = list(dict.fromkeys(name.toUnicode() for name in font['name'].names if name.nameID == 0))
license_text = license_path.read_text()
license_body = license_text[license_text.index('SIL OPEN FONT LICENSE Version 1.1'):]
license_bytes = ('Copyright / 原始著作權聲明\n' + '\n'.join(copyrights) +
    '\n\n來源：數位發展部，CNS11643中文標準交換碼全字庫網站。\n'
    'https://data.gov.tw/dataset/5961\nhttps://www.cns11643.gov.tw/opendata/Fonts_Kai.zip\n'
    '依官方雙授權聲明選用 OFL-1.1。TW-Kai-98_1.ttf 完整基本字面轉為 WOFF2，'
    '更名為 HHC Weekly Scripture；未裁切字元。擴充字面不包含於此檔。\n\n' + license_body).encode('utf-8')
assert b'SIL OPEN FONT LICENSE Version 1.1' in license_bytes and b'Copyright' in license_bytes
license_hash = hashlib.sha256(license_bytes).hexdigest()
directory = Path(__file__).resolve().parent.parent / 'public/assets/weekly/v1'
url = f'/assets/weekly/v1/scripture-{checksum}.woff2'
license_url = f'/assets/weekly/v1/kai-license-{license_hash}.txt'
for path, contents in [(url,data),(license_url,license_bytes)]:
    target = directory / Path(path).name
    assert not target.exists() or target.read_bytes() == contents, 'immutable_bytes_changed'
    target.write_bytes(contents)
entry = dict(url=url,sha256=checksum,mime='font/woff2',sizeBytes=len(data),kind='font',family=family,weight=400,roles=['scripture'],licenseUrl=license_url,sourceUrl='https://www.cns11643.gov.tw/opendata/Fonts_Kai.zip',sourceSha256=source_hash)
print(json.dumps({'font':entry,'license':dict(url=license_url,sha256=license_hash,mime='text/plain',sizeBytes=len(license_bytes),kind='license'),'cmapEntries':len(coverage)},ensure_ascii=False,indent=2))
