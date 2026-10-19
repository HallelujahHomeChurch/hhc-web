"""Verify the actual product download, then its packaged-renderer pages. No network."""
from pathlib import Path
from zipfile import ZipFile
import hashlib,json,subprocess,xml.etree.ElementTree as E
from PIL import Image
base=Path(__file__).parent
path=base/'T5-product-notes.docx'
download=json.loads((base/'T5-download.json').read_text())
assert download['filename']=='hhc-notes-1739.docx' and download['failure'] is None
with ZipFile(path) as archive:
    assert archive.testzip() is None
    size=sum(info.file_size for info in archive.infolist())
    assert size<=8*1024*1024 and path.stat().st_size<=8*1024*1024
    names=archive.namelist()
    assert not any('vbaProject' in name or '/header' in name or '/footer' in name for name in names)
    for name in names:
        if name.endswith('.rels'):
            assert all(rel.get('TargetMode')!='External' for rel in E.fromstring(archive.read(name)))
    document=E.fromstring(archive.read('word/document.xml'))
    actual=[''.join(t.text or '' for t in p.findall('.//{*}t')) for p in document.findall('.//{*}p')]
    expected=[]
    for note in download['ui']['notes']:
        quote=note['quote'].replace('\r\n','\n').replace('\r','\n')
        if quote.strip(): expected+=['引用',*quote.split('\n')]
        expected+=['我的筆記',*note['text'].replace('\r\n','\n').replace('\r','\n').split('\n')]
    assert actual==expected, 'Only saved quotes, own paragraphs, and the two labels may appear'
    core=E.fromstring(archive.read('docProps/core.xml'))
    for tag in ['creator','lastModifiedBy','title','subject','description','keywords']:
        assert not any((e.text or '').strip() for e in core.findall('.//{*}'+tag))
    assert len(document.findall('.//{*}keepNext'))==7
    assert len(document.findall('.//{*}shd'))==3
pdf=base/'T5-word-render'/'T5-product-notes.pdf'
raw=subprocess.check_output(['/Users/rayselfs/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/bin/pdftotext','-bbox',str(pdf),'-'])
boxes=E.fromstring(raw)
pages=[]
for index,page in enumerate(boxes.findall('.//{*}page'),1):
    words=page.findall('.//{*}word')
    bounds=[min(float(w.get('xMin')) for w in words),min(float(w.get('yMin')) for w in words),max(float(w.get('xMax')) for w in words),max(float(w.get('yMax')) for w in words)]
    assert bounds[0]>=30 and bounds[1]>=30 and bounds[2]<=float(page.get('width'))-30 and bounds[3]<=float(page.get('height'))-30
    image=base/'T5-word-render'/f'page-{index}.png'
    with Image.open(image) as im: dimensions=im.size
    pages.append({'page':index,'textBounds':bounds,'image':image.name,'pixels':dimensions})
assert len(pages)==3
result={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'downloadFilename':download['filename'],'notes':len(download['ui']['notes']),'paragraphs':len(actual),'missingQuotes':sum(not n['quote'].strip() for n in download['ui']['notes']),'bytes':path.stat().st_size,'uncompressedBytes':size,'exactTextMatch':True,'externalRelationships':False,'authorMetadata':False,'pages':pages}
(base/'T5-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
