import {beforeEach, describe, expect, it} from 'vitest';
import {addTab, closeTab, readTabs, writeTabs, readPaperView, writePaperView, tabHref, tabKey, type ReaderTab} from './workspace';
const first: ReaderTab = {issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant'};
const second: ReaderTab = {...first, issueNumber: 1740};
beforeEach(() => sessionStorage.clear());
describe('reader workspace', () => {
  it('restores per-document zoom/direction and rejects corrupt view state', () => {
    writePaperView('a:doc:1', {zoom: 2, direction: 'horizontal'});
    expect(readPaperView('a:doc:1')).toEqual({zoom: 2, direction: 'horizontal'});
    expect(readPaperView('b:doc:1')).toEqual({zoom: 1, direction: 'vertical'});
    sessionStorage.setItem('weekly-reader-view:a:doc:1', '{"zoom":999,"direction":"width"}');
    expect(readPaperView('a:doc:1')).toEqual({zoom: 1, direction: 'vertical'});
  });
  it('deduplicates editions without conflating languages', () => {
    expect(addTab([first, second], first)).toEqual([first, second]);
    expect(addTab([first], {...first, contentLocale: 'en'})).toHaveLength(2);
    expect(tabHref('ja', first)).toBe('/ja/literature-ministry/1739/read/general/zh-Hant');
  });
  it('closes inactive tabs without changing the active one and chooses a neighbor on active close', () => {
    expect(closeTab([first, second], tabKey(second), tabKey(first))).toEqual({tabs: [second], active: second});
    expect(closeTab([first, second], tabKey(second), tabKey(second))).toEqual({tabs: [first], active: first});
    expect(closeTab([first], tabKey(first), tabKey(first))).toEqual({tabs: [], active: null});
  });
  it('keeps titles isolated by account and rejects malformed entries', () => {
    writeTabs('a', [{...first, title: 'private title'} as ReaderTab]);
    expect(readTabs('a')).toEqual([{...first, title: 'private title'}]);
    expect(readTabs('b')).toEqual([]);
    expect(addTab(readTabs('a'), {...first, title: 'Updated'})).toEqual([{...first, title: 'Updated'}]);
    sessionStorage.setItem('weekly-reader-tabs:a', JSON.stringify([first, {...second, issueNumber: -1}, {...second, contentLocale: 'ja'}]));
    expect(readTabs('a')).toEqual([first]);
    sessionStorage.setItem('weekly-reader-tabs:a', '{');
    expect(readTabs('a')).toEqual([]);
  });
});
