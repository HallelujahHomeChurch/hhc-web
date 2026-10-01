import {describe, expect, it} from 'vitest';
import {readerFixture} from './test-fixture';
import {searchSentences} from './search';
describe('local authorized bulletin search', () => {
  it('returns CJK substring matches once per sentence in semantic order', () => {
    expect(searchSentences(readerFixture().document.content, '內容').map(hit => hit.sentenceId)).toEqual(['s0', 's1', 's2', 's3']);
    expect(searchSentences(readerFixture().document.content, '１')).toEqual([{sentenceId: 's1', text: '內容1。'}]);
  });
  it('ignores blank searches and never indexes receipts or fixed UI text', () => {
    expect(searchSentences(readerFixture().document.content, '   ')).toEqual([]);
    expect(searchSentences(readerFixture().document.content, readerFixture().access.traceCode)).toEqual([]);
    expect(searchSentences(readerFixture().document.content, 'Summary')).toEqual([]);
  });
  it('indexes published canonical titles as stable sentence anchors', () => {
    const {document} = readerFixture();
    expect(searchSentences(document.content, 'PRIVATE', document.canonicalMetadata)).toEqual([{sentenceId: 'canonical-title', text: 'Private weekly'}]);
  });
});
