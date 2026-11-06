import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {HhcWebApiError, type MemberRecording, type MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import {captureHandledError} from '@/lib/observability';
import type {Locale} from '@/i18n/locales';
import type {createMemberVideoApi} from './api';
import {mapBroadcastBookmark} from './broadcast';
import {createPlaybackDiagnostics} from './playback-diagnostics';
import type {PlayerBookmark} from './live-player';

type ActivePlayback = {recordingId: string; scopeId: string; grant: MemberRecordingPlayback; url: string; backgroundAudio: boolean};
const readyAudio=(grant:MemberRecordingPlayback)=>grant.audio?.version==='aac-hls-v1'&&grant.audio.playlistPath==='audio/aac-hls-v1/index.m3u8';

type Options = {
  api: ReturnType<typeof createMemberVideoApi>;
  identity: ReturnType<typeof import('@/components/layout/AccountControl').useAccountIdentity>;
  locale: Locale;
  messages: {playError: string; expired: string};
  selected?: MemberRecording;
  recordings: MemberRecording[] | null;
  resolveMissing: (signal: AbortSignal) => Promise<void>;
  mediaOrigin: number | null;
  mediaDuration: number | null;
  startAt?: number;
};

export function useVodPlayback({api, identity, locale, messages, selected, recordings, resolveMissing, mediaOrigin, mediaDuration, startAt}: Options) {
  const currentApi = useRef(api);
  useLayoutEffect(() => { currentApi.current = api; }, [api]);
  const currentResolveMissing = useRef(resolveMissing);
  useLayoutEffect(() => { currentResolveMissing.current = resolveMissing; }, [resolveMissing]);
  const router = useRouter();
  const playerSection = useRef<HTMLDivElement>(null);
  const [vodResume,setVodResume]=useState<PlayerBookmark|undefined>(undefined);
  const [playback, setPlayback] = useState<ActivePlayback | null>(null);
  const playbackRef = useRef<ActivePlayback | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const media=useRef<HTMLMediaElement|null>(null);
  const playbackPause=useRef<(()=>void)|null>(null);
  const pausePlayback=useCallback(()=>{if(playbackPause.current){playbackPause.current();return;}media.current?.pause();if(video.current!==media.current)video.current?.pause();},[]);
  const diagnostic=useMemo(()=>createPlaybackDiagnostics(),[]),grantGeneration=useRef(0);
  const cookieOperations=useRef(Promise.resolve());
  const clearCookie=useCallback((url:string)=>{
    cookieOperations.current=cookieOperations.current.then(()=>currentApi.current.clear(url)).catch(()=>{});
  },[]);
  const exchangeCookie=useCallback((grant:MemberRecordingPlayback,signal:AbortSignal)=>{
    const operation=cookieOperations.current.then(async()=>{
      signal.throwIfAborted();
      diagnostic('exchange-start',media.current,grantGeneration.current);
      const url=await currentApi.current.exchange(grant,signal);
      diagnostic('exchange-end',media.current,grantGeneration.current);
      if(signal.aborted){await currentApi.current.clear(url).catch(()=>{});signal.throwIfAborted();}
      return url;
    });
    cookieOperations.current=operation.then(()=>{},()=>{});
    return operation;
  },[diagnostic]);
  const mediaFailureReported = useRef(false);
  const vodBookmark=useRef<PlayerBookmark|undefined>(undefined), bookmarkFrozen=useRef(false);
  const rememberVod=useCallback((value:PlayerBookmark)=>{if(!bookmarkFrozen.current)vodBookmark.current={...value,mediaOriginSeconds:mediaOrigin??0};},[mediaOrigin]);
  const [preparing, setPreparing] = useState(false);
  const [playError, setPlayError] = useState('');
  const attempt = useRef<AbortController | null>(null);
  const [audioFailureScope,setAudioFailureScope]=useState<string|null>(null),failedAudioScope=useRef<string|null>(null);
  const backgroundAudio=Boolean(playback?.backgroundAudio&&audioFailureScope!==playback?.scopeId);
  useEffect(()=>{bookmarkFrozen.current=false;},[backgroundAudio,playback?.url]);
  const audioUrl=playback&&backgroundAudio?new URL('audio/aac-hls-v1/index.m3u8',playback.url).href:undefined;
  const currentResume=useRef(vodResume);
  useEffect(()=>{currentResume.current=vodResume;},[vodResume]);
  const snapshotVod=useCallback(()=>{
    const current=media.current,saved=vodBookmark.current??currentResume.current;
    return current?{...saved,time:current.readyState?current.currentTime:saved?.time??current.currentTime,rate:current.readyState?current.playbackRate:saved?.rate??current.playbackRate,paused:saved?.paused??current.paused,quality:saved?.quality??'auto',intent:'dvr' as const}:saved;
  },[]);
  useEffect(() => {playbackRef.current = playback;}, [playback]);
  useEffect(() => () => {
    attempt.current?.abort();
    pausePlayback();
    if (playbackRef.current) clearCookie(playbackRef.current.url);
  }, [clearCookie,pausePlayback]);

  useEffect(()=>{vodBookmark.current=undefined;bookmarkFrozen.current=false;},[identity,selected?.id,selected?.packageId]);
  const stop = useCallback(() => {
    attempt.current?.abort();
    attempt.current = null;
    setPreparing(false);
    pausePlayback();
    if (playbackRef.current) clearCookie(playbackRef.current.url);
    playbackRef.current = null;
    setPlayback(null);
    setPlayError('');
  }, [clearCookie, pausePlayback]);

  const automaticAttempt = useRef<string|null>(null);
  const start = useCallback(async (resume?:PlayerBookmark, prepareProgress?: (kind: "resume" | "at", signal: AbortSignal) => Promise<number | undefined> | undefined) => {
    if (!selected || preparing) return false;
    automaticAttempt.current = selected.id;
    mediaFailureReported.current = false;
    bookmarkFrozen.current=true;
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    if (playbackRef.current) clearCookie(playbackRef.current.url);
    pausePlayback();
    playbackRef.current = null;
    setPlayback(null);
    setPreparing(true);
    setPlayError('');
    try {
      const savedPosition = await prepareProgress?.(startAt !== undefined || resume ? "at" : "resume", controller.signal);
      controller.signal.throwIfAborted();
      const initialTime = startAt ?? savedPosition;
      const scopeId = crypto.randomUUID();
      const grant = await currentApi.current.grant(selected.id, scopeId, selected.packageId, controller.signal);
      const url = await exchangeCookie(grant, controller.signal);
      if (!controller.signal.aborted) {bookmarkFrozen.current=false;diagnostic('accepted',media.current,++grantGeneration.current,(Date.parse(grant.expiresAt)-Date.now())/1000);setVodResume(resume?mapBroadcastBookmark(resume,mediaOrigin,mediaDuration):initialTime!==undefined?{time:Math.min(initialTime,selected.durationSeconds??initialTime),paused:false,rate:1,quality:'auto',intent:'dvr'}:undefined);const accepted={recordingId:selected.id,scopeId,grant,url,backgroundAudio:readyAudio(grant)};playbackRef.current=accepted;setPlayback(accepted);return true;}
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof HhcWebApiError && error.status === 401) {router.replace(`/${locale}`); return;}
        captureHandledError(error, {operation: 'member-videos.playback'});
        if (error instanceof HhcWebApiError && (error.status === 404 || error.status === 409 || error.status === 412)) {
          try { await currentResolveMissing.current(controller.signal); } catch { /* keep the player stopped and offer retry */ }
        }
        setPlayError(messages.playError);
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
    }
  }, [selected, preparing, locale, router, messages.playError,mediaOrigin,mediaDuration,startAt,clearCookie,exchangeCookie,diagnostic,pausePlayback]);

  const renew = useCallback(async (current: ActivePlayback, signal: AbortSignal) => {
    diagnostic('renew',media.current,grantGeneration.current);
    const grant = await currentApi.current.grant(current.recordingId, current.scopeId, current.grant.packageId, signal);
    const url = await exchangeCookie(grant, signal);
    if (url !== current.url) throw new Error('Media URL changed during renewal');
    const active=playbackRef.current;
    if (!signal.aborted&&active?.scopeId===current.scopeId) {
      const backgroundAudio=active.backgroundAudio&&readyAudio(grant);
      if(active.backgroundAudio&&!backgroundAudio&&failedAudioScope.current!==active.scopeId){
        const bookmark=snapshotVod();bookmarkFrozen.current=true;pausePlayback();setVodResume(bookmark);
      }
      const next={...active,grant,backgroundAudio};playbackRef.current=next;
      diagnostic('accepted',media.current,++grantGeneration.current,(Date.parse(grant.expiresAt)-Date.now())/1000);setPlayback(next);
    }
  }, [snapshotVod,exchangeCookie,diagnostic,pausePlayback]);

  const recordingDeadline = recordings?.find(item => item.id === playback?.recordingId)?.expiresAt;
  useEffect(() => {
    if (!playback) return;
    const controller = new AbortController();
    const expiry = Date.parse(playback.grant.expiresAt);
    const deadline = Date.parse(recordingDeadline ?? '');
    const canRenew = !Number.isFinite(deadline) || expiry < deadline;
    const renewalAt = Math.min(Date.now() + 45 * 60_000, expiry - 10 * 60_000);
    let timer = 0;
    let inFlight = false;
    const expire = () => {
      if(playbackRef.current?.grant!==playback.grant)return;
      diagnostic('expired',media.current,grantGeneration.current);
      controller.abort();
      pausePlayback();
      clearCookie(playback.url);
      playbackRef.current = null;
      setPlayback(null);
      setPlayError(messages.expired);
    };
    const expiryTimer = window.setTimeout(expire, Math.max(0,expiry-Date.now()));
    const run = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;window.clearTimeout(timer);
      try {
        await renew(playback, controller.signal);
        if (!controller.signal.aborted) setPlayError('');
      } catch (error) {
        if (controller.signal.aborted) return;
        captureHandledError(error, {operation: 'member-videos.renew'});
        if (error instanceof HhcWebApiError && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409 || error.status === 412)) {
          pausePlayback();
          clearCookie(playback.url);
          diagnostic('denied',media.current,grantGeneration.current);playbackRef.current=null;setPlayback(null);setPlayError(messages.playError);
          if (error.status === 401) router.replace(`/${locale}`);
          else try { await currentResolveMissing.current(controller.signal); } catch { /* retry remains available */ }
        } else if (Date.now() >= expiry) {
          pausePlayback();
          clearCookie(playback.url);
          playbackRef.current=null;setPlayback(null);
        } else {
          timer = window.setTimeout(() => void run(), 60_000);
        }
        setPlayError(messages.playError);
      } finally {
        inFlight = false;
      }
    };
    if (canRenew) timer = window.setTimeout(() => void run(), Math.max(1_000, renewalAt - Date.now()));
    const visible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() >= expiry) { expire(); return; }
      if (canRenew && Date.now() >= renewalAt) {
        window.clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('online', visible);
    return () => {controller.abort(); window.clearTimeout(timer); window.clearTimeout(expiryTimer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', visible);};
  }, [locale, messages.playError, messages.expired, playback, recordingDeadline, renew, router,clearCookie,diagnostic,pausePlayback]);

  useEffect(()=>{
    const section=playerSection.current;if(!section)return;
    const events=['loadedmetadata','waiting','stalled','playing','pause','ratechange','seeking','seeked','timeupdate'] as const;
    // Media events do not bubble; capture lets diagnostics follow the current owner after handoff.
    const handlers=events.map(event=>{const handler=(value:Event)=>{if(value.target===media.current)diagnostic(event,media.current,grantGeneration.current);};section.addEventListener(event,handler,true);return()=>section.removeEventListener(event,handler,true);});
    const visible=()=>diagnostic('visibility',media.current,grantGeneration.current);document.addEventListener('visibilitychange',visible);
    return()=>{for(const remove of handlers)remove();document.removeEventListener('visibilitychange',visible);};
  },[backgroundAudio,playback?.url,diagnostic]);

  const mediaError = useCallback((bookmark?:PlayerBookmark) => {
    diagnostic('error',media.current,grantGeneration.current);
    if(!bookmarkFrozen.current){if(bookmark)vodBookmark.current={...bookmark,mediaOriginSeconds:mediaOrigin??0};bookmarkFrozen.current=true;}
    pausePlayback();
    const current=playbackRef.current;
    if(current?.backgroundAudio&&failedAudioScope.current!==current.scopeId){
      setVodResume(bookmark??vodBookmark.current);bookmarkFrozen.current=false;
      // Keep transport fallback separate from authority so in-flight renewal is not aborted.
      failedAudioScope.current=current.scopeId;setAudioFailureScope(current.scopeId);return;
    }
    setPlayError(messages.playError);
    if (!mediaFailureReported.current) {
      mediaFailureReported.current = true;
      captureHandledError(new Error('Member video media playback failed'), {operation: 'member-videos.media'});
    }
  }, [messages.playError,mediaOrigin,diagnostic,pausePlayback]);

  return {playback, video, media, playbackPause, vodResume, preparing, playError,
    playerSection, automaticAttempt, vodBookmark, backgroundAudio, audioUrl, rememberVod, mediaError, start, stop};
}
