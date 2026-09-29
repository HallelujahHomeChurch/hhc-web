import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemberVideoZone} from './MemberVideoZone';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';

const state = vi.hoisted(() => ({access: 'loading', auth: 'checking'}));
const list = vi.hoisted(() => vi.fn());
const videoApi = vi.hoisted(() => ({list: vi.fn(), grant: vi.fn(), exchange: vi.fn(), clear: vi.fn().mockResolvedValue(undefined)}));
const router = vi.hoisted(() => ({replace: vi.fn()}));
const replace = router.replace;
vi.mock('next/navigation', () => ({useRouter: () => router}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountAuth: () => ({status: state.auth}),
  useVideoAccess: () => state.access,
  useBulletinAuthorization: () => ({getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null})
}));
vi.mock('./api', () => ({createMemberVideoApi: () => videoApi}));

const messages = {
  selectedTitle: 'Selected recording', listTitle: 'Recent recordings', count: '{count} gatherings', play: 'Play', select: 'Select', selected: 'Selected',
  playing: 'Playing', featured: 'Featured', durationUnknown: 'Duration unavailable', expires: 'Available until', loading: 'Loading',
  preparing: 'Preparing', empty: 'No recordings', loadError: 'Unavailable', playError: 'Cannot play', expired: 'Expired',
  retry: 'Retry', previous: 'Previous', next: 'Next'
};

beforeEach(() => {
  state.access = 'loading'; state.auth = 'checking';
  list.mockReset(); replace.mockReset();
  list.mockResolvedValue([]);
  videoApi.list.mockReset().mockImplementation(list);
  videoApi.grant.mockReset(); videoApi.exchange.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({matches:true});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});
afterEach(() => {vi.useRealTimers();vi.restoreAllMocks();});

describe('member video gate', () => {
  it('allows another play after changing selection during a pending grant', async () => {
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue(['first','second'].map(id=>({id,title:id,uploadedAt:null,expiresAt:null,featured:false})));
    videoApi.grant.mockImplementation(()=>new Promise(()=>{}));
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Play'}));
    expect(screen.getByRole('button',{name:'Preparing'})).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button',{name:'Select'})[1]);
    expect(screen.getByRole('button',{name:'Play'})).toBeEnabled();
  });
  it('does not renew every second when the recording deadline caps the grant', async () => {
    state.auth='authenticated';state.access='available';
    const expiresAt=new Date(Date.now()+5*60000).toISOString();
    list.mockResolvedValue([{id:'r1',title:'Soon expires',uploadedAt:null,expiresAt,featured:false,primaryAssetVersionId:'f1'}]);
    videoApi.grant.mockResolvedValue({assetVersionId:'f1',watermarkCode:'CODE',expiresAt});
    videoApi.exchange.mockResolvedValue('https://media.alive.org.tw/content');
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    const play=await screen.findByRole('button',{name:'Play'});
    vi.useFakeTimers();
    await act(async()=>{fireEvent.click(play)});
    for(let second=0;second<31;second++) await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});
    expect(videoApi.grant.mock.calls.length).toBeLessThanOrEqual(2);
    expect(screen.getByLabelText('Soon expires')).toHaveAttribute('src','https://media.alive.org.tw/content');
  });
  it('paginates 18 titled recordings into 12 and 6 without changing the player selection', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    const records = Array.from({length:18},(_,index)=>({id:`r-${index}`,title:`Recording ${index}`,uploadedAt:new Date(Date.UTC(2026,8,28-index)).toISOString(),expiresAt:'2026-10-28T02:00:00Z',status:'published',featured:false,hidden:false,version:1,primaryAssetVersionId:`file-${index}`,durationSeconds:9000}));
    list.mockResolvedValue(records);
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    await screen.findByRole('heading',{level:2,name:'Recording 0'});
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.getAllByText(/2 hours 30 minutes/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button',{name:'Next'}));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(screen.getByRole('heading',{level:2,name:'Recording 0'})).toBeInTheDocument();
  });
  it('overlays only the pseudonymous watermark after playback authorization', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    list.mockResolvedValue([{id:'r1',title:'Sunday',uploadedAt:'2026-09-28T02:00:00Z',expiresAt:'2026-10-28T02:00:00Z',status:'published',featured:false,hidden:false,version:1,primaryAssetVersionId:'f1'}]);
    videoApi.grant.mockResolvedValue({assetVersionId:'f1',watermarkCode:'A123B456',expiresAt:new Date(Date.now()+3600000).toISOString()});
    videoApi.exchange.mockResolvedValue('https://media.alive.org.tw/videos/r1/files/f1/sessions/scope/content');
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    fireEvent.click(await screen.findByRole('button',{name:'Play'}));
    expect(await screen.findByText('A123B456')).toHaveAttribute('aria-hidden','true');
    expect(screen.getByLabelText('Sunday')).toHaveAttribute('controlslist','nodownload');
  });
  it('does not fetch or reveal recording content before entitlement and redirects denied members', async () => {
    const view = render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    expect(list).not.toHaveBeenCalled();
    expect(screen.queryByText('Member Videos')).not.toBeInTheDocument();
    state.auth = 'authenticated'; state.access = 'denied';
    view.rerender(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en'));
    expect(list).not.toHaveBeenCalled();
  });

  it('loads the authorized empty state', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    expect(await screen.findByText('No recordings')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });
  it('shows a fail-closed message when account authorization is unavailable', () => {
    state.auth = 'unavailable'; state.access = 'unavailable';
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
    expect(screen.queryByText('Member Videos')).not.toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });
  it('returns home after an authorized list still receives 401', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    videoApi.list.mockRejectedValue(new HhcWebApiError(401, 'unauthorized', 'Expired'));
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/en'));
    expect(screen.queryByText('No recordings')).not.toBeInTheDocument();
  });
});
