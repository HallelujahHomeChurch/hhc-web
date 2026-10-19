import {act, render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, expect, it, vi} from 'vitest'
import {OrganizationUnitPage} from './OrganizationUnitPage'
import {OrganizationRootsPage} from './OrganizationRootsPage'
import {messages} from './messages'
import type {Locale} from '@/i18n/locales'
import {JoinRequestDialog} from './JoinRequestDialog'
const state=vi.hoisted(()=>({locale:'en' as Locale,params:new URLSearchParams(),replace:vi.fn(),invalidate:vi.fn(),api:{getManagedUnit:vi.fn(),listManagedMembers:vi.fn(),getMyAccess:vi.fn(),listReviewableOrgJoinRequests:vi.fn(),getReviewableOrgJoinRequest:vi.fn(),approveOrgJoinRequest:vi.fn(),rejectOrgJoinRequest:vi.fn(),listOrgUnitDirectory:vi.fn(),listOwnOrgJoinRequests:vi.fn()}}))
const router={replace:state.replace}
vi.mock('next/navigation',()=>({useParams:()=>({unitId:'11111111-1111-4111-8111-111111111111'}),usePathname:()=>'/en/organizations/11111111-1111-4111-8111-111111111111',useSearchParams:()=>state.params,useRouter:()=>router}))
vi.mock('./context',()=>({useOrganizationApi:()=>({operationsApi:state.api}),useOrganizationMessages:()=>({locale:state.locale,messages:messages[state.locale]})}))
vi.mock('./OrganizationsSearch',()=>({useOrganizationsSearch:()=>null}))
vi.mock('@/features/notifications/provider',()=>({useNotificationInbox:()=>({store:{invalidate:state.invalidate}})}))
const unit='11111111-1111-4111-8111-111111111111', id='22222222-2222-4222-8222-222222222222'
const request={id,orgUnitId:unit,orgUnitName:'Target group',applicantDisplayName:'Current applicant',orgUnitKind:'small_group',status:'pending',requestedAt:'2026-10-19T00:00:00Z',version:7,actions:{cancel:false,approve:true,reject:true},ancestorCollapsePreview:[{id:'family',name:'Current family',kind:'family'}]}
const folder={unit:{id:unit,name:'Target group',kind:'small_group',status:'active'},breadcrumb:[],children:[],actions:{reviewJoinRequests:true}}
beforeEach(()=>{vi.resetAllMocks();state.locale='en';state.params=new URLSearchParams();state.api.getManagedUnit.mockResolvedValue(folder);state.api.listManagedMembers.mockResolvedValue({items:[],page:1});state.api.listReviewableOrgJoinRequests.mockResolvedValue({items:[request],page:1,actionablePendingTotal:4});state.api.getReviewableOrgJoinRequest.mockResolvedValue(request);state.api.approveOrgJoinRequest.mockResolvedValue({...request,status:'approved',version:8,actions:{cancel:false,approve:false,reject:false}});state.api.getMyAccess.mockResolvedValue({responsibilities:[{orgUnitId:unit}]});state.api.listOrgUnitDirectory.mockResolvedValue({items:[],page:1});state.api.listOwnOrgJoinRequests.mockResolvedValue({items:[],page:1})})
it('places the server-authorized review queue before the roster and loads current disclosure on selection',async()=>{const view=render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'Review Current applicant'}));const dialog=await screen.findByRole('dialog');expect(dialog).toHaveTextContent('Current family');expect(dialog).toHaveTextContent('Other small groups and fellowships');expect(view.container.querySelector('#join-requests')!.compareDocumentPosition(screen.getByRole('table',{hidden:true}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(state.api.listReviewableOrgJoinRequests).toHaveBeenCalledWith(expect.objectContaining({orgUnitId:unit,status:'pending',page:1,limit:20}));})
it('ordinary members never fetch reviewer data, even with a notification query',async()=>{state.params=new URLSearchParams({joinRequest:id,q:'Alice',page:'3'});state.api.getManagedUnit.mockResolvedValue({...folder,actions:{}});render(<OrganizationUnitPage/>);await screen.findByRole('table');expect(state.api.listReviewableOrgJoinRequests).not.toHaveBeenCalled();expect(state.api.getReviewableOrgJoinRequest).not.toHaveBeenCalled();await waitFor(()=>expect(state.replace).toHaveBeenCalledWith(expect.stringContaining('?q=Alice&page=3'),{scroll:false}));})
it('retries uncertain approval with exactly the original version/action/key and invalidates inbox',async()=>{state.api.approveOrgJoinRequest.mockRejectedValueOnce(new TypeError('offline'));render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'Review Current applicant'}));await userEvent.click(await screen.findByRole('button',{name:'Approve'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Reject'})).toBeDisabled();await userEvent.click(screen.getByRole('button',{name:'Approve'}));await waitFor(()=>expect(state.invalidate).toHaveBeenCalledOnce());expect(state.api.approveOrgJoinRequest.mock.calls[0]).toEqual([id,{version:7,idempotencyKey:expect.any(String)}]);expect(state.api.approveOrgJoinRequest.mock.calls[1]).toEqual(state.api.approveOrgJoinRequest.mock.calls[0]);})
it.each([401,403,404])('clears private selection and queue on decision %s denial',async status=>{state.params=new URLSearchParams({joinRequest:id});state.api.approveOrgJoinRequest.mockRejectedValue(Object.assign(new Error(),{status}));render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'Approve'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(screen.queryByText('Current applicant')).not.toBeInTheDocument();expect(state.replace).toHaveBeenCalled();})
it('requires explicit reload after 412, without replaying or inventing a new intent',async()=>{state.api.approveOrgJoinRequest.mockRejectedValue(Object.assign(new Error(),{status:412}));render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'Review Current applicant'}));await userEvent.click(await screen.findByRole('button',{name:'Approve'}));expect(await screen.findByRole('button',{name:'Reload request'})).toBeInTheDocument();expect(state.api.getReviewableOrgJoinRequest).toHaveBeenCalledOnce();await userEvent.click(screen.getByRole('button',{name:'Reload request'}));await waitFor(()=>expect(state.api.getReviewableOrgJoinRequest).toHaveBeenCalledTimes(2));expect(state.api.approveOrgJoinRequest).toHaveBeenCalledOnce();})
it.each([{orgUnitId:'other'}, {status:'approved',actions:{approve:false,reject:false,cancel:false}}, {actions:{approve:false,reject:false,cancel:true}}])('never approves a mismatched, processed or self request: %j',async change=>{state.params=new URLSearchParams({joinRequest:id});state.api.getReviewableOrgJoinRequest.mockResolvedValue({...request,...change});render(<OrganizationUnitPage/>);await waitFor(()=>expect(state.api.getReviewableOrgJoinRequest).toHaveBeenCalledOnce());await waitFor(()=>expect(screen.queryByRole('button',{name:'Approve'})).not.toBeInTheDocument());expect(state.api.approveOrgJoinRequest).not.toHaveBeenCalled();})
it('waits for current unit data, consumes close, and cannot reopen when authority returns',async()=>{let resolve!:(v:unknown)=>void;state.params=new URLSearchParams({joinRequest:id,q:'Alice'});state.api.getManagedUnit.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const view=render(<OrganizationUnitPage/>);expect(state.api.getReviewableOrgJoinRequest).not.toHaveBeenCalled();await act(async()=>resolve(folder));await userEvent.click(await screen.findAllByRole('button',{name:'Back'}).then(buttons=>buttons.at(-1)!));expect(state.replace).toHaveBeenLastCalledWith(expect.stringContaining('?q=Alice'),{scroll:false});state.api.getManagedUnit.mockResolvedValue({...folder,actions:{}});view.rerender(<OrganizationUnitPage searchQuery="lost"/>);await waitFor(()=>expect(state.api.listManagedMembers).toHaveBeenLastCalledWith(unit,'lost',1,expect.any(AbortSignal),false));state.api.getManagedUnit.mockResolvedValue(folder);view.rerender(<OrganizationUnitPage searchQuery="regained"/>);await waitFor(()=>expect(state.api.listManagedMembers).toHaveBeenLastCalledWith(unit,'regained',1,expect.any(AbortSignal),false));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();})
it('root summary uses current total across units, rather than row count or directory filter',async()=>{render(<OrganizationRootsPage/>);expect(await screen.findByText('4 pending requests')).toBeInTheDocument();expect(state.api.listReviewableOrgJoinRequests).toHaveBeenCalledWith(expect.objectContaining({status:'pending',limit:5,page:1}));await userEvent.click(screen.getByText('4 pending requests'));expect(await screen.findByRole('link',{name:'Review Current applicant'})).toHaveAttribute('href',`/en/organizations/${unit}?joinRequest=${id}#join-requests`);})
it('root ordinary members do not fetch reviewer queue',async()=>{state.api.getMyAccess.mockResolvedValue({responsibilities:[]});render(<OrganizationRootsPage/>);await screen.findByRole('heading',{name:'All small groups'});expect(state.api.listReviewableOrgJoinRequests).not.toHaveBeenCalled();})
it('uses server history pagination without converting the actionable total to a page count',async()=>{state.api.listReviewableOrgJoinRequests.mockResolvedValueOnce({items:[request],page:1,nextPage:2,actionablePendingTotal:4}).mockResolvedValueOnce({items:[{...request,status:'rejected',decidedAt:'2026-10-20T00:00:00Z'}],page:1,nextPage:2,actionablePendingTotal:4}).mockResolvedValueOnce({items:[],page:2,actionablePendingTotal:4});render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'History'}));await screen.findByText(/Rejected/);expect(screen.getByText(/Result/)).toHaveTextContent('10/20/2026');await userEvent.click(screen.getAllByRole('button',{name:'Next'})[0]);await waitFor(()=>expect(state.api.listReviewableOrgJoinRequests).toHaveBeenLastCalledWith(expect.objectContaining({status:'history',page:2,orgUnitId:unit})));expect(await screen.findByText('4 pending requests')).toBeInTheDocument();})
it('consumes an active deep link on scope revocation and never reopens it after scope returns',async()=>{state.params=new URLSearchParams({joinRequest:id,q:'keep',page:'2'});const view=render(<OrganizationUnitPage/>);await screen.findByRole('button',{name:'Approve'});state.api.getManagedUnit.mockResolvedValue({...folder,actions:{}});view.rerender(<OrganizationUnitPage searchQuery="lost"/>);await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(state.replace).toHaveBeenLastCalledWith(expect.stringContaining('?q=keep&page=2'),{scroll:false});state.api.getManagedUnit.mockResolvedValue(folder);view.rerender(<OrganizationUnitPage searchQuery="restored"/>);await waitFor(()=>expect(state.api.listManagedMembers).toHaveBeenLastCalledWith(unit,'restored',1,expect.any(AbortSignal),false));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();})
it('closes a query-selected dialog on browser query navigation',async()=>{state.params=new URLSearchParams({joinRequest:id});const view=render(<OrganizationUnitPage/>);await screen.findByRole('button',{name:'Approve'});state.params=new URLSearchParams('q=other');view.rerender(<OrganizationUnitPage/>);await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());state.params=new URLSearchParams({joinRequest:id});view.rerender(<OrganizationUnitPage/>);expect(await screen.findByRole('button',{name:'Approve'})).toBeInTheDocument();})
it('rejects malformed request identifiers before a detail read',async()=>{state.params=new URLSearchParams({joinRequest:'not-a-uuid'});render(<OrganizationUnitPage/>);await screen.findByRole('table');await waitFor(()=>expect(state.replace).toHaveBeenCalled());expect(state.api.getReviewableOrgJoinRequest).not.toHaveBeenCalled();})
it('distinguishes a current zero from summary failure and rechecks reviewer change on focus',async()=>{state.api.listReviewableOrgJoinRequests.mockResolvedValue({items:[],page:1,actionablePendingTotal:0});render(<OrganizationRootsPage/>);expect(await screen.findByText('0 pending requests')).toBeInTheDocument();state.api.listReviewableOrgJoinRequests.mockRejectedValue(new Error('offline'));await act(async()=>window.dispatchEvent(new Event('focus')));expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');expect(screen.queryByText('0 pending requests')).not.toBeInTheDocument();state.api.getMyAccess.mockResolvedValue({responsibilities:[]});state.api.listReviewableOrgJoinRequests.mockClear();await act(async()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(screen.queryByRole('region',{name:'Join requests'})).not.toBeInTheDocument());expect(state.api.listReviewableOrgJoinRequests).not.toHaveBeenCalled();})
it('locks double decisions and fences a late completion after route unmount',async()=>{let resolve!:(v:unknown)=>void;state.api.approveOrgJoinRequest.mockImplementation(()=>new Promise(r=>{resolve=r}));const view=render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'Review Current applicant'}));await userEvent.dblClick(await screen.findByRole('button',{name:'Approve'}));expect(state.api.approveOrgJoinRequest).toHaveBeenCalledOnce();view.unmount();await act(async()=>resolve({...request,status:'approved'}));expect(state.invalidate).not.toHaveBeenCalled();})
it('keeps an uncertain intent across close and explicit row reopening',async()=>{state.api.approveOrgJoinRequest.mockRejectedValueOnce(new TypeError('offline'));render(<OrganizationUnitPage/>);await userEvent.click(await screen.findByRole('button',{name:'Review Current applicant'}));await userEvent.click(await screen.findByRole('button',{name:'Approve'}));await screen.findByRole('alert');await userEvent.click(screen.getAllByRole('button',{name:'Back'}).at(-1)!);await userEvent.click(screen.getByRole('button',{name:'Review Current applicant'}));await userEvent.click(await screen.findByRole('button',{name:'Approve'}));expect(state.api.approveOrgJoinRequest.mock.calls[1]).toEqual(state.api.approveOrgJoinRequest.mock.calls[0]);})

it('restores a connected keyboard-focused row trigger after Escape',async()=>{render(<OrganizationUnitPage/>);const trigger=await screen.findByRole('button',{name:'Review Current applicant'});trigger.focus();expect(trigger).toHaveFocus();await userEvent.keyboard(' ');await screen.findByRole('button',{name:'Approve'});await userEvent.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());await waitFor(()=>expect(trigger).toHaveFocus());})

it.each([
 ['en','Approval adds the target affiliation. It does not automatically grant recording, bulletin or management access.'],
 ['zh-Hant','核准會新增目標單位的歸屬，不會自動授予聚會錄影、週報或管理權限。'],
 ['zh-Hans','批准会新增目标单位的归属，不会自动授予聚会录像、周报或管理权限。'],
 ['ja','承認すると申請先の所属が追加されます。録画、週報、管理の権限は自動的には付与されません。'],
 ['ko','승인하면 대상 단위 소속이 추가됩니다. 녹화 영상, 주보 또는 관리 권한은 자동으로 부여되지 않습니다.'],
] as const)('discloses affiliation-only approval consequences in %s',async(locale,consequence)=>{
 state.locale=locale
 render(<JoinRequestDialog requestId={id} unitId={unit} isOpen intents={new Map()} onClose={vi.fn()} onDenied={vi.fn()} onDecided={vi.fn()}/>)
 const dialog=await screen.findByRole('dialog')
 await within(dialog).findByText('Current family')
 expect(dialog).toHaveTextContent(consequence)
 expect(state.api.approveOrgJoinRequest).not.toHaveBeenCalled()
})
it.each(['pending','approved'] as const)('shows current detail timestamps for %s requests',async status=>{
 const requestedAt='2026-10-21T03:04:05Z',decidedAt='2026-10-22T06:07:08Z'
 state.api.getReviewableOrgJoinRequest.mockResolvedValue({...request,status,requestedAt,...(status==='approved'?{decidedAt,actions:{approve:false,reject:false,cancel:false}}:{})})
 render(<OrganizationUnitPage/>)
 await userEvent.click(await screen.findByRole('button',{name:'Review Current applicant'}))
 const dialog=await screen.findByRole('dialog')
 await within(dialog).findByText('Current family')
 expect(within(dialog).getByText('Requested')).toBeInTheDocument()
 expect(dialog.querySelector(`time[datetime="${requestedAt}"]`)).toBeInTheDocument()
 expect(dialog.querySelector(`time[datetime="${request.requestedAt}"]`)).not.toBeInTheDocument()
 if(status==='approved'){
  expect(within(dialog).getByText('Result')).toBeInTheDocument()
  expect(dialog.querySelector(`time[datetime="${decidedAt}"]`)).toBeInTheDocument()
 } else expect(within(dialog).queryByText('Result')).not.toBeInTheDocument()
})
it('puts the single current review summary before both group lists',async()=>{
 render(<OrganizationRootsPage/>)
 const summary=await screen.findByRole('region',{name:'Join requests'})
 await within(summary).findByText('4 pending requests')
 for(const name of ['My small groups','All small groups']){
  expect(summary.compareDocumentPosition(screen.getByRole('region',{name}))&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
 }
 expect(document.querySelectorAll('.organization-review-summary')).toHaveLength(1)
 expect(state.api.listReviewableOrgJoinRequests).toHaveBeenCalledOnce()
})
it('keeps the root summary expanded across keyed bounded review pages',async()=>{
 const next={...request,id:'33333333-3333-4333-8333-333333333333',applicantDisplayName:'Next applicant'}
 state.api.listReviewableOrgJoinRequests.mockResolvedValueOnce({items:[request],page:1,nextPage:2,actionablePendingTotal:4}).mockResolvedValueOnce({items:[next],page:2,actionablePendingTotal:4})
 render(<OrganizationRootsPage/>)
 const summary=await screen.findByRole('region',{name:'Join requests'})
 await userEvent.click(await within(summary).findByText('4 pending requests'))
 await waitFor(()=>expect(summary.querySelector('details')).toHaveAttribute('open'))
 const oldSignal=state.api.listReviewableOrgJoinRequests.mock.calls[0][0].signal
 await userEvent.click(within(summary).getByRole('button',{name:'Next'}))
 await within(summary).findByRole('link',{name:'Review Next applicant'})
 expect(summary.querySelector('details')).toHaveAttribute('open')
 expect(oldSignal.aborted).toBe(true)
 expect(state.api.listReviewableOrgJoinRequests).toHaveBeenCalledTimes(2)
 expect(state.api.listReviewableOrgJoinRequests).toHaveBeenLastCalledWith(expect.objectContaining({status:'pending',page:2,limit:5}))
 expect(state.api.getMyAccess).toHaveBeenCalledOnce()
})
