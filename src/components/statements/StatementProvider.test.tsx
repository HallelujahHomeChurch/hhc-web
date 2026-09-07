import {act, fireEvent, render, screen, waitFor, cleanup, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {StatementProvider} from './StatementProvider';
import {StatementStrip} from './StatementStrip';
const route = vi.hoisted(() => ({path: '/zh-Hant/about'}));
vi.mock('next/navigation', () => ({usePathname: () => route.path}));
const labels = {close: '關閉', hideToday: '今天不再顯示', readFull: '閱讀全文', notice: '教會聲明', date: '聲明日期', notifications: '網站通知', notificationDescription: '訂閱', email: 'Email'};
let sequence = 0;
function payload(id: string) {return {serverNow: '2026-09-07T10:01:16Z', nextChangeAt: '2026-09-21T10:01:16Z', statement: {id, title: '正式聲明', body: '第一段原文\n\n第二段原文', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant'], href: `/zh-Hant/statements/${id}`, popupStartsAt: '2026-09-07T10:01:16Z', popupEndsAt: '2026-09-21T10:01:16Z'}};}
function mount() {return render(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);}
beforeEach(() => {
 localStorage.clear(); route.path = '/zh-Hant/about';
 HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open', '');};
 HTMLDialogElement.prototype.close = function() {this.removeAttribute('open');};
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
describe('statement entry', () => {
 it('opens on a non-home entry and ordinary close lasts through SPA navigation', async () => {
  const id = `statement-${++sequence}`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id), meta: {}}))));
  const view = mount();
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('checkbox', {name: '今天不再顯示'})).toBeInTheDocument();
  expect(within(dialog).getByText('第一段原文 第二段原文', {exact: false}).textContent).toBe(payload(id).statement.body);
  expect(screen.getByText('第一段原文 第二段原文', {exact: false})).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', {name: '關閉'})[0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  route.path = '/zh-Hant/news';
  view.rerender(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute('href', `/zh-Hant/statements/${id}`);
 });
 it('direct detail bypass also suppresses the modal after SPA departure', async () => {
  const id = `statement-${++sequence}`;route.path = `/en/statements/${id}`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id), meta: {}}))));
  const view = mount();await act(async () => {});
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  route.path = '/zh-Hant';view.rerender(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);
  expect(await screen.findByRole('link')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('saves the Taipei day only when the checkbox is selected', async () => {
  const id = `statement-${++sequence}`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id), meta: {}}))));
  mount();await screen.findByRole('dialog');
  const checkbox = screen.getByRole('checkbox');expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);fireEvent.click(screen.getAllByRole('button', {name: '關閉'})[0]);
  expect(localStorage.getItem(`hhc:statement:${id}:hidden-day`)).toBe('2026-09-07');
  cleanup();mount();await screen.findByRole('link');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('renders no spacer on initial failure', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch', fetcher);
  const view = mount();await waitFor(() => expect(fetcher).toHaveBeenCalled());
  await act(async () => {});expect(view.container).toBeEmptyDOMElement();
 });
 it('removes expired content at revalidation', async () => {
  const id = `statement-${++sequence}`;
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data: payload(id)})));
  vi.stubGlobal('fetch', fetcher); mount(); await screen.findByRole('dialog');
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({data: {...payload(id), serverNow: '2026-09-21T10:01:16Z', nextChangeAt: null}})));
  fireEvent.focus(window); await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('shows again on the next Taipei day and tolerates blocked storage', async () => {
  const id = `statement-${++sequence}`;
  localStorage.setItem(`hhc:statement:${id}:hidden-day`, '2026-09-07');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: {...payload(id), serverNow: '2026-09-07T16:00:00Z'}}))));
  mount(); await screen.findByRole('dialog');
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('blocked');});
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button', {name: '關閉'})[0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); storage.mockRestore();
 });

});
