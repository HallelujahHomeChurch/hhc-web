import {useMemo, useState} from 'react';
import {Search, X} from 'lucide-react';
import {bulletinMobileDetails} from '@hallelujahhomechurch/ui';
import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {searchSentences} from '@/features/weekly-reader/search';
import {ReaderIconButton as IconButton} from './ReaderIconButton';
import type {ReaderMessages} from './ReaderToolbar';

export function ReaderSearch({document, onJump, messages: m, mobile = false}: {document: MemberOnlineDocument; onJump: (sentenceId: string) => void; messages: ReaderMessages; mobile?: boolean}) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useMemo(() => {
    const hidden = mobile ? bulletinMobileDetails(document.content).sentenceIds : new Set<string>();
    return searchSentences(document.content, submitted, document.canonicalMetadata).filter(result => !hidden.has(result.sentenceId));
  }, [document, submitted, mobile]);
  return <div className="reader-search">
    <form role="search" aria-label={m.search} onSubmit={event => {event.preventDefault(); setSubmitted(query.trim());}}>
      <input type="search" aria-label={m.search} placeholder={m.search} value={query} maxLength={256} enterKeyHint="search" onChange={event => setQuery(event.target.value)}/>
      {query ? <IconButton variant="ghost" aria-label={m.clearHighlight} onPress={() => {setQuery(''); setSubmitted('');}} icon={<X size={18} aria-hidden="true"/>}/> : null}
      <button type="submit" aria-label={m.submitSearch}><Search size={20} aria-hidden="true"/></button>
    </form>
    {submitted ? <>
      <p role="status" aria-label={m.searchResults}>{results.length ? m.searchCount.replace('{count}', String(results.length)) : m.noResults}</p>
      <ul className="reader-search-list">{results.map(result => {
        const page = document.content.layoutManifest.pages.findIndex(page => page.slots.some(slot => slot.fragments.some(fragment => fragment.sentenceId === result.sentenceId)) || page.fixedSlots?.some(slot => `canonical-${slot.element}` === result.sentenceId));
        return <li key={result.sentenceId}><button type="button" onClick={() => onJump(result.sentenceId)}>
          <span lang={document.contentLocale}><SearchExcerpt text={result.text} query={submitted}/></span>
          {page >= 0 ? <small>{m.page} {page + 1}</small> : null}
        </button></li>;
      })}</ul>
    </> : null}
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
