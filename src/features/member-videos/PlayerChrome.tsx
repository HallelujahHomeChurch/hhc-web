'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';
import {LoaderCircle, Maximize, Minimize, Pause, Play, Settings, Volume2, VolumeX} from 'lucide-react';
import type {PlayerLabels} from './HlsPlayer';
import {loadPreviewIndex, type PreviewCue} from './preview-index';
import styles from './PlayerChrome.module.css';
import {usePlayerFullscreen} from './use-player-fullscreen';
import {RecordingWatermark} from './RecordingWatermark';

type Quality = 'auto' | '720p' | '1080p';
type Props = {
  container: RefObject<HTMLDivElement | null>; videoRef: RefObject<HTMLVideoElement | null>;
  playbackUrl: string; watermark: string; labels: PlayerLabels;
  quality: Quality; qualities: Exclude<Quality, 'auto'>[]; loading: boolean; failed: boolean;
  onQualityChange: (quality: Quality) => void; onPlayingChange?: (playing: boolean) => void;
};

export function playerClock(seconds: number) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return total >= 3600 ? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function PlayerChrome({container, videoRef, playbackUrl, watermark, labels, quality, qualities, loading, failed, onQualityChange, onPlayingChange}: Props) {
  const fullscreenState = usePlayerFullscreen(container, videoRef);
  const fullscreen = fullscreenState.mode !== 'inline';
  const [playing, setPlaying] = useState(false), [waiting, setWaiting] = useState(true);
  const [muted, setMuted] = useState(false), [volume, setVolume] = useState(1), [rate, setRate] = useState(1);
  const [time, setTime] = useState(0), [duration, setDuration] = useState(0), [buffered, setBuffered] = useState(0);
  const [settings, setSettings] = useState(false), [visible, setVisible] = useState(true);
  const [feedback, setFeedback] = useState<{kind: 'play' | 'pause'; id: number} | null>(null);
  const [preview, setPreview] = useState<number | null>(null), [cues, setCues] = useState<PreviewCue[]>([]);
  const [previewRequested, setPreviewRequested] = useState(false), [scrub, setScrub] = useState<number | null>(null);
  const [failedImage, setFailedImage] = useState('');
  const hideTimer = useRef(0), feedbackTimer = useRef(0), dragging = useRef(false);
  const menu = useRef<HTMLDivElement>(null), settingsButton = useRef<HTMLButtonElement>(null);
  const playingCallback = useRef(onPlayingChange);
  useEffect(() => { playingCallback.current = onPlayingChange; }, [onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updatePlay = () => { setPlaying(!video.paused && !video.ended); playingCallback.current?.(!video.paused && !video.ended); };
    const updateTime = () => setTime(video.currentTime);
    const updateDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const updateVolume = () => { setMuted(video.muted); setVolume(video.volume); };
    const updateRate = () => setRate(video.playbackRate);
    const updateBuffer = () => {
      let end = video.currentTime;
      for (let i = 0; i < video.buffered.length; i++) if (video.buffered.start(i) <= video.currentTime + 1) end = Math.max(end, video.buffered.end(i));
      setBuffered(end);
    };
    const startWait = () => setWaiting(true), endWait = () => setWaiting(false);
    const events: [string, () => void][] = [['play', updatePlay], ['pause', updatePlay], ['ended', updatePlay], ['timeupdate', updateTime], ['durationchange', updateDuration], ['volumechange', updateVolume], ['ratechange', updateRate], ['progress', updateBuffer], ['loadstart', startWait], ['seeking', startWait], ['waiting', startWait], ['playing', endWait], ['canplay', endWait], ['seeked', endWait], ['pause', endWait], ['ended', endWait], ['error', endWait]];
    for (const [event, handler] of events) video.addEventListener(event, handler);
    container.current?.focus({preventScroll: true});
    return () => { for (const [event, handler] of events) video.removeEventListener(event, handler); };
  }, [container, videoRef]);

  useEffect(() => {
    return () => { window.clearTimeout(hideTimer.current); window.clearTimeout(feedbackTimer.current); };
  }, []);

  useEffect(() => {
    if (!previewRequested) return;
    const controller = new AbortController();
    void loadPreviewIndex(playbackUrl, controller.signal).then(value => { if (!controller.signal.aborted) setCues(value); }).catch(() => {});
    return () => controller.abort();
  }, [playbackUrl, previewRequested]);

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
      if (!videoRef.current?.paused && !dragging.current && !container.current?.querySelector('[data-controls]:focus-within')) setVisible(false);
    }, 2500);
  };
  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    const kind = video.paused ? 'play' : 'pause';
    if (video.paused) void video.play().catch(() => {}); else video.pause();
    setFeedback({kind, id: Date.now()});
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), 900);
    showControls();
  };
  const toggleFullscreen = fullscreenState.toggle;
  const seek = (value: number) => { if (videoRef.current && duration > 0) { videoRef.current.currentTime = Math.min(duration, Math.max(0, value)); setTime(videoRef.current.currentTime); } };
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
    root.addEventListener('pointermove', showControls);
    root.addEventListener('focusin', showControls);
    const video = videoRef.current;
    video?.addEventListener('play', showControls);
    return () => { root.removeEventListener('keydown', keyboard); root.removeEventListener('pointermove', showControls); root.removeEventListener('focusin', showControls); video?.removeEventListener('play', showControls); };
  });

  const current = scrub ?? time;
  const previewTime = scrub ?? preview;
  const cue = previewTime === null ? undefined : cues.find(cue => cue.start <= previewTime && cue.end > previewTime);
  const controlsVisible = visible || !playing || settings || scrub !== null;
  const percentage = (value: number) => duration > 0 ? `${Math.min(100, Math.max(0, value / duration * 100))}%` : '0%';
  return <>
    <button type="button" className={styles.surface} aria-label={labels.togglePlayback} tabIndex={-1} onClick={() => {container.current?.focus({preventScroll:true}); toggle();}} />
    <RecordingWatermark container={container} videoRef={videoRef} code={watermark}/>
    {fullscreenState.error ? <div className={styles.fullscreenError} role="alert">{labels.fullscreenError}</div> : null}
    {feedback ? <div className={styles.feedback} aria-hidden="true"><span key={feedback.id}>{feedback.kind === 'play' ? <Play size={36} fill="currentColor"/> : <Pause size={36} fill="currentColor"/>}</span></div> : null}
    {(loading || waiting) && !failed && !feedback ? <div className={styles.loading} role="status"><LoaderCircle aria-hidden="true"/><span className="sr-only">{labels.buffering}</span></div> : null}
    {settings ? <div ref={menu} data-controls className={styles.settings} role="group" aria-label={labels.settings}>
      <label>{labels.playbackSpeed}<select aria-label={labels.playbackSpeed} value={rate} onChange={event => { if (videoRef.current) videoRef.current.playbackRate = Number(event.target.value); }}>
        {[0.5,0.75,1,1.25,1.5,1.75,2].map(value => <option key={value} value={value}>{value}×</option>)}
      </select></label>
      <label>{labels.quality}<select aria-label={labels.quality} value={quality} disabled={loading} onChange={event => onQualityChange(event.target.value as Quality)}><option value="auto">{labels.auto}</option>{qualities.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    </div> : null}
    <div data-controls className={`${styles.controls} ${controlsVisible ? '' : styles.hidden}`}>
      <div className={styles.seek} onPointerLeave={() => { if (!dragging.current) setPreview(null); }}>
        <div className={styles.track} aria-hidden="true"><span className={styles.buffered} style={{width:percentage(buffered)}}/><span className={styles.played} style={{width:percentage(current)}}/></div>
        <input type="range" aria-label={labels.seek} aria-valuetext={`${playerClock(current)} / ${playerClock(duration)}`} min={0} max={duration} step={0.1} value={current} disabled={duration <= 0}
          onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); if (duration > 0 && bounds.width > 0) { setPreview(Math.min(duration - 0.001, Math.max(0, (event.clientX - bounds.left) / bounds.width * duration))); setPreviewRequested(true); } }}
          onPointerDown={event => { dragging.current = true; setScrub(Number(event.currentTarget.value)); setPreviewRequested(true); event.currentTarget.setPointerCapture?.(event.pointerId); }}
          onChange={event => { const value = Number(event.target.value); if (dragging.current) setScrub(value); else seek(value); }}
          onPointerUp={event => { seek(Number(event.currentTarget.value)); dragging.current = false; setScrub(null); setPreview(null); }}
          onPointerCancel={() => {dragging.current = false; setScrub(null); setPreview(null);}} />
        {previewTime !== null && duration > 0 ? <div className={styles.preview} aria-hidden="true" style={{left:`clamp(80px, ${percentage(previewTime)}, calc(100% - 80px))`}}>
          {cue && failedImage !== cue.url ? <div className={styles.previewImage}>
            {/* Authenticated sprite requests must retain the media cookie, without an image proxy. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cue.url} alt="" crossOrigin="use-credentials" referrerPolicy="no-referrer" width={960} height={90} style={{left:-cue.x}} onError={() => setFailedImage(cue.url)}/>
          </div> : null}<time>{playerClock(previewTime)}</time>
        </div> : null}
      </div>
      <div className={styles.row}>
        <button type="button" className={styles.button} aria-label={playing ? labels.pause : labels.play} title={playing ? labels.pause : labels.play} onClick={toggle}>{playing ? <Pause size={22} fill="currentColor"/> : <Play size={22} fill="currentColor"/>}</button>
        <button type="button" className={styles.button} aria-label={muted || volume === 0 ? labels.unmute : labels.mute} title={muted || volume === 0 ? labels.unmute : labels.mute} onClick={() => { const video = videoRef.current; if (video) { if (video.volume === 0) {video.volume = 1; video.muted = false;} else video.muted = !video.muted; } }}>{muted || volume === 0 ? <VolumeX size={22}/> : <Volume2 size={22}/>}</button>
        <input type="range" className={styles.volume} aria-label={labels.volume} min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={event => { if (videoRef.current) { videoRef.current.volume = Number(event.target.value); videoRef.current.muted = false; } }}/>
        <span className={styles.time}>{playerClock(current)} / {playerClock(duration)}</span><span className={styles.spacer}/>
        <button ref={settingsButton} type="button" className={styles.button} aria-label={labels.settings} title={labels.settings} aria-expanded={settings} onClick={() => setSettings(value => !value)}><Settings size={22}/></button>
        <button type="button" className={styles.button} aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen} title={fullscreen ? labels.exitFullscreen : labels.fullscreen} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={22}/> : <Maximize size={22}/>}</button>
      </div>
    </div>
  </>;
}
