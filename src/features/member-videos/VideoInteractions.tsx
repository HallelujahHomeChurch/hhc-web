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

type Api=ReturnType<typeof createMemberVideoApi>;
export function VideoInteractions({api,id,title,locale,live,currentTime,children,description,date,dateKind,durationSeconds}:{api:Api;id:string;title:string;locale:string;live:boolean;currentTime?:()=>number;children?:ReactNode;description?:string;date?:string|null;dateKind?:'uploaded'|'live'|'scheduled';durationSeconds?:number}){
 const t=videoLabels(locale);
 const [summary,setSummary]=useState<RecordingInteractionSummary|null>(null),[metrics,setMetrics]=useState<RecordingMemberMetrics|null>(null),[error,setError]=useState(false),[disabled,setDisabled]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const desired=useRef<boolean|null>(null),likeVersion=useRef(0);
 const [shareTime,setShareTime]=useState<number|undefined>(),[sharing,setSharing]=useState(false);
 useEffect(()=>{const abort=new AbortController();let timer=0;
  const load=async()=>{const version=likeVersion.current;const [interaction,stats]=await Promise.allSettled([api.interactions(id,abort.signal),api.metrics(id,abort.signal)]);if(abort.signal.aborted)return;
   if(version===likeVersion.current&&desired.current===null){if(interaction.status==='fulfilled'){setSummary(interaction.value);setError(false);setDisabled(false)}else if(interaction.reason?.code==='recording_interactions_unavailable'){setDisabled(true);setError(false)}else setError(true);}
   setMetrics(stats.status==='fulfilled'?stats.value:null);
   timer=window.setTimeout(()=>void load(),30000);
  };void load();return()=>{abort.abort();window.clearTimeout(timer)}
 },[api,id,revision]);
 const like=async()=>{if(!summary||busy)return;setBusy(true);setError(false);likeVersion.current++;desired.current??=!summary.liked;try{setSummary(await api.setLike(id,{liked:desired.current}));desired.current=null}catch{setError(true)}finally{setBusy(false)}};
 const share=()=>{setShareTime(!live&&currentTime?currentTime():undefined);setSharing(true);};
 return <section className={styles.panel} aria-label={t.comments}>
  <div className={styles.actions}><div className={styles.buttons}>{!disabled?<button type="button" disabled={!summary||busy} aria-pressed={summary?.liked??false} onClick={()=>void like()}><ThumbsUp size={18} aria-hidden="true"/>{summary?new Intl.NumberFormat(locale).format(summary.likes):t.like}<span className="sr-only">{t.like}</span></button>:null}<button type="button" onClick={()=>void share()}><Share2 size={18} aria-hidden="true"/>{t.share}</button></div></div>
  {sharing?<VideoShareDialog open onClose={()=>setSharing(false)} title={title} watchUrl={window.location.href} currentTime={shareTime} durationSeconds={durationSeconds} locale={locale}/>:null}
  <VideoInformation description={description} date={date} dateKind={dateKind} metrics={metrics} locale={locale} live={live}/>
  {children}
  {error?<p role="status">{t.error} <button type="button" onClick={()=>desired.current!==null?void like():setRevision(v=>v+1)}>{t.retry}</button></p>:null}
  {!disabled&&summary?<VideoComments key={id} api={api} id={id} locale={locale} count={summary.commentCount} enabled={summary.commentsEnabled} onChanged={()=>setRevision(v=>v+1)}/>:null}
 </section>;
}
