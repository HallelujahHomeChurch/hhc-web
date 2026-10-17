import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, expect, it, vi} from 'vitest'
import {useState} from 'react'
import {OrganizationsGate} from './OrganizationsGate'

const state = vi.hoisted(() => ({status: 'loading', owner: 'a', retry: vi.fn(), replace: vi.fn(), authorization: {getAccessToken: async () => null, refreshAfterUnauthorized: async () => null}}))
vi.mock('@/components/layout/AccountControl', () => ({useOrganizationsAccess: () => ({status: state.status, retry: state.retry}), useAccountIdentity: () => state.owner, useAccountAuthorization: () => state.authorization}))
vi.mock('next/navigation', () => ({useRouter: () => state}))
beforeEach(() => {state.status = 'loading'; state.owner = 'a'; vi.clearAllMocks()})

it.each(['loading', 'denied', 'unavailable'])('does not mount private content when access is %s', status => {
  state.status = status
  const mounted = vi.fn()
  function Private() {mounted(); return <p>Private member data</p>}
  render(<OrganizationsGate locale="en"><Private /></OrganizationsGate>)
  expect(mounted).not.toHaveBeenCalled()
  expect(screen.queryByText('Private member data')).not.toBeInTheDocument()
  if (status === 'denied') expect(state.replace).toHaveBeenCalledWith('/en')
})
it('keeps failed qualification retryable', async () => {
  state.status = 'unavailable'
  render(<OrganizationsGate locale="en"><p>Private</p></OrganizationsGate>)
  await userEvent.click(screen.getByRole('button', {name: 'Retry'}))
  expect(state.retry).toHaveBeenCalledOnce()
})
it('discards mounted private state when the account changes', () => {
  state.status = 'allowed'
  function Private() {const [owner] = useState(state.owner); return <p>Owner {owner}</p>}
  const view = render(<OrganizationsGate locale="en"><Private /></OrganizationsGate>)
  expect(screen.getByText('Owner a')).toBeInTheDocument()
  state.owner = 'b'
  view.rerender(<OrganizationsGate locale="en"><Private /></OrganizationsGate>)
  expect(screen.getByText('Owner b')).toBeInTheDocument()
  expect(screen.queryByText('Owner a')).not.toBeInTheDocument()
  state.status = 'denied'
  view.rerender(<OrganizationsGate locale="en"><Private /></OrganizationsGate>)
  expect(screen.queryByText('Owner b')).not.toBeInTheDocument()
})
