import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ReaderTabs} from './ReaderTabs';
import {writeTabs, readTabs} from '@/features/weekly-reader/workspace';
import {getMessages} from '@/i18n/messages';
const first = {title: 'First title', issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const};
const second = {...first, title: 'Second title', issueNumber: 1740};
const props = {accountId: 'a', locale: 'en' as const, current: second, title: second.title, messages: getMessages('en').weeklyReader};
beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers({toFake: ['requestAnimationFrame', 'cancelAnimationFrame']});
});
afterEach(() => {vi.useRealTimers(); vi.restoreAllMocks();});
function renderTabs(overrides: Partial<Parameters<typeof ReaderTabs>[0]> = {}) {
  render(<ReaderTabs {...props} {...overrides}/>);
  act(() => vi.advanceTimersToNextFrame());
}
it('does not show background sync controls in the tabs', async () => {
  writeTabs('a', [first]);
  renderTabs();
  await screen.findByRole('link', {name: 'First title'});
  expect(document.querySelector('.reader-tab-sync')).toBeNull();
  expect(screen.queryByRole('button', {name: props.messages.syncSynced})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: props.messages.syncSyncing})).not.toBeInTheDocument();
});
it('shows existing tabs and uses canonical routes while retaining inactive titles', async () => {
  writeTabs('a', [first]);
  renderTabs({title: 'Private weekly'});
  expect(await screen.findByRole('link', {name: 'First title'})).toHaveAttribute('href', '/en/literature-ministry/1739/read/general/zh-Hant');
  expect(screen.getByRole('link', {name: /Private weekly/})).toHaveAttribute('aria-current', 'page');
  expect(readTabs('a')).toEqual([first, {...second, title: 'Private weekly'}]);
});
it('honors navigation refusal before closing the current tab', async () => {
  const guard = vi.fn().mockResolvedValue(false);
  renderTabs({beforeNavigate: guard});
  fireEvent.click(await screen.findByRole('button', {name: /Close.*1740/}));
  await waitFor(() => expect(guard).toHaveBeenCalled());
  expect(readTabs('a')).toEqual([second]);
  expect(screen.getByRole('link', {name: 'Second title'})).toBeInTheDocument();
});
it('closes an inactive tab without invoking the dirty-note guard', async () => {
  writeTabs('a', [first]);
  const guard = vi.fn();
  renderTabs({beforeNavigate: guard});
  fireEvent.click(await screen.findByRole('button', {name: /Close.*1739/}));
  expect(readTabs('a')).toEqual([second]);
  expect(guard).not.toHaveBeenCalled();
});

it.each([
  {left: 876, right: 1070, initial: 0, expected: 730},
  {left: -150, right: 44, initial: 700, expected: 506},
  {left: 100, right: 294, initial: 180, expected: 180},
])('keeps the active tab visible without scrolling the document ($left to $right)', ({left, right, initial, expected}) => {
  writeTabs('a', [first]);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this.classList.contains('reader-tabs')) return new DOMRect(44, 0, 296, 52);
    if (this.matches('.reader-tab[data-active]')) return new DOMRect(left, 6, right - left, 46);
    return new DOMRect();
  });
  render(<ReaderTabs {...props}/>);
  const nav = screen.getByRole('navigation', {name: props.messages.openBulletins});
  nav.scrollLeft = initial;
  act(() => vi.advanceTimersToNextFrame());
  expect(nav.scrollLeft).toBe(expected);
  expect(window.scrollY).toBe(0);
  expect(document.activeElement).toBe(document.body);
});

it('preserves manual tab browsing when an inactive tab is closed', () => {
  writeTabs('a', [first]);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this.classList.contains('reader-tabs')) return new DOMRect(44, 0, 296, 52);
    if (this.matches('.reader-tab[data-active]')) return new DOMRect(876, 6, 194, 46);
    return new DOMRect();
  });
  renderTabs();
  const nav = screen.getByRole('navigation', {name: props.messages.openBulletins});
  nav.scrollLeft = 180;
  fireEvent.click(screen.getByRole('button', {name: /Close.*1739/}));
  expect(nav.scrollLeft).toBe(180);
});
