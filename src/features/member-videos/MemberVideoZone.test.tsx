import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemberVideoZone} from './MemberVideoZone';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';

const state = vi.hoisted(() => ({access: 'loading', auth: 'checking'}));
const list = vi.hoisted(() => vi.fn());
const videoApi = vi.hoisted(() => ({liveList:vi.fn().mockResolvedValue([]),cover:vi.fn(),list: vi.fn(), grant: vi.fn(), exchange: vi.fn(), clear: vi.fn().mockResolvedValue(undefined)}));
const router = vi.hoisted(() => ({replace: vi.fn()}));
const replace = router.replace;
const captureHandledError = vi.hoisted(() => vi.fn());
vi.mock('@/lib/observability', () => ({captureHandledError}));
const packageId = 'a'.repeat(32);
const playbackUrl = `https://media.alive.org.tw/videos/r1/packages/${packageId}/sessions/scope/master.m3u8`;
vi.mock('next/navigation', () => ({useRouter: () => router}));
vi.mock('@/components/layout/AccountControl', () => ({
  useAccountIdentity: () => 'member',
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
  ,quality:'Quality',auto:'Auto',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Playback position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Could not exit fullscreen',playbackSpeed:'Playback speed'
};

beforeEach(() => {
  state.access = 'loading'; state.auth = 'checking';
  list.mockReset(); replace.mockReset();
  captureHandledError.mockReset();
  list.mockResolvedValue([]);
  videoApi.list.mockReset().mockImplementation(list);
  videoApi.liveList.mockReset().mockResolvedValue([]);
  videoApi.grant.mockReset(); videoApi.exchange.mockReset();
  videoApi.cover.mockReset().mockRejectedValue(new Error('No cover'));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({matches:true});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
});
afterEach(() => {cleanup();vi.useRealTimers();vi.restoreAllMocks();});

describe('member video gate', () => {
  it('shows a live-only recording on its watch route without claiming unavailable or requesting VOD',async()=>{
    state.auth='authenticated';state.access='available';
    videoApi.liveList.mockResolvedValue([{id:'r1',captureId:'a'.repeat(32),title:'Sunday live',liveState:'starting',createdAt:'2026-10-07T00:00:00Z',stopAcceptedAt:null,progress:{revision:0,firstSequence:0,lastSequence:-1,mediaEndSeconds:0,lastAdvancedAt:null,endedAt:null,ended:false}}]);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    expect(await screen.findByRole('heading',{name:'Sunday live'})).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(videoApi.grant).not.toHaveBeenCalled();
  });

  it('shows a paginated library without requesting playback and links to a refreshable watch page', async () => {
    state.auth='authenticated'; state.access='available';
    list.mockResolvedValue(Array.from({length: 15}, (_, i) => ({id: `r${i}`, title: `Gathering ${i}`, uploadedAt: '2026-10-01T00:00:00Z'})));
    render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    const links = await screen.findAllByRole('link', {name: /Gathering/});
    expect(links).toHaveLength(12);
    expect(links[0]).toHaveAttribute('href', expect.stringMatching(/^\/en\/member-videos\/r[0-9]+\?page=1$/));
    expect(screen.queryByRole('button', {name:'Play'})).not.toBeInTheDocument();
    expect(videoApi.grant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name:'Next'}));
    expect(screen.getAllByRole('link', {name:/Gathering/})).toHaveLength(3);
  });
  it('uses the requested video and limits other videos to the newest ten', async () => {
    state.auth='authenticated'; state.access='available';
    const items=Array.from({length: 15}, (_, i) => ({id:`r${i}`, title:`Gathering ${i}`, uploadedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`}));
    list.mockResolvedValue(items);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r0" initialPage={2}/>);
    await screen.findByRole('heading', {level:2, name:'Gathering 0'});
    const links=screen.getAllByRole('link', {name:/Gathering/});
    expect(links).toHaveLength(10);
    expect(links[0]).toHaveTextContent('Gathering 14');
    expect(links[9]).toHaveTextContent('Gathering 5');
    expect(screen.getByRole('link', {name:'Recent recordings'})).toHaveAttribute('href','/en/member-videos?page=2');
    expect(screen.queryByRole('button', {name:'Next'})).not.toBeInTheDocument();
  });
  it('preserves library page two through sidebar navigation with thirteen recordings', async () => {
    state.auth='authenticated'; state.access='available';
    list.mockResolvedValue(Array.from({length:13}, (_, i) => ({id:`r${i}`, title:`Gathering ${i}`, uploadedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`})));
    const view=render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r0" initialPage={2}/>);
    await screen.findByRole('heading', {level:2, name:'Gathering 0'});
    const links=screen.getAllByRole('link', {name:/Gathering/});
    expect(links).toHaveLength(10);
    for (const link of links) expect(link).toHaveAttribute('href', expect.stringMatching(/\?page=2$/));
    const target=new URL(links[0].getAttribute('href')!, 'https://www.alive.org.tw');
    expect(target.pathname).toBe('/en/member-videos/r12');
    view.rerender(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId={target.pathname.split('/').at(-1)} initialPage={Number(target.searchParams.get('page'))}/>);
    await screen.findByRole('heading', {level:2, name:'Gathering 12'});
    expect(screen.getByRole('link', {name:'Recent recordings'})).toHaveAttribute('href','/en/member-videos?page=2');
  });
  it('does not substitute the newest video for an unavailable direct link', async () => {
    state.auth='authenticated'; state.access='available';
    list.mockResolvedValue([{id:'available', title:'Other gathering', uploadedAt:'2026-10-01T00:00:00Z'}]);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="missing"/>);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', {name:'Play'})).not.toBeInTheDocument();
    expect(videoApi.grant).not.toHaveBeenCalled();
  });

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
    vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(390);
    vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(220);
    vi.spyOn(HTMLVideoElement.prototype,'videoWidth','get').mockReturnValue(1920);
    vi.spyOn(HTMLVideoElement.prototype,'videoHeight','get').mockReturnValue(1080);
    state.auth = 'authenticated'; state.access = 'available';
    list.mockResolvedValue([{id:'r1',title:'Sunday',uploadedAt:'2026-09-28T02:00:00Z',expiresAt:'2026-10-28T02:00:00Z',status:'published',featured:false,hidden:false,version:1,packageId}]);
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'A123B456',expiresAt:new Date(Date.now()+3600000).toISOString()});
    videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    fireEvent.click(await screen.findByRole('button',{name:'Play'}));
    const marks = await screen.findAllByText('A123B456');
    expect(marks).toHaveLength(4);
    expect(marks[0].parentElement).toHaveAttribute('aria-hidden','true');
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
