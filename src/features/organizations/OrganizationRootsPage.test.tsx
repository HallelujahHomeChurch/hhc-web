import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const routing = vi.hoisted(() => ({ params: { unitId: 'unit', memberId: 'member' }, push: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => routing.params, useRouter: () => routing }))
import { beforeEach, expect, it, vi } from 'vitest'

import { useOrganizationApi } from './context'
import { messages } from './messages'
import { OrganizationRootsPage } from './OrganizationRootsPage'

vi.mock('./context', () => ({ useOrganizationApi: vi.fn(), useOrganizationMessages: () => ({ locale: 'en', messages: messages.en }) }))


beforeEach(() => vi.resetAllMocks())

it('renders every server-selected root as one clear viewing link without email or type columns', async () => {
  const roots = [{ id: 'unit', parentId: 'unmanaged-church', name: 'Family', kind: 'family', status: 'active', version: 1 }, { id: 'other', name: 'Other', kind: 'fellowship', email: 'other@example.test', status: 'active', version: 1 }]
  vi.mocked(useOrganizationApi).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue(roots) } } as never)
  render(<OrganizationRootsPage />)
  const list = await screen.findByRole('list', { name: messages.en.organizations.roots })
  expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  expect(within(list).getAllByRole('link')).toHaveLength(2)
  for (const root of roots) {
    const link = within(list).getByRole('link', { name: 'View ' + root.name })
    expect(link).toHaveAttribute('href', '/en/organizations/' + root.id)
    expect(link).toHaveTextContent(root.name)
  }
  expect(screen.queryByText('other@example.test')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', {name: 'My small groups'})).toBeInTheDocument()
  expect(screen.queryByText(messages.en.organizations.chooseUnit)).not.toBeInTheDocument()
})

it('renders authorization state for a direct denied URL', async () => {
  vi.mocked(useOrganizationApi).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 403 })) } } as never)
  render(<OrganizationRootsPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('shows the empty state without a table for an empty successful response', async () => {
  vi.mocked(useOrganizationApi).mockReturnValue({ operationsApi: { listManagedRoots: vi.fn().mockResolvedValue([]) } } as never)
  render(<OrganizationRootsPage />)
  expect(await screen.findByText(messages.en.organizations.empty)).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('retries a failed lookup instead of displaying an empty successful table', async () => {
  const listManagedRoots = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  vi.mocked(useOrganizationApi).mockReturnValue({ operationsApi: { listManagedRoots } } as never)
  render(<OrganizationRootsPage />)
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.loadFailed)
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText(messages.en.organizations.empty)
  expect(listManagedRoots).toHaveBeenCalledTimes(2)
})

it('keeps management links localized for units selected by the server', async () => {
  vi.mocked(useOrganizationApi).mockReturnValue({operationsApi: {listManagedRoots: vi.fn().mockResolvedValue([{id: 'unit', name: 'Family', kind: 'family', status: 'active'}])}} as never)
  render(<OrganizationRootsPage />)
  expect(await screen.findByRole('link', {name: 'View Family'})).toHaveAttribute('href', '/en/organizations/unit')
})
