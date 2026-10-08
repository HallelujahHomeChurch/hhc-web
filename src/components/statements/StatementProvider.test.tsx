import {act, fireEvent, render, screen, waitFor, cleanup, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {StatementProvider} from './StatementProvider';
import {StatementStrip} from './StatementStrip';
const route = vi.hoisted(() => ({path: '/zh-Hant/about'}));
const auth = vi.hoisted(() => ({status: 'anonymous', session: {user: {id: 'owner-a'}}}));
vi.mock('@/components/layout/AccountControl', () => ({useAccountAuth: () => auth, useBulletinAuthorization: () => authorization}));
const authorization = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};
const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({usePathname: () => route.path}));
vi.mock('@/lib/observability', () => ({captureHandledError}));
const labels = {close: '關閉', openImage: '放大圖片', closeImage: '關閉圖片', doNotShowAgain: '不再顯示', readFull: '閱讀全文', notice: '教會聲明', date: '聲明日期', notifications: '網站通知', notificationDescription: '訂閱', email: 'Email', syncError: '無法同步不再顯示設定'};
let sequence = 0;
function payload(id: string) {return {serverNow: '2026-09-07T10:01:16Z', nextChangeAt: '2026-09-21T10:01:16Z', statement: {id, publishedVersion: 7, title: '正式聲明', body: '第一段原文\n\n第二段原文', resolvedLocale: 'zh-Hant', availableLocales: ['zh-Hant'], href: `/zh-Hant/statements/${id}`, popupStartsAt: '2026-09-07T10:01:16Z', popupEndsAt: '2026-09-21T10:01:16Z'}};}
function mount() {return render(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);}
beforeEach(() => {
 auth.session.user.id = 'owner-a'; auth.status = 'anonymous'; captureHandledError.mockClear();
 document.cookie = 'hhc_statement_dismissed=; Max-Age=0; Path=/';
 localStorage.clear(); route.path = '/zh-Hant/about';
 document.cookie = 'hhc_statement_hidden_day=; Max-Age=0; Path=/';
 HTMLDialogElement.prototype.showModal = function() {this.setAttribute('open', '');};
 HTMLDialogElement.prototype.close = function() {this.removeAttribute('open'); this.dispatchEvent(new Event('close'));};
});
afterEach(() => {cleanup(); vi.unstubAllGlobals();});
describe('statement entry', () => {
 it('removes both the dialog and header strip at the expiry boundary', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const response = payload(id);
  response.nextChangeAt = response.statement.popupEndsAt = '2026-09-07T10:01:17Z';
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({data: response})).mockResolvedValue(Response.json({data: {...response, statement: null, nextChangeAt: null}}));
  vi.stubGlobal('fetch', fetcher);
  mount();
  await screen.findByRole('dialog');
  expect(screen.getByRole('complementary', {name: '教會聲明'})).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', {name: '教會聲明'})).not.toBeInTheDocument();
  }, {timeout: 2500});
 });

 it.each([
  '/zh-Hant/maintenance',
  '/en/privacy-policy',
  '/ja/terms-of-use/'
 ])('does not load or render statements on %s', async (path) => {
  route.path = path;
  const fetcher = vi.fn(async () => new Response(JSON.stringify({data: payload(`00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`), meta: {}})));
  vi.stubGlobal('fetch', fetcher);
  mount();
  await act(async () => {});
  expect(fetcher).not.toHaveBeenCalled();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });

 it('opens on a non-home entry and ordinary close lasts through SPA navigation', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id), meta: {}}))));
  const view = mount();
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('checkbox', {name: '不再顯示'})).toBeInTheDocument();
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
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;route.path = `/en/statements/${id}`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id), meta: {}}))));
  const view = mount();await act(async () => {});
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  route.path = '/zh-Hant';view.rerender(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);
  expect(await screen.findByRole('link')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('saves the published version only when the checkbox is selected', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id), meta: {}}))));
  mount();await screen.findByRole('dialog');
  const checkbox = screen.getByRole('checkbox');expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);fireEvent.click(screen.getAllByRole('button', {name: '關閉'})[0]);
  expect(localStorage.getItem(`hhc:statement:${id}:dismissed-version`)).toBe('7');
  expect(document.cookie).toContain(`hhc_statement_dismissed=${id}.7`);
  cleanup();mount();await screen.findByRole('link');expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('honors a dismissal set on the Account host', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  document.cookie = `hhc_statement_dismissed=${id}.7; Path=/`;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id)}))));
  mount();
  await screen.findByRole('link');
  await act(async () => {});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('ignores old day-based dismissals', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  localStorage.setItem(`hhc:statement:${id}:hidden-day`, '2026-09-07');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: payload(id)}))));
  mount();
  await screen.findByRole('link');
  await act(async () => {});
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
 });
 it('renders no spacer on initial failure', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch', fetcher);
  const view = mount();await waitFor(() => expect(fetcher).toHaveBeenCalled());
  await act(async () => {});expect(view.container).toBeEmptyDOMElement();
  expect(captureHandledError).toHaveBeenCalledWith(expect.anything(), {operation: 'statement.active', tags: {locale: 'zh-Hant'}});
 });
 it('removes expired content at revalidation', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data: payload(id)})));
  vi.stubGlobal('fetch', fetcher); mount(); await screen.findByRole('dialog');
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({data: {...payload(id), serverNow: '2026-09-21T10:01:16Z', nextChangeAt: null}})));
  fireEvent.focus(window); await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 });
 it('ignores legacy dates and tolerates blocked storage', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  localStorage.setItem(`hhc:statement:${id}:hidden-day`, '2026-09-07');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: {...payload(id), serverNow: '2026-09-07T16:00:00Z'}}))));
  mount(); await screen.findByRole('dialog');
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {throw new Error('blocked');});
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button', {name: '關閉'})[0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); storage.mockRestore();
 });

 it('keeps the entry dialog open when an enlarged image is dismissed with Escape', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const response = payload(id);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: {...response, statement: {...response.statement, bodyJson: {schemaVersion: 1, blocks: [
    {id: 'photo', type: 'image', url: '/assets/statement/photo', alt: {mode: 'text', text: ''}}
  ]}}}, meta: {}}))));
  mount();
  const outer = await screen.findByRole('dialog', {name: '正式聲明'});
  fireEvent.click(within(outer).getByRole('button', {name: '放大圖片'}));
  const inner = screen.getByRole('dialog', {name: '放大圖片'});
  fireEvent(inner, new Event('cancel', {cancelable: true}));
  expect(screen.queryByRole('dialog', {name: '放大圖片'})).not.toBeInTheDocument();
  expect(outer).toHaveAttribute('open');
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(within(outer).getAllByRole('button', {name: '關閉'})[0]);
  expect(document.body.style.overflow).toBe('');
  expect(screen.getByRole('link', {name: /閱讀全文/})).toHaveAttribute('href', `/zh-Hant/statements/${id}`);
 });

 it('restores page scrolling when the entry dialog unmounts around an open image', async () => {
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const response = payload(id);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({data: {...response, statement: {...response.statement, bodyJson: {schemaVersion: 1, blocks: [
    {id: 'photo', type: 'image', url: '/assets/statement/photo', alt: {mode: 'text', text: ''}}
  ]}}}, meta: {}}))));
  const view = mount();
  const outer = await screen.findByRole('dialog', {name: '正式聲明'});
  fireEvent.click(within(outer).getByRole('button', {name: '放大圖片'}));
  expect(document.body.style.overflow).toBe('hidden');
  view.unmount();
  expect(document.body.style.overflow).toBe('');
 });

});

it('waits for authentication before deciding whether to prompt', async () => {
  auth.status = 'checking';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({data: payload(id)}));
  vi.stubGlobal('fetch', fetcher);
  const view = mount();
  await screen.findByRole('link');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetcher.mock.calls).toHaveLength(1);
  auth.status = 'anonymous';
  view.rerender(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
it('uses the account preference rather than anonymous storage', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  localStorage.setItem(`hhc:statement:${id}:dismissed-version`, '7');
  const fetcher = vi.fn<typeof fetch>(async request => {
    const req = request as Request;
    return Response.json({data: req.url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:false} : payload(id)});
  });
  vi.stubGlobal('fetch', fetcher);
  mount();
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  expect((fetcher.mock.calls[1][0] as Request).headers.get('Authorization')).toBe('Bearer token');
});
it('keeps the strip but suppresses the popup when preference lookup fails', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => (request as Request).url.includes('/me/') ? Response.json({error:{code:'unavailable',message:'offline'}},{status:503}) : Response.json({data:payload(id)})));
  mount(); await screen.findByRole('link'); await act(async () => {});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('discards delayed preferences after switching accounts', async () => {
  auth.status = 'authenticated'; auth.session.user.id = 'owner-a';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  let finish!: (response: Response) => void;
  let reads = 0;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => {
    if (!(request as Request).url.includes('/me/')) return Response.json({data:payload(id)});
    if (++reads === 1) return new Promise<Response>(resolve => {finish = resolve;});
    return Response.json({data:{statementId:id,publishedVersion:7,dismissed:true}});
  }));
  const view = mount(); await waitFor(() => expect(reads).toBe(1));
  auth.session.user.id = 'owner-b'; view.rerender(<StatementProvider locale="zh-Hant" labels={labels}><StatementStrip /></StatementProvider>);
  await waitFor(() => expect(reads).toBe(2));
  await act(async () => {finish(Response.json({data:{statementId:id,publishedVersion:7,dismissed:false}}));});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('closes ordinarily and reports failed account writes without saving locally', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const fetcher = vi.fn<typeof fetch>(async request => {
    const req = request as Request;
    if (req.method === 'PUT') return Response.json({error:{code:'unavailable',message:'offline'}},{status:503});
    return Response.json({data:req.url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:false} : payload(id)});
  });
  vi.stubGlobal('fetch', fetcher); mount(); await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveTextContent('無法同步');
  expect(localStorage.getItem(`hhc:statement:${id}:dismissed-version`)).toBeNull();
});
it('closes an open dialog when another device has dismissed the version', async () => {
  auth.status = 'authenticated'; let hidden = false;
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => Response.json({data:(request as Request).url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:hidden} : payload(id)})));
  mount(); await screen.findByRole('dialog'); hidden = true;
  fireEvent.focus(window);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('link')).toBeInTheDocument();
});

it('still closes after recreating the transport for the same account and version', async () => {
  auth.status = 'authenticated';
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => Response.json({data:(request as Request).url.includes('/me/') ? {statementId:id,publishedVersion:7,dismissed:false} : payload(id)})));
  const view = mount(); await screen.findByRole('dialog');

  view.rerender(<StatementProvider locale="en" labels={labels}><StatementStrip /></StatementProvider>); await act(async () => {});
  fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('does not let an old version write clear a newer pending write', async () => {
  auth.status = 'authenticated'; let version = 7;
  const id = `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
  const finishes: Array<(response: Response) => void> = [];
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async request => {
    const req = request as Request;
    if (req.method === 'PUT') return new Promise<Response>(resolve => finishes.push(resolve));
    return Response.json({data:req.url.includes('/me/') ? {statementId:id,publishedVersion:version,dismissed:false} : {...payload(id),statement:{...payload(id).statement,publishedVersion:version}}});
  }));
  mount(); await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  await waitFor(() => expect(finishes).toHaveLength(1));
  version = 8; fireEvent.focus(window);
  await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getAllByRole('button',{name:'關閉'})[0]);
  await waitFor(() => expect(finishes).toHaveLength(2));
  await act(async () => {finishes[0](Response.json({data:{statementId:id,publishedVersion:7,dismissed:true}}));});
  expect(screen.getByRole('checkbox')).toBeDisabled();
  await act(async () => {finishes[1](Response.json({data:{statementId:id,publishedVersion:8,dismissed:true}}));});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem(`hhc:statement:${id}:dismissed-version`)).toBeNull();
});
