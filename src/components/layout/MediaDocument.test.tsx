import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {MediaDocumentProvider, useMediaDocument} from './MediaDocument';

const session = vi.hoisted(() => ({auth: 'loading', access: 'loading'}));
vi.mock('./AccountControl', () => ({
  useAccountAuth: () => ({status: session.auth}),
  useVideoAccess: () => session.access,
}));
afterEach(() => {
  cleanup();
  session.auth = 'loading';
  session.access = 'loading';
});

function Gates() {
  const {analyticsAllowed, privateMediaReady} = useMediaDocument();
  return <output>{String(analyticsAllowed)} {String(privateMediaReady)}</output>;
}

function Fixture() {
  return <MediaDocumentProvider><Gates/></MediaDocumentProvider>;
}

it('defers analytics while authority is unresolved and keeps an eligible document private through sign-out and locale remount', () => {
  const view = render(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false false');
  session.auth = 'anonymous';
  view.rerender(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('true false');
  session.auth = 'authenticated';
  session.access = 'loading';
  view.rerender(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false false');
  session.access = 'available';
  view.rerender(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false true');
  session.auth = 'anonymous';
  session.access = 'loading';
  view.rerender(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false false');
  view.unmount();
  render(<Fixture/>);
  expect(screen.getByRole('status').textContent).toBe('false false');
});
