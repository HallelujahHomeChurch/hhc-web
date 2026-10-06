import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {ReaderTabs} from './ReaderTabs';
import {writeTabs, readTabs} from '@/features/weekly-reader/workspace';
import {getMessages} from '@/i18n/messages';
const first = {title: 'First title', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const second = {...first, title: 'Second title', issueNumber: 1740};
const props = {accountId: 'a', locale: 'en' as const, current: second, title: second.title, messages: getMessages('en').weeklyReader};
beforeEach(() => sessionStorage.clear());
it('does not show background sync controls in the tabs', async () => {
  writeTabs('a', [first]);
  render(<ReaderTabs {...props}/>);
  await screen.findByRole('link', {name: 'First title'});
  expect(document.querySelector('.reader-tab-sync')).toBeNull();
  expect(screen.queryByRole('button', {name: props.messages.syncSynced})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: props.messages.syncSyncing})).not.toBeInTheDocument();
});
it('shows existing tabs and uses canonical routes while retaining inactive titles', async () => {
  writeTabs('a', [first]);
  render(<ReaderTabs {...props} title="Private weekly"/>);
  expect(await screen.findByRole('link', {name: 'First title'})).toHaveAttribute('href', '/en/literature-ministry/1739/read/general/zh-Hant');
  expect(screen.getByRole('link', {name: /Private weekly/})).toHaveAttribute('aria-current', 'page');
  expect(readTabs('a')).toEqual([first, {...second, title: 'Private weekly'}]);
});
it('honors navigation refusal before closing the current tab', async () => {
  const guard = vi.fn().mockResolvedValue(false);
  render(<ReaderTabs {...props} beforeNavigate={guard}/>);
  fireEvent.click(await screen.findByRole('button', {name: /Close.*1740/}));
  await waitFor(() => expect(guard).toHaveBeenCalled());
  expect(readTabs('a')).toEqual([second]);
  expect(screen.getByRole('link', {name: 'Second title'})).toBeInTheDocument();
});
it('closes an inactive tab without invoking the dirty-note guard', async () => {
  writeTabs('a', [first]);
  const guard = vi.fn();
  render(<ReaderTabs {...props} beforeNavigate={guard}/>);
  fireEvent.click(await screen.findByRole('button', {name: /Close.*1739/}));
  expect(readTabs('a')).toEqual([second]);
  expect(guard).not.toHaveBeenCalled();
});
