import type {BulletinReaderNote} from '@hallelujahhomechurch/hhc-web-client';
import {isLocale, type Locale} from '@/i18n/locales';

export const maxExportBytes = 8 * 1024 * 1024;
const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Inspect the builder's ZIP directory, without decompressing or reimplementing its packaging.
function uncompressedBytes(buffer: ArrayBuffer) {
  const view = new DataView(buffer), end = buffer.byteLength - 22;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50 || view.getUint16(end + 20, true) !== 0 || view.getUint32(end + 4, true) !== 0) throw new Error('export_unavailable');
  let offset = view.getUint32(end + 16, true), total = 0;
  if (offset + view.getUint32(end + 12, true) !== end) throw new Error('export_unavailable');
  const entries = view.getUint16(end + 10, true);
  if (entries !== view.getUint16(end + 8, true) || entries === 0xffff) throw new Error('export_unavailable');
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('export_unavailable');
    total += view.getUint32(offset + 24, true);
    if (total > maxExportBytes) throw new Error('export_limit');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  if (offset !== end) throw new Error('export_unavailable');
  return total;
}

export async function buildNoteExport({notes, locale, issueNumber, labels}: {
  notes: readonly BulletinReaderNote[]; locale: Locale; issueNumber: number; labels: {quote: string; note: string};
}) {
  if (!notes.length || notes.length > 200 || !isLocale(locale) || !Number.isSafeInteger(issueNumber) || issueNumber < 1 || issueNumber >= 1e9) throw new Error('export_unavailable');
  let bytes = 0, escapedBytes = 0;
  const encoder = new TextEncoder();
  const text = (value: string) => {
    if (typeof value !== 'string' || !value.isWellFormed() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(value)) throw new Error('export_unavailable');
    if (value.length > maxExportBytes) throw new Error('export_limit');
    const length = encoder.encode(value).byteLength;
    bytes += length; escapedBytes += length;
    for (const char of value) escapedBytes += char === '&' ? 4 : char === '<' || char === '>' ? 3 : 0;
    if (bytes > maxExportBytes || escapedBytes > maxExportBytes) throw new Error('export_limit');
    return value.replace(/\r\n?/g, '\n');
  };
  const entries = notes.map(note => {
    if (note.deleted || typeof note.text !== 'string' || note.text.length > 20000 || [...note.text].length > 10000) throw new Error('export_unavailable');
    const quote = text(note.quote ?? ''), own = text(note.text);
    if (quote.trim()) text(labels.quote);
    text(labels.note);
    return {quote: quote.trim() ? quote : '', own};
  });
  // Each content paragraph emits at least 80 bytes of spacing/widow XML; reject newline bombs before building objects.
  let paragraphs = 0;
  for (const entry of entries) for (const value of [entry.own, ...(entry.quote ? [entry.quote] : [])]) {
    paragraphs++;
    for (const char of value) if (char === '\n') paragraphs++;
  }
  if (paragraphs * 80 > maxExportBytes) throw new Error('export_limit');
  const {Document, Packer, Paragraph, TextRun} = await import('docx');
  const children: InstanceType<typeof Paragraph>[] = [];
  for (const entry of entries) {
    if (entry.quote) {
      children.push(new Paragraph({children: [new TextRun({text: labels.quote, bold: true, size: 20, color: '606060'})], keepNext: true, spacing: {before: 200, after: 100}}));
      for (const line of entry.quote.split('\n')) children.push(new Paragraph({text: line, indent: {left: 240, right: 240}, shading: {fill: 'F3F4F6'}, spacing: {after: 100, line: 360}, widowControl: true}));
    }
    children.push(new Paragraph({children: [new TextRun({text: labels.note, bold: true, size: 20, color: '606060'})], keepNext: true, spacing: {before: 160, after: 100}}));
    const lines = entry.own.split('\n');
    lines.forEach((line, index) => children.push(new Paragraph({text: line, spacing: {after: index === lines.length - 1 ? 360 : 100, line: 360}, widowControl: true})));
  }
  const language = {'en': 'en-US', 'zh-Hant': 'zh-TW', 'zh-Hans': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR'}[locale];
  const buffer = await Packer.toArrayBuffer(new Document({creator: '', lastModifiedBy: '', title: '', description: '', subject: '', keywords: '',
    styles: {default: {document: {run: {font: {ascii: 'Arial Unicode MS', hAnsi: 'Arial Unicode MS', eastAsia: 'Arial Unicode MS', cs: 'Arial Unicode MS'}, size: 24, color: '000000', language: {value: language, eastAsia: language}}, paragraph: {spacing: {line: 360}}}}},
    sections: [{properties: {page: {margin: {top: 1080, bottom: 1080, left: 1080, right: 1080}}}, children}]}));
  const xmlBytes = uncompressedBytes(buffer);
  if (buffer.byteLength > maxExportBytes) throw new Error('export_limit');
  return {buffer, bytes: buffer.byteLength, uncompressedBytes: xmlBytes, missingQuotes: entries.filter(entry => !entry.quote).length, mimeType, filename: `hhc-notes-${issueNumber}.docx`};
}
