import {render} from '@testing-library/react';
import {expect, it} from 'vitest';
import {PaperViewport} from './PaperViewport';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {verifyReaderAccess} from '@/features/weekly-reader/api';
const value = readerFixture();
const document = verifyReaderAccess(value, {accountId: 'account-a', issueNumber: 1739, series: 'general', contentLocale: 'zh-Hant'});
const props = {document, metadata: value.document.canonicalMetadata, traceCode: value.access.traceCode, page: 2, zoom: 1, viewport: {width: 600, height: 800}, direction: 'vertical' as const};
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
