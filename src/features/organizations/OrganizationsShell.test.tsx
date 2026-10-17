import {act, render, screen} from '@testing-library/react'
import {beforeEach, expect, it, vi} from 'vitest'
import {OrganizationsShell} from './OrganizationsShell'
import {useOrganizationsSearch, type OrganizationsSearchState} from './OrganizationsSearch'
import type {SiteLayout} from '@/features/site-layout/types'
const state = vi.hoisted(() => ({pathname:'/zh-Hant/organizations',owner:'owner'}))
vi.mock('next/navigation',()=>({usePathname:()=>state.pathname}))
vi.mock('@/components/layout/AccountControl',()=>({useAccountIdentity:()=>state.owner,useOrganizationsAccess:()=>({status:'allowed'})}))
vi.mock('@/components/layout/SiteHeader',()=>({SiteHeader:()=>null}))
vi.mock('@/components/layout/SiteFooter',()=>({SiteFooter:()=>null}))
vi.mock('./OrganizationsGate',()=>({OrganizationsGate:({children}:{children:React.ReactNode})=>children}))
const layout={bannerImageUrl:'/assets/banners/hero.jpg'} as SiteLayout
beforeEach(()=>{state.pathname='/zh-Hant/organizations';state.owner='owner'})
it('uses the approved title and subtitle in the existing entry banner',()=>{
 render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Managed unit list</p></OrganizationsShell>)
 expect(screen.getByRole('heading',{level:1,name:'小家'})).toBeInTheDocument()
 expect(screen.getByText('陪人走一生的路，乃人生最高的成就。')).toBeInTheDocument()
 expect(screen.getByText('Managed unit list')).toBeInTheDocument()
})
it.each(['/zh-Hant/organizations/unit','/zh-Hant/organizations/unit/members/member'])('does not repeat the entry banner on %s',pathname=>{
 state.pathname=pathname
 render(<OrganizationsShell locale="zh-Hant" layout={layout}><p>Management content</p></OrganizationsShell>)
 expect(screen.queryByText('陪人走一生的路，乃人生最高的成就。')).not.toBeInTheDocument()
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
