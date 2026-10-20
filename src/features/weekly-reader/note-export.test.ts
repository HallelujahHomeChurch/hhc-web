import {createRequire} from 'node:module';
import {afterEach, expect, it, vi} from 'vitest';
import {buildNoteExport, maxExportBytes} from './note-export';

// Inspect real product OOXML with the builder's installed ZIP dependency.
const JSZip = createRequire(import.meta.resolve('docx'))('jszip');
type Part = {dir: boolean; async(type: 'string'): Promise<string>};
async function parts(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(new Uint8Array(buffer)) as {files: Record<string, Part>};
  return new Map(await Promise.all(Object.entries(zip.files).filter(([, part]) => !part.dir).map(async ([name, part]) => [name, await part.async('string')] as const)));
}
const note = {id:'private-note-id', text:'My 😀 note\n\n<script>bad</script> [link](javascript:alert(1))',quote:'保存的引用 <信 & 愛> 😀',sentenceIds:['s0'],ranges:[{sentenceId:'s0',start:1,end:3,quote:'RANGE MUST NOT APPEAR'}],inactiveAnchors:[],reanchorRequired:false,version:1,deleted:false,createdAt:'',updatedAt:'2026-10-19T00:00:00Z'};
const input = {notes:[note],locale:'en' as const,issueNumber:1739,labels:{quote:'Quotation',note:'My note'}};
afterEach(()=>vi.restoreAllMocks());
it('produces real Word containing only saved quotation and own paragraphs with safe plain text',async()=>{
 const file=await buildNoteExport(input),xml=await parts(file.buffer),body=xml.get('word/document.xml')!;
 const doc=new DOMParser().parseFromString(body,'application/xml');
 expect(doc.querySelector('parsererror')).toBeNull();
 expect([...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join(''))).toEqual(['Quotation',note.quote,'My note','My 😀 note','','<script>bad</script> [link](javascript:alert(1))']);
 for(const privateField of ['private-note-id','RANGE MUST NOT APPEAR','1739','2026-10-19','Pending sync','https://www.alive.org.tw','s0']) expect(body).not.toContain(privateField);
 expect(body).not.toContain('<script>');expect(body).not.toContain('<w:hyperlink');
 expect(body.match(/<w:keepNext\/>/g)).toHaveLength(2);expect(body).toContain('w:fill="F3F4F6"');
 for(const [name,text] of xml){expect(name).not.toMatch(/vbaProject|header\d|footer\d/);if(name.endsWith('.rels'))expect(text).not.toContain('TargetMode="External"');}
 expect(xml.get('docProps/core.xml')).not.toContain('private-note-id');
 expect(new DOMParser().parseFromString(xml.get('docProps/core.xml')!,'application/xml').getElementsByTagNameNS('*','creator')[0]?.textContent ?? '').toBe('');
 expect(file.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');expect(file.filename).toBe('hhc-notes-1739.docx');
 expect(file.bytes).toBe(file.buffer.byteLength);expect(file.uncompressedBytes).toBe([...xml.values()].reduce((sum,text)=>sum+new TextEncoder().encode(text).length,0));
});
it('uses only own text when a saved quotation is missing and never reconstructs inactive or range text',async()=>{
 const file=await buildNoteExport({...input,notes:[{...note,quote:'',inactiveAnchors:[{sentenceId:'gone',quote:'PRIVATE OLD BODY',componentId:'old',pageId:'old'}],reanchorRequired:true}]}),xml=await parts(file.buffer);
 expect(file.missingQuotes).toBe(1);expect(xml.get('word/document.xml')).not.toContain('Quotation');expect(xml.get('word/document.xml')).not.toContain('PRIVATE OLD BODY');expect(xml.get('word/document.xml')).not.toContain('RANGE MUST NOT APPEAR');
});
it('retains Unicode and original paragraph breaks and accepts 200 complete notes',async()=>{
 const file=await buildNoteExport({...input,locale:'zh-Hant',notes:Array.from({length:200},(_,i)=>({...note,id:String(i),quote:'繁體 简体 日本語 한국어 😀',text:'第一段\r\n第二段\r第三段'}))}),xml=await parts(file.buffer);
 expect(xml.get('word/document.xml')?.match(/繁體 简体 日本語 한국어 😀/g)).toHaveLength(200);expect(file.missingQuotes).toBe(0);expect(file.uncompressedBytes).toBeLessThan(maxExportBytes);
});
it('refuses empty, deleted, malformed Unicode/XML, oversized notes and invalid scopes as a whole',async()=>{
 for(const change of [{notes:[]},{notes:Array(201).fill(note)},{notes:[{...note,deleted:true}]},{notes:[{...note,text:'😀'.repeat(10001)}]},{notes:[{...note,text:'bad\u0000'}]},{notes:[{...note,quote:'\ud800'}]},{issueNumber:-1},{locale:'../bad' as 'en'}])await expect(buildNoteExport({...input,...change})).rejects.toThrow();
 await expect(buildNoteExport({...input,notes:[{...note,quote:'x'.repeat(maxExportBytes+1)}]})).rejects.toThrow('export_limit');
 await expect(buildNoteExport({...input,notes:Array(200).fill({...note,text:'&'.repeat(10000)})})).rejects.toThrow('export_limit');
 await expect(buildNoteExport({...input,notes:Array(200).fill({...note,text:'\n'.repeat(9999)+'X'})})).rejects.toThrow('export_limit');
});
it('rejects oversized uncompressed XML even when the generated ZIP is small',async()=>{
 const {Packer}=await import('docx');
 const zip=new JSZip();zip.file('word/document.xml','x'.repeat(maxExportBytes+1));
 const compressed=await zip.generateAsync({type:'arraybuffer',compression:'DEFLATE'});
 expect(compressed.byteLength).toBeLessThan(maxExportBytes);
 vi.spyOn(Packer,'toArrayBuffer').mockResolvedValueOnce(compressed);
 await expect(buildNoteExport(input)).rejects.toThrow('export_limit');
});
