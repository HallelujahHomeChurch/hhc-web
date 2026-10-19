import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {NextIntlClientProvider} from 'next-intl';
import {NotificationBell} from './NotificationBell';
import {NotificationsPage} from './NotificationsPage';
const auth=vi.hoisted(()=>({state:{status:'authenticated',session:{user:{id:'synthetic',email:'synthetic@example.test',display_name:'Synthetic',avatar_url:null},permissions:[],permissionAvailability:{status:'available'}}},runtime:{getSnapshot:()=>auth.state,subscribe:()=>()=>{},getAccessToken:async()=> 'synthetic',refreshAfterUnauthorized:async()=> 'synthetic'}}));
const router=vi.hoisted(()=>({push:vi.fn()}));
vi.mock('@/components/layout/AccountControl',()=>({useAccountAuth:()=>auth.state,useInboxAuthRuntime:()=>auth.runtime,useAccountSignIn:()=>vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>router,usePathname:()=>'/en/notifications'}));
import {NotificationProvider} from './provider';
import en from '@/i18n/locales/en.json';
const id='11111111-1111-4111-8111-111111111111';
const item={id,type:'recording.published',resource:{type:'recording',id:'video1'},occurredAt:'2026-10-19T00:00:00Z',projection:{titleKey:'notification.recording',messageKey:'notification.published',parameters:{title:'Synthetic recording'},action:{type:'recording',resource:{type:'recording',id:'video1'}}}};
const envelope=(data:unknown)=>Response.json({data,meta:{requestId:'synthetic'},error:null});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
function setup() {
 const fetcher=vi.fn(async(path:RequestInfo|URL)=>String(path).includes('/read')?Response.json({error:{code:'NTF_INTERNAL'},meta:{requestId:'test'},data:null},{status:500}):envelope({items:[item],readSnapshotToken:'opaque-snapshot',asOf:item.occurredAt,...(String(path).includes('/summary')?{unreadCount:105}:{nextCursor:'opaque-cursor'})}));
 vi.stubGlobal('fetch',fetcher);
 return render(<NextIntlClientProvider locale="en" messages={en}><NotificationProvider locale="en"><NotificationBell/><NotificationsPage/></NotificationProvider></NextIntlClientProvider>);
}
it('shows exact accessible count with capped badge, a preview, and opening never marks read',async()=>{
 setup();const bell=await screen.findByRole('button',{name:'Notifications, 105 unread'});expect(screen.getByText('99+')).toBeInTheDocument();
 fireEvent.click(bell);expect(await screen.findByRole('dialog',{name:'Notifications'})).toBeInTheDocument();expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching('/read'),expect.anything());
});
it('navigates even when marking read fails and retains a generic recovery message after the click',async()=>{
 setup();await screen.findByRole('heading',{name:'Notifications'});const links=await screen.findAllByRole('link',{name:'Open'});
 fireEvent.click(links[0]);expect(router.push).toHaveBeenCalledWith('/en/member-videos/video1');await waitFor(()=>expect(screen.getAllByText('Could not save the read status. Try again.').length).toBeGreaterThan(0));
});
it('keeps opaque pagination tokens out of browser history and DOM while changing the unread filter',async()=>{
 setup();await screen.findByText('Synthetic recording');fireEvent.click(screen.getByRole('button',{name:'Next'}));await waitFor(()=>expect(fetch).toHaveBeenCalledWith(expect.stringContaining('cursor=opaque-cursor'),expect.anything()));
 expect(document.body.innerHTML).not.toContain('opaque-cursor');expect(location.href).not.toContain('opaque');fireEvent.click(screen.getByRole('button',{name:'Unread only'}));await act(async()=>{});expect(fetch).toHaveBeenLastCalledWith('/api/notifications/me?filter=unread&limit=20&locale=en',expect.anything());
});
