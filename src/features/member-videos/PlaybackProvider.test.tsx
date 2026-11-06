import {act, fireEvent, render, screen} from '@testing-library/react';
import {useEffect} from 'react';
import {expect, it, vi} from 'vitest';
import {PlaybackProvider, usePersistentPlayback} from './PlaybackProvider';

vi.mock('@/components/layout/AccountControl', () => ({useAccountIdentity: () => 'member', useVideoAccess: () => 'available'}));
vi.mock('@/components/layout/MediaDocument', () => ({useMediaDocument: () => ({privateMediaReady: true})}));
vi.mock('./ContinueWatching', () => ({ContinueWatching: () => <aside>Historical resume</aside>}));
const labels = {resume: 'Resume', live: 'Live', close: 'Close player', expand: 'Expand', minimize: 'Minimize', move: 'Move', resize: 'Resize'};
const player = <video aria-label="Current recording"/>;
function Playing() {
  const start = usePersistentPlayback()?.start;
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
  expect(screen.queryByText('Historical resume')).toBeNull();
});
