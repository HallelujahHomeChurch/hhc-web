'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {Play} from 'lucide-react';
import type {MemberRecording, MemberRecordingPlayback} from '@hallelujahhomechurch/hhc-web-client';
import {HhcWebApiError} from '@hallelujahhomechurch/hhc-web-client';
import {useAccountAuth, useBulletinAuthorization, useVideoAccess} from '@/components/layout/AccountControl';
import type {Locale} from '@/i18n/locales';
import {captureHandledError} from '@/lib/observability';
import {createMemberVideoApi} from './api';
import {HlsPlayer, type PlayerLabels} from './HlsPlayer';

type Messages = {
  selectedTitle: string; listTitle: string; count: string; play: string; select: string; selected: string;
  playing: string; featured: string; durationUnknown: string; expires: string; loading: string;
  preparing: string; empty: string; loadError: string; playError: string; expired: string;
  retry: string; previous: string; next: string;
} & PlayerLabels;
type ActivePlayback = {recordingId: string; scopeId: string; grant: MemberRecordingPlayback; url: string};
const pageSize = 12;

function formatDate(value: string | null, locale: Locale, compact = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale, {timeZone: 'Asia/Taipei', year: 'numeric', month: 'short', day: 'numeric', ...(compact ? {} : {hour:'numeric',minute:'2-digit',timeZoneName:'short'} as const)}).format(new Date(value));
}

function formatDuration(seconds: number | undefined, unknown: string, locale: Locale) {
  if (!seconds || seconds < 1) return unknown;
  const minutes = Math.max(1,Math.round(seconds/60));
  const unit = (value:number,name:'hour'|'minute') => new Intl.NumberFormat(locale,{style:'unit',unit:name,unitDisplay:'long'}).format(value);
  return [minutes>=60?unit(Math.floor(minutes/60),'hour'):'',minutes%60?unit(minutes%60,'minute'):''].filter(Boolean).join(' ');
}

export function MemberVideoZone({locale, messages, hero}: {locale: Locale; messages: Messages; hero: ReactNode}) {
  const router = useRouter();
  const auth = useAccountAuth();
  const access = useVideoAccess();
  useEffect(() => {
    if (auth.status === 'anonymous' || access === 'denied') router.replace(`/${locale}`);
  }, [access, auth.status, locale, router]);
  if (access === 'available') return <AuthorizedVideoZone locale={locale} messages={messages} hero={hero} />;
  if (auth.status === 'anonymous' || access === 'denied') return null;
  const unavailable = auth.status === 'unavailable' || access === 'unavailable';
  return <main className="bg-[image:var(--hhc-page-gradient)] py-16"><section className="shell rounded-[14px] border border-panel-border bg-panel p-8 text-center text-ink" role={unavailable ? 'alert' : 'status'}>{unavailable ? messages.loadError : messages.loading}{unavailable ? <button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => window.location.reload()}>{messages.retry}</button> : null}</section></main>;
}

function AuthorizedVideoZone({locale, messages, hero}: {locale: Locale; messages: Messages; hero: ReactNode}) {
  const router = useRouter();
  const authorization = useBulletinAuthorization();
  const api = useMemo(() => createMemberVideoApi(authorization), [authorization]);
  const [recordings, setRecordings] = useState<MemberRecording[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [playback, setPlayback] = useState<ActivePlayback | null>(null);
  const playbackRef = useRef<ActivePlayback | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [playError, setPlayError] = useState('');
  const [playing, setPlaying] = useState(false);
  const attempt = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playerTitle = useRef<HTMLHeadingElement>(null);

  const resolveMissing = useCallback(async (signal: AbortSignal) => {
    try {
      const items = await api.list(signal);
      if (signal.aborted) return;
      setRecordings(items);
      setSelectedId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null);
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
  }, [api, locale, router]);

  useEffect(() => {
    const controller = new AbortController();
    api.list(controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      const sorted = [...items].sort((a, b) => Number(b.featured) - Number(a.featured) || (b.uploadedAt??'').localeCompare(a.uploadedAt??'') || a.id.localeCompare(b.id));
      setRecordings(sorted);
      setSelectedId((current) => current && sorted.some((item) => item.id === current) ? current : sorted[0]?.id ?? null);
      setLoadError(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof HhcWebApiError && error.status === 401) {router.replace(`/${locale}`); return;}
      captureHandledError(error, {operation: 'member-videos.list'});
      setLoadError(true);
    });
    return () => controller.abort();
  }, [api, locale, retry, router]);

  useEffect(() => {playbackRef.current = playback;}, [playback]);
  useEffect(() => () => {
    attempt.current?.abort();
    video.current?.pause();
    if (playbackRef.current) void api.clear(playbackRef.current.url).catch(() => {});
  }, [api]);

  const selected = recordings?.find((recording) => recording.id === selectedId);
  const select = (id: string) => {
    if (id === selectedId) return;
    attempt.current?.abort();
    attempt.current = null;
    setPreparing(false);
    video.current?.pause();
    if (playbackRef.current) void api.clear(playbackRef.current.url).catch(() => {});
    playbackRef.current = null;
    setPlayback(null);
    setPlaying(false);
    setPlayError('');
    setSelectedId(id);
    queueMicrotask(() => { playerTitle.current?.focus(); playerTitle.current?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start'}); });
  };

  const start = async () => {
    if (!selected || preparing) return;
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
      if (!controller.signal.aborted) setPlayback({recordingId: selected.id, scopeId, grant, url});
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
  };

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
      setPlaying(false);
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

  const mediaError = useCallback(() => {video.current?.pause();setPlayError(messages.playError);},[messages.playError]);

  const pageCount = Math.ceil((recordings?.length ?? 0) / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const visibleItems = recordings?.slice((currentPage - 1) * pageSize, currentPage * pageSize) ?? [];
  return (
    <main>
      {hero}
      <div className="bg-[image:var(--hhc-page-gradient)] py-10 pb-14">
        <section className="shell grid gap-8" aria-label={messages.listTitle}>
          {loadError ? <div role="alert" className="rounded-[14px] border border-panel-border bg-panel p-7 text-center text-ink">{messages.loadError}<button type="button" className="ml-4 min-h-11 rounded-full border border-[var(--hhc-control-border)] px-5 font-semibold" onClick={() => setRetry((value) => value + 1)}>{messages.retry}</button></div> : null}
          {!loadError && !recordings ? <p role="status" className="rounded-[14px] border border-panel-border bg-panel p-8 text-center text-muted">{messages.loading}</p> : null}
          {!loadError && recordings?.length === 0 ? <p className="rounded-[14px] border border-panel-border bg-panel p-8 text-center text-muted">{messages.empty}</p> : null}
          {selected ? <div className="grid gap-4">
            <p className="text-sm font-semibold tracking-widest text-primary">{messages.selectedTitle}</p>
            {playback?.recordingId === selected.id ? <HlsPlayer key={playback.url} videoRef={video} playbackUrl={playback.url} availableQualities={(playback.grant.renditions??[]).map(rendition=>rendition.name)} watermark={playback.grant.watermarkCode} title={selected.title} labels={messages} onPlayingChange={setPlaying} onError={mediaError}/> : <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[14px] bg-neutral-950"><button type="button" disabled={preparing} onClick={() => void start()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-60"><Play size={18} aria-hidden="true" />{preparing ? messages.preparing : messages.play}</button></div>}
            <h2 ref={playerTitle} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">{selected.title}</h2>
            <p className="text-sm text-muted">{formatDate(selected.uploadedAt, locale)} · {formatDuration(selected.durationSeconds, messages.durationUnknown, locale)}</p>
            <p className="text-sm text-muted">{messages.expires} {formatDate(selected.expiresAt, locale)}</p>
            {playError ? <p role="alert" className="text-sm text-primary">{playError} <button type="button" className="underline" onClick={() => void start()}>{messages.retry}</button></p> : null}
          </div> : null}
          {recordings && recordings.length > 0 ? <div className="grid gap-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-panel-border pt-7"><h2 className="text-2xl font-semibold text-ink">{messages.listTitle}</h2><p className="text-sm text-muted">{messages.count.replace('{count}', String(recordings.length))}</p></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleItems.map((item) => <article key={item.id} className="grid min-w-0 gap-3 rounded-[14px] border border-panel-border bg-panel p-5 shadow-[inset_0_1px_0_var(--hhc-inset-highlight)]">
              <p className="text-sm text-muted">{formatDate(item.uploadedAt, locale, true)}</p>
              <h3 className="break-words text-lg font-semibold text-ink">{item.title}</h3>
              <p className="text-sm text-muted">{formatDuration(item.durationSeconds, messages.durationUnknown, locale)} · {messages.expires} {formatDate(item.expiresAt, locale, true)}</p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-primary">{item.featured ? <span>{messages.featured}</span> : null}{item.id === selectedId ? <span>{playing && playback?.recordingId === item.id ? messages.playing : messages.selected}</span> : null}</div>
              <button type="button" className="min-h-11 justify-self-start rounded-full border border-[var(--hhc-control-border)] bg-paper px-5 font-semibold text-[var(--hhc-control)] hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-primary" onClick={() => select(item.id)}>{messages.select}</button>
            </article>)}</div>
            {pageCount > 1 ? <nav aria-label={messages.listTitle} className="flex items-center justify-center gap-4"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="min-h-11 px-4 disabled:opacity-40">{messages.previous}</button><span>{currentPage} / {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="min-h-11 px-4 disabled:opacity-40">{messages.next}</button></nav> : null}
          </div> : null}
        </section>
      </div>
    </main>
  );
}
