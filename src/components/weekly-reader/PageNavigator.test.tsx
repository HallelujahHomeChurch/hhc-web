import {cleanup, render} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import {afterEach, expect, it, vi} from 'vitest';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
import {PageNavigator} from './PageNavigator';

afterEach(cleanup);
it.each(['v6', 'v7', 'v8'] as const)('preserves version-aware issue spacing in %s thumbnails', version => {
  const fixture = readerFixture('zh-Hant', version);
  const content = {...fixture.document.content, contentLocale: 'zh-Hant' as const, sourcePageCount: fixture.document.content.pages.length};
  const {container} = render(<div className="weekly-reader"><PageNavigator document={content} metadata={fixture.document.canonicalMetadata} page={0} onPage={vi.fn()} messages={getMessages('en').weeklyReader} traceCode={fixture.access.traceCode}/></div>);
  const thumbnail = container.querySelector('.reader-thumbnail-image')!;
  expect(thumbnail).toHaveAttribute('data-reader-renderer', version);
  const issue = document.createElement('span');
  issue.dataset.fixedElement = 'issueNumber';
  thumbnail.querySelector('[data-bulletin-mode="paper"]')!.append(issue);
  const css = readFileSync('src/components/weekly-reader/reader.css', 'utf8');
  const selector = css.split('\n').find(line => line.includes("[data-fixed-element='issueNumber']::before"))!.split('::before')[0];
  expect(issue.matches(selector)).toBe(version !== 'v8');
});
