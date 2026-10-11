import {act, fireEvent, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {useReaderSearchNavigation} from './useReaderSearchNavigation';

afterEach(() => {document.body.replaceChildren(); vi.restoreAllMocks();});
function setup() {
  const button = document.createElement('button');
  button.dataset.readerSearchTarget = 's1';
  const root = document.createElement('div'); root.append(button); document.body.append(root);
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100));
  const onJump = vi.fn(), allowAction = vi.fn(() => true);
  const options = {root: {current: root}, open: true, suspended: false, binding: 'account:doc:1', allowAction, onJump};
  const hook = renderHook(props => useReaderSearchNavigation(props), {initialProps: options});
  const pointer = (type: string, x = 10, id = 1) => {
    const event = new MouseEvent(type, {bubbles: true, clientX: x, clientY: 10, button: 0});
    Object.defineProperties(event, {pointerId: {value: id}, isPrimary: {value: id === 1}});
    fireEvent(button, event);
  };
  return {button, root, options, hook, pointer, onJump, allowAction};
}
it('queues only a completed permitted pointer while validation interrupts click', () => {
  const {options, hook, pointer, onJump} = setup();
  pointer('pointerdown'); hook.rerender({...options, suspended: true});
  expect(onJump).not.toHaveBeenCalled(); pointer('pointerup');
  expect(onJump).not.toHaveBeenCalled(); hook.rerender(options);
  expect(onJump).toHaveBeenCalledExactlyOnceWith('s1');
  act(() => hook.result.current('s1')); expect(onJump).toHaveBeenCalledTimes(1);
});
it.each(['pointercancel', 'scroll', 'resize', 'blur', 'moved', 'multitouch'])('cancelled or scrolled pointer never queues search navigation: %s', reason => {
  const {options, hook, pointer, onJump, root} = setup();
  pointer('pointerdown'); hook.rerender({...options, suspended: true});
  if (reason === 'multitouch') pointer('pointerdown', 10, 2);
  else if (reason === 'pointercancel') pointer('pointercancel');
  else if (reason !== 'moved') fireEvent(reason === 'scroll' ? root : window, new Event(reason));
  pointer('pointerup', reason === 'moved' ? 40 : 10); hook.rerender(options);
  expect(onJump).not.toHaveBeenCalled();
});
it('does not start new activation during validation', () => {
  const {options, hook, pointer, onJump} = setup();
  hook.rerender({...options, suspended: true}); pointer('pointerdown'); pointer('pointerup'); hook.rerender(options);
  expect(onJump).not.toHaveBeenCalled();
});
it.each(['binding', 'closed', 'revoked'])('pending search jump is cancelled on %s change', reason => {
  const {options, hook, pointer, onJump, allowAction} = setup();
  pointer('pointerdown'); hook.rerender({...options, suspended: true}); pointer('pointerup');
  if (reason === 'revoked') allowAction.mockReturnValue(false);
  hook.rerender({...options, binding: reason === 'binding' ? 'account:doc:2' : options.binding, open: reason !== 'closed'});
  expect(onJump).not.toHaveBeenCalled();
});
it('keyboard activation navigates once without pointer inference', () => {
  const {hook, onJump} = setup();
  act(() => hook.result.current('s1'));
  expect(onJump).toHaveBeenCalledExactlyOnceWith('s1');
});
