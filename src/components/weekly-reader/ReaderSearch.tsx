import {useMemo, useState} from 'react';
import type {MemberOnlineDocument} from '@hallelujahhomechurch/hhc-web-client';
import {searchSentences} from '@/features/weekly-reader/search';
import type {ReaderMessages} from './ReaderToolbar';

export function ReaderSearch({document, onJump, messages: m}: {document: MemberOnlineDocument; onJump: (sentenceId: string) => void; messages: ReaderMessages}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const results = useMemo(() => searchSentences(document.content, query, document.canonicalMetadata), [document, query]);
  function jump(next: number) {const result = results[next]; if (result) {setIndex(next); onJump(result.sentenceId);}}
  return <details className="reader-search"><summary>{m.search}</summary>
    <form role="search" aria-label={m.search} onSubmit={event => {event.preventDefault(); jump(index);}}>
      <label className="sr-only" htmlFor="reader-search-query">{m.search}</label>
      <input id="reader-search-query" type="search" maxLength={256} autoComplete="off" value={query} onChange={event => {setQuery(event.target.value); setIndex(0);}}/>
      <button type="submit" disabled={!results.length}>{m.goToResult}</button>
      <button type="button" disabled={index === 0 || !results.length} onClick={() => jump(index - 1)}>{m.previousResult}</button>
      <button type="button" disabled={index >= results.length - 1} onClick={() => jump(index + 1)}>{m.nextResult}</button>
      <output aria-label={m.searchResults} aria-live="polite">{results.length ? index + 1 : 0} / {results.length}</output>
    </form>
    {results[index] ? <p lang={document.contentLocale}>{results[index].text}</p> : null}
  </details>;
}
