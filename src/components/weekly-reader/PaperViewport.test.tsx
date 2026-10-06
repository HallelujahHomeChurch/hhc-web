import {render} from '@testing-library/react';
import {expect, it} from 'vitest';
import {PaperViewport, paperPresentation} from './PaperViewport';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {verifyReaderAccess} from '@/features/weekly-reader/api';
const value = readerFixture();
const document = verifyReaderAccess(value, {accountId: 'account-a', issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant'});
const props = {document, metadata: value.document.canonicalMetadata, traceCode: value.access.traceCode, page: 2, zoom: 1, viewport: {width: 600, height: 800}, direction: 'vertical' as const};
it('aligns back-cover frames outside text and separates sections without changing source content', () => {
  const source = structuredClone(document);
  source.components[1] = {...source.components[1], type: 'announcements'} as typeof source.components[number];
  source.components[2] = {...source.components[2], type: 'victoriesAndPrayers'} as typeof source.components[number];
  const page = source.layoutManifest.pages[0];
  page.slots = source.layoutManifest.pages.slice(0, 3).map((p, i) => ({...p.slots[0], box: {x: .04, y: .1 + i * .2, width: .92, height: .18}}));
  page.fixedSlots = (['summaryFrame', 'announcementsFrame', 'prayersFrame'] as const).map((element, i) => ({id: element, element, box: {x: .04, y: .09 + i * .2, width: .92, height: .2}, style: {fontSize: 11, lineHeight: 14, indent: 0, firstLineIndent: 0, spaceBefore: 0, spaceAfter: 0}}));
  const before = JSON.stringify(source);
  const result = paperPresentation(source).layoutManifest.pages[0];
  const frames = result.fixedSlots!;
  expect(frames[1].box.x).toBe(frames[2].box.x);
  expect(frames[1].box.width).toBe(frames[2].box.width);
  for (let i = 1; i < 3; i++) {
    const frame = frames[i].box, text = result.slots[i].box, previous = frames[i - 1].box;
    expect(frame.x).toBeLessThan(text.x);
    expect(frame.x + frame.width).toBeGreaterThan(text.x + text.width);
    expect(frame.y).toBeLessThan(text.y);
    expect(frame.y + frame.height).toBeGreaterThan(text.y + text.height);
    expect(frame.y - previous.y - previous.height).toBeGreaterThanOrEqual(11.9 / source.pages[0].height);
    expect(text.width).toBe(page.slots[i].box.width);
  }
  expect(JSON.stringify(source)).toBe(before);
});
it('renders cover verses as scripture without changing canonical text or source pages', () => {
  const source = structuredClone(document);
  const first = source.components[0];
  if (first.type !== 'backSummary') throw new Error('fixture');
  source.components[0] = {id: first.id, type: 'cover', cover: {welcome: [], worship: [], work: [], wordQuestions: [], weeklyVerses: first.items[0].blocks}};
  const before = JSON.stringify(source);
  const {container} = render(<PaperViewport {...props} document={source}/>);
  expect(container.querySelector('[data-sentence-id="s0"] [data-font-role]')).toHaveAttribute('data-font-role', 'scripture');
  expect(container.querySelector('[data-sentence-id="s1"] [data-font-role]')).toHaveAttribute('data-font-role', 'body');
  expect(container.querySelectorAll('[data-bulletin-page]')).toHaveLength(4);
  expect(JSON.stringify(source)).toBe(before);
});
it('renders source pages in order in continuous mode and watermarks every page', () => {
  const {container} = render(<PaperViewport {...props}/>);
  expect(Array.from(container.querySelectorAll('[data-bulletin-page]'), page => page.getAttribute('data-bulletin-page'))).toEqual(['p0', 'p1', 'p2', 'p3']);
  expect(container.querySelectorAll('.reader-watermarked')).toHaveLength(4);
});
it('renders only the current page horizontally without changing its source content', () => {
  const {container, rerender} = render(<PaperViewport {...props} direction="horizontal"/>);
  expect(container.querySelectorAll('[data-bulletin-page]')).toHaveLength(1);
  expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p2');
  expect(container).toHaveTextContent('內容2。');
  rerender(<PaperViewport {...props}/>);
  expect(container.querySelector('[data-paper-index="2"]')).toHaveTextContent('內容2。');
});
