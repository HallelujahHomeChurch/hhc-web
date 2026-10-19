import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {useReaderExitGuard} from './useReaderExitGuard';

afterEach(() => {cleanup(); vi.restoreAllMocks();});
function historyModel(direct = false) {
  const entries: Record<string, unknown>[] = direct ? [{__NA: true, tree: 'reader'}] : [{destination: 'original'}, {__NA: true, tree: 'reader'}];
  let index = entries.length - 1;
  vi.spyOn(history, 'length', 'get').mockImplementation(() => entries.length);
  vi.spyOn(history, 'state', 'get').mockImplementation(() => entries[index]);
  const push = vi.spyOn(history, 'pushState').mockImplementation(state => {entries.splice(index + 1); entries.push(state); index++;});
  vi.spyOn(history, 'replaceState').mockImplementation(state => {entries[index] = state;});
  const go = vi.spyOn(history, 'go').mockImplementation(delta => {queueMicrotask(() => {
    index = Math.max(0, Math.min(entries.length - 1, index + (delta ?? 0)));
    window.dispatchEvent(new PopStateEvent('popstate', {state: entries[index]}));
  });});
  return {entries, push, go, back: () => go(-1), current: () => entries[index]};
}
const messages = getMessages('en').weeklyReader;
it.each(['home', 'back'] as const)('%s uses the shared leave action without bypassing cancellation', async kind => {
  historyModel(true); const beforeLeave = vi.fn().mockResolvedValue(true);
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => true, beforeLeave, messages: getMessages('zh-Hant').weeklyReader}));
  let request!: Promise<boolean>;
  act(() => {request = result.current.confirmLeave(kind);});
  expect(result.current.dialogProps.confirmLabel).toBe('離開');
  expect(result.current.dialogProps.description).toContain(getMessages('zh-Hant').weeklyReader.noteDiscardConfirm);
  act(() => result.current.dialogProps.onOpenChange?.(false));
  expect(await request).toBe(false); expect(beforeLeave).not.toHaveBeenCalled();
});
it('cancel never calls cleanup or flush and concurrent exit requests share one dialog', async () => {
  historyModel(true); const beforeLeave = vi.fn().mockResolvedValue(true);
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => true, beforeLeave, messages}));
  let first!: Promise<boolean>, second!: Promise<boolean>;
  act(() => {first = result.current.confirmLeave('home'); second = result.current.confirmLeave('back');});
  expect(result.current.dialogProps.description).toContain(messages.noteDiscardConfirm);
  act(() => result.current.dialogProps.onOpenChange?.(false));
  expect(await first).toBe(false); expect(await second).toBe(false); expect(beforeLeave).not.toHaveBeenCalled();
});
it('home owns its confirmation when browser back arrives before confirm', async () => {
  const model = historyModel(); const beforeLeave = vi.fn().mockResolvedValue(true);
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => false, beforeLeave, messages}));
  let home!: Promise<boolean>;
  act(() => {home = result.current.confirmLeave('home');});
  await act(async () => model.back());
  await act(async () => result.current.dialogProps.onConfirm());
  expect(await home).toBe(true);
  expect(beforeLeave).toHaveBeenCalledOnce();
  expect(model.go.mock.calls.filter(([delta]) => delta === -2)).toHaveLength(0);
  expect(model.current().__hhcReaderExit).toMatchObject({position: 'guard'});
});
it('confirmed back leaves once to original destination, cancel restores the same entry without pushes', async () => {
  const model = historyModel(); const beforeLeave = vi.fn().mockResolvedValue(true);
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => false, beforeLeave, messages}));
  expect(model.push).toHaveBeenCalledOnce(); expect(history.state).toMatchObject({__NA: true, tree: 'reader'});
  await act(async () => model.back()); expect(result.current.dialogProps.isOpen).toBe(true);
  act(() => result.current.dialogProps.onOpenChange?.(false)); await act(async () => {});
  expect(model.current()).toMatchObject({__NA: true, tree: 'reader'}); expect(beforeLeave).not.toHaveBeenCalled();
  await act(async () => model.back());
  await act(async () => result.current.dialogProps.onConfirm());
  expect(beforeLeave).toHaveBeenCalledOnce(); expect(model.current()).toEqual({destination: 'original'});
  expect(model.go.mock.calls.filter(([delta]) => delta === -2)).toHaveLength(1);
  expect(model.push).toHaveBeenCalledOnce();
});
it('direct entry does not create a fake back destination', () => {
  const model = historyModel(true);
  renderHook(() => useReaderExitGuard({hasUnsavedNote: () => false, beforeLeave: async () => true, messages}));
  expect(model.push).not.toHaveBeenCalled();
});
it('refresh and remount reuse the guard; forward traversal reuses its existing entry', async () => {
  const model = historyModel();
  const options = {hasUnsavedNote: () => false, beforeLeave: async () => true, messages};
  const first = renderHook(() => useReaderExitGuard(options)); first.unmount();
  const next = renderHook(() => useReaderExitGuard(options)); expect(model.push).toHaveBeenCalledOnce();
  next.unmount(); await act(async () => model.back());
  renderHook(() => useReaderExitGuard(options)); await act(async () => {});
  expect(model.push).toHaveBeenCalledOnce(); expect(model.current().__hhcReaderExit).toMatchObject({position: 'guard'});
});
it('unmount cancels a pending confirmation and removes history listeners', async () => {
  const model = historyModel(); const beforeLeave = vi.fn();
  const {result, unmount} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => false, beforeLeave, messages}));
  let request!: Promise<boolean>; act(() => {request = result.current.confirmLeave('home');});
  unmount(); expect(await request).toBe(false);
  await act(async () => model.back()); expect(beforeLeave).not.toHaveBeenCalled();
});

it('cancels an already-confirmed leave and ignores its late completion after a new prompt opens', async () => {
  historyModel(true); let finish!: (allowed: boolean) => void; let isCurrent!: () => boolean;
  const beforeLeave = vi.fn((current: () => boolean) => {isCurrent = current; return new Promise<boolean>(resolve => {finish = resolve;});});
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => true, beforeLeave, messages}));
  let first!: Promise<boolean>; act(() => {first = result.current.confirmLeave('home');});
  let confirmation!: Promise<void>; act(() => {confirmation = Promise.resolve(result.current.dialogProps.onConfirm());});
  expect(result.current.confirming).toBe(true); expect(isCurrent()).toBe(true);
  act(() => result.current.dialogProps.onOpenChange?.(false));
  expect(await first).toBe(false); expect(isCurrent()).toBe(false);
  let second!: Promise<boolean>; act(() => {second = result.current.confirmLeave('home');});
  await act(async () => {finish(true); await confirmation;});
  expect(result.current.dialogProps.isOpen).toBe(true);
  act(() => result.current.dialogProps.onOpenChange?.(false)); expect(await second).toBe(false);
});

it('warns about accepted memory changes even after the note editor has closed', async () => {
  historyModel(true); const beforeLeave = vi.fn().mockResolvedValue(true);
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => false, hasUnsavedChanges: () => true, beforeLeave, messages}));
  let request!: Promise<boolean>; act(() => {request = result.current.confirmLeave('home');});
  expect(result.current.dialogProps.description).toContain(messages.exitUnsavedChanges);
  act(() => result.current.dialogProps.onOpenChange?.(false)); expect(await request).toBe(false); expect(beforeLeave).not.toHaveBeenCalled();
});


it('browser Back dismisses the top overlay before asking to leave the reader', async () => {
  const model = historyModel(); let overlay = true;
  const consumeBack = vi.fn(() => {if (!overlay) return false; overlay = false; return true;});
  const beforeLeave = vi.fn().mockResolvedValue(true);
  const {result} = renderHook(() => useReaderExitGuard({hasUnsavedNote: () => false, beforeLeave, consumeBack, messages}));
  await act(async () => model.back());
  expect(consumeBack).toHaveBeenCalledOnce();
  expect(result.current.dialogProps.isOpen).toBe(false); expect(beforeLeave).not.toHaveBeenCalled();
  expect(model.current().__hhcReaderExit).toMatchObject({position: 'guard'});
  await act(async () => model.back());
  expect(result.current.dialogProps.isOpen).toBe(true);
  act(() => result.current.dialogProps.onOpenChange?.(false));
  expect(model.push).toHaveBeenCalledOnce();
});
