'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Share2,ThumbsUp} from 'lucide-react';
import type {RecordingInteractionSummary,RecordingMemberMetrics} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import {VideoShareDialog} from './VideoShareDialog';
import {VideoComments} from './VideoComments';
import {VideoInformation} from './VideoInformation';
import {videoLabels} from './video-labels';
import styles from './VideoInteractions.module.css';
import {LoadingBlock, LoadingStatus} from '@/components/ui/ContentLoading';

type Api=ReturnType<typeof createMemberVideoApi>;
export function VideoInteractions({api,id,title,locale,live,currentTime,children,description,date,dateKind,durationSeconds}:{api:Api;id:string;title:string;locale:string;live:boolean;currentTime?:()=>number;children?:ReactNode;description?:string;date?:string|null;dateKind?:'uploaded'|'live'|'scheduled';durationSeconds?:number}){
 const t=videoLabels(locale);
 const [summary,setSummary]=useState<RecordingInteractionSummary|null>(null),[metrics,setMetrics]=useState<RecordingMemberMetrics|null>(null),[error,setError]=useState(false),[disabled,setDisabled]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [metricsPending,setMetricsPending]=useState(true);
 const desired=useRef<boolean|null>(null),likeVersion=useRef(0);
 const [shareTime,setShareTime]=useState<number|undefined>(),[sharing,setSharing]=useState(false);
 useEffect(()=>{const abort=new AbortController();let timer=0;
  const load=async()=>{const version=likeVersion.current;
   await Promise.allSettled([
    api.interactions(id,abort.signal).then(value=>{
     if(abort.signal.aborted||version!==likeVersion.current||desired.current!==null)return;
     setSummary(value);setError(false);setDisabled(false);
    },reason=>{
     if(abort.signal.aborted||version!==likeVersion.current||desired.current!==null)return;
     if(reason?.code==='recording_interactions_unavailable'){setDisabled(true);setError(false)}else setError(true);
    }),
    api.metrics(id,abort.signal).then(value=>{if(!abort.signal.aborted)setMetrics(value);},()=>{
     // Keep the last known statistics during a transient polling failure.
    }).finally(()=>{if(!abort.signal.aborted)setMetricsPending(false);})
   ]);
   if(!abort.signal.aborted)timer=window.setTimeout(()=>void load(),30000);
  };void load();return()=>{abort.abort();window.clearTimeout(timer)}
 },[api,id,revision]);
 const like=async()=>{if(!summary||busy)return;setBusy(true);setError(false);likeVersion.current++;desired.current??=!summary.liked;try{setSummary(await api.setLike(id,{liked:desired.current}));desired.current=null}catch{setError(true)}finally{setBusy(false)}};
 const share=()=>{setShareTime(!live&&currentTime?currentTime():undefined);setSharing(true);};
 return <section className={styles.panel} aria-label={t.comments}>
  <div className={styles.actions}><div className={styles.buttons}>{!disabled?<button type="button" disabled={!summary||busy} aria-pressed={summary?.liked??false} onClick={()=>void like()}><ThumbsUp size={20} aria-hidden="true"/><span>{summary?new Intl.NumberFormat(locale).format(summary.likes):t.like}</span><span className="sr-only">{t.like}</span></button>:null}<button type="button" onClick={()=>void share()}><Share2 size={18} aria-hidden="true"/>{t.share}</button></div></div>
  {sharing?<VideoShareDialog open onClose={()=>setSharing(false)} title={title} watchUrl={window.location.href} currentTime={shareTime} durationSeconds={durationSeconds} locale={locale}/>:null}
  <VideoInformation description={description} date={date} dateKind={dateKind} metrics={metrics} loadingMetrics={metricsPending} locale={locale} live={live}/>
  {children}
  {error?<p role="status">{t.error} <button type="button" onClick={()=>desired.current!==null?void like():setRevision(v=>v+1)}>{t.retry}</button></p>:null}
  {!disabled&&!summary&&!error?<div data-loading-layout="video-interactions"><LoadingStatus label={t.loading}/><div aria-busy="true" className={styles.interactionSkeleton}><LoadingBlock className={styles.commentHeading}/><LoadingBlock className={styles.commentPreview}/></div></div>:null}
  {!disabled&&summary?<VideoComments key={id} api={api} id={id} locale={locale} count={summary.commentCount} enabled={summary.commentsEnabled} onChanged={()=>setRevision(v=>v+1)}/>:null}
 </section>;
}
