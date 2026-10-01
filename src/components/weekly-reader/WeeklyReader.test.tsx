import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
import {WeeklyReader} from './WeeklyReader';

const state = vi.hoisted(() => ({accountId: 'account-a' as string | null, status: 'authenticated', open: vi.fn(), signIn: vi.fn()}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => state.accountId, useAccountAuth: () => ({status: state.status}),
  useAccountSignIn: () => state.signIn,
  useBulletinAccess: () => ({status: 'available', editions: state.accountId ? [{series: 'general', locale: 'zh-Hant'}] : []}),
  useBulletinAuthorization: () => authorization
}));
const authorization = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};
vi.mock('@/features/weekly-reader/api', async original => ({...await original<typeof import('@/features/weekly-reader/api')>(), createReaderApi: () => ({open: state.open})}));
const props = {locale: 'en' as const, issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const, messages: getMessages('en').weeklyReader};
beforeEach(() => {vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'); state.accountId = 'account-a'; state.status = 'authenticated'; state.open.mockReset().mockResolvedValue(readerFixture()); sessionStorage.clear(); vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})));});
afterEach(() => {Reflect.deleteProperty(document, 'fonts'); vi.unstubAllEnvs();});

describe('protected weekly reader', () => {
  it('keeps launch disabled unless explicitly enabled after acceptance', () => {
    vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', undefined);
    render(<WeeklyReader {...props}/>);
    expect(state.open).not.toHaveBeenCalled();
    expect(screen.getByText('This bulletin is unavailable.')).toBeInTheDocument();
  });
  it('searches loaded text and jumps without requesting another receipt', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByText('Search this bulletin', {selector: 'summary'}));
    fireEvent.change(screen.getByRole('searchbox', {name: 'Search this bulletin'}), {target: {value: '內容2'}});
    fireEvent.click(screen.getByRole('button', {name: 'Go to result'}));
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p2');
    expect(state.open).toHaveBeenCalledOnce();
    expect(container.querySelectorAll('[data-reader-watermark]')).toHaveLength(1);
    expect(container.querySelector('[data-reader-watermark]')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain(readerFixture().access.traceCode);
  });
  it('announces font loading instead of presenting a blank paper as ready', async () => {
    let ready!: () => void;
    Object.defineProperty(document, 'fonts', {configurable: true, value: {ready: new Promise<void>(resolve => {ready = resolve;})}});
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(screen.getByText('Loading bulletin…')).toHaveAttribute('role', 'status');
    await act(async () => ready());
    expect(screen.queryByText('Loading bulletin…')).not.toBeInTheDocument();
  });
  it('shows only a login shell when anonymous', () => {
    state.accountId = null; state.status = 'anonymous';
    render(<WeeklyReader {...props}/>);
    expect(screen.queryByText('Private weekly')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}));
    expect(state.signIn).toHaveBeenCalled();
    expect(state.open).not.toHaveBeenCalled();
  });
  it('renders only the active paper page, supports buttons/direct entry and preserves input arrows', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(container.querySelectorAll('[data-bulletin-page]')).toHaveLength(1);
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p0');
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p1');
    const page = screen.getByRole('spinbutton', {name: 'Page'});
    page.focus();
    fireEvent.change(page, {target: {value: '4'}});
    fireEvent.keyDown(page, {key: 'Enter'});
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p3');
    expect(screen.getByRole('spinbutton', {name: 'Page'})).toHaveFocus();
    fireEvent.change(page, {target: {value: '999'}});
    fireEvent.keyDown(page, {key: 'Enter'});
    expect(page).toHaveValue(4);
    fireEvent.keyDown(screen.getByRole('spinbutton', {name: 'Page'}), {key: 'ArrowLeft'});
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p3');
    fireEvent.keyDown(screen.getByRole('region', {name: 'Bulletin reader'}), {key: 'ArrowLeft'});
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p2');
  });
  it('discards a late response after account switch', async () => {
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;})).mockResolvedValueOnce({...readerFixture(), access: {...readerFixture().access, accountId: 'account-b'}});
    const {rerender} = render(<WeeklyReader {...props}/>);
    state.accountId = 'account-b'; rerender(<WeeklyReader {...props}/>);
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    await act(async () => finish(readerFixture()));
    expect(state.open.mock.calls[0][2].aborted).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('reflows all mobile sections without fixed pages or zoom controls', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-bulletin-mode="mobile"]')).not.toBeNull());
    expect(container.querySelectorAll('[data-bulletin-page]')).toHaveLength(0);
    expect(screen.queryByRole('button', {name: 'Next page'})).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-sentence-id]')).toHaveLength(4);
  });
  it('restores the bound revision page and makes thumbnail copies inert', async () => {
    sessionStorage.setItem(`weekly-reader-position:account-a:${readerFixture().document.documentId}:1`, 'p2');
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p2');
    fireEvent.click(screen.getByRole('button', {name: 'Thumbnails'}));
    expect(container.querySelectorAll('[inert][aria-hidden="true"]')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', {name: 'Page 1'}));
    expect(screen.getByRole('spinbutton', {name: 'Page'})).toHaveValue(1);
    expect(sessionStorage.getItem(`weekly-reader-position:account-a:${readerFixture().document.documentId}:1`)).toBe('p0');
  });
  it('persists a section anchor and restores it only within the same account/revision', async () => {
    const key = `weekly-reader-position:account-a:${readerFixture().document.documentId}:1:anchor`;
    const {unmount} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    fireEvent.click(screen.getByText('Sections', {selector: 'summary'}));
    fireEvent.click(screen.getAllByRole('button', {name: 'Summary'})[2]);
    expect(sessionStorage.getItem(key)).toBe(JSON.stringify({kind: 'component', id: 'c2'}));
    unmount();
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    scroll.mockRestore();
  });
  it('retries failures with the same issuance ID and never renders failed content', async () => {
    state.open.mockRejectedValueOnce(new Error('temporary'));
    render(<WeeklyReader {...props}/>);
    await screen.findByRole('alert');
    expect(screen.queryByText('Private weekly')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
    await screen.findByText('Private weekly');
    expect(state.open.mock.calls[0][1].clientRequestId).toBe(state.open.mock.calls[1][1].clientRequestId);
  });
});
