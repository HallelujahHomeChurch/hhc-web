import {act, fireEvent, render, screen, within} from '@testing-library/react'
import {NextIntlClientProvider} from 'next-intl'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {OrganizationsShell} from './OrganizationsShell'
import {OrganizationRootsPage} from './OrganizationRootsPage'
import type {SiteLayout} from '@/features/site-layout/types'
import {messages} from './messages'
import en from '@/i18n/locales/en.json'

const state = vi.hoisted(() => ({
  pathname: '/en/organizations', owner: 'owner', params: new URLSearchParams(),
  router: {replace: vi.fn()}, api: {listOrgUnitDirectory: vi.fn(), listOwnOrgJoinRequests: vi.fn()},
}))
vi.mock('next/navigation', () => ({usePathname: () => state.pathname, useSearchParams: () => state.params, useRouter: () => state.router}))
vi.mock('@/components/layout/AccountControl', () => ({useAccountIdentity: () => state.owner, useOrganizationsAccess: () => ({status: 'allowed'})}))
vi.mock('@/components/layout/SiteHeader', async () => {
  const {OrganizationsSearch} = await import('./OrganizationsSearch')
  return {SiteHeader: () => <OrganizationsSearch onExpandedChange={() => {}}/>}
})
vi.mock('@/components/layout/SiteFooter', () => ({SiteFooter: () => null}))
vi.mock('./OrganizationsGate', () => ({OrganizationsGate: ({children}: {children: React.ReactNode}) => <div key={state.owner}>{children}</div>}))
vi.mock('./context', () => ({useOrganizationApi: () => ({operationsApi: state.api}), useOrganizationMessages: () => ({locale: 'en', messages: messages.en})}))
vi.mock('@/features/notifications/provider', () => ({useNotificationInbox: () => null}))
const layout = {bannerImageUrl: '/assets/banners/hero.jpg'} as SiteLayout
function App() {
  return <NextIntlClientProvider locale="en" messages={en}><OrganizationsShell locale="en" layout={layout}>{state.pathname === '/en/organizations' ? <OrganizationRootsPage/> : <p>Unit page</p>}</OrganizationsShell></NextIntlClientProvider>
}
const fields = () => screen.getAllByRole('searchbox', {name: 'Search small groups or fellowships'})
const advance = async (ms = 250) => {await act(async () => {vi.advanceTimersByTime(ms)})}
const acknowledge = (query: string, view: ReturnType<typeof render>, browser = false) => {
  state.params = new URLSearchParams(query)
  if (browser) fireEvent.popState(window)
  view.rerender(<App/>)
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks()
  state.pathname = '/en/organizations'; state.owner = 'owner'; state.params = new URLSearchParams()
  state.api.listOrgUnitDirectory.mockResolvedValue({items: [], page: 1})
  state.api.listOwnOrgJoinRequests.mockResolvedValue({items: [], page: 1})
})
afterEach(() => vi.useRealTimers())

it('keeps a newer shared draft when an earlier replace commits and then requests the newer query', async () => {
  const view = render(<App/>)
  fireEvent.change(fields()[1], {target: {value: 'ab'}})
  await advance()
  expect(state.router.replace).toHaveBeenLastCalledWith('/en/organizations?q=ab', {scroll: false})
  fireEvent.change(fields()[0], {target: {value: 'abc'}})
  await advance(100)
  acknowledge('q=ab', view)
  for (const input of fields()) expect(input).toHaveValue('abc')
  await advance()
  expect(state.router.replace).toHaveBeenLastCalledWith('/en/organizations?q=abc', {scroll: false})
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'mine', q: 'abc', page: 1}))
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'all', q: 'abc', page: 1}))
})
it.each([0, 1])('preserves active IME draft and composition at shared control %s across an earlier URL acknowledgement', async control => {
  const view = render(<App/>)
  fireEvent.change(fields()[1], {target: {value: 'ab'}})
  await advance()
  fireEvent.compositionStart(fields()[control])
  fireEvent.change(fields()[control], {target: {value: 'ab中'}})
  acknowledge('q=ab', view)
  for (const input of fields()) expect(input).toHaveValue('ab中')
  await advance(500)
  expect(state.router.replace).toHaveBeenCalledTimes(1)
  fireEvent.compositionEnd(fields()[control])
  await advance()
  expect(state.router.replace).toHaveBeenLastCalledWith('/en/organizations?q=ab%E4%B8%AD', {scroll: false})
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({q: 'ab中'}))
})
it('restores genuine browser back and forward query/pages while discarding an unfinished composition', async () => {
  state.params = new URLSearchParams('q=first&minePage=2&allPage=3')
  const view = render(<App/>)
  fireEvent.change(fields()[1], {target: {value: 'ab'}})
  await advance()
  fireEvent.compositionStart(fields()[0]); fireEvent.change(fields()[0], {target: {value: 'private draft'}})
  acknowledge('q=first&minePage=2&allPage=3', view, true)
  for (const input of fields()) expect(input).toHaveValue('first')
  acknowledge('q=second&minePage=4&allPage=5', view, true)
  for (const input of fields()) expect(input).toHaveValue('second')
  await advance(500)
  expect(state.router.replace).toHaveBeenCalledTimes(1)
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'mine', q: 'second', page: 4}))
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'all', q: 'second', page: 5}))
  acknowledge('q=first&minePage=2&allPage=3', view, true)
  for (const input of fields()) expect(input).toHaveValue('first')
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'mine', q: 'first', page: 2}))
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'all', q: 'first', page: 3}))
})
it('resets private draft and composition on actor/path changes without reviving them on return', async () => {
  state.params = new URLSearchParams('q=route')
  const view = render(<App/>)
  fireEvent.compositionStart(fields()[0]); fireEvent.change(fields()[0], {target: {value: 'private actor draft'}})
  state.owner = 'other'; view.rerender(<App/>)
  for (const input of fields()) expect(input).toHaveValue('route')
  fireEvent.change(fields()[1], {target: {value: 'fresh'}}); await advance()
  expect(state.router.replace).toHaveBeenLastCalledWith('/en/organizations?q=fresh', {scroll: false})
  state.pathname = '/en/organizations/unit'; view.rerender(<App/>)
  expect(screen.getByRole('searchbox', {name: 'Search members'})).toHaveValue('')
  state.pathname = '/en/organizations'; view.rerender(<App/>)
  for (const input of fields()) expect(input).toHaveValue('route')
})

it('preserves a newer draft across its own independent page acknowledgement then resets both pages for that draft', async () => {
  state.params = new URLSearchParams('q=ab&minePage=2&allPage=3')
  state.api.listOrgUnitDirectory.mockImplementation(async ({page}) => ({items: [], page, nextPage: page + 1}))
  const view = render(<App/>)
  await advance(0)
  fireEvent.click(within(screen.getByRole('region', {name: 'All small groups'})).getByRole('button', {name: 'Next'}))
  expect(state.router.replace).toHaveBeenLastCalledWith('/en/organizations?q=ab&minePage=2&allPage=4', {scroll: false})
  fireEvent.change(fields()[1], {target: {value: 'abc'}})
  acknowledge('q=ab&minePage=2&allPage=4', view)
  for (const input of fields()) expect(input).toHaveValue('abc')
  await advance()
  expect(state.router.replace).toHaveBeenLastCalledWith('/en/organizations?q=abc', {scroll: false})
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'mine', q: 'abc', page: 1}))
  expect(state.api.listOrgUnitDirectory).toHaveBeenCalledWith(expect.objectContaining({relation: 'all', q: 'abc', page: 1}))
})
