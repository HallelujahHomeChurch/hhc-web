import { useState } from 'react'
import { ExpandableSearchField } from '@hallelujahhomechurch/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const routing = vi.hoisted(() => ({ params: { unitId: 'unit', memberId: 'member' }, push: vi.fn() }))
vi.mock('next/navigation', () => ({ useParams: () => routing.params, useRouter: () => routing, useSearchParams:()=>new URLSearchParams(), usePathname:()=>'/en/organizations/church' }))
import { beforeEach, expect, it, vi } from 'vitest'

import { useOrganizationApi } from './context'
import { messages } from './messages'
import { OrganizationUnitPage } from './OrganizationUnitPage'

vi.mock('./context', () => ({ useOrganizationApi: vi.fn(), useOrganizationMessages: () => ({ locale: 'en', messages: messages.en }) }))


const operationsApi = { admitManagedMember: vi.fn(), updateManagedUnit: vi.fn(), getManagedUnit: vi.fn(), listManagedMembers: vi.fn(), searchManagedCandidates: vi.fn(), listManagedResponsibilities: vi.fn(), getMyAccess: vi.fn(), revokeManagedResponsibility: vi.fn(), applyManagedEntitlements: vi.fn() }
beforeEach(() => {
  routing.params = {unitId: 'church', memberId: ''}
  vi.resetAllMocks()
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active', version: 1 }, breadcrumb: [], children: [], actions: { editUnit: false, createChild: false, archive: false, restore: false, manageMembers: true, manageResponsibilities: false, manageEntitlements: true, sendNotifications: false } })
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'member', displayName: 'Alice', email: 'alice@example.test' }], page: 1 })
  operationsApi.searchManagedCandidates.mockResolvedValue([])
  operationsApi.getMyAccess.mockResolvedValue({ memberId: 'self', responsibilities: [] })
  vi.mocked(useOrganizationApi).mockReturnValue({ operationsApi } as never)
})

function mount(path = '/en/organizations/church') { routing.params = {unitId: path.split('?')[0].split('/')[3], memberId: ''}; return render(<OrganizationUnitPage />) }

it('has one primary heading for the current unit', async () => {
 mount()
 await screen.findByText('Alice')
 expect(screen.getAllByRole('heading', {level:1, name:'Church'})).toHaveLength(1)
})

it('shows the current manager read-only and still allows revoking another manager', async () => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'family', name: 'Family', status: 'active' }, breadcrumb: [], children: [], actions: { editUnit: true, manageResponsibilities: true } })
  operationsApi.listManagedResponsibilities.mockResolvedValue([
    { id: 'r-self', memberId: 'self', displayName: 'Current manager', email: 'self@example.test', version: 1 },
    { id: 'r-other', memberId: 'other', displayName: 'Other manager', email: 'other@example.test', version: 2 },
  ])
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Unit settings' }))
  const self = await screen.findByText('Current manager (You)')
  expect(within(self.closest('li')!).queryByRole('button')).not.toBeInTheDocument()
  const other = screen.getByText('Other manager')
  await userEvent.click(within(other.closest('li')!).getByRole('button', { name: 'Revoke' }))
  expect(operationsApi.revokeManagedResponsibility).toHaveBeenCalledWith('church', 'r-other', 2, expect.any(String))
})

it.each([null, {}])('does not expose revoke actions when current member identity is unavailable: %s', async access => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'family', name: 'Family', status: 'active' }, breadcrumb: [], children: [], actions: { editUnit: true, manageResponsibilities: true } })
  operationsApi.listManagedResponsibilities.mockResolvedValue([{ id: 'r-self', memberId: 'self', displayName: 'Current manager', email: 'self@example.test', version: 1 }])
  if (access === null) operationsApi.getMyAccess.mockRejectedValue(new Error('Unavailable'))
  else operationsApi.getMyAccess.mockResolvedValue(access)
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Unit settings' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(messages.en.organizations.loadFailed)
  expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
})

it('requires a complete email and an explicit lookup before showing add-member candidates', async () => {
  expect(messages['zh-Hant'].organizations.fullEmailHint).toBe('請輸入完整 email')
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Add member' }))
  const input = await screen.findByRole('textbox', { name: 'Search email' })
  expect(screen.getByText('Enter the full email address.')).toBeInTheDocument()
  await userEvent.type(input, 'member@')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(operationsApi.searchManagedCandidates).not.toHaveBeenCalled()
  await userEvent.type(input, 'example.com')
  expect(operationsApi.searchManagedCandidates).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(operationsApi.searchManagedCandidates).toHaveBeenCalledWith('church', 'member@example.com', expect.any(AbortSignal)))
  expect(screen.queryByRole('button', { name: /browse/i })).not.toBeInTheDocument()
})

it('offers individual member access without selection or batch entitlement controls', async () => {
  mount()
  const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
  expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Grant' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  expect(within(table).getByRole('link', { name: 'Content access Alice' })).toHaveAttribute('href', '/en/organizations/church/members/member')
  expect(operationsApi.applyManagedEntitlements).not.toHaveBeenCalled()
})

it.each(['church', 'family', 'small_group', 'fellowship'])('only offers child creation for supported parent kind %s', async (kind) => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind, name: 'Unit', status: 'active' }, breadcrumb: [], children: [], actions: { createChild: true } })
  mount()
  await screen.findByRole('table')
  expect(Boolean(screen.queryByRole('button', { name: 'Create child unit' }))).toBe(['church', 'family'].includes(kind))
})

it('keeps names icon-free and provides a last-column action for units and members', async () => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active' }, breadcrumb: [], children: [{ id: 'family', kind: 'family', name: 'Family', status: 'active' }], actions: {manageMembers: true} })
  mount()
  const unit = await screen.findByRole('link', { name: 'View Family' })
  const member = screen.getByRole('link', { name: 'Content access Alice' })
  expect(unit).toHaveAttribute('href', '/en/organizations/family')
  expect(member).toHaveAttribute('href', '/en/organizations/church/members/member')
  for (const link of [unit, member]) expect(link.closest('td')).toBe(link.closest('tr')?.lastElementChild)
  expect(screen.getByRole('link', { name: 'Family' }).querySelector('svg')).toBeNull()
  expect(screen.getByRole('link', { name: 'Alice' }).querySelector('svg')).toBeNull()
  expect(screen.queryByRole('checkbox', { name: 'Archived units' })).not.toBeInTheDocument()
})

it('does not offer child creation when server actions deny it', async () => {
  mount()
  await screen.findByRole('table')
  expect(screen.queryByRole('button', { name: 'Create child unit' })).not.toBeInTheDocument()
})

it('lets an ancestor manager restrict a child to Traditional bulletin and video', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.zh-Hans.access','bulletin.general.en.access','video.meeting-recordings.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 const policy=screen.getByRole('group',{name:'Grantable access'})
 await userEvent.click(within(policy).getByRole('switch',{name:'簡體週報下載'}))
 await userEvent.click(within(policy).getByRole('switch',{name:'英文週報下載'}))
 await userEvent.click(within(policy).getByRole('switch',{name:'Member videos'}))
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,expect.objectContaining({grantableEntitlementCodes:['bulletin.general.zh-Hant.access','video.meeting-recordings.access']}),expect.any(String))
})

it('shows own unit policy read-only and omits it from an ordinary name update', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'family',name:'Family',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[],children:[],actions:{editUnit:true,manageEntitlementPolicy:false}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 expect(screen.queryByRole('group',{name:'Grantable access'})).not.toBeInTheDocument()
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Family',email:''},expect.any(String))
})

it('preserves a child policy on name-only saves after ancestor restriction', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','bulletin.general.en.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 await userEvent.type(within(screen.getByRole('dialog')).getByRole('textbox',{name:'Name'}),' renamed')
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group renamed',email:''},expect.any(String))
})

it('can override inherited access beyond the parent and reset to inheritance', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',parentId:'parent',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:true,grantableEntitlementCodes:['bulletin.general.zh-Hant.access'],effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 const policy=screen.getByRole('group',{name:'Grantable access'})
 expect(within(policy).getByRole('switch',{name:'Member videos'})).toBeDisabled()
 await userEvent.click(within(policy).getByRole('switch',{name:'Inherit from parent'}))
 await userEvent.click(within(policy).getByRole('switch',{name:'Member videos'}))
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group',email:'',inheritsGrantableEntitlements:false,grantableEntitlementCodes:['bulletin.general.zh-Hant.access','video.meeting-recordings.access']},expect.any(String))
})

it('sends only the inheritance flag when restoring parent defaults', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',parentId:'parent',kind:'small_group',name:'Group',status:'active',version:1,inheritsGrantableEntitlements:false,grantableEntitlementCodes:[],effectiveGrantableEntitlementCodes:[]},breadcrumb:[{id:'parent',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']}],children:[],actions:{editUnit:true,manageEntitlementPolicy:true}})
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 await userEvent.click(screen.getByRole('switch',{name:'Inherit from parent'}))
 expect(screen.getByRole('switch',{name:'繁體週報下載'})).toBeChecked()
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Save'}))
 expect(operationsApi.updateManagedUnit).toHaveBeenCalledWith('church',1,{name:'Group',email:'',inheritsGrantableEntitlements:true},expect.any(String))
})

it('shows effective inherited access when own-unit ancestors are hidden', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',parentId:'hidden',kind:'family',name:'Family',status:'active',version:1,inheritsGrantableEntitlements:true,grantableEntitlementCodes:[],effectiveGrantableEntitlementCodes:['video.meeting-recordings.access']},breadcrumb:[],children:[],actions:{editUnit:true,manageEntitlementPolicy:false}})
 mount(); await userEvent.click(await screen.findByRole('button',{name:'Unit settings'}))
 expect(screen.queryByRole('group',{name:'Grantable access'})).not.toBeInTheDocument()
})

it('submits default-off admission switches atomically and resets them on reopening', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'church',name:'Church',status:'active',effectiveGrantableEntitlementCodes:['bulletin.general.zh-Hant.access']},breadcrumb:[],children:[],actions:{manageMembers:true,manageEntitlements:true}})
 operationsApi.searchManagedCandidates.mockResolvedValue([{account:{accountUserId:'new',displayName:'Bob',email:'bob@example.test'},state:'available'}])
 mount()
 await userEvent.click(await screen.findByRole('button',{name:'Add member'}))
 const toggle=await screen.findByRole('switch',{name:'繁體週報下載'})
 expect(toggle).not.toBeChecked()
 await userEvent.click(toggle)
 await userEvent.type(screen.getByRole('textbox',{name:'Search email'}),'bob@example.test')
 await userEvent.click(screen.getByRole('button',{name:'Search'}))
 const row = (await screen.findByText('Bob')).closest('li')!
 await userEvent.click(within(row).getByRole('button',{name:'Add member'}))
 expect(operationsApi.admitManagedMember).toHaveBeenCalledWith('church','new',expect.any(String),['bulletin.general.zh-Hant.access'])
 await userEvent.click(await screen.findByRole('button',{name:'Add member'}))
 expect(await screen.findByRole('switch',{name:'繁體週報下載'})).not.toBeChecked()
})

it('shows responsible people with existing read access without requesting delegation access', async () => {
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'leader', displayName: 'Alice', email: 'alice@example.test', isResponsible: true }], page: 1 })
  mount()
  const row = (await screen.findByText('alice@example.test')).closest('tr')!
  expect(within(row).getByText('Responsible person')).toBeInTheDocument()
  expect(within(row).getByRole('link', { name: 'Content access Alice' })).toBeInTheDocument()
  expect(operationsApi.listManagedResponsibilities).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Unit settings' })).not.toBeInTheDocument()
})

it.each(['unit', 'member', 'responsibility', 'invalid'])('ignores the retired type filter %s and shows both units and members', async type => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind: 'church', name: 'Church', status: 'active' }, breadcrumb: [], children: [{ id: 'family', kind: 'family', name: 'Family', status: 'active' }], actions: {manageMembers: true} })
  operationsApi.listManagedMembers.mockResolvedValue({ items: [{ memberId: 'leader', displayName: 'Alice', email: 'alice@example.test', isResponsible: true }], page: 1 })
  mount('/en/organizations/church?type=' + type)
  const table = await screen.findByRole('table')
  expect(within(table).getByRole('link', { name: 'Family' })).toBeInTheDocument()
  expect(within(table).getByText('alice@example.test')).toBeInTheDocument()
  expect(within(table).getByText('Responsible person')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Type/ })).not.toBeInTheDocument()
  expect(operationsApi.listManagedMembers).toHaveBeenLastCalledWith('church', '', 1, expect.any(AbortSignal), false)
})

it('resets member pagination when the header search changes', async () => {
  operationsApi.listManagedMembers.mockImplementation((_unit, query, page) => Promise.resolve({ items: [{ memberId: 'member', displayName: 'Alice', email: `alice-${page}@example.test` }], page, nextPage: !query ? 2 : undefined }))
  function FolderWithHeader() {
    const [value, setValue] = useState('')
    return <><ExpandableSearchField label="Search members" submitLabel="Search" clearLabel="Clear" value={value} onChange={setValue} /><OrganizationUnitPage searchQuery={value} /></>
  }
  render(<FolderWithHeader />)
  await screen.findByText('alice-1@example.test')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await screen.findByText('alice-2@example.test')
  await userEvent.click(screen.getByRole('button', { name: 'Search members' }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search members' }), 'Alice')
  await waitFor(() => expect(operationsApi.listManagedMembers).toHaveBeenLastCalledWith('church', 'Alice', 1, expect.any(AbortSignal), false))
})

it.each(['small_group', 'fellowship'])('omits the unit-kind column for terminal unit %s', async kind => {
  operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: 'church', kind, name: 'Unit', status: 'active' }, breadcrumb: [], children: [], actions: {manageMembers: true} })
  mount()
  const table = await screen.findByRole('table')
  expect(within(table).queryByRole('columnheader', { name: messages.en.organizations.unitKind })).not.toBeInTheDocument()
  expect(within(table).getAllByRole('columnheader')).toHaveLength(4)
  expect(within(table).getAllByRole('cell')).toHaveLength(4)
})

it('uses the controlled header query without rendering a second roster search or archive controls', async () => {
  render(<OrganizationUnitPage searchQuery="Alice" />)
  await screen.findByRole('table')
  await waitFor(() => expect(operationsApi.listManagedMembers).toHaveBeenCalledWith('church', 'Alice', 1, expect.any(AbortSignal), false))
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'Archived units' })).not.toBeInTheDocument()
})

it('groups editing with business actions separately from the breadcrumb', async () => {
 operationsApi.getManagedUnit.mockResolvedValue({ unit: { id: "church", kind: "church", name: "Church", status: "active", version: 1 }, breadcrumb: [], children: [], actions: { editUnit: true } });
 mount();
 const edit = await screen.findByRole('button', { name: messages.en.organizations.settings });
 expect(edit.closest('.organization-location')).toBeNull();
 expect(edit.closest('.organization-actions')).not.toBeNull();
});

it.each(['small_group','fellowship'])('renders ordinary %s members as a read-only roster with no management links or action column', async kind => {
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind,name:'My group',status:'active'},breadcrumb:[],children:[],actions:{}})
 mount()
 const table = await screen.findByRole('table')
 await within(table).findByText('Alice')
 expect(within(table).queryByRole('link')).not.toBeInTheDocument()
 expect(within(table).getAllByRole('columnheader')).toHaveLength(3)
 for (const name of ['Unit settings','Add member','Create child unit','Notifications']) expect(screen.queryByRole('button',{name})).not.toBeInTheDocument()
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Next'})).toBeInTheDocument()
})

 it('unmounts an open management dialog when a refresh returns read-only actions', async () => {
 const view = mount()
 await userEvent.click(await screen.findByRole('button',{name:'Add member'}))
 const input = screen.getByRole('textbox',{name:'Search email'})
 await userEvent.type(input,'member@example.test')
 await userEvent.click(screen.getByRole('button',{name:'Search'}))
 await waitFor(() => expect(operationsApi.searchManagedCandidates).toHaveBeenCalledOnce())
 operationsApi.getManagedUnit.mockResolvedValue({unit:{id:'church',kind:'small_group',name:'My group',status:'active'},breadcrumb:[],children:[],actions:{}})
 view.rerender(<OrganizationUnitPage searchQuery="Alice" />)
 await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
 expect(screen.queryByRole('button',{name:'Add member'})).not.toBeInTheDocument()
 expect(within(screen.getByRole('table')).queryAllByRole('link')).toHaveLength(0)
 expect(operationsApi.searchManagedCandidates).toHaveBeenCalledOnce()
 })

it.each([
  ['manageMembers', 'Add member'],
  ['editUnit', 'Unit settings'],
  ['createChild', 'Create child unit'],
  ['sendNotifications', messages.en.site.notifications],
] as const)('does not reopen a dialog after %s is revoked and restored', async (permission, label) => {
  const actions = { editUnit: true, createChild: true, manageMembers: true, sendNotifications: true }
  const folder = { unit: { id: 'church', kind: 'church', name: 'Church', status: 'active', version: 1 }, breadcrumb: [], children: [], actions }
  operationsApi.getManagedUnit.mockResolvedValue(folder)
  vi.mocked(useOrganizationApi).mockReturnValue({ operationsApi, unitNotificationsApi: { list: vi.fn().mockResolvedValue({ items: [], page: 1, perPage: 10, total: 0 }) } } as never)
  const view = mount()
  await userEvent.click(await screen.findByRole('button', { name: label }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  // A successful refresh with unchanged permissions must preserve the open dialog.
  view.rerender(<OrganizationUnitPage searchQuery="Alice" />)
  await waitFor(() => expect(operationsApi.listManagedMembers).toHaveBeenLastCalledWith('church', 'Alice', 1, expect.any(AbortSignal), false))
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  operationsApi.getManagedUnit.mockResolvedValue({ ...folder, actions: { ...actions, [permission]: false } })
  view.rerender(<OrganizationUnitPage searchQuery="Bob" />)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()

  operationsApi.getManagedUnit.mockResolvedValue(folder)
  view.rerender(<OrganizationUnitPage searchQuery="" />)
  await waitFor(() => expect(operationsApi.listManagedMembers).toHaveBeenLastCalledWith('church', '', 1, expect.any(AbortSignal), false))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: label }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('keeps the directory shell and never announces no results while a new search is pending',async()=>{
 const view=mount();await screen.findByText('Alice');
 let settle!:(value:unknown)=>void;
 operationsApi.listManagedMembers.mockImplementationOnce(()=>new Promise(resolve=>{settle=resolve}));
 view.rerender(<OrganizationUnitPage searchQuery="Nobody"/>);
 await waitFor(()=>expect(operationsApi.listManagedMembers).toHaveBeenCalledTimes(2));
 expect(screen.queryByText(messages.en.organizations.noResults)).not.toBeInTheDocument();
 expect(screen.queryByText('Alice')).not.toBeInTheDocument();
 expect(view.container.querySelectorAll('tbody tr[aria-hidden="true"]')).toHaveLength(5);
 expect(screen.getByRole('table')).toHaveAttribute('aria-busy','true');
 const {act}=await import('@testing-library/react');await act(async()=>settle({items:[],page:1}));
 expect(await screen.findByText(messages.en.organizations.noResults)).toBeInTheDocument();
});
