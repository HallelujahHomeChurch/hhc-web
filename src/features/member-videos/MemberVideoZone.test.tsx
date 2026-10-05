import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemberVideoZone} from './MemberVideoZone';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';

const state = vi.hoisted(() => ({access: 'loading', auth: 'checking'}));
const list = vi.hoisted(() => vi.fn());
const videoApi = vi.hoisted(() => ({list: vi.fn(), grant: vi.fn(), exchange: vi.fn(), clear: vi.fn().mockResolvedValue(undefined)}));
const router = vi.hoisted(() => ({replace: vi.fn()}));
const replace = router.replace;
const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({captureHandledError}));
const packageId = 'a'.repeat(32);
const playbackUrl = `https://media.alive.org.tw/videos/r1/packages/${packageId}/sessions/scope/master.m3u8`;
vi.mock('next/navigation', () => ({useRouter: () => router}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountAuth: () => ({status: state.auth}),
  useVideoAccess: () => state.access,
  useBulletinAuthorization: () => ({getAccessToken: async () => 'token', refreshAfterUnauthorized: async () => null})
}));
vi.mock('./api', () => ({createMemberVideoApi: () => videoApi}));
vi.mock('hls.js',()=>({default:class {static isSupported(){return false;}}}));

const messages = {
  settings:'Settings',togglePlayback:'Play or pause',privateCopy:'HHC members only',buffering:'Loading video',uploadedDate:'Uploaded: {date}',
  selectedTitle: 'Selected recording', listTitle: 'Recent recordings', count: '{count} gatherings', play: 'Play', select: 'Select', selected: 'Selected',
  playing: 'Playing', featured: 'Featured', durationUnknown: 'Duration unavailable', expires: 'Available until', loading: 'Loading',
  preparing: 'Preparing', empty: 'No recordings', loadError: 'Unavailable', playError: 'Cannot play', expired: 'Expired',
  retry: 'Retry', previous: 'Previous', next: 'Next'
  ,quality:'Quality',auto:'Auto',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Playback position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',playbackSpeed:'Playback speed'
};

beforeEach(() => {
  state.access = 'loading'; state.auth = 'checking';
  list.mockReset(); replace.mockReset();
  captureHandledError.mockReset();
  list.mockResolvedValue([]);
  videoApi.list.mockReset().mockImplementation(list);
  videoApi.grant.mockReset(); videoApi.exchange.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({matches:true});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
});
afterEach(() => {cleanup();vi.useRealTimers();vi.restoreAllMocks();});

describe('member video gate', () => {
  it.each([true, false])('refresh keeps manual selection when present=%s, otherwise selects newest', async (present) => {
    state.auth='authenticated';state.access='available';
    const old={id:'old',title:'Older',uploadedAt:'2026-10-01T00:00:00Z'};
    const newer={id:'new',title:'Newer',uploadedAt:'2026-10-04T00:00:00Z'};
    const newest={id:'newest',title:'Newest',uploadedAt:'2026-10-05T00:00:00Z'};
    list.mockResolvedValueOnce([old,newer]).mockResolvedValueOnce(present ? [old,newest,newer] : [newer,newest]);
    videoApi.grant.mockRejectedValue(new HhcWebApiError(404,'not_found','Unavailable'));
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    await screen.findByRole('heading',{level:2,name:'Newer'});
    fireEvent.click(screen.getByRole('button',{name:'Select'}));
    await screen.findByRole('heading',{level:2,name:'Older'});
    fireEvent.click(screen.getByRole('button',{name:'Play'}));
    await waitFor(()=>expect(list).toHaveBeenCalledTimes(2));
    await screen.findByRole('heading',{level:2,name:present ? 'Older' : 'Newest'});
    expect(videoApi.exchange).not.toHaveBeenCalled();
  });
  it('selects newest uploaded recording even when an older recording was featured',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'old',title:'Older pinned',uploadedAt:'2026-10-01T00:00:00Z',featured:true},{id:'new',title:'Newest',uploadedAt:'2026-10-05T00:00:00Z',featured:false}]);
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    const play=await screen.findByRole('button',{name:'Play'});
    expect(screen.getAllByRole('heading',{level:2})[0]).toHaveTextContent('Newest');
    expect(play).toBeEnabled();
    expect(videoApi.grant).not.toHaveBeenCalled();
  });
  it('reports media failure once per playback attempt without private playback details', async () => {
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Sunday',uploadedAt:null,expiresAt:null,featured:false,packageId}]);
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'PRIVATE-CODE',expiresAt:new Date(Date.now()+3600000).toISOString()});
    videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Play'}));
    const video=await screen.findByLabelText('Sunday');
    fireEvent.error(video); fireEvent.error(video);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(captureHandledError).toHaveBeenCalledExactlyOnceWith(new Error('Member video media playback failed'), {operation:'member-videos.media'});
    fireEvent.click(screen.getByRole('button',{name:'Retry'}));
    fireEvent.error(await screen.findByLabelText('Sunday'));
    expect(captureHandledError).toHaveBeenCalledTimes(2);
  });
  it('allows another play after changing selection during a pending grant', async () => {
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue(['first','second'].map(id=>({id,title:id,uploadedAt:null,expiresAt:null,featured:false})));
    videoApi.grant.mockImplementation(()=>new Promise(()=>{}));
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Play'}));
    expect(screen.getByRole('status')).toHaveTextContent('Preparing');
    expect(screen.queryByRole('button',{name:'Play'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Select'}));
    expect(screen.getByRole('button',{name:'Play'})).toBeEnabled();
  });
  it('does not renew every second when the recording deadline caps the grant', async () => {
    state.auth='authenticated';state.access='available';
    const expiresAt=new Date(Date.now()+5*60000).toISOString();
    list.mockResolvedValue([{id:'r1',title:'Soon expires',uploadedAt:null,expiresAt,featured:false,packageId}]);
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'CODE',expiresAt});
    videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    const play=await screen.findByRole('button',{name:'Play'});
    vi.useFakeTimers();
    await act(async()=>{fireEvent.click(play)});
    for(let second=0;second<31;second++) await act(async()=>{await vi.advanceTimersByTimeAsync(1000)});
    expect(videoApi.grant.mock.calls.length).toBeLessThanOrEqual(2);
    expect(screen.getByLabelText('Soon expires')).toHaveAttribute('src',playbackUrl);
  });
  it('renews the same package and session without reloading or resetting playback', async () => {
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Sunday',uploadedAt:null,expiresAt:new Date(Date.now()+86400000).toISOString(),featured:false,packageId}]);
    videoApi.grant.mockImplementation(async()=>({packageId,watermarkCode:'CODE',expiresAt:new Date(Date.now()+3600000).toISOString(),renditions:[{name:'720p'},{name:'1080p'}]}));
    videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    const play=await screen.findByRole('button',{name:'Play'});
    vi.useFakeTimers();
    await act(async()=>{fireEvent.click(play)});
    const video=screen.getByLabelText('Sunday') as HTMLVideoElement;
    expect(video).toHaveAttribute('src',playbackUrl);
    video.currentTime=1234;
    const loads=vi.mocked(HTMLMediaElement.prototype.load).mock.calls.length;
    await act(async()=>{await vi.advanceTimersByTimeAsync(45*60000)});
    expect(videoApi.grant).toHaveBeenCalledTimes(2);
    expect(videoApi.grant.mock.calls[1].slice(0,3)).toEqual(videoApi.grant.mock.calls[0].slice(0,3));
    expect(videoApi.grant.mock.calls[1][2]).toBe(packageId);
    expect(videoApi.exchange).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Sunday')).toBe(video);
    expect(video.currentTime).toBe(1234);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(loads);
  });
  it('excludes the selected recording and paginates the other 17 recordings into 12 and 5', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    const records = Array.from({length:18},(_,index)=>({id:`r-${index}`,title:`Recording ${index}`,uploadedAt:new Date(Date.UTC(2026,8,28-index)).toISOString(),expiresAt:'2026-10-28T02:00:00Z',status:'published',featured:false,hidden:false,version:1,packageId,durationSeconds:9000}));
    list.mockResolvedValue(records);
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    await screen.findByRole('heading',{level:2,name:'Recording 0'});
    expect(screen.getAllByRole('article')).toHaveLength(12);
    expect(screen.queryByRole('heading',{level:3,name:'Recording 0'})).not.toBeInTheDocument();
    expect(screen.queryByText(/2 hours 30 minutes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available until/)).not.toBeInTheDocument();
    expect(screen.getByText('Uploaded: September 28, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Next'}));
    expect(screen.getAllByRole('article')).toHaveLength(5);
    expect(screen.getByRole('heading',{level:2,name:'Recording 0'})).toBeInTheDocument();
  });
  it('moves the chosen card to the player and restores the previous selection to the list', async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue(['First','Second'].map((title,index)=>({id:`r${index}`,title,uploadedAt:`2026-10-0${4-index}T07:06:00Z`,expiresAt:'2026-11-03T07:06:00Z',featured:false})));
    render(<MemberVideoZone locale="en" messages={messages} hero={null}/>);
    await screen.findByRole('heading',{level:2,name:'First'});
    expect(screen.queryByRole('heading',{level:3,name:'First'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Select'}));
    await waitFor(()=>expect(screen.getByRole('heading',{level:2,name:'Second'})).toHaveFocus());
    expect(screen.getByRole('heading',{level:3,name:'First'})).toBeInTheDocument();
    expect(screen.queryByRole('heading',{level:3,name:'Second'})).not.toBeInTheDocument();
    await waitFor(()=>expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled());
  });
  it('overlays only the pseudonymous watermark after playback authorization', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    list.mockResolvedValue([{id:'r1',title:'Sunday',uploadedAt:'2026-09-28T02:00:00Z',expiresAt:'2026-10-28T02:00:00Z',status:'published',featured:false,hidden:false,version:1,packageId}]);
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'A123B456',expiresAt:new Date(Date.now()+3600000).toISOString()});
    videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    fireEvent.click(await screen.findByRole('button',{name:'Play'}));
    expect(await screen.findByText('A123B456')).toHaveAttribute('aria-hidden','true');
    expect(screen.getByLabelText('Sunday').getAttribute('controlslist')).toContain('nodownload');
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
