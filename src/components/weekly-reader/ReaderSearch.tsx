import {useMemo, useRef, useState, type ReactNode} from 'react';
import {Search, X} from 'lucide-react';
import {bulletinMobileDetails, bulletinChapters, bulletinBlocks} from '@hallelujahhomechurch/ui';
import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {searchSentences} from '@/features/weekly-reader/search';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import type {ReaderMessages} from './ReaderToolbar';

export function ReaderSearch({document, onJump, messages: m, mobile = false, closeControl}: {document: MemberOnlineDocument; onJump: (sentenceId: string) => void; messages: ReaderMessages; mobile?: boolean; closeControl?: ReactNode}) {
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useMemo(() => {
    const hidden = mobile ? bulletinMobileDetails(document.content).sentenceIds : new Set<string>();
    return searchSentences(document.content, submitted, document.canonicalMetadata).filter(result => !hidden.has(result.sentenceId));
  }, [document, submitted, mobile]);
  return <div className="reader-search">
    <header className="reader-search-header">{closeControl}
    <form role="search" aria-label={m.search} onSubmit={event => {event.preventDefault(); if (composing.current) return; setSubmitted(query.trim());}}>
      <input ref={input} type="search" aria-label={m.search} placeholder={m.search} value={query} maxLength={256} enterKeyHint="search" onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}} onKeyDown={event => {if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) {event.preventDefault();}}} onChange={event => setQuery(event.target.value)}/>
      {query ? <IconButton variant="ghost" aria-label={m.clearSearch} onPress={() => {setQuery(''); setSubmitted(''); input.current?.focus({preventScroll: true});}} icon={<X size={18} aria-hidden="true"/>}/> : null}
      <button type="submit" aria-label={m.submitSearch}><Search size={20} aria-hidden="true"/></button>
    </form>
    </header>
    {mobile ? <p className="reader-search-scope">{m.easySearchScope}</p> : null}
    <div className="reader-search-results">{submitted ? <>
      <p role="status" aria-label={m.searchResults}>{results.length ? m.searchCount.replace('{count}', String(results.length)) : m.noResults}</p>
      <ul className="reader-search-list">{results.map(result => {
        const page = document.content.layoutManifest.pages.findIndex(page => page.slots.some(slot => slot.fragments.some(fragment => fragment.sentenceId === result.sentenceId)) || page.fixedSlots?.some(slot => `canonical-${slot.element}` === result.sentenceId));
        const componentId = bulletinBlocks(document.content).find(entry => entry.block.sentences.some(sentence => sentence.id === result.sentenceId))?.componentId;
        const component = document.content.components.find(component => component.id === componentId);
        const chapter = bulletinChapters(document.content).find(chapter => componentId ? chapter.componentIds.includes(componentId) : result.sentenceId.startsWith('canonical-') && chapter.id === 'cover');
        const labels = {cover: m.chapterCover, body: m.chapterBody, worship: m.chapterWorship, back: m.chapterBack};
        const context = component?.type === 'bodySection' ? component.bodySection.title.sentences.map(sentence => sentence.spans.map(span => span.text).join('')).join('') : chapter ? labels[chapter.id] : '';
        return <li key={result.sentenceId}><button type="button" data-reader-search-target={result.sentenceId} onClick={() => onJump(result.sentenceId)}>
          <span lang={document.contentLocale}><SearchExcerpt text={result.text} query={submitted}/></span>
          {context || page >= 0 ? <small>{context}{context && page >= 0 ? ' · ' : ''}{page >= 0 ? `${m.page} ${page + 1}` : ''}</small> : null}
        </button></li>;
      })}</ul>
    </> : null}</div>
  </div>;
}

/** Normalize per Unicode scalar and retain original offsets (e.g. full-width Latin). */
function SearchExcerpt({text, query}: {text: string; query: string}) {
  const chars = Array.from(text), normalized = chars.map(char => char.normalize('NFKC').toLowerCase());
  let offset = 0;
  const offsets = normalized.map(char => {const start = offset; offset += char.length; return start;});
  const start = normalized.join('').indexOf(query.normalize('NFKC').toLowerCase());
  const end = start + query.normalize('NFKC').length;
  const first = Math.max(0, offsets.findIndex((offset, index) => offset + normalized[index].length > start));
  const last = offsets.findIndex(offset => offset >= end);
  const from = Math.max(0, first - 35), to = Math.min(chars.length, (last < 0 ? chars.length : last) + 70);
  return <>{from > 0 ? '…' : ''}{chars.slice(from, to).map((char, i) => offsets[from + i] < end && offsets[from + i] + normalized[from + i].length > start ? <mark key={from + i}>{char}</mark> : char)}{to < chars.length ? '…' : ''}</>;
}
