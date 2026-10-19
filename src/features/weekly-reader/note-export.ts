import {bulletinChapters} from '@hallelujahhomechurch/ui';
import type {BulletinReaderNote, MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {isLocale, type Locale} from '@/i18n/locales';
import {readerSentences} from './selection';
import {tabHref} from './workspace';

export const maxExportBytes = 8 * 1024 * 1024;
function fenced(text: string) {
  let longest = 0, run = 0;
  for (const char of text) {run = char === '`' ? run + 1 : 0; longest = Math.max(longest, run);}
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}\n${text}\n${fence}\n\n`;
}

export function noteSource(document: MemberOnlineDocument, note: BulletinReaderNote, unknown: string, chapters: Record<string, string>) {
  if (note.reanchorRequired || note.inactiveAnchors.length) return unknown;
  const sentences = readerSentences(document);
  const ranges = note.ranges?.length ? note.ranges : note.sentenceIds.map(sentenceId => ({sentenceId, start: 0, end: sentences.find(s => s.id === sentenceId)?.text ? [...sentences.find(s => s.id === sentenceId)!.text].length : 0}));
  const positions = new Set<string>();
  if (!ranges.length) return unknown;
  for (const range of ranges) {
    const sentence = sentences.find(s => s.id === range.sentenceId);
    if (!sentence || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0 || range.end <= range.start || range.end > [...sentence.text].length) return unknown;
    const chapter = bulletinChapters(document.content).find(chapter => chapter.componentIds.includes(sentence.componentId))?.id;
    let located = false;
    document.content.layoutManifest.pages.forEach(page => {
      if (page.slots.some(slot => slot.fragments.some(f => f.sentenceId === range.sentenceId && f.start < range.end && range.start < f.end)) || page.fixedSlots?.some(slot => `canonical-${slot.element}` === range.sentenceId)) {
        const index = document.content.pages.findIndex(p => p.id === page.pageId);
        if (index >= 0) {positions.add(`${chapter ? chapters[chapter] ?? chapter : ''} · PDF ${index + 1}`); located = true;}
      }
    });
    if (!located) return unknown;
  }
  return [...positions].join('\n');
}

export function buildNoteExport({document, notes, pendingNoteIds, locale, issueNumber, createdAt, unknownSource, chapters}: {
  document: MemberOnlineDocument; notes: readonly BulletinReaderNote[]; pendingNoteIds: ReadonlySet<string>; locale: Locale; issueNumber: number; createdAt: string; unknownSource: string; chapters: Record<string, string>;
}) {
  if (!notes.length || notes.length > 200 || !isLocale(locale) || !Number.isSafeInteger(issueNumber) || issueNumber < 1 || issueNumber >= 1e9 || !['general', 'children'].includes(document.series) || !['zh-Hant', 'zh-Hans', 'en'].includes(document.contentLocale) || !Number.isFinite(Date.parse(createdAt))) throw new Error('export_unavailable');
  const chunks: string[] = [], encoder = new TextEncoder(); let bytes = 0;
  const append = (text: string) => {bytes += encoder.encode(text).byteLength; if (bytes > maxExportBytes) throw new Error('export_limit'); chunks.push(text);};
  const text = (value: string) => {if (value.length > 20000) throw new Error('export_limit'); append(fenced(value));};
  append(`# HHC notes\n\nIssue: ${issueNumber}\nEdition: ${document.series}\nLanguage: ${document.contentLocale}\nRevision: ${document.revision}\nExported: ${new Date(createdAt).toISOString()}\nNotes: ${notes.length}\n\n`);
  append(`https://www.alive.org.tw${tabHref(locale, {issueNumber, series: document.series, contentLocale: document.contentLocale})}\n\n`);
  for (const [index, note] of notes.entries()) {
    if (note.deleted || typeof note.text !== 'string' || note.text.length > 20000 || [...note.text].length > 10000) throw new Error('export_unavailable');
    append(`## ${index + 1}\n\n`); text(note.text);
    append('Saved:\n\n'); text(note.updatedAt);
    append('Source:\n\n'); text(noteSource(document, note, unknownSource, chapters));
    if (pendingNoteIds.has(note.id)) append('Pending sync\n\n');
  }
  return {text: chunks.join(''), bytes, filename: `hhc-notes-${issueNumber}-${document.series}-${document.contentLocale}.md`};
}
