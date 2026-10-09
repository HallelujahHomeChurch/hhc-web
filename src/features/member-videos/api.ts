import {createHhcWebClient, type MemberLivePlayback, type MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import {createProtectedFetch} from '@/features/weekly/api';

type Authorization = {
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const mediaHosts = new Set(['media.alive.org.tw', 'media-test.alive.org.tw']);

const vodMediaPath = /^\/videos\/[a-zA-Z0-9-]{1,80}\/packages\/[a-f0-9]{32}\/sessions\/[a-zA-Z0-9-]{1,80}\/master\.m3u8$/;
const liveMediaPath = /^\/videos\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/captures\/[a-f0-9]{32}\/sessions\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/master\.m3u8$/;
function mediaCookieURL(mediaURL: string, mode: 'vod'|'live' = 'vod') {
  const media = new URL(mediaURL);
  if (media.protocol !== 'https:' || !mediaHosts.has(media.hostname) || media.port || media.username || media.password || !(mode==='live'?liveMediaPath:vodMediaPath).test(media.pathname) || media.search || media.hash) {
    throw new Error('Invalid media endpoint');
  }
  const cookie = new URL(media);
  cookie.pathname = media.pathname.replace(/\/master\.m3u8$/, '/cookie');
  return {media, cookie};
}

export function createMemberVideoApi(authorization: Authorization, fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
  const protectedFetch=createProtectedFetch(authorization,fetcher);
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => null, fetcher: protectedFetch});
  async function exchange(playback:Pick<MemberRecordingPlayback,'mediaUrl'|'exchangeCredential'>,mode:'vod'|'live',signal?:AbortSignal){
    const {media,cookie}=mediaCookieURL(playback.mediaUrl,mode);
    const response=await fetcher(cookie,{method:'POST',credentials:'include',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify({credential:playback.exchangeCredential}),signal});
    if(!response.ok)throw new Error(`Media authorization failed (${response.status})`);
    return media.toString();
  }
  async function clear(url:string,mode:'vod'|'live'){
    const {cookie}=mediaCookieURL(url,mode);
    await fetcher(cookie,{method:'DELETE',credentials:'include',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
  }
  return {
    async cover(id:string,signal?:AbortSignal) {
      const blob=await client.getMemberRecordingCover(id,signal);
      if(blob.type!=='image/jpeg'||blob.size>(1<<20)) throw new Error('Invalid recording cover');
      return blob;
    },
    listPage: (options: {limit?:number;cursor?:string;q?:string;signal?:AbortSignal}={})=>client.listMemberRecordingsPage(options),
    list: (signal?: AbortSignal) => client.listMemberRecordings(signal),
    grant: (id: string, scopeId: string, versionId?: string, signal?: AbortSignal) => client.issueRecordingPlayback(id, scopeId, versionId, signal),
    exchange: (playback: MemberRecordingPlayback, signal?:AbortSignal)=>exchange(playback,'vod',signal),
    async exchangeLive(playback:MemberLivePlayback,signal?:AbortSignal){
      const {media}=mediaCookieURL(playback.mediaUrl,'live');
      if(media.pathname!==`/videos/${playback.recordingId}/captures/${playback.captureId}/sessions/${playback.playbackScopeId}/master.m3u8`)throw new Error('Invalid media endpoint');
      return exchange(playback,'live',signal);
    },
    clear: (url:string)=>clear(url,'vod'),
    clearLive: (url:string)=>clear(url,'live'),
    liveList: (signal?:AbortSignal,q?:string)=>client.listMemberLivestreams({signal,q}),
    liveGrant:(id:string,captureId:string,scopeId:string,signal?:AbortSignal)=>client.issueLiveRecordingPlayback(id,captureId,scopeId,signal),
  };
}
