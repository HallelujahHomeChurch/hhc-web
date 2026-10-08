'use client';

import {useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type RefObject} from 'react';
import Link from 'next/link';
import {ChevronDown, SkipBack, SkipForward, LoaderCircle, Maximize, Minimize, Pause, Play, Settings, Volume2, VolumeX} from 'lucide-react';
import {liveWindow,type LivePlayerState} from './live-player';
import type {PlayerLabels} from './HlsPlayer';
import {loadPreviewIndex, type PreviewCue} from './preview-index';
import styles from './PlayerChrome.module.css';
import {usePlayerFullscreen} from './use-player-fullscreen';
import {RecordingWatermark} from './RecordingWatermark';
import {PreviewSprite} from './PreviewSprite';

type Quality = 'auto' | '480p' | '720p' | '1080p';
type Props = {
  previousHref?:string; nextHref?:string;
  live?: LivePlayerState; onDvr?:()=>void; onReturnToLive?:()=>void;
  container: RefObject<HTMLDivElement | null>; videoRef: RefObject<HTMLVideoElement | null>;
  playbackUrl: string; watermark: string; labels: PlayerLabels;
  quality: Quality; qualities: Exclude<Quality, 'auto'>[]; loading: boolean; failed: boolean;
  onQualityChange: (quality: Quality) => void; onPlayingChange?: (playing: boolean) => void;
};

const touchQuery = '(pointer: coarse)';
const touchSnapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(touchQuery).matches;
const subscribeTouch = (notify:()=>void) => {
  const query = window.matchMedia?.(touchQuery);
  query?.addEventListener?.('change', notify);
  return () => query?.removeEventListener?.('change', notify);
};

export function playerClock(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return total >= 3600 ? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function PlayerChrome({container, videoRef, playbackUrl, watermark, labels, quality, qualities, loading, failed, onQualityChange, onPlayingChange,live,onDvr,onReturnToLive,previousHref,nextHref}: Props) {
  const touchUI = useSyncExternalStore(subscribeTouch, touchSnapshot, () => false);
  const fullscreenState = usePlayerFullscreen(container, videoRef, touchUI);
  const fullscreen = fullscreenState.mode !== 'inline';
  const [playing, setPlaying] = useState(false), [waiting, setWaiting] = useState(true);
  const [muted, setMuted] = useState(false), [volume, setVolume] = useState(1), [rate, setRate] = useState(1);
  const [liveRange,setLiveRange]=useState<ReturnType<typeof liveWindow>>(null);
  const [time, setTime] = useState(0), [duration, setDuration] = useState(0), [buffered, setBuffered] = useState(0);
  const [settings, setSettings] = useState(false), [visible, setVisible] = useState(true);
  const [feedback, setFeedback] = useState<{kind: 'play' | 'pause' | 'back' | 'forward'; id: number} | null>(null);
  const [preview, setPreview] = useState<number | null>(null), [cues, setCues] = useState<PreviewCue[]>([]);
  const [previewRequested, setPreviewRequested] = useState(false), [scrub, setScrub] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);
  const gesture = useRef<{id:number;x:number;y:number;moved:boolean;rate:number|null}|null>(null);
  const holdTimer = useRef(0), tapTimer = useRef(0);
  const lastTap = useRef<{time:number;side:'back'|'forward'|'center'}|null>(null);
  const hideTimer = useRef(0), feedbackTimer = useRef(0), dragging = useRef(false);
  const menu = useRef<HTMLDivElement>(null), settingsButton = useRef<HTMLButtonElement>(null);
  const playingCallback = useRef(onPlayingChange);
  useEffect(() => { playingCallback.current = onPlayingChange; }, [onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updatePlay = () => { setPlaying(!video.paused && !video.ended); playingCallback.current?.(!video.paused && !video.ended); };
    const updateTime = () => setTime(video.currentTime);
    const updateDuration = () => {const range=live ? liveWindow(video.seekable,live.verifiedEnd):null;setLiveRange(range);setDuration(live ? range?.end??0 : Number.isFinite(video.duration) ? video.duration : 0);};
    const updateVolume = () => { setMuted(video.muted); setVolume(video.volume); };
    const updateRate = () => setRate(video.playbackRate);
    const updateBuffer = () => {
      let end = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime + 1) end = Math.max(end, video.buffered.end(i));
      setBuffered(end);
    };
    const startWait = () => setWaiting(true), endWait = () => setWaiting(false);
    const events: [string, () => void][] = [['play', updatePlay], ['pause', updatePlay], ['ended', updatePlay], ['timeupdate', updateTime], ['durationchange', updateDuration], ['loadedmetadata',updateDuration], ['volumechange', updateVolume], ['ratechange', updateRate], ['progress', updateBuffer], ['progress', updateDuration], ['canplay',updateDuration], ['loadstart', startWait], ['seeking', startWait], ['waiting', startWait], ['playing', endWait], ['canplay', endWait], ['seeked', endWait], ['pause', endWait], ['ended', endWait], ['error', endWait]];
    for (const [event, handler] of events) video.addEventListener(event, handler);
    updatePlay(); updateTime(); updateDuration(); updateVolume(); updateRate();
    return () => { for (const [event, handler] of events) video.removeEventListener(event, handler); };
  }, [container, videoRef,live]);

  useEffect(()=>{container.current?.focus({preventScroll:true});},[container]);

  useEffect(() => {
    const video=videoRef.current;
    return () => { window.clearTimeout(hideTimer.current); window.clearTimeout(feedbackTimer.current); window.clearTimeout(holdTimer.current); window.clearTimeout(tapTimer.current);
      if (gesture.current?.rate != null && video) video.playbackRate = gesture.current.rate;
    };
  }, [videoRef]);

  useEffect(() => {
    if (!previewRequested || live) return;
    const controller = new AbortController();
    void loadPreviewIndex(playbackUrl, controller.signal).then(value => { if (!controller.signal.aborted) setCues(value); }).catch(() => {});
    return () => controller.abort();
  }, [playbackUrl, previewRequested,live]);

  useEffect(() => {
    if (!settings) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !menu.current?.contains(event.target) && !settingsButton.current?.contains(event.target)) setSettings(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [settings]);

  const showControls = () => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!videoRef.current?.paused && !dragging.current && !menu.current && !container.current?.querySelector('[data-controls] :focus-visible')) setVisible(false);
    }, 2500);
  };
  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    const kind = video.paused ? 'play' : 'pause';
    if (video.paused) void video.play().catch(() => {}); else {onDvr?.();video.pause();}
    setFeedback({kind, id: Date.now()});
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 900);
    showControls();
  };
  const toggleFullscreen = fullscreenState.toggle;
  const seekStart = liveRange?.start ?? 0;
  const seek = (value: number) => { if (videoRef.current && duration > seekStart) { onDvr?.();videoRef.current.currentTime = Math.min(duration, Math.max(seekStart, value)); setTime(videoRef.current.currentTime); } };
  const cancelGesture = () => {
    window.clearTimeout(holdTimer.current);
    if (gesture.current?.rate != null && videoRef.current) videoRef.current.playbackRate = gesture.current.rate;
    gesture.current = null; setHolding(false);
  };
  const pointerDown = (event:ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch') return;
    if (!event.isPrimary) {cancelGesture();window.clearTimeout(tapTimer.current);lastTap.current=null;return;}
    gesture.current = {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,rate:null};
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimer.current = window.setTimeout(() => {
      const video = videoRef.current, active = gesture.current;
      if (video && active && !active.moved && !video.paused && !failed && !loading) {
        window.clearTimeout(tapTimer.current);lastTap.current=null;
        active.rate = video.playbackRate;video.playbackRate = 2;setHolding(true);
      }
    }, 450);
  };
  const pointerMove = (event:ReactPointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.hypot(event.clientX-active.x,event.clientY-active.y)>12) {
      active.moved=true;window.clearTimeout(holdTimer.current);
      if (active.rate != null && videoRef.current) {videoRef.current.playbackRate=active.rate;active.rate=null;setHolding(false);}
    }
  };
  const pointerUp = (event:ReactPointerEvent<HTMLButtonElement>) => {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    const dx=event.clientX-active.x,dy=event.clientY-active.y,held=active.rate!=null;
    cancelGesture();
    if (held) return;
    if (Math.abs(dy)>60 && Math.abs(dy)>Math.abs(dx)*1.5) {
      window.clearTimeout(tapTimer.current);lastTap.current=null;
      if (dy<0 && !fullscreen) void toggleFullscreen();
      else if (dy>0 && fullscreen) void fullscreenState.exit();
      return;
    }
    if (active.moved) return;
    const bounds=event.currentTarget.getBoundingClientRect();
    const fraction=bounds.width>0?(event.clientX-bounds.left)/bounds.width:0.5;
    const side=fraction<0.35?'back':fraction>0.65?'forward':'center';
    const previous=lastTap.current,now=Date.now();
    window.clearTimeout(tapTimer.current);
    if (previous && now-previous.time<280 && previous.side===side && side!=='center') {
      lastTap.current=null;seek((videoRef.current?.currentTime??0)+(side==='back'?-10:10));
      setFeedback({kind:side,id:now});window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current=window.setTimeout(()=>setFeedback(null),900);showControls();
    } else {
      lastTap.current={time:now,side};
      tapTimer.current=window.setTimeout(()=>{lastTap.current=null;if(visible){window.clearTimeout(hideTimer.current);setVisible(false);}else showControls();},280);
    }
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && settings) { event.preventDefault(); event.stopPropagation(); setSettings(false); settingsButton.current?.focus(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && (event.target.closest('input,select,textarea,[contenteditable=true]') || event.key === ' ' && event.target.closest('button'))) return;
    const key = event.key.toLowerCase();
    if (![' ', 'k', 'arrowleft', 'arrowright', 'j', 'l', 'm', 'f'].includes(key)) return;
    event.preventDefault();
    if (event.repeat && [' ', 'k', 'm', 'f'].includes(key)) return;
    if (key === ' ' || key === 'k') toggle();
    else if (key === 'f') void toggleFullscreen();
    else if (key === 'm' && videoRef.current) videoRef.current.muted = !videoRef.current.muted;
    else seek((videoRef.current?.currentTime ?? 0) + (key === 'arrowleft' ? -5 : key === 'arrowright' ? 5 : key === 'j' ? -10 : 10));
    showControls();
  };
  // Bind shortcuts to this focused player; inputs and page-level scrolling retain their keys.
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const keyboard = (event: KeyboardEvent) => keyDown(event);
    root.addEventListener('keydown', keyboard);
    const mouseMove = (event:PointerEvent) => {if(event.pointerType!=='touch')showControls();};
    root.addEventListener('pointermove', mouseMove);
    root.addEventListener('focusin', showControls);
    const video = videoRef.current;
    video?.addEventListener('play', showControls);
    return () => { root.removeEventListener('keydown', keyboard); root.removeEventListener('pointermove', mouseMove); root.removeEventListener('focusin', showControls); video?.removeEventListener('play', showControls); };
  });

  const current = scrub ?? time;
  const previewTime = scrub ?? preview;
  const cue = previewTime === null ? undefined : cues.find(cue => cue.start <= previewTime && cue.end > previewTime);
  const neighbor = cue ? cues.find(item => item.start >= cue.end && item.url !== cue.url)?.url : undefined;
  const controlsVisible = visible || !playing || settings || scrub !== null;
  useEffect(() => {
    const root=container.current;if(!root)return;
    root.setAttribute('data-touch',String(touchUI));root.setAttribute('data-controls-visible',String(controlsVisible));
    return()=>{root.removeAttribute('data-touch');root.removeAttribute('data-controls-visible');};
  }, [container,touchUI,controlsVisible]);
  const atLive = Boolean(live?.canFollow && liveRange && playing && current >= liveRange.edge - 2);
  const percentage = (value: number) => duration > seekStart ? `${Math.min(100, Math.max(0, (value - seekStart) / (duration - seekStart) * 100))}%` : '0%';
  return <>
    <button type="button" className={styles.surface} aria-label={labels.togglePlayback} tabIndex={-1} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelGesture} onLostPointerCapture={cancelGesture} onContextMenu={event=>{if(touchUI)event.preventDefault();}} onClick={event => {if(!touchUI || event.detail===0){container.current?.focus({preventScroll:true}); toggle();}}} />
    <RecordingWatermark container={container} videoRef={videoRef} code={watermark}/>
    {fullscreenState.error ? <div className={styles.fullscreenError} role="alert">{labels.fullscreenError}</div> : null}
    {holding ? <div className={styles.speedFeedback} aria-hidden="true">2×</div> : null}
    {feedback ? <div className={`${styles.feedback} ${feedback.kind==='back'?styles.seekBack:feedback.kind==='forward'?styles.seekForward:''}`} aria-hidden="true"><span key={feedback.id}>{feedback.kind === 'play' ? <Play size={36} fill="currentColor"/> : feedback.kind === 'pause' ? <Pause size={36} fill="currentColor"/> : <><span>{feedback.kind==='back'?'−10':'+10'}</span><span className="sr-only">{labels.seek}</span></>}</span></div> : null}
    {(loading || waiting) && !failed && !feedback ? <div className={styles.loading} role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{labels.buffering}</span></div> : null}
    {touchUI || !playing && !loading && !waiting && !failed ? <div data-controls className={`${styles.centerControls} ${controlsVisible ? '' : styles.hidden}`}>
      {touchUI && previousHref && labels.previousVideo ? <Link href={previousHref} className={styles.skip} aria-label={labels.previousVideo}><SkipBack fill="currentColor"/></Link> : <span/>}
      {!loading && !waiting && !failed ? <button type="button" className={styles.centerPlay} aria-label={playing ? labels.pause : labels.play} onClick={toggle}>{playing ? <Pause fill="currentColor"/> : <Play fill="currentColor"/>}</button> : <span/>}
      {touchUI && nextHref && labels.nextVideo ? <Link href={nextHref} className={styles.skip} aria-label={labels.nextVideo}><SkipForward fill="currentColor"/></Link> : <span/>}
    </div> : null}
    {touchUI ? <div data-controls className={`${styles.topControls} ${controlsVisible ? '' : styles.hidden}`}>
      {fullscreen ? <button type="button" className={styles.button} aria-label={labels.exitFullscreen} onClick={()=>void fullscreenState.exit()}><ChevronDown/></button> : <span/>}
      <button ref={settingsButton} type="button" className={styles.button} aria-label={labels.settings} aria-expanded={settings} onClick={()=>setSettings(value=>!value)}><Settings/></button>
    </div> : null}
    {settings ? <div ref={menu} data-controls className={styles.settings} role="group" aria-label={labels.settings}>
      <label>{labels.playbackSpeed}<select aria-label={labels.playbackSpeed} value={rate} onChange={event => { if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}>
        {[0.5,0.75,1,1.25,1.5,1.75,2].map(value => <option key={value} value={value}>{value}×</option>)}
      </select></label>
      <label>{labels.quality}<select aria-label={labels.quality} value={quality} disabled={loading} onChange={event => onQualityChange(event.target.value as Quality)}><option value="auto">{labels.auto}</option>{qualities.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    </div> : null}
    <div data-controls className={`${styles.controls} ${controlsVisible ? '' : styles.hidden}`}>
      <div className={styles.seek} onPointerLeave={() => { if (!dragging.current) setPreview(null); }}>
        <div className={styles.track} aria-hidden="true"><span className={styles.buffered} style={{width:percentage(buffered)}}/><span className={styles.played} style={{width:percentage(current)}}/></div>
        <input type="range" aria-label={labels.seek} aria-valuetext={`${playerClock(current)} / ${playerClock(duration)}`} min={seekStart} max={duration} step={0.1} value={Math.max(seekStart, Math.min(duration, current))} disabled={duration <= seekStart}
          onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); if (duration > 0 && bounds.width > 0) { setPreview(Math.min(duration - 0.001, Math.max(seekStart, seekStart + (event.clientX - bounds.left) / bounds.width * (duration - seekStart)))); setPreviewRequested(true); } }}
          onPointerDown={event => { dragging.current = true; setScrub(Number(event.currentTarget.value)); setPreviewRequested(true); event.currentTarget.setPointerCapture?.(event.pointerId); }}
          onChange={event => { const value = Number(event.target.value); if (dragging.current) setScrub(value); else seek(value); }}
          onPointerUp={event => { seek(Number(event.currentTarget.value)); dragging.current = false; setScrub(null); setPreview(null); }}
          onPointerCancel={() => {dragging.current = false; setScrub(null); setPreview(null);}} />
        <div className={styles.preview} hidden={previewTime===null||duration<=0} aria-hidden="true" style={{left:`clamp(80px, ${percentage(previewTime??0)}, calc(100% - 80px))`}}>
          {!failed && !live ? <PreviewSprite key={playbackUrl} playbackUrl={playbackUrl} cue={cue} neighbor={neighbor}/> : null}
          <time>{playerClock(previewTime??0)}</time>
        </div>
      </div>
      <div className={styles.row}>
        {!touchUI ? <><button type="button" className={styles.button} aria-label={playing ? labels.pause : labels.play} title={playing ? labels.pause : labels.play} onClick={toggle}>{playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}</button>
        <button type="button" className={styles.button} aria-label={muted || volume === 0 ? labels.unmute : labels.mute} title={muted || volume === 0 ? labels.unmute : labels.mute} onClick={() => { const video = videoRef.current; if (video) { if (video.volume === 0) {video.volume = 1; video.muted = false;} else video.muted = !video.muted; } }}>{muted || volume === 0 ? <VolumeX size={22}/> : <Volume2 size={22}/>}</button>
        <input type="range" className={styles.volume} aria-label={labels.volume} min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={event => { if (videoRef.current) { videoRef.current.volume = Number(event.target.value); videoRef.current.muted = false; } }}/></> : null}
        {live ? <button type="button" className={`${styles.button} ${styles.liveButton}`} data-live-edge={atLive} disabled={!live.canFollow || !liveRange} aria-label={live.canFollow ? live.backToLive : live.label} title={live.canFollow ? live.backToLive : live.label} onClick={onReturnToLive}><span className={styles.liveDot} aria-hidden="true"/><span className={styles.liveText}>{live.canFollow ? live.liveLabel ?? live.label : live.label}</span></button> : <span className={styles.time}>{playerClock(current)} / {playerClock(duration)}</span>}<span className={styles.spacer}/>
        {!touchUI ? <button ref={settingsButton} type="button" className={styles.button} aria-label={labels.settings} title={labels.settings} aria-expanded={settings} onClick={() => setSettings(value => !value)}><Settings size={22}/></button> : null}
        <button type="button" className={styles.button} aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen} title={fullscreen ? labels.exitFullscreen : labels.fullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={22}/> : <Maximize size={22}/>}</button>
      </div>
    </div>
  </>;
}
