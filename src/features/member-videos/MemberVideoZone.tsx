'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {LoadMoreTrigger} from '@hallelujahhomechurch/ui';
import zoneStyles from './MemberVideoZone.module.css';
import {LoaderCircle, Play} from 'lucide-react';
import type {MemberLiveRecording, MemberRecording, MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {useAccountAuth, useAccountIdentity, useBulletinAuthorization, useVideoAccess} from '@/components/layout/AccountControl';
import type {Locale} from '@/i18n/locales';
import {captureHandledError} from '@/lib/observability';
import {createMemberVideoApi} from './api';
import {videoSearchHref,videoSearchRefreshEvent,type VideoSearchLabels} from './search';
import {VideoInformation} from './VideoInformation';
import {VideoInteractions} from './VideoInteractions';
import {usePlaybackTelemetry} from './usePlaybackTelemetry';
import {HlsPlayer, type PlayerLabels} from './HlsPlayer';

import {playerClock} from './PlayerChrome';
import {LiveRecordingCover,RecordingCover,useRecordingCover} from './RecordingCover';
import {LiveRecordingPlayer,liveViewerLabel,englishLiveLabels,type LiveLabels} from './LiveRecordingPlayer';
import type {PlayerBookmark} from './live-player';
import {useBroadcastWatch} from './useBroadcastWatch';
import {BroadcastWaitingPanel} from './BroadcastWaitingPanel';
import {mapBroadcastBookmark} from './broadcast';
import {liveLibraryItems} from './video-library';
import {UpcomingBroadcasts} from './UpcomingBroadcasts';
import {VideoListSkeleton, VideoRecommendationsSkeleton, VideoWatchSkeleton} from './VideoLoading';
import {LoadingStatus} from '@/components/ui/ContentLoading';
import {ThumbnailPreview} from './ThumbnailPreview';
import {clearLineVideoTarget, rememberLineVideoTarget} from '@/lib/line-browser-handoff';

export type Messages = {
  live?: LiveLabels;
  search?: VideoSearchLabels;
  backToList?: string; otherVideos?: string; unavailable?: string;
  selectedTitle: string; listTitle: string; count: string; play: string; select: string; selected: string;
  playing: string; featured: string; durationUnknown: string; expires: string; loading: string;
  preparing: string; empty: string; loadError: string; playError: string; expired: string;
  retry: string; previous: string; next: string; loadMore?:string; liveStartedDate?:string; uploadedDate: string; description: string;
} & PlayerLabels;
type ActivePlayback = {recordingId: string; scopeId: string; grant: MemberRecordingPlayback; url: string};
const pageSize = 12;
// Default automatic covers belong to the immutable recording package.
const coverRevision=(recording:MemberRecording|undefined)=>recording?.selectedCoverId||(recording?.packageId?`auto:${recording.packageId}`:undefined);
type ZoneProps = {startAt?:number;locale: Locale; messages: Messages; hero: ReactNode; view?: 'list' | 'watch'; recordingId?: string;query?: string;invalidQuery?: boolean};

function newestFirst(items: MemberRecording[]) {
  return [...items].sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '') || b.id.localeCompare(a.id));
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric'}).format(new Date(value));
}

export function MemberVideoZone({locale, messages, hero, view = 'watch', recordingId, query = '', invalidQuery = false,startAt}: ZoneProps) {
  const router = useRouter();
  const auth = useAccountAuth();
  const identity=useAccountIdentity();
  const access = useVideoAccess();
  useEffect(() => {
    if (auth.status === 'anonymous') rememberLineVideoTarget();
    if (auth.status === 'authenticated') clearLineVideoTarget();
    if (auth.status === 'anonymous' || access === 'denied') router.replace(`/${locale}`);
  }, [access, auth.status, locale, router]);
  if (access === 'available') return <AuthorizedVideoZone startAt={startAt} key={`${identity}:${recordingId ?? view}:${view==='list'?`${query}:${invalidQuery}`:''}`} locale={locale} messages={messages} hero={hero} view={view} recordingId={recordingId} query={query} invalidQuery={invalidQuery} />;
  if (auth.status === 'anonymous' || access === 'denied') return null;
  const unavailable = auth.status === 'unavailable' || access === 'unavailable';
  if (!unavailable) return <main><div className={`${recordingId?'':'bg-[image:var(--hhc-page-gradient)]'} ${recordingId ? zoneStyles.watchPage : 'py-10'}`}><section className={`${zoneStyles.zone} ${recordingId ? zoneStyles.watch : query ? zoneStyles.search : zoneStyles.library}`}>{recordingId ? <VideoWatchSkeleton label={messages.loading}/> : <VideoListSkeleton label={messages.loading} search={Boolean(query)}/>}</section></div></main>;
  return <main className="bg-[image:var(--hhc-page-gradient)] py-16"><section className="shell rounded-[14px] border border-panel-border bg-panel p-8 text-center text-ink" role={unavailable ? 'alert' : 'status'}>{unavailable ? messages.loadError : messages.loading}{unavailable ? <button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => window.location.reload()}>{messages.retry}</button> : null}</section></main>;
}

function AuthorizedVideoZone({locale, messages, hero, view, recordingId, query = '', invalidQuery = false,startAt}: ZoneProps) {
  const router = useRouter();
  const authorization = useBulletinAuthorization();
  const identity = useAccountIdentity();
  const batchesRef = useRef(0);
  const previousLiveIDs = useRef(new Set<string>());
  const listGeneration = useRef(0);
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [upcomingPresent,setUpcomingPresent]=useState<boolean|null>(null);
  const [hoveredRecording,setHoveredRecording]=useState<string|null>(null);
 const [upcomingState,setUpcomingState]=useState<{ids:string[];complete:boolean;initialState:'loading'|'ready'|'error'}>({ids:[],complete:false,initialState:'loading'});
  const [recordings, setRecordings] = useState<MemberRecording[] | null>(null);
  const [livestreams,setLivestreams]=useState<MemberLiveRecording[]>([]);
  const [vodChosen,setVodChosen]=useState(false);
  const [vodResume,setVodResume]=useState<PlayerBookmark|undefined>(undefined);
  const [legacySelectedLive,setSelectedLive]=useState<MemberLiveRecording|null>(null);
  const [retry, setRetry] = useState(0);
  const resolver=useBroadcastWatch(api,recordingId,retry);
  const watch=resolver.watch;
  const mediaOrigin=watch?.mediaStartSeconds??null,mediaDuration=watch?.durationSeconds??null;
  const selectedLive=resolver.denied||vodChosen||recordingId&&!watch?null:watch?watch.live??(['processing','vod'].includes(watch.view)?resolver.lastLive:null):legacySelectedLive;
  const waitingWatch=watch&&!['live','vod'].includes(watch.view)?watch:null;
  const [liveError,setLiveError]=useState(false);
  const [livePending,setLivePending]=useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [moreLoading,setMoreLoading]=useState(false),[moreError,setMoreError]=useState(false);
  const moreAttempt=useRef<AbortController|null>(null), morePending=useRef(false);
  const [playback, setPlayback] = useState<ActivePlayback | null>(null);
  const playbackRef = useRef<ActivePlayback | null>(null);
  const mediaFailureReported = useRef(false);
  const vodBookmark=useRef<PlayerBookmark|undefined>(undefined), bookmarkFrozen=useRef(false);
  const rememberVod=useCallback((value:PlayerBookmark)=>{if(!bookmarkFrozen.current)vodBookmark.current={...value,mediaOriginSeconds:mediaOrigin??0};},[mediaOrigin]);
  const [preparing, setPreparing] = useState(false);
  const [playError, setPlayError] = useState('');
  const attempt = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playerTitle = useRef<HTMLHeadingElement>(null);
  const playerSection = useRef<HTMLDivElement>(null);

  const resolveMissing = useCallback(async (signal: AbortSignal) => {
    try {
      const items = newestFirst(await api.list(signal));
      if (signal.aborted) return;
      setRecordings(items);
      setSelectedId((current) => recordingId ? (items.some(item => item.id === recordingId) ? recordingId : null) : view === 'list' ? null : current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof HhcWebApiError && error.status === 404) {
        setRecordings(null);
        router.replace(`/${locale}`);
      } else if (error instanceof HhcWebApiError && error.status === 401) {
        router.replace(`/${locale}`);
      } else {
        throw error;
      }
    }
  }, [api, locale, router, recordingId, view]);

  useEffect(() => {
    if(view==='list'&&invalidQuery)return;
    const controller = new AbortController();
    const generation = ++listGeneration.current;
    moreAttempt.current?.abort();morePending.current=false;
    const request = view === 'list' ? api.listPage({limit:pageSize,q:query||undefined,signal:controller.signal}) : api.list(controller.signal).then(items=>({items,nextCursor:null}));
    request.then(({items,nextCursor}) => {
      if (controller.signal.aborted || generation!==listGeneration.current) return;
      const sorted = newestFirst(items);
      batchesRef.current=1;
      setRecordings(sorted);
      setNextCursor(nextCursor);setMoreLoading(false);setMoreError(false);
      setSelectedId((current) => recordingId ? (sorted.some(item => item.id === recordingId) ? recordingId : null) : view === 'list' ? null : current && sorted.some((item) => item.id === current) ? current : sorted[0]?.id ?? null);
      setLoadError(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted || generation!==listGeneration.current) return;
      if (error instanceof HhcWebApiError && error.status === 401) {router.replace(`/${locale}`); return;}
      captureHandledError(error, {operation: 'member-videos.list'});
      setLoadError(true);
    });
    return () => {controller.abort();moreAttempt.current?.abort();morePending.current=false;};
  }, [api, locale, retry, router, recordingId, view, query, invalidQuery]);

  const loadMore=useCallback(async()=>{
    if(nextCursor===null||morePending.current)return;
    morePending.current=true;setMoreLoading(true);setMoreError(false);
    const controller=new AbortController();moreAttempt.current=controller;
    try {
      const page=await api.listPage({limit:pageSize,cursor:nextCursor,q:query||undefined,signal:controller.signal});
      if(controller.signal.aborted)return;
      if(page.nextCursor===nextCursor)throw new Error('Recording cursor did not advance');
      setRecordings(current=>{const items=new Map((current??[]).map(item=>[item.id,item]));for(const item of page.items)items.set(item.id,item);return [...items.values()];});
      setNextCursor(page.nextCursor);batchesRef.current+=1;
    } catch(error) {
      if(controller.signal.aborted)return;
      if(error instanceof HhcWebApiError&&error.status===401){router.replace(`/${locale}`);return;}
      captureHandledError(error,{operation:'member-videos.load-more'});setMoreError(true);
    } finally {if(!controller.signal.aborted){morePending.current=false;setMoreLoading(false);}}
  },[api,nextCursor,locale,router,query]);

  useEffect(()=>{
    if(view!=='list')return;
    const refresh=()=>{
      ++listGeneration.current;moreAttempt.current?.abort();morePending.current=false;
      setRecordings(null);setNextCursor(null);
      batchesRef.current=0;setMoreLoading(false);setMoreError(false);setLoadError(false);setRetry(value=>value+1);
    };
    window.addEventListener(videoSearchRefreshEvent,refresh);
    return()=>window.removeEventListener(videoSearchRefreshEvent,refresh);
  },[view]);


  useEffect(()=>{
    if(view==='list'&&invalidQuery)return;
    const controller=new AbortController();let timer=0;
    const load=async()=>{
      try{
        const items=await api.liveList(controller.signal,view==='list'?query||undefined:undefined);
        if(controller.signal.aborted)return;
        setLivestreams(items);setLiveError(false);
        const currentIDs=new Set(items.map(item=>item.id));
        const removedLive=view==='list'&&[...previousLiveIDs.current].some(id=>!currentIDs.has(id));
        previousLiveIDs.current=currentIDs;
        if(removedLive){
          const generation=++listGeneration.current;
          const head=await api.listPage({limit:pageSize,q:query||undefined,signal:controller.signal});
          if(controller.signal.aborted)return;
          if(generation===listGeneration.current){
            const tail=newestFirst(head.items).at(-1);
            const headIDs=new Set(head.items.map(item=>item.id));
            setRecordings(current=>newestFirst([...head.items,...(batchesRef.current>1&&head.nextCursor&&tail ? (current??[]).filter(item=>!headIDs.has(item.id)&&((item.uploadedAt??'').localeCompare(tail.uploadedAt??'')<0||item.uploadedAt===tail.uploadedAt&&item.id.localeCompare(tail.id)<0)) : [])]));
            setNextCursor(current=>batchesRef.current>1?current:head.nextCursor);
          }
        }
        const current=items.find(item=>item.id===recordingId);
        // Keep a stopped event mounted for its already registered viewer scope.
        if(current&&!vodChosen)setSelectedLive(previous=>previous&&previous.captureId!==current.captureId?previous:current);
        if(recordingId){
          const recordings=await api.list(controller.signal);
          if(controller.signal.aborted)return;
          setRecordings(newestFirst(recordings));
          setSelectedId(recordings.some(item=>item.id===recordingId)?recordingId:null);
        }
      }catch{if(!controller.signal.aborted)setLiveError(true);}
      finally{if(!controller.signal.aborted){setLivePending(false);timer=window.setTimeout(()=>void load(),30000);}}
    };
    void load();return()=>{controller.abort();window.clearTimeout(timer);};
  },[api,recordingId,retry,view,query,invalidQuery,vodChosen]);

  useEffect(() => {playbackRef.current = playback;}, [playback]);
  useEffect(() => () => {
    attempt.current?.abort();
    video.current?.pause();
    if (playbackRef.current) void api.clear(playbackRef.current.url).catch(() => {});
  }, [api]);

  const selected = resolver.denied ? undefined : recordingId ? watch?.recording??undefined : recordings?.find((recording) => recording.id === selectedId);
  useEffect(()=>{vodBookmark.current=undefined;bookmarkFrozen.current=false;},[identity,selected?.id,selected?.packageId]);
  const poster=useRecordingCover(api,selected?.id,selected?.expiresAt,coverRevision(selected));
  const select = (id: string) => {
    if (id === selectedId) return;
    attempt.current?.abort();
    attempt.current = null;
    setPreparing(false);
    video.current?.pause();
    if (playbackRef.current) void api.clear(playbackRef.current.url).catch(() => {});
    playbackRef.current = null;
    setPlayback(null);
    setPlayError('');
    setSelectedId(id);
    queueMicrotask(() => {
      playerTitle.current?.focus({preventScroll: true});
      playerSection.current?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    });
  };

  const automaticAttempt = useRef<string|null>(null);
  const start = useCallback(async (resume?:PlayerBookmark) => {
    if (!selected || preparing) return false;
    automaticAttempt.current = selected.id;
    mediaFailureReported.current = false;
    bookmarkFrozen.current=true;
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    if (playbackRef.current) void api.clear(playbackRef.current.url).catch(() => {});
    video.current?.pause();
    playbackRef.current = null;
    setPlayback(null);
    setPreparing(true);
    setPlayError('');
    try {
      const scopeId = crypto.randomUUID();
      const grant = await api.grant(selected.id, scopeId, selected.packageId, controller.signal);
      const url = await api.exchange(grant, controller.signal);
      if (!controller.signal.aborted) {bookmarkFrozen.current=false;setVodResume(resume?mapBroadcastBookmark(resume,mediaOrigin,mediaDuration):startAt!==undefined?{time:Math.min(startAt,selected.durationSeconds??startAt),paused:false,rate:1,quality:'auto',intent:'dvr'}:undefined);setPlayback({recordingId: selected.id, scopeId, grant, url});return true;}
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof HhcWebApiError && error.status === 401) {router.replace(`/${locale}`); return;}
        captureHandledError(error, {operation: 'member-videos.playback'});
        if (error instanceof HhcWebApiError && (error.status === 404 || error.status === 409 || error.status === 412)) {
          try { await resolveMissing(controller.signal); } catch { /* keep the player stopped and offer retry */ }
        }
        setPlayError(messages.playError);
      }
    } finally {
      if (!controller.signal.aborted) setPreparing(false);
    }
  }, [selected, preparing, api, locale, router, resolveMissing, messages.playError,mediaOrigin,mediaDuration,startAt]);

  useEffect(() => {
    if (!recordingId || !selected || selectedLive || waitingWatch || resolver.denied || automaticAttempt.current === selected.id) return;
    void start();
  }, [recordingId, selected, selectedLive, waitingWatch, resolver.denied, start]);

  const renew = useCallback(async (current: ActivePlayback, signal: AbortSignal) => {
    const grant = await api.grant(current.recordingId, current.scopeId, current.grant.packageId, signal);
    const url = await api.exchange(grant, signal);
    if (url !== current.url) throw new Error('Media URL changed during renewal');
    if (!signal.aborted) setPlayback((active) => active?.scopeId === current.scopeId ? {...active, grant} : active);
  }, [api]);

  useEffect(() => {
    if (!playback) return;
    const controller = new AbortController();
    const expiry = Date.parse(playback.grant.expiresAt);
    const deadline = Date.parse(recordings?.find(item => item.id === playback.recordingId)?.expiresAt ?? '');
    const canRenew = !Number.isFinite(deadline) || expiry < deadline;
    const renewalAt = Math.min(Date.now() + 45 * 60_000, expiry - 10 * 60_000);
    let timer = 0;
    let inFlight = false;
    const expire = () => {
      controller.abort();
      video.current?.pause();
      void api.clear(playback.url).catch(() => {});
      playbackRef.current = null;
      setPlayback(null);
      setPlayError(messages.expired);
    };
    const expiryTimer = window.setTimeout(expire, Math.max(0,expiry-Date.now()));
    const run = async () => {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        await renew(playback, controller.signal);
        if (!controller.signal.aborted) setPlayError('');
      } catch (error) {
        if (controller.signal.aborted) return;
        captureHandledError(error, {operation: 'member-videos.renew'});
        if (error instanceof HhcWebApiError && (error.status === 401 || error.status === 404 || error.status === 409 || error.status === 412)) {
          video.current?.pause();
          void api.clear(playback.url).catch(() => {});
          if (error.status === 401) router.replace(`/${locale}`);
          else try { await resolveMissing(controller.signal); } catch { /* retry remains available */ }
          setPlayback(null);
        } else if (Date.now() >= expiry) {
          video.current?.pause();
          void api.clear(playback.url).catch(() => {});
          setPlayback(null);
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
  }, [api, locale, messages.playError, messages.expired, playback, recordings, renew, resolveMissing, router]);

  const mediaError = useCallback((bookmark?:PlayerBookmark) => {
    if(!bookmarkFrozen.current){if(bookmark)vodBookmark.current={...bookmark,mediaOriginSeconds:mediaOrigin??0};bookmarkFrozen.current=true;}
    video.current?.pause();
    setPlayError(messages.playError);
    if (!mediaFailureReported.current) {
      mediaFailureReported.current = true;
      captureHandledError(new Error('Member video media playback failed'), {operation: 'member-videos.media'});
    }
  }, [messages.playError,mediaOrigin]);

  const selectedIndex = recordings?.findIndex(item => item.id === selectedId) ?? -1;
  const previousRecording = selectedIndex > 0 ? recordings?.[selectedIndex - 1] : undefined;
  const nextRecording = selectedIndex >= 0 ? recordings?.[selectedIndex + 1] : undefined;
  const liveItems = liveLibraryItems(livestreams).filter(item=>item.id!==recordingId);
  const activeLiveIds = new Set(liveItems.map(item=>item.id));
  const otherRecordings = recordings?.filter(item => item.id !== selectedId && !activeLiveIds.has(item.id)&&!upcomingState.ids.includes(item.id)) ?? [];
  const visibleItems = recordingId ? otherRecordings.slice(0, 10) : otherRecordings;
  const recommendationsPending = Boolean(recordingId) && !visibleItems.length && !liveItems.length && (recordings === null && !loadError || livePending);
  const liveLabels=messages.live??englishLiveLabels;
  const cardLink=(id:string)=>`/${locale}/member-videos/${encodeURIComponent(id)}`;
  usePlaybackTelemetry(api,selected?.id,video,Boolean(playback&&!selectedLive&&!resolver.denied));
  const searchMode=view==='list'&&Boolean(query||invalidQuery);
  const searchLabels=messages.search??{results:'Results for {query}',empty:'No results for {query}',clear:'Clear search',tooLong:'Search accepts one query of up to 100 characters.'};
  const liveBadge=(item:MemberLiveRecording)=>liveViewerLabel(item.liveState,liveLabels);
  const inlineRecommendations=Boolean(recordingId&&(selected||selectedLive||waitingWatch)&&!resolver.denied);
  const recommendations=liveItems.length>0||visibleItems.length>0||view==='list'&&!invalidQuery||recordingId&&watch&&!resolver.denied&&(recommendationsPending||loadError||liveError) ? <div className={zoneStyles.results}>
            {recordingId ? <h2 className="sr-only">{messages.otherVideos??messages.listTitle}</h2>:null}
            {recordingId&&watch&&recommendationsPending?<LoadingStatus label={messages.loading}/>:null}
            {recordingId&&watch&&!recommendationsPending&&(loadError||liveError)?<p role="status" className="text-sm text-muted">{messages.loadError} <button type="button" className="min-h-11 cursor-pointer text-primary underline" onClick={()=>setRetry(value=>value+1)}>{messages.retry}</button></p>:null}
            <div className={recordingId ? zoneStyles.recommendations : searchMode ? zoneStyles.searchList : zoneStyles.grid}>
              {recordingId&&watch&&recommendationsPending?<VideoRecommendationsSkeleton/>:null}
              {liveItems.map(item=><article id={`recording-${item.id}`} key={item.captureId} className={zoneStyles.card}>
                <Link href={cardLink(item.id)} className={zoneStyles.thumbnail} tabIndex={-1} aria-hidden="true">
                  <ThumbnailPreview api={api} recording={item} labels={messages} enabled={view==='list'} activeId={hoveredRecording} onActive={setHoveredRecording}>
                  <LiveRecordingCover api={api} recording={item}/>
                  </ThumbnailPreview>
                  <span className={`${zoneStyles.badge} ${item.liveState==='live'?zoneStyles.liveBadge:zoneStyles.stateBadge}`}>{liveBadge(item)}</span>
                </Link>
                <div className={zoneStyles.info}><h3 className={zoneStyles.title}><Link href={cardLink(item.id)} aria-label={`${item.title} — ${liveBadge(item)}`}>{item.title}</Link></h3><p className={zoneStyles.date}>{(messages.liveStartedDate??'{date}').replace('{date}',formatDate(item.startedAt??item.createdAt,locale))}</p>{searchMode&&item.description?<p className={zoneStyles.summary}>{item.description}</p>:null}</div>
              </article>)}
              {view==='list'&&!invalidQuery&&!loadError&&livePending?<VideoListSkeleton label={messages.loading} search={searchMode}/>:null}
              {view==='list'&&!invalidQuery?<UpcomingBroadcasts api={api} locale={locale} onPresenceChange={setUpcomingPresent} query={query} excludeIds={liveItems.map(item=>item.id)} onPageState={setUpcomingState} loadMoreLabel={messages.loadMore??'Load more'} loading={messages.loading} retry={messages.retry}/>:null}
              {view==='list'&&!invalidQuery&&!loadError&&!livePending&&(!recordings||upcomingState.initialState==='loading')?<VideoListSkeleton label={messages.loading} search={searchMode}/>:null}
              {(view!=='list'||upcomingState.complete&&!livePending?visibleItems:[]).map(item=><article id={`recording-${item.id}`} key={item.id} className={zoneStyles.card}>
                <Link href={cardLink(item.id)} className={zoneStyles.thumbnail} tabIndex={-1} aria-hidden="true">
                  <ThumbnailPreview api={api} recording={item} labels={messages} enabled={view==='list'} activeId={hoveredRecording} onActive={setHoveredRecording}>
                  <RecordingCover api={api} id={item.id} title={item.title} expiresAt={item.expiresAt} revision={coverRevision(item)}/>
                  </ThumbnailPreview>
                  {item.durationSeconds ? <span className={zoneStyles.duration}>{playerClock(item.durationSeconds)}</span>:null}
                </Link>
                <div className={zoneStyles.info}><h3 className={zoneStyles.title}>{view==='list'||recordingId ? <Link href={cardLink(item.id)}>{item.title}</Link>:item.title}</h3><p className={zoneStyles.date}>{formatDate(item.uploadedAt,locale)}</p>{searchMode&&item.description?<p className={zoneStyles.summary}>{item.description}</p>:null}
                  {view!=='list'&&!recordingId ? <button type="button" className="min-h-11 justify-self-start text-primary underline focus-visible:outline-2 focus-visible:outline-primary" onClick={()=>select(item.id)}>{messages.select}</button>:null}
                </div>
              </article>)}
            </div>
            {view==='list'&&upcomingState.complete ? <LoadMoreTrigger hasMore={nextCursor!==null} loading={moreLoading} error={moreError} onLoadMore={loadMore} labels={{loadMore:messages.loadMore??'Load more',loading:messages.loading,retry:messages.retry}}/>:null}
          </div>:view==='list'&&nextCursor!==null ? <LoadMoreTrigger hasMore loading={moreLoading} error={moreError} onLoadMore={loadMore} labels={{loadMore:messages.loadMore??'Load more',loading:messages.loading,retry:messages.retry}}/>:null;
  return (
    <main>
      {!searchMode?hero:null}
      <div className={`${recordingId?'':'bg-[image:var(--hhc-page-gradient)]'} pb-14 ${recordingId ? zoneStyles.watchPage : 'py-10'}`}>
        <section className={`${zoneStyles.zone} ${recordingId ? zoneStyles.watch : searchMode ? zoneStyles.search : zoneStyles.library}`} aria-label={messages.listTitle}>
          {searchMode ? <h1 className={zoneStyles.searchHeading}>{searchLabels.results.replace('{query}',query)}</h1>:null}
          {invalidQuery&&view==='list' ? <div role="alert" className="text-ink">{searchLabels.tooLong} <Link href={videoSearchHref(locale,'')} className="underline">{searchLabels.clear}</Link></div>:null}
          {recordingId && resolver.denied ? <p role="alert" className="text-ink">{messages.unavailable ?? messages.expired}</p> : null}
          {(loadError || recordingId && resolver.error && !resolver.denied) && !watch ? <div role="alert" className="rounded-[14px] border border-panel-border bg-panel p-7 text-center text-ink">{messages.loadError}<button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => setRetry((value) => value + 1)}>{messages.retry}</button></div> : null}
          {recordingId && !loadError && !resolver.error && !resolver.denied && !watch ? <VideoWatchSkeleton label={messages.loading} recommendations={recommendationsPending}/> : null}
          {!loadError && !livePending && !liveError && recordings?.length === 0 && nextCursor===null && !livestreams.length && !selectedLive && !watch && (view!=='list'||upcomingState.complete&&upcomingPresent===false) ? <p className="rounded-[14px] border border-panel-border bg-panel p-8 text-center text-muted">{searchMode ? <>{searchLabels.empty.replace('{query}',query)} <Link href={videoSearchHref(locale,'')} className="underline">{searchLabels.clear}</Link></> : messages.empty}</p> : null}
          {liveError&&!watch?<p role="status" className="text-sm text-muted">{messages.loadError}</p>:null}
          {waitingWatch&&!selectedLive?<BroadcastWaitingPanel recommendations={recommendations} watch={waitingWatch} locale={locale} api={api}/>:null}
          {recordingId&&selectedLive&&!resolver.denied?<LiveRecordingPlayer recommendations={recommendations} key={selectedLive.captureId} api={api} recording={selectedLive} labels={messages} liveLabels={messages.live??englishLiveLabels} locale={locale} mediaOriginSeconds={mediaOrigin} onVod={selected?.packageId===selectedLive.captureId?async bookmark=>{
            if(await start(bookmark)){setVodChosen(true);setSelectedLive(null);return true;}return false;
          }:undefined}/>:null}
          {selected && !selectedLive && !waitingWatch && !resolver.denied ? <div data-video-watch ref={playerSection} className={`${zoneStyles.video} grid min-w-0 scroll-mt-28 gap-4`}>
            {playback?.recordingId === selected.id ? <HlsPlayer key={playback.url} resume={vodResume} poster={poster} videoRef={video} playbackUrl={playback.url} availableQualities={(playback.grant.renditions??[]).map(rendition=>rendition.name)} watermark={playback.grant.watermarkCode} title={selected.title} labels={messages} previousHref={previousRecording ? cardLink(previousRecording.id) : undefined} nextHref={nextRecording ? cardLink(nextRecording.id) : undefined} onError={mediaError} onBookmark={rememberVod}/> : <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-neutral-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {poster?<img src={poster} alt={selected.title} width={1280} height={720} className="absolute inset-0 h-full w-full object-contain"/>:null}
              {preparing || recordingId && !playError ? <div className="absolute inset-0 grid place-items-center text-white [&>svg]:h-12 [&>svg]:w-12 [&>svg]:animate-spin" role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{messages.preparing}</span></div> : !recordingId ? <button type="button" onClick={() => void start()} className="relative inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground"><Play size={18} aria-hidden="true" />{messages.play}</button> : null}
            </div>}
            <h2 ref={playerTitle} tabIndex={-1} className={`${zoneStyles.watchTitle} outline-none`}>{selected.title}</h2>
            {recordingId?<VideoInteractions recommendations={recommendations} key={selected.id} api={api} id={selected.id} title={selected.title} locale={locale} live={false} currentTime={()=>video.current?.currentTime??0} durationSeconds={selected.durationSeconds??undefined} description={selected.description} date={selected.uploadedAt} dateKind="uploaded"/>:<VideoInformation description={selected.description} date={selected.uploadedAt} metrics={null} locale={locale}/>}
            {playError ? <p role="alert" className="text-sm text-primary">{playError} <button type="button" className="underline" onClick={() => void start(vodBookmark.current)}>{messages.retry}</button></p> : null}
          </div> : null}
          {!inlineRecommendations?recommendations:null}
        </section>
      </div>
    </main>
  );
}
