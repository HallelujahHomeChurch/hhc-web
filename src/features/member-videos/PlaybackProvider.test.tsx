import {act, fireEvent, render, screen} from '@testing-library/react';
import {useEffect} from 'react';
import {beforeEach, expect, it, vi} from 'vitest';
import {PlaybackProvider, usePersistentPlayback} from './PlaybackProvider';
import {clearResumeDismissals, dismissResume, isResumeDismissed} from './resume-dismissal';

const account = vi.hoisted(() => ({status: 'authenticated', access: 'available'}));
vi.mock('next/navigation', () => ({useRouter: () => ({push: vi.fn()})}));
vi.mock('@/components/layout/AccountControl', () => ({useAccountIdentity: () => 'member', useAccountAuth: () => ({status: account.status}), useVideoAccess: () => account.access}));
vi.mock('@/components/layout/MediaDocument', () => ({useMediaDocument: () => ({privateMediaReady: true})}));
vi.mock('./ContinueWatching', () => ({ContinueWatching: () => <aside>Historical resume</aside>}));
const labels = {removeResume: 'Remove from continue watching', resume: 'Resume', live: 'Live', close: 'Close player', expand: 'Expand', minimize: 'Minimize', move: 'Move', resize: 'Resize'};
const flush = vi.fn();
const identity = {recordingId: 'recording', mediaVersion: 'vod:package', sessionId: 'pending-session'};
beforeEach(() => {clearResumeDismissals(); flush.mockReset(); account.status='authenticated'; account.access='available';});
const player = <video aria-label="Current recording"/>;
function Playing() {
  const playback = usePersistentPlayback();
  const start = playback?.start, register = playback?.registerPlayback;
  useEffect(() => register?.(flush, () => 5, () => identity), [register]);
  useEffect(() => { start?.({key: 'vod:recording:package', href: '/video/aB_012-xyzQ', title: 'Recording', player}); }, [start]);
  return null;
}

it('does not mount historical resume on the homepage or after closing the current mini player', async () => {
  const view = render(<PlaybackProvider locale="en" labels={labels}><main>Home</main></PlaybackProvider>);
  await act(async () => {});
  expect(screen.queryByText('Historical resume')).toBeNull();
  view.rerender(<PlaybackProvider locale="en" labels={labels}><Playing/></PlaybackProvider>);
  expect(screen.getByLabelText('Current recording')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Close player'}));
  await act(async () => {});
  expect(screen.queryByLabelText('Current recording')).toBeNull();
  expect(flush).toHaveBeenCalledTimes(1);
  expect(isResumeDismissed('member', {...identity, generation: 'late-generation'})).toBe(true);
  expect(isResumeDismissed('member', {...identity, sessionId: 'other-device', generation: 'new-generation'})).toBe(false);
  expect(screen.queryByText('Historical resume')).toBeNull();
});


it('keeps persisted dismissal through auth loading and clears it on logout', () => {
  dismissResume('member', identity);
  account.status='checking'; account.access='loading';
  const view=render(<PlaybackProvider locale="en" labels={labels}><main>Home</main></PlaybackProvider>);
  expect(isResumeDismissed('member', identity)).toBe(true);
  account.status='anonymous'; account.access='denied';
  view.rerender(<PlaybackProvider locale="en" labels={labels}><main>Home</main></PlaybackProvider>);
  expect(isResumeDismissed('member', identity)).toBe(false);
});
