import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {readerFixture} from './test-fixture';
import {useReaderProgress} from './progress';

afterEach(() => vi.useRealTimers());
it('records settled navigation once, flushes on hiding, and does not overwrite progress merely by opening the cover', async () => {
  vi.useFakeTimers();
  const commit = vi.fn().mockResolvedValue(undefined);
  const {result} = renderHook(() => useReaderProgress(readerFixture().document, commit));
  await act(async () => vi.advanceTimersByTimeAsync(1000));
  expect(commit).not.toHaveBeenCalled();
  act(() => {result.current.record('p1'); result.current.record('p2', 's2');});
  await act(async () => vi.advanceTimersByTimeAsync(499));
  expect(commit).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(commit).toHaveBeenCalledOnce();
  expect(commit.mock.calls[0][0]).toMatchObject({kind: 'setProgress', documentRevision: 1, payload: {pageId: 'p2', sentenceId: 's2', componentId: 'c2'}});
  act(() => result.current.record('p3'));
  await act(async () => result.current.flush());
  expect(commit).toHaveBeenCalledTimes(2);
  expect(commit.mock.calls[1][0].payload).toEqual({pageId: 'p3', sentenceId: 's3', componentId: 'c3'});
});
it('uses an explicit empty progress mutation for Start over and does not invent a cross-page anchor', async () => {
  vi.useFakeTimers(); const commit = vi.fn().mockResolvedValue(undefined);
  const {result} = renderHook(() => useReaderProgress(readerFixture().document, commit));
  act(() => result.current.record('p1', 's0'));
  await act(async () => vi.advanceTimersByTimeAsync(500));
  expect(commit.mock.calls[0][0].payload).toEqual({pageId: 'p1', sentenceId: 's1', componentId: 'c1'});
  await act(async () => result.current.reset());
  expect(commit.mock.calls[1][0].payload).toEqual({});
});
