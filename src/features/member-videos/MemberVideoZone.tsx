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
import {HlsPlayer, type PlayerLabels} from './HlsPlayer';
import playerStyles from './PlayerChrome.module.css';
import {playerClock} from './PlayerChrome';
import {RecordingCover,useRecordingCover} from './RecordingCover';
import {LiveRecordingPlayer,liveViewerLabel,englishLiveLabels,type LiveLabels} from './LiveRecordingPlayer';
import type {PlayerBookmark} from './live-player';

export type Messages = {
  live?: LiveLabels;
  backToList?: string; otherVideos?: string; unavailable?: string;
  selectedTitle: string; listTitle: string; count: string; play: string; select: string; selected: string;
  playing: string; featured: string; durationUnknown: string; expires: string; loading: string;
  preparing: string; empty: string; loadError: string; playError: string; expired: string;
  retry: string; previous: string; next: string; loadMore?:string; liveStartedDate?:string; uploadedDate: string; description: string;
} & PlayerLabels;
type ActivePlayback = {recordingId: string; scopeId: string; grant: MemberRecordingPlayback; url: string};
const pageSize = 12;
type ZoneProps = {locale: Locale; messages: Messages; hero: ReactNode; view?: 'list' | 'watch'; recordingId?: string};

function newestFirst(items: MemberRecording[]) {
  return [...items].sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '') || b.id.localeCompare(a.id));
}

function formatDate(value: string | null, locale: Locale) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {timeZone: 'Asia/Taipei', year: 'numeric', month: 'long', day: 'numeric'}).format(new Date(value));
}

export function MemberVideoZone({locale, messages, hero, view = 'watch', recordingId}: ZoneProps) {
  const router = useRouter();
  const auth = useAccountAuth();
  const identity=useAccountIdentity();
  const access = useVideoAccess();
  useEffect(() => {
    if (auth.status === 'anonymous' || access === 'denied') router.replace(`/${locale}`);
  }, [access, auth.status, locale, router]);
  if (access === 'available') return <AuthorizedVideoZone key={`${identity}:${recordingId ?? view}`} locale={locale} messages={messages} hero={hero} view={view} recordingId={recordingId} />;
  if (auth.status === 'anonymous' || access === 'denied') return null;
  const unavailable = auth.status === 'unavailable' || access === 'unavailable';
  return <main className="bg-[image:var(--hhc-page-gradient)] py-16"><section className="shell rounded-[14px] border border-panel-border bg-panel p-8 text-center text-ink" role={unavailable ? 'alert' : 'status'}>{unavailable ? messages.loadError : messages.loading}{unavailable ? <button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => window.location.reload()}>{messages.retry}</button> : null}</section></main>;
}

function AuthorizedVideoZone({locale, messages, hero, view, recordingId}: ZoneProps) {
  const router = useRouter();
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [recordings, setRecordings] = useState<MemberRecording[] | null>(null);
  const [livestreams,setLivestreams]=useState<MemberLiveRecording[]>([]);
  const vodChosen=useRef(false);
  const [vodResume,setVodResume]=useState<PlayerBookmark|undefined>(undefined);
  const [selectedLive,setSelectedLive]=useState<MemberLiveRecording|null>(null);
  const [liveLoading,setLiveLoading]=useState(true);
  const [liveError,setLiveError]=useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [moreLoading,setMoreLoading]=useState(false),[moreError,setMoreError]=useState(false);
  const moreAttempt=useRef<AbortController|null>(null), morePending=useRef(false);
  const [playback, setPlayback] = useState<ActivePlayback | null>(null);
  const playbackRef = useRef<ActivePlayback | null>(null);
  const mediaFailureReported = useRef(false);
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
    const controller = new AbortController();
    moreAttempt.current?.abort();morePending.current=false;
    const request = view === 'list' ? api.listPage({limit:pageSize,signal:controller.signal}) : api.list(controller.signal).then(items=>({items,nextCursor:null}));
    request.then(({items,nextCursor}) => {
      if (controller.signal.aborted) return;
      const sorted = newestFirst(items);
      setRecordings(sorted);
      setNextCursor(nextCursor);setMoreLoading(false);setMoreError(false);
      setSelectedId((current) => recordingId ? (sorted.some(item => item.id === recordingId) ? recordingId : null) : view === 'list' ? null : current && sorted.some((item) => item.id === current) ? current : sorted[0]?.id ?? null);
      setLoadError(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof HhcWebApiError && error.status === 401) {router.replace(`/${locale}`); return;}
      captureHandledError(error, {operation: 'member-videos.list'});
      setLoadError(true);
    });
    return () => {controller.abort();moreAttempt.current?.abort();morePending.current=false;};
  }, [api, locale, retry, router, recordingId, view]);

  const loadMore=useCallback(async()=>{
    if(nextCursor===null||morePending.current)return;
    morePending.current=true;setMoreLoading(true);setMoreError(false);
    const controller=new AbortController();moreAttempt.current=controller;
    try {
      const page=await api.listPage({limit:pageSize,cursor:nextCursor,signal:controller.signal});
      if(controller.signal.aborted)return;
      if(page.nextCursor===nextCursor)throw new Error('Recording cursor did not advance');
      setRecordings(current=>{const items=new Map((current??[]).map(item=>[item.id,item]));for(const item of page.items)items.set(item.id,item);return [...items.values()];});
      setNextCursor(page.nextCursor);
    } catch(error) {
      if(controller.signal.aborted)return;
      if(error instanceof HhcWebApiError&&error.status===401){router.replace(`/${locale}`);return;}
      captureHandledError(error,{operation:'member-videos.load-more'});setMoreError(true);
    } finally {if(!controller.signal.aborted){morePending.current=false;setMoreLoading(false);}}
  },[api,nextCursor,locale,router]);

  useEffect(()=>{
    const controller=new AbortController();let timer=0;
    const load=async()=>{
      try{
        const items=await api.liveList(controller.signal);
        if(controller.signal.aborted)return;
        setLivestreams(items);setLiveError(false);
        const current=items.find(item=>item.id===recordingId);
        // Keep a stopped event mounted for its already registered viewer scope.
        if(current&&!vodChosen.current)setSelectedLive(previous=>previous&&previous.captureId!==current.captureId?previous:current);
        if(recordingId){
          const recordings=await api.list(controller.signal);
          if(controller.signal.aborted)return;
          setRecordings(newestFirst(recordings));
          setSelectedId(recordings.some(item=>item.id===recordingId)?recordingId:null);
        }
      }catch{if(!controller.signal.aborted)setLiveError(true);}
      finally{if(!controller.signal.aborted){setLiveLoading(false);timer=window.setTimeout(()=>void load(),30000);}}
    };
    void load();return()=>{controller.abort();window.clearTimeout(timer);};
  },[api,recordingId,retry]);

  useEffect(() => {playbackRef.current = playback;}, [playback]);
  useEffect(() => () => {
    attempt.current?.abort();
    video.current?.pause();
    if (playbackRef.current) void api.clear(playbackRef.current.url).catch(() => {});
  }, [api]);

  const selected = recordings?.find((recording) => recording.id === selectedId);
  const poster=useRecordingCover(api,selected?.id,selected?.expiresAt,selected?.selectedCoverId);
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
      if (!controller.signal.aborted) {setVodResume(resume);setPlayback({recordingId: selected.id, scopeId, grant, url});return true;}
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
  }, [selected, preparing, api, locale, router, resolveMissing, messages.playError]);

  useEffect(() => {
    if (!recordingId || !selected || liveLoading || selectedLive || automaticAttempt.current === selected.id) return;
    void start();
  }, [recordingId, selected, liveLoading, selectedLive, start]);

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

  const mediaError = useCallback(() => {
    video.current?.pause();
    setPlayError(messages.playError);
    if (!mediaFailureReported.current) {
      mediaFailureReported.current = true;
      captureHandledError(new Error('Member video media playback failed'), {operation: 'member-videos.media'});
    }
  }, [messages.playError]);

  const selectedIndex = recordings?.findIndex(item => item.id === selectedId) ?? -1;
  const previousRecording = selectedIndex > 0 ? recordings?.[selectedIndex - 1] : undefined;
  const nextRecording = selectedIndex >= 0 ? recordings?.[selectedIndex + 1] : undefined;
  const liveItems = livestreams.filter(item=>item.id!==recordingId && !['failed','expired','aborted'].includes(item.liveState)).sort((a,b)=>Number(b.liveState==='live')-Number(a.liveState==='live')||b.createdAt.localeCompare(a.createdAt));
  const activeLiveIds = new Set(liveItems.map(item=>item.id));
  const otherRecordings = recordings?.filter(item => item.id !== selectedId && !activeLiveIds.has(item.id)) ?? [];
  const visibleItems = recordingId ? otherRecordings.slice(0, 10) : otherRecordings;
  const liveLabels=messages.live??englishLiveLabels;
  const cardLink=(id:string)=>`/${locale}/member-videos/${encodeURIComponent(id)}`;
  const liveBadge=(item:MemberLiveRecording)=>liveViewerLabel(item.liveState,liveLabels);
  return (
    <main>
      {hero}
      <div className={`bg-[image:var(--hhc-page-gradient)] pb-14 ${recordingId ? zoneStyles.watchPage : 'py-10'}`}>
        <section className={`${zoneStyles.zone} ${recordingId ? zoneStyles.watch : zoneStyles.library}`} aria-label={messages.listTitle}>
          {!loadError && recordings && recordingId && !selected && !selectedLive && !liveLoading ? <p role="alert" className="text-ink">{messages.unavailable ?? messages.expired}</p> : null}
          {loadError ? <div role="alert" className="rounded-[14px] border border-panel-border bg-panel p-7 text-center text-ink">{messages.loadError}<button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => setRetry((value) => value + 1)}>{messages.retry}</button></div> : null}
          {!loadError && !recordings ? <p role="status" className="rounded-[14px] border border-panel-border bg-panel p-8 text-center text-muted">{messages.loading}</p> : null}
          {!loadError && recordings?.length === 0 && nextCursor===null && !livestreams.length && !selectedLive ? <p className="rounded-[14px] border border-panel-border bg-panel p-8 text-center text-muted">{messages.empty}</p> : null}
          {liveError?<p role="status" className="text-sm text-muted">{messages.loadError}</p>:null}
          {recordingId&&selectedLive?<LiveRecordingPlayer key={selectedLive.captureId} api={api} recording={selectedLive} labels={messages} liveLabels={messages.live??englishLiveLabels} locale={locale} onVod={selected?.packageId===selectedLive.captureId?async bookmark=>{
            if(await start(bookmark)){vodChosen.current=true;setSelectedLive(null);return true;}return false;
          }:undefined}/>:null}
          {selected && !selectedLive ? <div ref={playerSection} className={`${zoneStyles.video} grid min-w-0 scroll-mt-28 gap-4`}>
            {playback?.recordingId === selected.id ? <HlsPlayer key={playback.url} resume={vodResume} poster={poster} videoRef={video} playbackUrl={playback.url} availableQualities={(playback.grant.renditions??[]).map(rendition=>rendition.name)} watermark={playback.grant.watermarkCode} title={selected.title} labels={messages} previousHref={previousRecording ? cardLink(previousRecording.id) : undefined} nextHref={nextRecording ? cardLink(nextRecording.id) : undefined} onError={mediaError}/> : <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-neutral-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {poster?<img src={poster} alt={selected.title} width={1280} height={720} className="absolute inset-0 h-full w-full object-contain"/>:null}
              {preparing || recordingId && !playError ? <div className={playerStyles.loading} role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{messages.preparing}</span></div> : !recordingId ? <button type="button" onClick={() => void start()} className="relative inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground"><Play size={18} aria-hidden="true" />{messages.play}</button> : null}
            </div>}
            <h2 ref={playerTitle} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">{selected.title}</h2>
            <p className="text-sm text-muted">{messages.uploadedDate.replace('{date}', formatDate(selected.uploadedAt, locale))}</p>
            {selected.description?<details className="rounded-xl bg-panel p-4 text-ink"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-primary">{messages.description}</summary><p className="whitespace-pre-wrap break-words">{selected.description}</p></details>:null}
            {playError ? <p role="alert" className="text-sm text-primary">{playError} <button type="button" className="underline" onClick={() => void start()}>{messages.retry}</button></p> : null}
          </div> : null}
          {liveItems.length>0||visibleItems.length>0 ? <div className={zoneStyles.results}>
            {recordingId ? <h2 className="sr-only">{messages.otherVideos??messages.listTitle}</h2>:null}
            <div className={recordingId ? zoneStyles.recommendations : zoneStyles.grid}>
              {liveItems.map(item=><article key={item.captureId} className={zoneStyles.card}>
                <Link href={cardLink(item.id)} className={zoneStyles.thumbnail} tabIndex={-1} aria-hidden="true">
                  <div className="grid aspect-video place-items-center rounded-xl bg-neutral-950 text-white"><Play size={28} aria-hidden="true"/></div>
                  <span className={`${zoneStyles.badge} ${item.liveState==='live'?zoneStyles.liveBadge:zoneStyles.stateBadge}`}>{liveBadge(item)}</span>
                </Link>
                <div className={zoneStyles.info}><h3 className={zoneStyles.title}><Link href={cardLink(item.id)} aria-label={`${item.title} — ${liveBadge(item)}`}>{item.title}</Link></h3><p className={zoneStyles.date}>{(messages.liveStartedDate??'{date}').replace('{date}',formatDate(item.createdAt,locale))}</p></div>
              </article>)}
              {visibleItems.map(item=><article key={item.id} className={zoneStyles.card}>
                <Link href={cardLink(item.id)} className={zoneStyles.thumbnail} tabIndex={-1} aria-hidden="true">
                  <RecordingCover api={api} id={item.id} title={item.title} expiresAt={item.expiresAt} revision={item.selectedCoverId}/>
                  {item.durationSeconds ? <span className={zoneStyles.duration}>{playerClock(item.durationSeconds)}</span>:null}
                </Link>
                <div className={zoneStyles.info}><h3 className={zoneStyles.title}>{view==='list'||recordingId ? <Link href={cardLink(item.id)}>{item.title}</Link>:item.title}</h3><p className={zoneStyles.date}>{formatDate(item.uploadedAt,locale)}</p>
                  {view!=='list'&&!recordingId ? <button type="button" className="min-h-11 justify-self-start text-primary underline focus-visible:outline-2 focus-visible:outline-primary" onClick={()=>select(item.id)}>{messages.select}</button>:null}
                </div>
              </article>)}
            </div>
            {view==='list' ? <LoadMoreTrigger hasMore={nextCursor!==null} loading={moreLoading} error={moreError} onLoadMore={loadMore} labels={{loadMore:messages.loadMore??'Load more',loading:messages.loading,retry:messages.retry}}/>:null}
          </div>:view==='list'&&nextCursor!==null ? <LoadMoreTrigger hasMore loading={moreLoading} error={moreError} onLoadMore={loadMore} labels={{loadMore:messages.loadMore??'Load more',loading:messages.loading,retry:messages.retry}}/>:null}
        </section>
      </div>
    </main>
  );
}
