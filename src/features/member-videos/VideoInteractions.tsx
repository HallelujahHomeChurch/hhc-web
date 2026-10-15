'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {Share2,ThumbsUp} from 'lucide-react';
import type {RecordingComment,RecordingInteractionSummary,RecordingMemberMetrics} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import {videoShareURL} from './share';
import styles from './VideoInteractions.module.css';

type Api=ReturnType<typeof createMemberVideoApi>;
const copy={en:{like:'Like',share:'Share',copied:'Link copied',comments:'Comments',add:'Add a comment',send:'Comment',cancel:'Cancel',reply:'Reply',replies:'Replies',edit:'Edit',save:'Save',remove:'Delete',report:'Report',reason:'Reason for reporting',reported:'Report received',load:'Load more',retry:'Retry',error:'Unable to update. Please try again.',closed:'Comments are turned off.',empty:'No comments yet.',deleted:'Comment deleted',newest:'Newest first',oldest:'Oldest first',watching:'watching now',views:'views',confirm:'Delete this comment?'},zh:{like:'按讚',share:'分享',copied:'已複製連結',comments:'留言',add:'新增留言',send:'留言',cancel:'取消',reply:'回覆',replies:'回覆',edit:'編輯',save:'儲存',remove:'刪除',report:'檢舉',reason:'檢舉原因',reported:'已收到檢舉',load:'載入更多',retry:'重試',error:'無法完成操作，請重試。',closed:'已關閉留言。',empty:'尚無留言。',deleted:'留言已刪除',newest:'由新到舊',oldest:'由舊到新',watching:'人正在觀看',views:'次觀看',confirm:'刪除這則留言？'}};
type Labels=typeof copy.en;
const cn:Labels={...copy.zh,like:'点赞',share:'分享',copied:'已复制链接',comments:'留言',add:'新增留言',cancel:'取消',reply:'回复',replies:'回复',edit:'编辑',save:'保存',remove:'删除',report:'举报',reason:'举报原因',reported:'已收到举报',load:'加载更多',retry:'重试',error:'无法完成操作，请重试。',closed:'已关闭留言。',empty:'尚无留言。',deleted:'留言已删除',watching:'人正在观看',views:'次观看',confirm:'删除这则留言？'};
export function VideoInteractions({api,id,title,locale,live,currentTime,children}:{api:Api;id:string;title:string;locale:string;live:boolean;currentTime?:()=>number;children?:ReactNode}){
 const t=locale==='en'?copy.en:locale==='zh-Hans'?cn:copy.zh;
 const [summary,setSummary]=useState<RecordingInteractionSummary|null>(null),[metrics,setMetrics]=useState<RecordingMemberMetrics|null>(null),[error,setError]=useState(false),[disabled,setDisabled]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const desired=useRef<boolean|null>(null),likeVersion=useRef(0);
 const [includeTime,setIncludeTime]=useState(false);
 useEffect(()=>{const abort=new AbortController();let timer=0;
  const load=async()=>{const version=likeVersion.current;const [interaction,stats]=await Promise.allSettled([api.interactions(id,abort.signal),api.metrics(id,abort.signal)]);if(abort.signal.aborted)return;
   if(version===likeVersion.current&&desired.current===null){if(interaction.status==='fulfilled'){setSummary(interaction.value);setError(false);setDisabled(false)}else if(interaction.reason?.code==='recording_interactions_unavailable'){setDisabled(true);setError(false)}else setError(true);}
   setMetrics(stats.status==='fulfilled'?stats.value:null);
   timer=window.setTimeout(()=>void load(),30000);
  };void load();return()=>{abort.abort();window.clearTimeout(timer)}
 },[api,id,revision]);
 const like=async()=>{if(!summary||busy)return;setBusy(true);setError(false);likeVersion.current++;desired.current??=!summary.liked;try{setSummary(await api.setLike(id,{liked:desired.current}));desired.current=null}catch{setError(true)}finally{setBusy(false)}};
 const share=async()=>{const url=videoShareURL(window.location.href,!live&&includeTime?currentTime?.():undefined);try{if(navigator.share)await navigator.share({title,url});else{await navigator.clipboard.writeText(url);setNotice(t.copied)}}catch(e){if((e as {name?:string}).name!=='AbortError')setNotice(t.error)}};
 return <section className={styles.panel} aria-label={t.comments}>
  <div className={styles.actions}><p className={styles.count}>{metrics?.status==='not_started'?(locale==='en'?'Viewing statistics start after launch':'觀看統計自功能上線起計'):metrics?`${new Intl.NumberFormat(locale).format(live?metrics.currentViewers:metrics.totalViews)} ${live?t.watching:t.views}`:'—'}</p><div className={styles.buttons}>{!disabled?<button type="button" disabled={!summary||busy} aria-pressed={summary?.liked??false} onClick={()=>void like()}><ThumbsUp size={18} aria-hidden="true"/>{summary?new Intl.NumberFormat(locale).format(summary.likes):t.like}<span className="sr-only">{t.like}</span></button>:null}<button type="button" onClick={()=>void share()}><Share2 size={18} aria-hidden="true"/>{t.share}</button></div></div>
  {!live&&currentTime?<label><input type="checkbox" checked={includeTime} onChange={e=>setIncludeTime(e.target.checked)}/> {locale==='en'?'Share from the current position':locale==='zh-Hans'?'分享当前播放位置':'分享目前播放位置'}</label>:null}
  {children}
  {notice?<p role="status">{notice}</p>:null}
  {error?<p role="status">{t.error} <button type="button" onClick={()=>desired.current!==null?void like():setRevision(v=>v+1)}>{t.retry}</button></p>:null}
  {!disabled&&summary?<><h3>{t.comments}</h3>{summary.commentsEnabled?<CommentComposer api={api} id={id} t={t} onDone={()=>setRevision(v=>v+1)}/>:<p>{t.closed}</p>}<CommentList key={id} api={api} id={id} t={t} locale={locale} enabled={summary.commentsEnabled} revision={revision}/></>:null}
 </section>;
}
function CommentComposer({api,id,t,parent,onDone,onCancel}:{api:Api;id:string;t:Labels;parent?:string;onDone:()=>void;onCancel?:()=>void}){
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false),[uncertain,setUncertain]=useState(false);
 const intent=useRef<{clientMutationId:string;parentId?:string;text:string}|null>(null);
 const send=async()=>{if(busy||!text.trim())return;setBusy(true);setError(false);const input=intent.current??{clientMutationId:crypto.randomUUID(),parentId:parent,text};intent.current=input;setUncertain(true);try{await api.createComment(id,input);intent.current=null;setUncertain(false);setText('');onDone()}catch(e){if((e as {status?:number}).status&&[400,403,404,409].includes((e as {status:number}).status)){intent.current=null;setUncertain(false);}setError(true)}finally{setBusy(false)}};
 return <form className={styles.composer} onSubmit={e=>{e.preventDefault();void send()}}><label><span className="sr-only">{parent?t.reply:t.add}</span><textarea value={text} maxLength={2000} rows={2} placeholder={parent?t.reply:t.add} disabled={busy||uncertain} onChange={e=>setText(e.target.value)}/></label><div className={styles.buttons}>{onCancel?<button type="button" disabled={busy||uncertain} onClick={onCancel}>{t.cancel}</button>:null}<button type="submit" disabled={busy||!text.trim()}>{error?t.retry:t.send}</button></div>{error?<p role="alert">{t.error}</p>:null}</form>;
}
function CommentList({api,id,t,locale,parent,enabled,revision}:{api:Api;id:string;t:Labels;locale:string;parent?:string;enabled:boolean;revision:number}){
 const [items,setItems]=useState<RecordingComment[]>([]),[cursor,setCursor]=useState<string>(),[order,setOrder]=useState<'newest'|'oldest'>('newest'),[error,setError]=useState(false),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
 const request=useRef<AbortController|null>(null);
 const [failedCursor,setFailedCursor]=useState<string>();
 const load=useCallback((next?:string)=>{request.current?.abort();const controller=new AbortController();request.current=controller;
  return api.comments(id,{parentId:parent,cursor:next,order:parent?'oldest':order,signal:controller.signal}).then(page=>{if(controller.signal.aborted)return;setItems(old=>next?[...old,...page.items.filter(item=>!old.some(v=>v.id===item.id))]:page.items);setCursor(page.nextCursor);setError(false)},()=>{if(!controller.signal.aborted){setError(true);setFailedCursor(next)}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
 },[api,id,parent,order]);
 useEffect(()=>{void load();return()=>request.current?.abort()},[load,revision]);
 useEffect(()=>{if(!refresh)return;const controller=new AbortController();const count=items.length;
  const reconcile=async()=>{try{let next:string|undefined;const fresh:RecordingComment[]=[];do{const page=await api.comments(id,{parentId:parent,cursor:next,order:parent?'oldest':order,signal:controller.signal});fresh.push(...page.items);next=page.nextCursor;}while(next&&fresh.length<count);if(controller.signal.aborted)return;setItems(fresh);setCursor(next);setError(false)}catch{if(!controller.signal.aborted)setError(true)}};
  void reconcile();return()=>controller.abort();
 // Only explicit mutations refresh this loaded range; polling must not discard drafts.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[refresh]);
 return <div className={styles.list}>{!parent?<label className={styles.sort}>{t.comments}<select value={order} onChange={e=>setOrder(e.target.value as 'newest'|'oldest')}><option value="newest">{t.newest}</option><option value="oldest">{t.oldest}</option></select></label>:null}{items.map(comment=><CommentItem key={comment.id} api={api} id={id} t={t} locale={locale} comment={comment} enabled={enabled} onChanged={()=>setRefresh(v=>v+1)}/>)}{!loading&&!error&&!items.length&&!parent?<p>{t.empty}</p>:null}{error?<p role="status">{t.error} <button type="button" onClick={()=>{setLoading(true);void load(failedCursor)}}>{t.retry}</button></p>:null}{cursor?<button type="button" disabled={loading} onClick={()=>{setLoading(true);void load(cursor)}}>{t.load}</button>:null}</div>;
}
function CommentItem({api,id,t,locale,comment,enabled,onChanged}:{api:Api;id:string;t:Labels;locale:string;comment:RecordingComment;enabled:boolean;onChanged:()=>void}){
 const [mode,setMode]=useState<'none'|'edit'|'reply'|'report'|'delete'>('none'),[text,setText]=useState(comment.text),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false),[replies,setReplies]=useState(false),[replyRevision,setReplyRevision]=useState(0),[reported,setReported]=useState(false);
 const attempted=useRef<{mode:string;text:string;revision:number}|null>(null);
 useEffect(()=>{const prior=attempted.current;if(!prior||comment.revision===prior.revision)return;if(prior.mode==='edit'&&comment.text===prior.text||prior.mode==='delete'&&comment.deleted){setMode('none');setError(false)}attempted.current=null},[comment.revision,comment.text,comment.deleted]);
 const action=async()=>{attempted.current={mode,text,revision:comment.revision};setBusy(true);setError(false);try{if(mode==='edit')await api.updateComment(id,comment.id,{text,expectedRevision:comment.revision});if(mode==='delete')await api.deleteComment(id,comment.id,{expectedRevision:comment.revision});if(mode==='report'){await api.reportComment(id,comment.id,{reason});setReported(true)}setMode('none');onChanged()}catch{setError(true);onChanged()}finally{setBusy(false)}};
 return <article className={styles.comment}><header><strong>{comment.deleted?t.deleted:comment.displayName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString(locale)}</time>{comment.editedAt&&!comment.deleted?<span>{locale==='en'?'Edited':'已編輯'}</span>:null}</header>{!comment.deleted?<p className={styles.text}>{comment.text}</p>:null}<div className={styles.buttons}>{!comment.parentId&&!comment.deleted&&enabled?<button type="button" onClick={()=>setMode('reply')}>{t.reply}</button>:null}{comment.mine&&!comment.deleted?<><button type="button" onClick={()=>{setText(comment.text);setMode('edit')}}>{t.edit}</button><button type="button" onClick={()=>setMode('delete')}>{t.remove}</button></>:!comment.deleted?<button type="button" disabled={reported} onClick={()=>setMode('report')}>{reported?t.reported:t.report}</button>:null}{comment.replyCount>0?<button type="button" aria-expanded={replies} onClick={()=>setReplies(!replies)}>{comment.replyCount} {t.replies}</button>:null}</div>
 {mode==='reply'?<CommentComposer api={api} id={id} t={t} parent={comment.id} onCancel={()=>setMode('none')} onDone={()=>{setMode('none');setReplies(true);setReplyRevision(v=>v+1);onChanged()}}/>:null}
 {['edit','report','delete'].includes(mode)?<form className={styles.composer} onSubmit={e=>{e.preventDefault();void action()}}>{mode==='delete'?<p>{t.confirm}</p>:<label>{mode==='edit'?t.edit:t.reason}<textarea disabled={busy} maxLength={mode==='edit'?2000:500} value={mode==='edit'?text:reason} onChange={e=>mode==='edit'?setText(e.target.value):setReason(e.target.value)}/></label>}<div className={styles.buttons}><button type="button" disabled={busy} onClick={()=>setMode('none')}>{t.cancel}</button><button type="submit" disabled={busy||mode==='edit'&&!text.trim()||mode==='report'&&!reason.trim()}>{mode==='delete'?t.remove:mode==='report'?t.report:t.save}</button></div>{error?<p role="alert">{t.error}</p>:null}</form>:null}
 {replies?<CommentList api={api} id={id} t={t} locale={locale} parent={comment.id} enabled={enabled} revision={replyRevision}/>:null}</article>;
}
