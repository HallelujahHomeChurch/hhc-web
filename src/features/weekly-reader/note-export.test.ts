import {expect, it} from 'vitest';
import {readerFixture} from './test-fixture';
import {buildNoteExport, maxExportBytes, noteSource} from './note-export';
const document = readerFixture().document;
const note = {id: 'private-note-id', text: 'My 😀 note\n```\n<script>bad</script> [link](javascript:alert(1))', quote: 'NEVER EXPORT QUOTE', sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 1, end: 3, quote: 'NEVER EXPORT RANGE'}], inactiveAnchors: [], reanchorRequired: false, version: 1, deleted: false, createdAt: '', updatedAt: '2026-10-19T00:00:00Z'};
const input = {document, notes: [note], pendingNoteIds: new Set<string>(), locale: 'en' as const, issueNumber: 1739, createdAt: '2026-10-19T00:00:00Z', unknownSource: 'Unknown source', chapters: {back: 'Back cover'}};
it('exports only own text and verified source metadata, with dynamic fences and a controlled URL/filename', () => {
  const file = buildNoteExport(input);
  expect(file.text).toContain('````\n' + note.text + '\n````');
  expect(file.text).toContain('PDF 1');
  expect(file.text).toContain('https://www.alive.org.tw/en/literature-ministry/1739/read/general/zh-Hant');
  for (const privateField of ['NEVER EXPORT QUOTE', 'NEVER EXPORT RANGE', 'account-a', 'receipt-a', 'private-note-id', document.canonicalMetadata.title]) expect(file.text).not.toContain(privateField);
  expect(file.text).not.toContain('#s0');
  expect(file.filename).toBe('hhc-notes-1739-general-zh-Hant.md');
  expect(file.bytes).toBe(new TextEncoder().encode(file.text).byteLength);
});
it('marks only queued note IDs and retains unknown source without copying inactive anchor text', () => {
  const file = buildNoteExport({...input, pendingNoteIds: new Set([note.id]), notes: [{...note, inactiveAnchors: [{sentenceId: 'gone', quote: 'PRIVATE OLD BODY', componentId: 'old', pageId: 'old'}], reanchorRequired: true}]});
  expect(file.text).toContain('Pending sync'); expect(file.text).toContain(input.unknownSource); expect(file.text).not.toContain('PRIVATE OLD BODY');
});
it('resolves scalar ranges to every intersecting PDF page and rejects unavailable anchors', () => {
  const doc = structuredClone(document); doc.content.layoutManifest.pages[0].slots[0].fragments[0].end = 2;
  doc.content.layoutManifest.pages[1].slots[0].fragments.push({sentenceId: 's0', start: 2, end: 4});
  expect(noteSource(doc, note, 'unknown', {})).toContain('PDF 2');
  expect(noteSource(doc, {...note, ranges: [{...note.ranges[0], start: 2}]}, 'unknown', {})).not.toContain('PDF 1');
  expect(noteSource(doc, {...note, ranges: [{...note.ranges[0], end: 100}]}, 'unknown', {})).toBe('unknown');
});
it('rejects empty, deleted, oversized and invalid selector exports as a whole', () => {
  for (const change of [{notes: []}, {notes: Array(201).fill(note)}, {notes: [{...note, deleted: true}]}, {notes: [{...note, text: '😀'.repeat(10001)}]}, {issueNumber: -1}, {locale: '../bad' as 'en'}]) expect(() => buildNoteExport({...input, ...change})).toThrow();
});
it('bounds worst-case Unicode and backtick serialization without truncation', () => {
  for (const text of ['😀'.repeat(10000), '`'.repeat(10000)]) {
    const file = buildNoteExport({...input, notes: Array.from({length: 200}, (_, i) => ({...note, id: String(i), text}))});
    expect(file.bytes).toBeLessThanOrEqual(maxExportBytes); expect(file.text.split('## ').length).toBe(201);
  }
  expect(() => buildNoteExport({...input, notes: Array(200).fill({...note, text: '😀'.repeat(10000), updatedAt: '😀'.repeat(10000)})})).toThrow('export_limit');
});
