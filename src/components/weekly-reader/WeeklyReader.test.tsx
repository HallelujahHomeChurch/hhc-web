import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {readerFixture} from '@/features/weekly-reader/test-fixture';
import {getMessages} from '@/i18n/messages';
import {WeeklyReader} from './WeeklyReader';

const state = vi.hoisted(() => ({accountId: 'account-a' as string | null, status: 'authenticated', open: vi.fn(), signIn: vi.fn(), privateState: vi.fn(), mutate: vi.fn()}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => state.accountId, useAccountAuth: () => ({status: state.status}),
  useAccountSignIn: () => state.signIn,
  useBulletinAccess: () => ({status: 'available', editions: state.accountId ? [{series: 'general', locale: 'zh-Hant'}] : []}),
  useBulletinAuthorization: () => authorization
}));
const authorization = {getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null};
function selectText(element: Element, start?: number, end?: number) {
  fireEvent.pointerDown(element);
  const range = document.createRange();
  range.selectNodeContents(element);
  if (start !== undefined) {
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()!;
    range.setStart(text, start); range.setEnd(text, end!);
  }
  const selection = window.getSelection()!;
  selection.removeAllRanges(); selection.addRange(range);
  fireEvent(document, new Event('selectionchange'));
}
vi.mock('@/features/weekly-reader/api', async original => ({...await original<typeof import('@/features/weekly-reader/api')>(), createReaderApi: () => ({open: state.open, privateState: state.privateState, mutate: state.mutate})}));
const props = {locale: 'en' as const, issueNumber: 1739, series: 'general' as const, contentLocale: 'zh-Hant' as const, messages: getMessages('en').weeklyReader};
beforeEach(() => {vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'); state.accountId = 'account-a'; state.status = 'authenticated'; state.open.mockReset().mockResolvedValue(readerFixture()); state.privateState.mockReset().mockResolvedValue({state: {accountId: 'account-a', documentId: readerFixture().document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: null, conflicts: []}}); state.mutate.mockReset(); sessionStorage.clear(); vi.stubGlobal('matchMedia', vi.fn(() => ({matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()})));});
afterEach(() => {Reflect.deleteProperty(document, 'fonts'); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();});

describe('protected weekly reader', () => {
  it('selects partial native text instead of activating an entire sentence on click', async () => {
    const cloud = (await state.privateState()).state;
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    fireEvent.click(sentence);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    expect(sentence).not.toHaveAttribute('role', 'button');
    selectText(sentence, 1, 3);
    fireEvent.click(screen.getByRole('button', {name: 'Blue highlight'}));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0].payload).toEqual({sentenceIds: ['s0'], ranges: [{sentenceId: 's0', start: 1, end: 3}], color: 'blue'});
  });
  it('dismisses transient selection outside the reader without removing a saved highlight', async () => {
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, highlights: [{sentenceId: 's0', color: 'yellow', quote: '內容0', active: true, version: 1, updatedAt: ''}]}});
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    expect(sentence).toHaveAttribute('data-highlight', 'yellow');
    expect(state.mutate).not.toHaveBeenCalled();
    selectText(sentence);
    fireEvent.click(screen.getByText('Private weekly', {selector: 'h1'}));
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
  });

  it('keeps toolbar selection until acknowledgement, then closes it and preserves the saved color', async () => {
    const cloud = (await state.privateState()).state;
    let acknowledge!: () => void;
    state.mutate.mockImplementation((_selector, _value, mutations) => new Promise(resolve => {
      acknowledge = () => resolve({state: {...cloud, highlights: [{sentenceId: 's0', color: 'yellow', quote: '內容0', active: true, version: 1, updatedAt: ''}]}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]});
    }));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    const color = screen.getByRole('button', {name: 'Yellow highlight'});
    fireEvent.pointerDown(color);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    fireEvent.click(color);
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'));
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    await act(async () => acknowledge());
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    expect(sentence).toHaveAttribute('data-highlight', 'yellow');
  });

  it('retains retry context after a failed highlight and does not discard an open note on outside click', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    state.mutate.mockRejectedValue(new Error('temporary'));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Yellow highlight'}));
    await screen.findByText(props.messages.actionFailed);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    expect(container.querySelector('[data-sentence-id="s0"]')).not.toHaveAttribute('data-highlight');
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Keep this draft'}});
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('Keep this draft');
    expect(confirm).toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  });

  it('protects a dirty note when changing pages or opening the notes list', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const next = screen.getByRole('button', {name: 'Next page'});
    const list = screen.getByRole('button', {name: 'My notes'});
    selectText(container.querySelector('[data-sentence-id="s0"]')!, 1, 3);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Keep draft and range'}});
    fireEvent.click(next);
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p0');
    fireEvent.click(list);
    expect(screen.getByRole('textbox', {name: props.messages.noteText})).toHaveValue('Keep draft and range');
    expect(confirm).toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(next);
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p1');
    expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  });

  it('does not clear a newer selection when an older highlight acknowledgement arrives', async () => {
    const cloud = (await state.privateState()).state;
    let acknowledge!: () => void;
    state.mutate.mockImplementation((_selector, _value, mutations) => new Promise(resolve => {
      acknowledge = () => resolve({state: cloud, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]});
    }));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    fireEvent.click(screen.getByRole('button', {name: 'Yellow highlight'}));
    await waitFor(() => expect(acknowledge).toBeTypeOf('function'));
    selectText(sentence); selectText(sentence);
    await act(async () => acknowledge());
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
  });

  it('keeps native pinch-zoom panning from turning the paper page', async () => {
    const visual = Object.assign(new EventTarget(), {scale: 1});
    vi.stubGlobal('visualViewport', visual);
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    const viewport = container.querySelector('.reader-viewport')!;
    const swipe = () => {
      for (const [type, x] of [['pointerdown', 200], ['pointerup', 100]] as const) {
        const event = new Event(type, {bubbles: true});
        Object.assign(event, {pointerType: 'touch', pointerId: 1, clientX: x, clientY: 100});
        fireEvent(viewport, event);
      }
    };
    act(() => {visual.scale = 2; visual.dispatchEvent(new Event('resize'));});
    swipe();
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p0');
    act(() => {visual.scale = 1; visual.dispatchEvent(new Event('resize'));});
    swipe();
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p1');
  });
  it('returns focus to the inline note marker after closing its associated notes', async () => {
    const cloud = (await state.privateState()).state;
    state.privateState.mockResolvedValue({state: {...cloud, notes: [{id: 'note-a', sentenceIds: ['s0'], text: 'Anchored note', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''}]}});
    render(<WeeklyReader {...props}/>);
    const marker = await screen.findByRole('button', {name: 'My notes (1)'});
    marker.focus(); fireEvent.click(marker);
    expect(await screen.findByText('Anchored note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    await waitFor(() => expect(marker).toHaveFocus());
  });
  it('restores same-account selection and note draft after login without sending a write', async () => {
    const first = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(first.container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Return after login'}});
    first.unmount();
    const second = render(<WeeklyReader {...props}/>);
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Return after login');
    expect(state.mutate).not.toHaveBeenCalled();
    second.unmount();
    state.accountId = 'account-b';
    state.open.mockResolvedValue({...readerFixture(), access: {...readerFixture().access, accountId: 'account-b'}});
    render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
  });
  it('preserves an unsaved note when resizing between the side panel and sheet', async () => {
    let resize!: (width: number) => void;
    vi.stubGlobal('ResizeObserver', class {
      constructor(private callback: (entries: {contentRect: {width: number; height: number}}[]) => void) {}
      observe(element: HTMLElement) {if (element.className === 'reader-document') resize = width => this.callback([{contentRect: {width, height: 800}}]);}
      disconnect() {}
    });
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    act(() => resize(1300));
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Do not lose this draft'}});
    act(() => resize(800));
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Do not lose this draft');
    act(() => resize(1300));
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Do not lose this draft');
    vi.unstubAllGlobals();
  });
  it('hides portal note text during foreground authorization and restores the unchanged draft afterward', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    fireEvent.change(screen.getByRole('textbox', {name: props.messages.noteText}), {target: {value: 'Unsaved private draft'}});
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent.focus(window);
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('textbox', {name: props.messages.noteText})).not.toBeInTheDocument();
    await act(async () => finish(readerFixture()));
    expect(await screen.findByRole('textbox', {name: props.messages.noteText})).toHaveValue('Unsaved private draft');
  });
  it('shows both versions after a delete conflict and never silently retries deletion', async () => {
    const local = {id: 'note-a', sentenceIds: ['s0'], text: 'Local note', quote: 'Quote', version: 1, deleted: false, inactiveAnchors: [], reanchorRequired: false, createdAt: '', updatedAt: ''};
    const cloud = {...local, text: 'Cloud edit', version: 2};
    const privateState = {...(await state.privateState()).state, notes: [local]};
    state.privateState.mockResolvedValue({state: privateState});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...privateState, notes: [cloud]}, results: [{mutationId: mutations[0].mutationId, status: 'note_conflict', revision: 1, note: cloud}]}));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<WeeklyReader {...props}/>);
    await waitFor(() => expect(screen.getByRole('button', {name: 'My notes'})).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', {name: 'My notes'}));
    fireEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(await screen.findByText('Cloud edit')).toBeInTheDocument();
    expect(screen.getByText('Local note')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Keep cloud'}));
    expect(state.mutate).toHaveBeenCalledOnce();
  });
  it.each([false, true])('records mobile progress without an initial-cover write, immediate hide: %s', async hide => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn()})));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(container.querySelector('[data-sentence-id="s2"]')).toBeInTheDocument());
    expect(state.mutate).not.toHaveBeenCalled();
    for (const element of container.querySelectorAll<HTMLElement>('[data-sentence-id]')) {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({top: element.dataset.sentenceId === 's2' ? 100 : -100, bottom: element.dataset.sentenceId === 's2' ? 130 : -70} as DOMRect);
    }
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: (await state.privateState()).state, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    fireEvent.scroll(window);
    if (hide) {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      fireEvent(document, new Event('visibilitychange'));
      await waitFor(() => expect(state.mutate).toHaveBeenCalled(), {timeout: 150});
    }
    await waitFor(() => expect(state.mutate).toHaveBeenCalled(), {timeout: 2500});
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'setProgress', payload: {pageId: 'p2', sentenceId: 's2'}});
  });
  it('offers cloud progress without jumping and uses Start over as a normal private mutation', async () => {
    const cloud = {accountId: 'account-a', documentId: readerFixture().document.documentId, appliedRevision: 1, currentRevision: 1, highlights: [], notes: [], progress: {pageId: 'p2', componentId: 'c2', sentenceId: 's2', recordedAt: '', updatedAt: ''}, conflicts: []};
    state.privateState.mockResolvedValue({state: cloud});
    state.mutate.mockImplementation(async (_selector, _value, mutations) => ({state: {...cloud, progress: null}, results: [{mutationId: mutations[0].mutationId, status: 'applied', revision: 1}]}));
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByRole('button', {name: 'Start over'});
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p0');
    fireEvent.click(screen.getByRole('button', {name: 'Start over'}));
    await waitFor(() => expect(state.mutate).toHaveBeenCalled());
    expect(state.mutate.mock.calls[0][2][0]).toMatchObject({kind: 'setProgress', payload: {}});
    expect(screen.queryByRole('button', {name: 'Continue reading'})).not.toBeInTheDocument();
  });
  it('retains selected sentences across foreground authorization checks without permitting actions during validation', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    selectText(container.querySelector('[data-sentence-id="s0"]')!);
    let finish!: (value: ReturnType<typeof readerFixture>) => void;
    state.open.mockImplementationOnce(() => new Promise(resolve => {finish = resolve;}));
    fireEvent.focus(window);
    await waitFor(() => expect(state.open).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    await act(async () => finish(readerFixture()));
    await screen.findByRole('button', {name: 'Copy'});
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
  });
  it('preserves native selection snapshot on note cancellation and clears it on escape and navigation', async () => {
    const {container} = render(<WeeklyReader {...props}/>);
    await screen.findByText('Private weekly');
    await waitFor(() => expect(state.privateState).toHaveBeenCalled());
    const sentence = container.querySelector('[data-sentence-id="s0"]')!;
    selectText(sentence);
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Note'}));
    expect(screen.queryByRole('button', {name: 'Yellow highlight'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await screen.findByRole('button', {name: 'Yellow highlight'});
    expect(screen.getByRole('button', {name: 'Copy'})).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    selectText(sentence);
    fireEvent.keyDown(screen.getByRole('region', {name: 'Bulletin reader'}), {key: 'Escape'});
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
    selectText(sentence);
    fireEvent.click(screen.getByRole('button', {name: 'Next page'}));
    expect(screen.queryByRole('button', {name: 'Copy'})).not.toBeInTheDocument();
  });
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
    expect(container.querySelector('[data-bulletin-page]')).toHaveAttribute('data-bulletin-page', 'p0');
    fireEvent.click(screen.getByRole('button', {name: 'Continue reading'}));
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
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Continue reading'}));
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
