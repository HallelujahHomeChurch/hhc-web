'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {LoadMoreTrigger} from '@hallelujahhomechurch/ui';
import zoneStyles from './MemberVideoZone.module.css';
import {LoaderCircle, Play} from 'lucide-react';
import type {MemberLiveRecording, MemberRecording, MemberRecordingCard} from '@hallelujahhomechurch/hhc-web-client';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {useAccountAuth, useAccountSignIn, useAccountIdentity, useBulletinAuthorization, useVideoAccess} from '@/components/layout/AccountControl';
import {useMediaDocument} from '@/components/layout/MediaDocument';
import {getLocaleCookie, type Locale} from '@/i18n/locales';
import {captureHandledError} from '@/lib/observability';
import {createMemberVideoApi} from './api';
import {videoSearchHref,videoSearchRefreshEvent,type VideoSearchLabels} from './search';
import {VideoInformation} from './VideoInformation';
import {VideoInteractions} from './VideoInteractions';
import {useVodPlayback} from './useVodPlayback';
import {PersistentLive} from './PersistentLive';
import {PersistentVod} from './PersistentVod';
import {usePersistentPlayback} from './PlaybackProvider';
import type {PlayerBookmark} from './live-player';
import {usePlaybackTelemetry} from './usePlaybackTelemetry';
import {HlsPlayer, type PlayerLabels} from './HlsPlayer';

import {videoWatchPath} from './share';
import {playerClock} from './PlayerChrome';
import {LiveRecordingCover,RecordingCover,useRecordingCover} from './RecordingCover';
import {LiveRecordingPlayer,liveViewerLabel,englishLiveLabels,type LiveLabels} from './LiveRecordingPlayer';
import {useBroadcastWatch} from './useBroadcastWatch';
import {BroadcastWaitingPanel} from './BroadcastWaitingPanel';
import {liveLibraryItems} from './video-library';
import {UpcomingBroadcasts} from './UpcomingBroadcasts';
import {VideoListSkeleton, VideoRecommendationsSkeleton, VideoWatchSkeleton} from './VideoLoading';
import {LoadingStatus} from '@/components/ui/ContentLoading';
import {RecordingCardProgress} from './RecordingCardProgress';
import {ThumbnailPreview} from './ThumbnailPreview';

export type Messages = {
  signIn?: string; shareDescription?: string;
  live?: LiveLabels;
  search?: VideoSearchLabels;
  backToList?: string; otherVideos?: string; unavailable?: string;
  selectedTitle: string; listTitle: string; count: string; play: string; select: string; selected: string;
  playing: string; featured: string; durationUnknown: string; expires: string; loading: string;
  preparing: string; empty: string; loadError: string; playError: string; expired: string;
  retry: string; previous: string; next: string; loadMore?:string; liveStartedDate?:string; uploadedDate: string; description: string;
} & PlayerLabels;
const pageSize = 12;
// Default automatic covers belong to the immutable recording package.
const coverRevision=(recording:MemberRecording|undefined)=>recording?.selectedCoverId||(recording?.packageId?`auto:${recording.packageId}`:undefined);
type ZoneProps = {active?: boolean;publicId?:string;startAt?:number;locale: Locale; messages: Messages; hero: ReactNode; view?: 'list' | 'watch'; recordingId?: string;query?: string;invalidQuery?: boolean};

function newestFirst<T extends MemberRecording>(items: T[]) {
  return [...items].sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '') || b.id.localeCompare(a.id));
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric'}).format(new Date(value));
}

export function MemberVideoZone({locale, messages, hero, view = 'watch', recordingId, publicId, query = '', invalidQuery = false,startAt}: ZoneProps) {
  const router = useRouter();
  const auth = useAccountAuth();
  const signIn = useAccountSignIn();
  useEffect(() => { document.cookie = getLocaleCookie(locale); }, [locale]);
  const identity=useAccountIdentity();
  const access = useVideoAccess();
  const {privateMediaReady} = useMediaDocument();
  useEffect(() => {
    if (!publicId && (auth.status === 'anonymous' || access === 'denied')) router.replace(`/${locale}`);
  }, [access, auth.status, locale, router, publicId]);
  if (access === 'available' && privateMediaReady) return <AuthorizedVideoEntry publicId={publicId} startAt={startAt} key={`${identity}:${publicId ?? recordingId ?? view}:${view==='list'?`${query}:${invalidQuery}`:''}`} locale={locale} messages={messages} hero={hero} view={view} recordingId={recordingId} query={query} invalidQuery={invalidQuery} />;
  if (publicId && auth.status === 'anonymous') return <main className="shell py-16"><section className="rounded-2xl border border-panel-border bg-panel p-8 text-center"><h1 className="text-2xl font-semibold">{messages.selectedTitle}</h1><p className="mt-4 text-muted">{messages.shareDescription}</p><button type="button" className="mt-5 min-h-11 rounded-full bg-primary-solid px-5 font-semibold text-primary-foreground" onClick={() => void signIn?.()}>{messages.signIn}</button></section></main>;
  if (publicId && access === 'denied') return <main className="shell py-16" role="alert">{messages.unavailable ?? messages.expired}</main>;
  if (auth.status === 'anonymous' || access === 'denied') return null;
  const unavailable = auth.status === 'unavailable' || access === 'unavailable';
  if (!unavailable) return <main><div className={`${recordingId||publicId?'':'bg-[image:var(--hhc-page-gradient)]'} ${(recordingId||publicId) ? zoneStyles.watchPage : 'py-10'}`}><section className={`${zoneStyles.zone} ${(recordingId||publicId) ? zoneStyles.watch : query ? zoneStyles.search : zoneStyles.library}`}>{recordingId||publicId ? <VideoWatchSkeleton label={messages.loading}/> : <VideoListSkeleton label={messages.loading} search={Boolean(query)}/>}</section></div></main>;
  return <main className="bg-[image:var(--hhc-page-gradient)] py-16"><section className="shell rounded-[14px] border border-panel-border bg-panel p-8 text-center text-ink" role={unavailable ? 'alert' : 'status'}>{unavailable ? messages.loadError : messages.loading}{unavailable ? <button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => window.location.reload()}>{messages.retry}</button> : null}</section></main>;
}

function AuthorizedVideoEntry(props: ZoneProps) {
  const persistent = usePersistentPlayback();
  const retain = persistent?.retainLibrary, prepare = persistent?.prepareLibrary;
  const {locale, messages, hero, query = '', invalidQuery = false, view} = props;
  const surface = useMemo(() => ({
    key: `${locale}:${view === 'list' ? `${query}:${invalidQuery}` : ':false'}`,
    render: (active: boolean) => <AuthorizedVideoZone locale={locale} messages={messages} hero={view === 'list' ? hero : null}
      view="list" query={view === 'list' ? query : ''} invalidQuery={view === 'list' && invalidQuery} active={active}/>,
  }), [locale, messages, hero, query, invalidQuery, view]);
  const librarySlot = useCallback((element: HTMLDivElement | null) => { retain?.(surface, element); }, [retain, surface]);
  useEffect(() => { if (view !== 'list') prepare?.(surface); }, [view, prepare, surface]);
  if (view === 'list' && retain) return <div ref={librarySlot}/>;
  return <AuthorizedVideoZone {...props}/>;
}

function AuthorizedVideoZone({locale, messages, hero, view, recordingId: internalRecordingId, publicId, query = '', invalidQuery = false,startAt,active = true}: ZoneProps) {
  const router = useRouter();
  const authorization = useBulletinAuthorization();
  const identity = useAccountIdentity();
  const batchesRef = useRef(0);
  const previousLiveIDs = useRef(new Set<string>());
  const liveLoaded = useRef(false);
  const listGeneration = useRef(0);
  const loadedList = useRef<{api: ReturnType<typeof createMemberVideoApi>; retry: number} | null>(null);
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [upcomingPresent,setUpcomingPresent]=useState<boolean|null>(null);
  const [hoveredRecording,setHoveredRecording]=useState<string|null>(null);
 const [upcomingState,setUpcomingState]=useState<{ids:string[];complete:boolean;initialState:'loading'|'ready'|'error'}>({ids:[],complete:false,initialState:'loading'});
  const [recordings, setRecordings] = useState<MemberRecordingCard[] | null>(null);
  const [livestreams,setLivestreams]=useState<MemberLiveRecording[]>([]);
  const [vodChosen,setVodChosen]=useState(false);
  const [legacySelectedLive,setSelectedLive]=useState<MemberLiveRecording|null>(null);
  const [retry, setRetry] = useState(0);
  const resolver=useBroadcastWatch(api,publicId ?? internalRecordingId,retry);
  const watch=resolver.watch;
  const recordingId=publicId ? watch?.recordingId ?? publicId : internalRecordingId;
  const mediaOrigin=watch?.mediaStartSeconds??null,mediaDuration=watch?.durationSeconds??null;
  const persistent = usePersistentPlayback();
  const retainedLive = recordingId && persistent?.activeLive?.id === recordingId ? persistent.activeLive : null;
  const selectedLive=resolver.denied||vodChosen||recordingId&&!watch?null:watch?watch.live??(['processing','vod'].includes(watch.view)?resolver.lastLive??retainedLive:null):legacySelectedLive;
  const waitingWatch=watch&&!['live','vod'].includes(watch.view)?watch:null;
  const [liveError,setLiveError]=useState(false);
  const [livePending,setLivePending]=useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [moreLoading,setMoreLoading]=useState(false),[moreError,setMoreError]=useState(false);
  const moreAttempt=useRef<AbortController|null>(null), morePending=useRef(false);
  const playerTitle = useRef<HTMLHeadingElement>(null);

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
    if(view==='list'&&(invalidQuery || loadedList.current?.api === api && loadedList.current.retry === retry))return;
    const controller = new AbortController();
    const generation = ++listGeneration.current;
    moreAttempt.current?.abort();morePending.current=false;
    const request = view === 'list' ? api.listPage({limit:pageSize,q:query||undefined,signal:controller.signal}) : api.list(controller.signal).then(items=>({items,nextCursor:null}));
    request.then(({items,nextCursor}) => {
      if (controller.signal.aborted || generation!==listGeneration.current) return;
      const sorted = newestFirst(items);
      batchesRef.current=1;
      loadedList.current = {api, retry};
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
    const controller=new AbortController();moreAttempt.current=controller;const generation=listGeneration.current;
    try {
      const page=await api.listPage({limit:pageSize,cursor:nextCursor,q:query||undefined,signal:controller.signal});
      if(controller.signal.aborted||generation!==listGeneration.current)return;
      if(page.nextCursor===nextCursor)throw new Error('Recording cursor did not advance');
      setRecordings(current=>{const items=new Map((current??[]).map(item=>[item.id,item]));for(const item of page.items)items.set(item.id,item);return [...items.values()];});
      setNextCursor(page.nextCursor);batchesRef.current+=1;
    } catch(error) {
      if(controller.signal.aborted)return;
      if(error instanceof HhcWebApiError&&error.status===401){router.replace(`/${locale}`);return;}
      captureHandledError(error,{operation:'member-videos.load-more'});setMoreError(true);
    } finally {if(!controller.signal.aborted){morePending.current=false;setMoreLoading(false);}}
  },[api,nextCursor,locale,router,query]);

  useEffect(() => {
    if (view !== 'list' || !active || invalidQuery) return;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (loadedList.current?.api !== api || loadedList.current.retry !== retry || !batchesRef.current || controller || document.visibilityState !== 'visible') return;
      controller = new AbortController();
      const signal = controller.signal, generation = ++listGeneration.current, pages = batchesRef.current;
      moreAttempt.current?.abort(); moreAttempt.current = controller; morePending.current = true;
      setMoreLoading(true);
      try {
        let cursor: string | undefined;
        const items = new Map<string, MemberRecordingCard>();
        let next: string | null = null;
        for (let page = 0; page < pages; page++) {
          const result = await api.listPage({limit: pageSize, cursor, q: query || undefined, signal});
          if (signal.aborted || generation !== listGeneration.current) return;
          for (const item of result.items) items.set(item.id, item);
          next = result.nextCursor;
          if (next === null) break;
          if (next === cursor) throw new Error('Recording cursor did not advance');
          cursor = next;
        }
        setRecordings(newestFirst([...items.values()]));
        setNextCursor(next); setLoadError(false);
      } catch (error) {
        if (signal.aborted || generation !== listGeneration.current) return;
        if (error instanceof HhcWebApiError && error.status === 401) {router.replace(`/${locale}`); return;}
        captureHandledError(error, {operation: 'member-videos.refresh'});
      } finally {if (moreAttempt.current === controller) {moreAttempt.current = null; morePending.current = false; if (!signal.aborted) setMoreLoading(false);} controller = null;}
    };
    void refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {controller?.abort(); if (controller && moreAttempt.current === controller) {moreAttempt.current = null; morePending.current = false;} window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh);};
  }, [api, view, active, invalidQuery, query, locale, router, retry]);

  useEffect(()=>{
    if(view!=='list'||!active)return;
    const refresh=()=>{
      ++listGeneration.current;moreAttempt.current?.abort();morePending.current=false;
      setRecordings(null);setNextCursor(null);
      batchesRef.current=0;setMoreLoading(false);setMoreError(false);setLoadError(false);setRetry(value=>value+1);
    };
    window.addEventListener(videoSearchRefreshEvent,refresh);
    return()=>window.removeEventListener(videoSearchRefreshEvent,refresh);
  },[view,active]);


  useEffect(()=>{
    if(view==='list'&&(invalidQuery || !active && liveLoaded.current))return;
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
      finally{if(!controller.signal.aborted){liveLoaded.current=true;setLivePending(false);if(active)timer=window.setTimeout(()=>void load(),30000);}}
    };
    void load();return()=>{controller.abort();window.clearTimeout(timer);};
  },[api,recordingId,retry,view,query,invalidQuery,vodChosen,active]);

  const selected = resolver.denied ? undefined : recordingId ? watch?.recording??undefined : recordings?.find((recording) => recording.id === selectedId);
  const [archiveBookmark, setArchiveBookmark] = useState<PlayerBookmark>();
  const {playback, video, media, playbackPause, vodResume, preparing, playError, playerSection,
    automaticAttempt, vodBookmark, backgroundAudio, audioUrl, rememberVod, mediaError, start, stop} =
    useVodPlayback({api, identity, locale, messages, selected, recordings, resolveMissing, mediaOrigin, mediaDuration, startAt});
  const poster=useRecordingCover(api,selected?.id,selected?.expiresAt,coverRevision(selected));
  const select = (id: string) => {
    if (id === selectedId) return;
    stop();
    setSelectedId(id);
    queueMicrotask(() => {
      playerTitle.current?.focus({preventScroll: true});
      playerSection.current?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'});
    });
  };

  useEffect(() => {
    if (persistent || !recordingId || !selected || selectedLive || waitingWatch || resolver.denied || automaticAttempt.current === selected.id) return;
    void start();
  }, [recordingId, selected, selectedLive, waitingWatch, resolver.denied, start, automaticAttempt, persistent]);

  const selectedIndex = recordings?.findIndex(item => item.id === selectedId) ?? -1;
  const previousRecording = selectedIndex > 0 ? recordings?.[selectedIndex - 1] : undefined;
  const nextRecording = selectedIndex >= 0 ? recordings?.[selectedIndex + 1] : undefined;
  const liveLabels=messages.live??englishLiveLabels;
  const liveKey = selectedLive ? `live:${selectedLive.id}:${selectedLive.captureId}` : undefined;
  const vodKey = selected ? `vod:${selected.id}:${selected.packageId}` : undefined;
  const activeKey = liveKey ?? (!waitingWatch ? vodKey : undefined);
  const startPersistent = persistent?.start;
  const closePersistent = persistent?.close;
  const registerPersistentSlot = persistent?.setSlot;
  const slotRef = useCallback((element: HTMLDivElement | null) => {
    if (activeKey) registerPersistentSlot?.(activeKey, element);
  }, [activeKey, registerPersistentSlot]);
  const selectArchive = useCallback(async (bookmark: PlayerBookmark | undefined) => {
    setArchiveBookmark(bookmark);
    setVodChosen(true);
    setSelectedLive(null);
    return true;
  }, []);
  const refreshAfterFailure = useCallback(async (signal: AbortSignal) => {
    if (recordingId) await api.watch(recordingId, signal);
  }, [api, recordingId]);
  const returnToLibrary = persistent?.returnToLibrary;
  const takeLibraryScroll = persistent?.takeLibraryScroll;
  const pendingLibraryScroll = useRef<number | undefined>(undefined);
  const commitMinimize = persistent?.minimize;
  const minimize = useCallback(() => {
    const fallback = `/${locale}/member-videos`;
    const navigate = () => {
      const target = returnToLibrary?.(fallback);
      if (target?.method === 'back') router.back(); else router.replace(target?.href ?? fallback, {scroll: false});
    };
    if (commitMinimize) commitMinimize(navigate); else navigate();
  }, [router, locale, returnToLibrary, commitMinimize]);
  useEffect(() => {
    if (view !== 'list' || !active || !recordings || livePending) return;
    const saved = takeLibraryScroll?.();
    if (saved !== undefined) pendingLibraryScroll.current = saved;
    const scroll = pendingLibraryScroll.current;
    if (scroll === undefined) return;
    const frame = requestAnimationFrame(() => {
      if (scroll > document.documentElement.scrollHeight - window.innerHeight && nextCursor && !moreError) {
        if (!moreLoading) void loadMore();
        return;
      }
      pendingLibraryScroll.current = undefined;
      window.scrollTo({top: scroll});
    });
    return () => cancelAnimationFrame(frame);
  }, [view, active, recordings, livePending, takeLibraryScroll, nextCursor, moreError, moreLoading, loadMore]);
  const minimizeLabel = persistent?.labels.minimize;
  const descriptor = useMemo(() => {
    if (!recordingId || !activeKey || resolver.denied) return;
    const item = selectedLive ?? selected;
    if (!item) return;
    const href = videoWatchPath(locale, item.id, item.publicId) + (startAt === undefined ? '' : `?t=${startAt}`);
    const player = selectedLive
      ? <PersistentLive onMinimize={minimize} api={api} recording={selectedLive} labels={{...messages, minimize: minimizeLabel}}
          liveLabels={liveLabels} locale={locale} mediaOriginSeconds={mediaOrigin}
          onVod={selected?.packageId === selectedLive.captureId ? selectArchive : undefined}/>
      : <PersistentVod onMinimize={minimize} api={api} identity={identity} locale={locale} messages={{...messages, minimize: minimizeLabel}} selected={selected}
          recordings={selected ? [selected] : null} resolveMissing={refreshAfterFailure}
          mediaOrigin={mediaOrigin} mediaDuration={mediaDuration} startAt={startAt} initialBookmark={archiveBookmark}
          previousHref={previousRecording && videoWatchPath(locale, previousRecording.id, previousRecording.publicId)}
          nextHref={nextRecording && videoWatchPath(locale, nextRecording.id, nextRecording.publicId)}/>;
    return {key: activeKey, href, title: item.title, player, live: selectedLive ?? undefined};
  }, [recordingId, activeKey, resolver.denied, selectedLive, selected, locale, api, messages, liveLabels, mediaOrigin,
    selectArchive, identity, refreshAfterFailure, mediaDuration, startAt, archiveBookmark, previousRecording, nextRecording, minimize, minimizeLabel]);
  useEffect(() => { if (descriptor) startPersistent?.(descriptor); }, [descriptor, startPersistent]);
  const currentPlaybackKey = persistent?.activeKey;
  const activeHref = persistent?.activeHref;
  useEffect(() => {
    const requested = publicId ?? internalRecordingId;
    if (!requested || !currentPlaybackKey) return;
    const aliases = [currentPlaybackKey.split(':')[1], activeHref?.split('?')[0].split('/').at(-1)];
    // A committed unknown target must not keep playing the previous recording behind its loading/error page.
    if (!aliases.includes(requested)) closePersistent?.(currentPlaybackKey);
  }, [publicId, internalRecordingId, currentPlaybackKey, activeHref, closePersistent]);
  useEffect(() => {
    if (!resolver.denied || !recordingId || !currentPlaybackKey) return;
    if (currentPlaybackKey.split(':')[1] === recordingId ||
      activeHref?.split('?')[0] === videoWatchPath(locale, recordingId, publicId)) closePersistent?.(currentPlaybackKey);
  }, [resolver.denied, recordingId, currentPlaybackKey, activeHref, locale, publicId, closePersistent]);
  const liveItems = liveLibraryItems(livestreams).filter(item=>item.id!==recordingId);
  const activeLiveIds = new Set(liveItems.map(item=>item.id));
  const otherRecordings = recordings?.filter(item => item.id !== selectedId && !activeLiveIds.has(item.id)&&!upcomingState.ids.includes(item.id)) ?? [];
  const visibleItems = recordingId ? otherRecordings.slice(0, 10) : otherRecordings;
  const recommendationsPending = Boolean(recordingId) && !visibleItems.length && !liveItems.length && (recordings === null && !loadError || livePending);
  const cardLink=(item:{id:string;publicId?:string})=>videoWatchPath(locale,item.id,item.publicId);
  usePlaybackTelemetry(api,selected?.id,media,Boolean(playback&&!selectedLive&&!resolver.denied));
  const searchMode=view==='list'&&Boolean(query||invalidQuery);
  const searchLabels=messages.search??{results:'Results for {query}',empty:'No results for {query}',clear:'Clear search',tooLong:'Search accepts one query of up to 100 characters.'};
  const liveBadge=(item:MemberLiveRecording)=>liveViewerLabel(item.liveState,liveLabels);
  const rememberLibrary = (watchHref?: string) => {
    if (view === 'list') persistent?.rememberLibrary(videoSearchHref(locale, query), window.scrollY, watchHref);
  };
  const inlineRecommendations=Boolean(recordingId&&(selected||selectedLive||waitingWatch)&&!resolver.denied);
  const recommendations=liveItems.length>0||visibleItems.length>0||view==='list'&&!invalidQuery||recordingId&&watch&&!resolver.denied&&(recommendationsPending||loadError||liveError) ? <div className={zoneStyles.results}>
            {recordingId ? <h2 className="sr-only">{messages.otherVideos??messages.listTitle}</h2>:null}
            {recordingId&&watch&&recommendationsPending?<LoadingStatus label={messages.loading}/>:null}
            {recordingId&&watch&&!recommendationsPending&&(loadError||liveError)?<p role="status" className="text-sm text-muted">{messages.loadError} <button type="button" className="min-h-11 cursor-pointer text-primary underline" onClick={()=>setRetry(value=>value+1)}>{messages.retry}</button></p>:null}
            <div className={recordingId ? zoneStyles.recommendations : searchMode ? zoneStyles.searchList : zoneStyles.grid}>
              {recordingId&&watch&&recommendationsPending?<VideoRecommendationsSkeleton/>:null}
              {liveItems.map(item=><article id={`recording-${item.id}`} key={item.captureId} className={zoneStyles.card}>
                <Link href={cardLink(item)} onNavigate={()=>rememberLibrary(cardLink(item))} className={zoneStyles.thumbnail} tabIndex={-1} aria-label={`${messages.select}: ${item.title}`}>
                  <ThumbnailPreview api={api} recording={item} labels={messages} enabled={active&&view==='list'&&!persistent?.activeKey} activeId={hoveredRecording} onActive={setHoveredRecording}>
                  <LiveRecordingCover api={api} recording={item}/>
                  </ThumbnailPreview>
                  <span className={`${zoneStyles.badge} ${item.liveState==='live'?zoneStyles.liveBadge:zoneStyles.stateBadge}`}>{liveBadge(item)}</span>
                </Link>
                <div className={zoneStyles.info}><h3 className={zoneStyles.title}><Link href={cardLink(item)} onNavigate={()=>rememberLibrary(cardLink(item))} aria-label={`${item.title} — ${liveBadge(item)}`}>{item.title}</Link></h3><p className={zoneStyles.date}>{(messages.liveStartedDate??'{date}').replace('{date}',formatDate(item.startedAt??item.createdAt,locale))}</p>{searchMode&&item.description?<p className={zoneStyles.summary}>{item.description}</p>:null}</div>
              </article>)}
              {view==='list'&&!invalidQuery&&!loadError&&livePending?<VideoListSkeleton label={messages.loading} search={searchMode}/>:null}
              {view==='list'&&!invalidQuery?<UpcomingBroadcasts onNavigate={rememberLibrary} active={active} api={api} locale={locale} onPresenceChange={setUpcomingPresent} query={query} excludeIds={liveItems.map(item=>item.id)} onPageState={setUpcomingState} loadMoreLabel={messages.loadMore??'Load more'} loading={messages.loading} retry={messages.retry}/>:null}
              {view==='list'&&!invalidQuery&&!loadError&&!livePending&&(!recordings||upcomingState.initialState==='loading')?<VideoListSkeleton label={messages.loading} search={searchMode}/>:null}
              {(view!=='list'||upcomingState.complete&&!livePending?visibleItems:[]).map(item=><article id={`recording-${item.id}`} key={item.id} className={zoneStyles.card}>
                <Link href={cardLink(item)} onNavigate={()=>rememberLibrary(cardLink(item))} className={zoneStyles.thumbnail} tabIndex={-1} aria-label={`${messages.select}: ${item.title}`}>
                  <ThumbnailPreview api={api} recording={item} labels={messages} enabled={active&&view==='list'&&!persistent?.activeKey} activeId={hoveredRecording} onActive={setHoveredRecording}>
                  <RecordingCover api={api} id={item.id} title={item.title} expiresAt={item.expiresAt} revision={coverRevision(item)}/>
                  </ThumbnailPreview>
                  <RecordingCardProgress item={item} label={messages.seek}/>
                  {item.durationSeconds ? <span className={zoneStyles.duration}>{playerClock(item.durationSeconds)}</span>:null}
                </Link>
                <div className={zoneStyles.info}><h3 className={zoneStyles.title}>{view==='list'||recordingId ? <Link href={cardLink(item)} onNavigate={()=>rememberLibrary(cardLink(item))}>{item.title}</Link>:item.title}</h3><p className={zoneStyles.date}>{formatDate(item.uploadedAt,locale)}</p>{searchMode&&item.description?<p className={zoneStyles.summary}>{item.description}</p>:null}
                  {view!=='list'&&!recordingId ? <button type="button" className="min-h-11 justify-self-start text-primary underline focus-visible:outline-2 focus-visible:outline-primary" onClick={()=>select(item.id)}>{messages.select}</button>:null}
                </div>
              </article>)}
            </div>
            {active&&view==='list'&&upcomingState.complete ? <LoadMoreTrigger hasMore={nextCursor!==null} loading={moreLoading} error={moreError} onLoadMore={loadMore} labels={{loadMore:messages.loadMore??'Load more',loading:messages.loading,retry:messages.retry}}/>:null}
          </div>:active&&view==='list'&&nextCursor!==null ? <LoadMoreTrigger hasMore loading={moreLoading} error={moreError} onLoadMore={loadMore} labels={{loadMore:messages.loadMore??'Load more',loading:messages.loading,retry:messages.retry}}/>:null;
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
          {recordingId&&selectedLive&&!resolver.denied&&persistent?<div data-video-watch className={zoneStyles.video}>
            <div ref={slotRef} className={`${zoneStyles.watchSlot} aspect-video bg-neutral-950`}>{!currentPlaybackKey && descriptor && <button type="button" onClick={() => startPersistent?.(descriptor, true)}>{messages.play}</button>}</div>
            <h2 className={zoneStyles.watchTitle}>{selectedLive.title}</h2>
            <VideoInteractions recommendations={recommendations} key={selectedLive.id} api={api} id={selectedLive.id} publicId={selectedLive.publicId} title={selectedLive.title} locale={locale} live={true} description={selectedLive.description} date={selectedLive.startedAt??selectedLive.createdAt} dateKind="live"/>
          </div>:null}
          {recordingId&&selectedLive&&!resolver.denied&&!persistent?<LiveRecordingPlayer recommendations={recommendations} key={selectedLive.captureId} api={api} recording={selectedLive} labels={messages} liveLabels={messages.live??englishLiveLabels} locale={locale} mediaOriginSeconds={mediaOrigin} onVod={selected?.packageId===selectedLive.captureId?async bookmark=>{
            if(await start(bookmark)){setVodChosen(true);setSelectedLive(null);return true;}return false;
          }:undefined}/>:null}
          {selected && !selectedLive && !waitingWatch && !resolver.denied ? <div data-video-watch ref={playerSection} className={`${zoneStyles.video} grid min-w-0 scroll-mt-28 gap-4`}>
            {persistent && descriptor ? <div ref={slotRef} className={`${zoneStyles.watchSlot} aspect-video bg-neutral-950`}>{!currentPlaybackKey && <button type="button" onClick={() => startPersistent?.(descriptor, true)}>{messages.play}</button>}</div> : playback?.recordingId === selected.id ? <HlsPlayer key={`${playback.url}:${backgroundAudio}`} backgroundAudioUrl={audioUrl} playbackMediaRef={media} playbackPauseRef={playbackPause} resume={vodResume} poster={poster} videoRef={video} playbackUrl={playback.url} availableQualities={(playback.grant.renditions??[]).map(rendition=>rendition.name)} watermark={playback.grant.watermarkCode} title={selected.title} labels={messages} previousHref={previousRecording ? cardLink(previousRecording) : undefined} nextHref={nextRecording ? cardLink(nextRecording) : undefined} onError={mediaError} onBookmark={rememberVod}/> : <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-neutral-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {poster?<img src={poster} alt={selected.title} width={1280} height={720} className="absolute inset-0 h-full w-full object-contain"/>:null}
              {preparing || recordingId && !playError ? <div className="hhc-player-loading" role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{messages.preparing}</span></div> : !recordingId ? <button type="button" onClick={() => void start()} className="relative inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground"><Play size={18} aria-hidden="true" />{messages.play}</button> : null}
            </div>}
            <h2 ref={playerTitle} tabIndex={-1} className={`${zoneStyles.watchTitle} outline-none`}>{selected.title}</h2>
            {recordingId?<VideoInteractions recommendations={recommendations} key={selected.id} api={api} id={selected.id} publicId={selected.publicId} title={selected.title} locale={locale} live={false} currentTime={persistent?.currentTime ?? (()=>media.current?.currentTime??0)} durationSeconds={selected.durationSeconds??undefined} description={selected.description} date={selected.uploadedAt} dateKind="uploaded"/>:<VideoInformation description={selected.description} date={selected.uploadedAt} metrics={null} locale={locale}/>}
            {playError ? <p role="alert" className="text-sm text-primary">{playError} <button type="button" className="underline" onClick={() => void start(vodBookmark.current)}>{messages.retry}</button></p> : null}
          </div> : null}
          {!inlineRecommendations?recommendations:null}
        </section>
      </div>
    </main>
  );
}
