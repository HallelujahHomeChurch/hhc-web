import {createHhcWebClient, type MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import {createProtectedFetch} from '@/features/weekly/api';

type Authorization = {
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const mediaHosts = new Set(['media.alive.org.tw', 'media-test.alive.org.tw']);

function mediaCookieURL(mediaURL: string) {
  const media = new URL(mediaURL);
  if (media.protocol !== 'https:' || !mediaHosts.has(media.hostname) || media.port || media.username || media.password || !/^\/videos\/[a-zA-Z0-9-]{1,80}\/packages\/[a-f0-9]{32}\/sessions\/[a-zA-Z0-9-]{1,80}\/master\.m3u8$/.test(media.pathname) || media.search || media.hash) {
    throw new Error('Invalid media endpoint');
  }
  const cookie = new URL(media);
  cookie.pathname = media.pathname.replace(/\/master\.m3u8$/, '/cookie');
  return {media, cookie};
}

export function createMemberVideoApi(authorization: Authorization, fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
  const protectedFetch=createProtectedFetch(authorization,fetcher);
  const client = createHhcWebClient({baseUrl: '/api', getAccessToken: () => null, fetcher: protectedFetch});
  return {
    async cover(id:string,signal?:AbortSignal) {
      const blob=await client.getMemberRecordingCover(id,signal);
      if(blob.type!=='image/jpeg'||blob.size>(1<<20)) throw new Error('Invalid recording cover');
      return blob;
    },
    list: (signal?: AbortSignal) => client.listMemberRecordings(signal),
    grant: (id: string, scopeId: string, versionId?: string, signal?: AbortSignal) => client.issueRecordingPlayback(id, scopeId, versionId, signal),
    async exchange(playback: MemberRecordingPlayback, signal?: AbortSignal) {
      const {media, cookie} = mediaCookieURL(playback.mediaUrl);
      const response = await fetcher(cookie, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({credential: playback.exchangeCredential}),
        signal
      });
      if (!response.ok) throw new Error(`Media authorization failed (${response.status})`);
      return media.toString();
    },
    async clear(mediaURL: string) {
      const {cookie} = mediaCookieURL(mediaURL);
      await fetcher(cookie, {method: 'DELETE', credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer'});
    }
  };
}
