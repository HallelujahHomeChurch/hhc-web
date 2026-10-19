import {act, render, screen} from '@testing-library/react'
import {beforeEach, expect, it, vi} from 'vitest'
import {OrganizationsShell} from './OrganizationsShell'
import {useOrganizationsSearch, type OrganizationsSearchState} from './OrganizationsSearch'
import type {SiteLayout} from '@/features/site-layout/types'
const state = vi.hoisted(() => ({pathname:'/zh-Hant/organizations',owner:'owner',status:'allowed',params:new URLSearchParams(),router:{replace:vi.fn()}}))
vi.mock('next/navigation',()=>({usePathname:()=>state.pathname,useSearchParams:()=>state.params,useRouter:()=>state.router}))
vi.mock('@/components/layout/AccountControl',()=>({useAccountIdentity:()=>state.owner,useOrganizationsAccess:()=>({status:state.status})}))
vi.mock('@/components/layout/SiteHeader',()=>({SiteHeader:()=>null}))
vi.mock('@/components/layout/SiteFooter',()=>({SiteFooter:()=>null}))
vi.mock('./OrganizationsGate',()=>({OrganizationsGate:({children,ownerOnly}:{children:React.ReactNode;ownerOnly:boolean})=><div data-testid="gate" data-owner-only={String(ownerOnly)}>{children}</div>}))
const layout={bannerImageUrl:'/assets/banners/hero.jpg'} as SiteLayout
beforeEach(()=>{state.pathname='/zh-Hant/organizations';state.owner='owner';state.status='allowed';state.params=new URLSearchParams();state.router.replace.mockClear()})
it('uses the approved title and subtitle in the existing entry banner',()=>{
 render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Managed unit list</p></OrganizationsShell>)
 expect(screen.getByRole('heading',{level:1,name:'小家'})).toBeInTheDocument()
 expect(screen.getByText('陪人走一生的路，乃人生最高的成就')).toBeInTheDocument()
 expect(screen.getByText('Managed unit list')).toBeInTheDocument()
})
it.each(['/zh-Hant/organizations/unit','/zh-Hant/organizations/unit/members/member'])('does not repeat the entry banner on %s',pathname=>{
 state.pathname=pathname
 render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Management content</p></OrganizationsShell>)
 expect(screen.queryByText('陪人走一生的路，乃人生最高的成就')).not.toBeInTheDocument()
 expect(screen.getByText('Management content')).toBeInTheDocument()
})

it('isolates header member search across routes and account changes, ignoring stale readiness', () => {
 let current: OrganizationsSearchState
 function Probe() {current = useOrganizationsSearch()!; return <output>{current.available ? 'ready' : 'disabled'}:{current.query}</output>}
 state.pathname='/zh-Hant/organizations/unit-a'
 const view=render(<OrganizationsShell locale="zh-Hant" layout={layout}><Probe /></OrganizationsShell>)
 act(()=>{current.setAvailable({unitId:'unit-a',available:true});current.setQuery('Alice')})
 expect(screen.getByText('ready:Alice')).toBeInTheDocument()
 const stale=current!.setAvailable
 state.pathname='/zh-Hant/organizations/unit-b'
 view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><Probe /></OrganizationsShell>)
 act(()=>stale({unitId:'unit-a',available:true}))
 expect(screen.getByText('disabled:')).toBeInTheDocument()
 act(()=>{current.setAvailable({unitId:'unit-b',available:true});current.setQuery('Bob')})
 expect(screen.getByText('ready:Bob')).toBeInTheDocument()
 state.owner='other'
 view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><Probe /></OrganizationsShell>)
 expect(screen.getByText('disabled:')).toBeInTheDocument()
})

it.each([
 ['/zh-Hant/organizations/requests/request',true],
 ['/zh-Hant/organizations/unit',false],
 ['/zh-Hant/organizations/unit/members/member',false],
 ['/zh-Hant/organizations/requests/request/members/member',false],
])('limits owner-only admission to exact necessary result route %s', (pathname,exception)=>{
 state.pathname=pathname
 render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Content</p></OrganizationsShell>)
 expect(screen.getByTestId('gate')).toHaveAttribute('data-owner-only',String(exception))
})

it('waits through initial qualification but consumes a review query after scope loss before restoration',()=>{
 state.pathname='/zh-Hant/organizations/unit';state.params=new URLSearchParams('q=Alice&page=3&joinRequest=request');state.status='loading'
 const view=render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 expect(state.router.replace).not.toHaveBeenCalled()
 state.status='allowed';view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 state.status='unavailable';view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 expect(state.router.replace).toHaveBeenCalledWith('/zh-Hant/organizations/unit?q=Alice&page=3#join-requests',{scroll:false})
 state.status='allowed';view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 expect(screen.queryByText('Private review page')).not.toBeInTheDocument()
 state.params=new URLSearchParams('q=Alice&page=3');view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 expect(screen.getByText('Private review page')).toBeInTheDocument()
})
it('consumes a previous actor’s selected review before rendering the new actor',()=>{
 state.pathname='/zh-Hant/organizations/unit';state.params=new URLSearchParams('joinRequest=request')
 const view=render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 state.owner='other';view.rerender(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Private review page</p></OrganizationsShell>)
 expect(state.router.replace).toHaveBeenCalledWith('/zh-Hant/organizations/unit#join-requests',{scroll:false})
 expect(screen.queryByText('Private review page')).not.toBeInTheDocument()
})
