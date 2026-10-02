import { render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MemberLegalSupplement } from './MemberLegalSupplement';
const mocks = vi.hoisted(() => ({
  subject: null as string | null,
  get: vi.fn(),
  authorization: {
    getAccessToken: async () => 'token',
    refreshAfterUnauthorized: async () => null,
  },
}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => mocks.subject,
  useBulletinAuthorization: () => mocks.authorization,
}));
vi.mock('@hallelujahhomechurch/hhc-web-client', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@hallelujahhomechurch/hhc-web-client')
  >()),
  createHhcWebClient: () => ({ getMemberLegalSnapshot: mocks.get }),
}));
it('makes no request for an anonymous visitor', () => {
  mocks.subject = null;
  mocks.get.mockClear();
  const view = render(
    <MemberLegalSupplement locale="en" documentKey="privacy" />,
  );
  expect(view.container).toBeEmptyDOMElement();
  expect(mocks.get).not.toHaveBeenCalled();
});
it('reveals no private wording when qualification is rejected', async () => {
  const { HhcWebApiError } = await import(
    '@hallelujahhomechurch/hhc-web-client'
  );
  mocks.subject = 'user';
  mocks.get.mockRejectedValue(new HhcWebApiError(403, 'forbidden', 'private'));
  const view = render(
    <MemberLegalSupplement locale="en" documentKey="privacy" />,
  );
  await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  expect(view.container).toBeEmptyDOMElement();
  expect(screen.queryByText('private')).not.toBeInTheDocument();
});
