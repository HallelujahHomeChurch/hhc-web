import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, expect, it, vi} from 'vitest';
import {ReaderTabs} from './ReaderTabs';
import {writeTabs, readTabs} from '@/features/weekly-reader/workspace';
import {getMessages} from '@/i18n/messages';
const first = {issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const second = {...first, issueNumber: 1740};
const props = {accountId: 'a', locale: 'en' as const, current: second, messages: getMessages('en').weeklyReader};
beforeEach(() => sessionStorage.clear());
it('keeps one accessible sync status on the active tab only', async () => {
  writeTabs('a', [first]);
  const {rerender} = render(<ReaderTabs {...props} syncStatus="syncing" onSyncDetails={() => {}}/>);
  expect(await screen.findByRole('button', {name: props.messages.syncSyncing})).toBeInTheDocument();
  rerender(<ReaderTabs {...props} syncStatus="synced" onSyncDetails={() => {}}/>);
  expect(screen.getAllByRole('button', {name: props.messages.syncSynced})).toHaveLength(1);
  expect(screen.queryByRole('button', {name: props.messages.syncSyncing})).not.toBeInTheDocument();
});
it('shows existing tabs and uses canonical routes without persisting private titles', async () => {
  writeTabs('a', [first]);
  render(<ReaderTabs {...props} title="Private weekly"/>);
  expect(await screen.findByRole('link', {name: /1739/})).toHaveAttribute('href', '/en/literature-ministry/1739/read/general/zh-Hant');
  expect(screen.getByRole('link', {name: /Private weekly/})).toHaveAttribute('aria-current', 'page');
  expect(readTabs('a')).toEqual([first, second]);
});
it('honors navigation refusal before closing the current tab', async () => {
  const guard = vi.fn().mockResolvedValue(false);
  render(<ReaderTabs {...props} beforeNavigate={guard}/>);
  fireEvent.click(await screen.findByRole('button', {name: /Close.*1740/}));
  await waitFor(() => expect(guard).toHaveBeenCalled());
  expect(readTabs('a')).toEqual([second]);
  expect(screen.getByRole('link', {name: /1740/})).toBeInTheDocument();
});
it('closes an inactive tab without invoking the dirty-note guard', async () => {
  writeTabs('a', [first]);
  const guard = vi.fn();
  render(<ReaderTabs {...props} beforeNavigate={guard}/>);
  fireEvent.click(await screen.findByRole('button', {name: /Close.*1739/}));
  expect(readTabs('a')).toEqual([second]);
  expect(guard).not.toHaveBeenCalled();
});
