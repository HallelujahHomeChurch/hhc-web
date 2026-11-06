import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {MediaDocumentProvider, useMediaDocument} from './MediaDocument';

const session = vi.hoisted(() => ({auth: 'anonymous', access: 'loading'}));
vi.mock('./AccountControl', () => ({
  useAccountAuth: () => ({status: session.auth}),
  useVideoAccess: () => session.access,
}));

function Gates() {
  const {analyticsAllowed, privateMediaReady, markAnalyticsStarted} = useMediaDocument();
  return <>
    <output>{String(analyticsAllowed)} {String(privateMediaReady)}</output>
    <button type="button" onClick={markAnalyticsStarted}>Start analytics</button>
  </>;
}

function Fixture() {
  return <MediaDocumentProvider><Gates/></MediaDocumentProvider>;
}

it('withholds private playback in a document that already started analytics', () => {
  const view = render(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('true false');
  fireEvent.click(screen.getByRole('button', {name: 'Start analytics'}));
  session.auth = 'authenticated';
  session.access = 'available';
  view.rerender(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false false');
  view.unmount();
  render(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false false');
});
