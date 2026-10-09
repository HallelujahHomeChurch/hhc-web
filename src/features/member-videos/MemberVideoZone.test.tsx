import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemberVideoZone} from './MemberVideoZone';
import {forgetVideoPosition,videoSearchRefreshEvent} from './search';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';

const state = vi.hoisted(() => ({access: 'loading', auth: 'checking'}));
const list = vi.hoisted(() => vi.fn());
const videoApi = vi.hoisted(() => ({listPage:vi.fn(),liveList:vi.fn().mockResolvedValue([]),cover:vi.fn(),list: vi.fn(), grant: vi.fn(), exchange: vi.fn(), clear: vi.fn().mockResolvedValue(undefined)}));
const liveSession = vi.hoisted(()=>({playback:null,closed:false,pending:false,error:false,start:vi.fn(),remember:vi.fn(),bookmark:{current:undefined}}));
vi.mock('./useLivePlayback',()=>({useLivePlayback:()=>liveSession}));
const router = vi.hoisted(() => ({replace: vi.fn(),push:vi.fn()}));
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
  description:'Video description',
  settings:'Settings',togglePlayback:'Play or pause',privateCopy:'HHC members only',buffering:'Loading video',uploadedDate:'Uploaded: {date}',
  selectedTitle: 'Selected recording', listTitle: 'Recent recordings', count: '{count} gatherings', play: 'Play', select: 'Select', selected: 'Selected',
  playing: 'Playing', featured: 'Featured', durationUnknown: 'Duration unavailable', expires: 'Available until', loading: 'Loading',
  preparing: 'Preparing', empty: 'No recordings', loadError: 'Unavailable', playError: 'Cannot play', expired: 'Expired',
  loadMore:'Load more', retry: 'Retry', previous: 'Previous', next: 'Next'
  ,quality:'Quality',auto:'Auto',pause:'Pause',mute:'Mute',unmute:'Unmute',seek:'Playback position',volume:'Volume',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',fullscreenError:'Could not exit fullscreen',playbackSpeed:'Playback speed'
};

beforeEach(() => {
  state.access = 'loading'; state.auth = 'checking';
  liveSession.bookmark.current=undefined;
  list.mockReset(); replace.mockReset();
  captureHandledError.mockReset();
  list.mockResolvedValue([]);
  videoApi.list.mockReset().mockImplementation(list);
  videoApi.listPage.mockReset().mockImplementation(async()=>({items:await list(),nextCursor:null}));
  videoApi.liveList.mockReset().mockResolvedValue([]);
  videoApi.grant.mockReset().mockImplementation(()=>new Promise(()=>{})); videoApi.exchange.mockReset();
  videoApi.cover.mockReset().mockRejectedValue(new Error('No cover'));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({matches:true});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
});
afterEach(() => {forgetVideoPosition();cleanup();vi.useRealTimers();vi.restoreAllMocks();});

describe('member video gate', () => {
  it('does not start twice or discard a bookmark when switching a live watch route to VOD',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Meeting',packageId}]);
    videoApi.liveList.mockResolvedValue([{id:'r1',captureId:packageId,title:'Meeting live',liveState:'ended',createdAt:'2026-10-07T00:00:00Z',progress:{mediaEndSeconds:120}}]);
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'trace',expiresAt:new Date(Date.now()+3600000).toISOString()});videoApi.exchange.mockResolvedValue(playbackUrl);
    Object.assign(liveSession.bookmark,{current:{time:60,paused:true,rate:1.5,quality:'auto',intent:'dvr'}});
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Continue with the published recording'}));
    const video=await screen.findByLabelText('Meeting') as HTMLVideoElement;
    await waitFor(()=>expect(video).toHaveAttribute('src',playbackUrl));
    fireEvent.loadedMetadata(video);
    expect(videoApi.grant).toHaveBeenCalledTimes(1);expect(videoApi.exchange).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(60);expect(video.playbackRate).toBe(1.5);expect(video.play).not.toHaveBeenCalled();
  });
  it('plays an available recording when the live index is offline',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Meeting',packageId}]);videoApi.liveList.mockRejectedValue(new Error('Live index offline'));
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'trace',expiresAt:new Date(Date.now()+3600000).toISOString()});videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    const video=await screen.findByLabelText('Meeting');
    await waitFor(()=>expect(video).toHaveAttribute('src',playbackUrl));
    expect(videoApi.grant).toHaveBeenCalledTimes(1);
  });

  it('prepares a watch route automatically and keeps failed grants stopped until retry',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Meeting',packageId}]);
    videoApi.grant.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({packageId,watermarkCode:'trace',expiresAt:new Date(Date.now()+3600000).toISOString()});
    videoApi.exchange.mockResolvedValue(playbackUrl);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
    expect(await screen.findByLabelText('Meeting')).toHaveAttribute('src',playbackUrl);
    expect(videoApi.grant).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('link',{name:'Recent recordings'})).toBeNull();
  });
  it('aborts automatic playback when navigating to a different recording',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'First'},{id:'r2',title:'Second'}]);
    videoApi.grant.mockImplementation(()=>new Promise(()=>{}));
    const view=render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    await waitFor(()=>expect(videoApi.grant).toHaveBeenCalledTimes(1));
    const signal=videoApi.grant.mock.calls[0][3];
    view.rerender(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r2"/>);
    await waitFor(()=>expect(videoApi.grant).toHaveBeenCalledTimes(2));
    expect(signal.aborted).toBe(true);expect(videoApi.grant.mock.calls[1][0]).toBe('r2');
  });

  it('expands plain-text descriptions without replacing the playing video',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Meeting',description:'<script>alert(1)</script>\nSunday gathering'}]);
    videoApi.grant.mockResolvedValue({packageId,watermarkCode:'trace',expiresAt:new Date(Date.now()+3600000).toISOString()});
    videoApi.exchange.mockResolvedValue(playbackUrl);
    const {container}=render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    const video=await screen.findByLabelText('Meeting');
    const summary=screen.getByText(messages.description,{selector:'summary'}),details=summary.closest('details')!;
    const description=screen.getByText(/<script>alert/);
    expect(details.open).toBe(false);expect(description).not.toBeVisible();
    fireEvent.click(summary);expect(details.open).toBe(true);expect(description).toBeVisible();
    expect(description.textContent).toBe('<script>alert(1)</script>\nSunday gathering');
    expect(description).toHaveClass('whitespace-pre-wrap');expect(container.querySelector('script')).toBeNull();
    expect(screen.getByLabelText('Meeting')).toBe(video);
    fireEvent.click(summary);expect(details.open).toBe(false);expect(screen.getByLabelText('Meeting')).toBe(video);
    expect(videoApi.grant).toHaveBeenCalledTimes(1);
  });
  it('omits absent and empty recording descriptions',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue([{id:'r1',title:'Meeting'},{id:'r2',title:'Empty',description:''}]);
    const view=render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    await screen.findByRole('heading',{name:'Meeting'});expect(view.container.querySelector('details')).toBeNull();
    view.rerender(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r2"/>);
    await screen.findByRole('heading',{name:'Empty'});expect(view.container.querySelector('details')).toBeNull();
  });

  it('shows a live-only recording on its watch route without claiming unavailable or requesting VOD',async()=>{
    state.auth='authenticated';state.access='available';
    videoApi.liveList.mockResolvedValue([{id:'r1',captureId:'a'.repeat(32),title:'Sunday live',liveState:'starting',createdAt:'2026-10-07T00:00:00Z',stopAcceptedAt:null,progress:{revision:0,firstSequence:0,lastSequence:-1,mediaEndSeconds:0,lastAdvancedAt:null,endedAt:null,ended:false}}]);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
    expect(await screen.findByRole('heading',{name:'Sunday live'})).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(videoApi.grant).not.toHaveBeenCalled();
  });

  it('appends cursor batches, removes count and pagination, and keeps plain watch links',async()=>{
    state.auth='authenticated';state.access='available';
    const items=Array.from({length:15},(_,i)=>({id:`r${i}`,title:`Gathering ${i}`,uploadedAt:new Date(Date.UTC(2026,9,15-i)).toISOString()}));
    list.mockResolvedValue(items.slice(0,12));
    videoApi.listPage.mockResolvedValueOnce({items:items.slice(0,12),nextCursor:'next'}).mockResolvedValueOnce({items:[items[11],...items.slice(12)],nextCursor:null});
    render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    expect(await screen.findAllByRole('link',{name:/Gathering/})).toHaveLength(12);
    expect(screen.queryByRole('heading',{name:'Recent recordings'})).toBeNull();
    expect(screen.queryByText(/gatherings/)).toBeNull();
    expect(screen.getAllByRole('link',{name:/Gathering/})[0]).toHaveAttribute('href','/en/member-videos/r0');
    expect(screen.queryByRole('button',{name:'Next'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Load more'}));
    await waitFor(()=>expect(screen.getAllByRole('link',{name:/Gathering/})).toHaveLength(15));
    expect(screen.queryByRole('button',{name:'Load more'})).toBeNull();
    expect(videoApi.grant).not.toHaveBeenCalled();
  });
  it('keeps loaded cards after a failed next batch and retries the same cursor',async()=>{
    state.auth='authenticated';state.access='available';
    videoApi.listPage.mockResolvedValueOnce({items:[{id:'first',title:'First'}],nextCursor:'next'}).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({items:[{id:'second',title:'Second'}],nextCursor:null});
    render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    await screen.findByRole('link',{name:'First'});
    fireEvent.click(screen.getByRole('button',{name:'Load more'}));
    fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
    await screen.findByRole('link',{name:'Second'});
    expect(screen.getByRole('link',{name:'First'})).toBeVisible();
    expect(videoApi.listPage.mock.calls[1][0].cursor).toBe('next');expect(videoApi.listPage.mock.calls[2][0].cursor).toBe('next');
  });
  it('requests twelve items, prevents duplicate loads and aborts a pending batch on unmount',async()=>{
    state.auth='authenticated';state.access='available';
    videoApi.listPage.mockResolvedValueOnce({items:[{id:'first',title:'First'}],nextCursor:'next'}).mockImplementationOnce(()=>new Promise(()=>{}));
    const view=render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    await screen.findByRole('link',{name:'First'});
    const loadMore=screen.getByRole('button',{name:'Load more'});
    fireEvent.click(loadMore);fireEvent.click(loadMore);
    expect(videoApi.listPage).toHaveBeenCalledTimes(2);
    expect(videoApi.listPage.mock.calls[0][0].limit).toBe(12);
    const request=videoApi.listPage.mock.calls[1][0];
    expect(request).toMatchObject({limit:12,cursor:'next'});
    expect(request.signal.aborted).toBe(false);
    view.unmount();
    expect(request.signal.aborted).toBe(true);
  });
  it('continues after an empty batch and offers retry when its cursor does not advance',async()=>{
    state.auth='authenticated';state.access='available';
    videoApi.listPage.mockResolvedValueOnce({items:[],nextCursor:'next'}).mockResolvedValueOnce({items:[],nextCursor:'next'});
    render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    fireEvent.click(await screen.findByRole('button',{name:'Load more'}));
    expect(await screen.findByRole('button',{name:'Retry'})).toBeEnabled();
    expect(screen.queryByText('No recordings')).toBeNull();
    expect(videoApi.listPage).toHaveBeenCalledTimes(2);
  });
  it('uses a compact live label for recovering entries instead of exposing source recovery',async()=>{
    state.access='available';state.auth='authenticated';
    videoApi.liveList.mockResolvedValue([{id:'r1',captureId:packageId,title:'Recovering stream',liveState:'recovering',createdAt:'2026-10-07T00:00:00Z',progress:{mediaEndSeconds:120}}]);
    list.mockResolvedValue([]);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    expect(await screen.findByRole('link',{name:'Recovering stream — Live'})).toBeVisible();
    expect(screen.queryByText('Catching up')).not.toBeInTheDocument();
  });
  it('puts livestreams in the same grid before recordings and removes duplicate VOD cards',async()=>{
    state.auth='authenticated';state.access='available';
    const live={id:'r1',captureId:'a'.repeat(32),title:'Sunday live',liveState:'live',createdAt:'2026-10-07T00:00:00Z',stopAcceptedAt:null,progress:{revision:1,firstSequence:0,lastSequence:3,mediaEndSeconds:120,lastAdvancedAt:'2026-10-07T00:02:00Z',endedAt:null,ended:false}};
    videoApi.liveList.mockResolvedValue([live]);list.mockResolvedValue([{id:'r1',title:'Sunday live'},{id:'r2',title:'Earlier'}]);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} view="list"/>);
    await screen.findByRole('link',{name:'Earlier'});
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Sunday live');
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Live');
    expect(screen.getByRole('link',{name:'Sunday live — Live'})).toBeVisible();
    expect(screen.getAllByRole('article')[0].parentElement).toBe(screen.getAllByRole('article')[1].parentElement);
  });
  it('uses the requested video and limits other videos to the newest ten', async () => {
    state.auth='authenticated'; state.access='available';
    const items=Array.from({length: 15}, (_, i) => ({id:`r${i}`, title:`Gathering ${i}`, uploadedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`}));
    list.mockResolvedValue(items);
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r0"/>);
    await screen.findByRole('heading', {level:2, name:'Gathering 0'});
    const links=screen.getAllByRole('link', {name:/Gathering/});
    expect(links).toHaveLength(10);
    expect(links[0]).toHaveTextContent('Gathering 14');
    expect(links[9]).toHaveTextContent('Gathering 5');
    expect(screen.queryByRole('link', {name:'Recent recordings'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Next'})).not.toBeInTheDocument();
  });
  it('uses plain watch links throughout the sidebar',async()=>{
    state.auth='authenticated';state.access='available';
    list.mockResolvedValue(Array.from({length:13},(_,i)=>({id:`r${i}`,title:`Gathering ${i}`,uploadedAt:`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`})));
    render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r0"/>);
    await screen.findByRole('heading',{level:2,name:'Gathering 0'});
    for(const link of screen.getAllByRole('link',{name:/Gathering/}))expect(link.getAttribute('href')).not.toContain('?');
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
  it('excludes the selected recording without paginating the remaining cards', async () => {
    state.auth = 'authenticated'; state.access = 'available';
    const records = Array.from({length:18},(_,index)=>({id:`r-${index}`,title:`Recording ${index}`,uploadedAt:new Date(Date.UTC(2026,8,28-index)).toISOString(),expiresAt:'2026-10-28T02:00:00Z',status:'published',featured:false,hidden:false,version:1,packageId,durationSeconds:9000}));
    list.mockResolvedValue(records);
    render(<MemberVideoZone locale="en" messages={messages} hero={<h1>Member Videos</h1>} />);
    await screen.findByRole('heading',{level:2,name:'Recording 0'});
    expect(screen.getAllByRole('article')).toHaveLength(17);
    expect(screen.queryByRole('heading',{level:3,name:'Recording 0'})).not.toBeInTheDocument();
    expect(screen.queryByText(/2 hours 30 minutes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Available until/)).not.toBeInTheDocument();
    expect(screen.getByText('Uploaded: September 28, 2026')).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Next'})).toBeNull();
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

it('uses server video search batches and preserves source query without filtering watch recommendations',async()=>{
 state.auth='authenticated';state.access='available';
 videoApi.listPage.mockResolvedValue({items:[{id:'r1',title:'Faith meeting',description:'Hope together',uploadedAt:'2026-10-08T00:00:00Z'}],nextCursor:'next'});
 videoApi.liveList.mockResolvedValue([{id:'live',captureId:packageId,title:'Faith live',description:'Hope today',liveState:'live',createdAt:'2026-10-09T00:00:00Z'}]);
 render(<MemberVideoZone view="list" query="faith" locale="en" messages={{...messages,search:{results:'Results for {query}',empty:'No results for {query}',clear:'Clear search',back:'Back to search results',tooLong:'Invalid query'}}} hero={<div>Browse hero</div>}/>);
 await screen.findByRole('link',{name:'Faith meeting'});
 expect(videoApi.listPage).toHaveBeenCalledWith(expect.objectContaining({limit:12,q:'faith'}));
 expect(videoApi.liveList).toHaveBeenCalledWith(expect.any(AbortSignal),'faith');
 expect(screen.getByRole('heading',{name:'Results for faith'})).toBeInTheDocument();
 expect(screen.queryByText('Browse hero')).not.toBeInTheDocument();
 expect(screen.getByText('Hope together')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Faith meeting'})).toHaveAttribute('href','/en/member-videos/r1?q=faith');
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await waitFor(()=>expect(videoApi.listPage).toHaveBeenCalledWith(expect.objectContaining({cursor:'next',q:'faith'})));
});
it('does not query media for an invalid search and offers a clear action',async()=>{
 state.auth='authenticated';state.access='available';
 render(<MemberVideoZone view="list" query="bad" invalidQuery locale="en" messages={{...messages,search:{results:'Results for {query}',empty:'No results for {query}',clear:'Clear search',back:'Back to search results',tooLong:'Invalid query'}}} hero={null}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('Invalid query');
 expect(videoApi.listPage).not.toHaveBeenCalled();expect(videoApi.liveList).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('link',{name:'Clear search'}));
 expect(screen.getByRole('link',{name:'Clear search'})).toHaveAttribute('href','/en/member-videos');
});

it('aborts a previous query and rejects its late response after the query changes',async()=>{
 state.auth='authenticated';state.access='available';
 let finish!:(value:unknown)=>void;
 videoApi.listPage.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue({items:[{id:'r2',title:'Hope meeting'}],nextCursor:null});
 const {rerender}=render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 const previousSignal=videoApi.listPage.mock.calls[0][0].signal as AbortSignal;
 rerender(<MemberVideoZone view="list" query="hope" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'Hope meeting'});expect(previousSignal.aborted).toBe(true);
 await act(async()=>finish({items:[{id:'r1',title:'Old result'}],nextCursor:null}));
 expect(screen.queryByText('Old result')).not.toBeInTheDocument();
});
it('keeps watch selection and other recommendations independent of the source query',async()=>{
 state.auth='authenticated';state.access='available';
 list.mockResolvedValue([{id:'r1',title:'Selected'}, {id:'r2',title:'Other latest recording'}]);
 render(<MemberVideoZone query="faith" recordingId="r1" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('heading',{name:'Selected'});
 expect(videoApi.listPage).not.toHaveBeenCalled();expect(videoApi.liveList).toHaveBeenCalledWith(expect.any(AbortSignal),undefined);
 expect(screen.getByRole('link',{name:'Other latest recording'})).toHaveAttribute('href','/en/member-videos/r2?q=faith');
 const back=screen.getByRole('link',{name:'Back to search results'});expect(back).toHaveAttribute('href','/en/member-videos?q=faith');
 expect(screen.getByRole('heading',{name:'Selected'}).compareDocumentPosition(back)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('returns to the loaded depth by refetching fresh batches and restores a bounded position',async()=>{
 state.auth='authenticated';state.access='available';
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 videoApi.listPage.mockResolvedValueOnce({items:[{id:'r1',title:'First'}],nextCursor:'next'}).mockResolvedValueOnce({items:[{id:'r2',title:'Second'}],nextCursor:'tail'});
 const first=render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'First'});fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 const selected=await screen.findByRole('link',{name:'Second'});fireEvent.click(selected);first.unmount();
 videoApi.listPage.mockResolvedValueOnce({items:[{id:'r1',title:'First reread'}],nextCursor:'new-next'}).mockResolvedValueOnce({items:[{id:'r2',title:'Second reread'}],nextCursor:'new-tail'});
 render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'Second reread'});
 expect(screen.queryByRole('link',{name:'Second'})).not.toBeInTheDocument();
 await waitFor(()=>expect(window.scrollTo).toHaveBeenCalled());
 expect(videoApi.listPage).toHaveBeenCalledTimes(4);
 expect(videoApi.listPage.mock.calls[2][0]).toMatchObject({limit:12,q:'faith'});
 expect(videoApi.listPage.mock.calls[3][0]).toMatchObject({cursor:'new-next',q:'faith'});
});
it('repeats the same query with a fresh first page',async()=>{
 state.auth='authenticated';state.access='available';
 videoApi.listPage.mockResolvedValueOnce({items:[{id:'r1',title:'Before'}],nextCursor:'next'}).mockResolvedValueOnce({items:[{id:'r2',title:'After'}],nextCursor:null});
 render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'Before'});
 act(()=>window.dispatchEvent(new Event(videoSearchRefreshEvent)));
 await screen.findByRole('link',{name:'After'});
 expect(screen.queryByRole('link',{name:'Before'})).not.toBeInTheDocument();
 expect(videoApi.listPage.mock.calls[1][0]).not.toHaveProperty('cursor');
});

it('clears the old continuation while a same-query fresh head is pending',async()=>{
 state.auth='authenticated';state.access='available';
 let finish!:(value:unknown)=>void;
 videoApi.listPage.mockResolvedValueOnce({items:[{id:'old',title:'Before'}],nextCursor:'old-next'}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'Before'});
 act(()=>window.dispatchEvent(new Event(videoSearchRefreshEvent)));
 expect(screen.queryByRole('button',{name:'Load more'})).not.toBeInTheDocument();
 expect(videoApi.listPage).toHaveBeenCalledTimes(2);
 await act(async()=>finish({items:[{id:'new',title:'After'}],nextCursor:'fresh-next'}));
 await screen.findByRole('link',{name:'After'});
 videoApi.listPage.mockResolvedValueOnce({items:[],nextCursor:null});
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await waitFor(()=>expect(videoApi.listPage.mock.calls[2][0]).toHaveProperty('cursor','fresh-next'));
});
it('preserves a displaced head boundary and older continuation when live becomes a recording',async()=>{
 state.auth='authenticated';state.access='available';
 const record=(id:string,day:number)=>({id,title:id,uploadedAt:new Date(Date.UTC(2026,8,30-day)).toISOString()});
 const oldHead=Array.from({length:12},(_,i)=>record(`a${i+1}`,i+1));
 const older=Array.from({length:12},(_,i)=>record(`a${i+13}`,i+13));
 const completed=record('completed',0);
 videoApi.listPage.mockResolvedValueOnce({items:oldHead,nextCursor:'c12'}).mockResolvedValueOnce({items:older,nextCursor:'c24'}).mockResolvedValueOnce({items:[completed,...oldHead.slice(0,11)],nextCursor:'c11'}).mockResolvedValue({items:[],nextCursor:null});
 videoApi.liveList.mockResolvedValueOnce([{id:'completed',captureId:packageId,title:'Live before',liveState:'live'}]).mockResolvedValue([]);
 let poll:(()=>void)|undefined;
 const setTimeout=globalThis.setTimeout.bind(globalThis);
 vi.spyOn(window,'setTimeout').mockImplementation((callback,delay,...args)=>{
   if(delay===30000){poll=callback as ()=>void;return setTimeout(()=>{},30000);}
   return setTimeout(callback,delay,...args);
 });
 render(<MemberVideoZone view="list" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'a12'});fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await screen.findByRole('link',{name:'a24'});
 await waitFor(()=>expect(poll).toBeDefined());await act(async()=>poll!());
 await screen.findByRole('link',{name:'completed'});
 expect(screen.getByRole('link',{name:'a12'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'a24'})).toBeInTheDocument();
 expect(screen.queryByRole('link',{name:'Live before'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Load more'}));
 await waitFor(()=>expect(videoApi.listPage.mock.calls[3][0]).toHaveProperty('cursor','c24'));
});
it('waits for initial live rows before restoring the clicked anchor',async()=>{
 state.auth='authenticated';state.access='available';
 vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 list.mockResolvedValue([{id:'r1',title:'Recording'}]);
 const first=render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 fireEvent.click(await screen.findByRole('link',{name:'Recording'}));first.unmount();
 let finish!:(value:unknown)=>void;
 videoApi.liveList.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 render(<MemberVideoZone view="list" query="faith" locale="en" messages={messages} hero={null}/>);
 await screen.findByRole('link',{name:'Recording'});
 await new Promise(resolve=>window.setTimeout(resolve,50));
 expect(window.scrollTo).not.toHaveBeenCalled();
 await act(async()=>finish([{id:'live',captureId:packageId,title:'Late live',liveState:'live'}]));
 await screen.findByRole('link',{name:'Late live — Live'});
 await waitFor(()=>expect(window.scrollTo).toHaveBeenCalled());
});

it('retries VOD at the frozen pre-error position with the same rate, quality and playing intent',async()=>{
 state.auth='authenticated';state.access='available';list.mockResolvedValue([{id:'r1',title:'Meeting',packageId}]);
 videoApi.grant.mockResolvedValue({packageId,watermarkCode:'trace',expiresAt:new Date(Date.now()+3600000).toISOString()});videoApi.exchange.mockResolvedValue(playbackUrl);
 render(<MemberVideoZone locale="en" messages={messages} hero={null} recordingId="r1"/>);
 const video=await screen.findByLabelText('Meeting') as HTMLVideoElement;await waitFor(()=>expect(video).toHaveAttribute('src',playbackUrl));
 Object.defineProperty(video,'duration',{configurable:true,value:7200});fireEvent.loadedMetadata(video);video.currentTime=2820;video.playbackRate=1.5;Object.defineProperty(video,'paused',{configurable:true,value:false});fireEvent.play(video);fireEvent.timeUpdate(video);
 fireEvent.error(video);video.currentTime=0;fireEvent.pause(video);fireEvent.timeUpdate(video);vi.mocked(video.play).mockClear();
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));const resumed=await screen.findByLabelText('Meeting') as HTMLVideoElement;
 await waitFor(()=>expect(videoApi.grant).toHaveBeenCalledTimes(2));fireEvent.loadedMetadata(resumed);
 expect(resumed.currentTime).toBe(2820);expect(resumed.playbackRate).toBe(1.5);expect(resumed.play).toHaveBeenCalled();
});
