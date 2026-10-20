"""Read-only artifact checks; run from this evidence directory."""
import json
import struct
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET

for width, height in [(390, 844), (768, 1024), (1440, 900)]:
    for theme in ['light', 'dark']:
        data = Path(f'baseline-{width}-{theme}.png').read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (width, height)
geometry = json.loads(Path('prototype-geometry.json').read_text())
panels = geometry[:3]
assert all(item['panel'] == panels[0]['panel'] for item in panels)
assert all(item['header'] == panels[0]['header'] for item in panels)
assert geometry[3]['panel']['width'] == 390 and geometry[3]['panel']['height'] == 844
assert geometry[3]['active'] == 'search'
with ZipFile('word-prototype.docx') as archive:
    assert sum(item.file_size for item in archive.infolist()) < 8 * 1024 * 1024
    text = ''.join(ET.fromstring(archive.read('word/document.xml')).itertext())
    assert '讓閱讀保持專注' in text and '<XML & 特殊字元>' in text
    assert all(value not in text for value in ['account-a', 'fixture-note', 'Revision:', 'Exported:', 'http'])
    for item in archive.infolist():
        if item.filename.endswith('.rels'):
            assert 'TargetMode="External"' not in archive.read(item).decode()
for name in ['prototype-motion.mp4', 'baseline-save-motion.mp4']:
    assert Path(name).stat().st_size > 1000
assert len(list(Path('word-browser-render').glob('page-*.png'))) == 3
print('T0 artifact checks PASS')
