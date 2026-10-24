'use client';
import {createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {ArrowDownWideNarrow, ArrowLeft, ChevronDown, ChevronRight, ChevronUp, MoreVertical, RefreshCw, ThumbsDown, ThumbsUp, X} from 'lucide-react';
import {Button, Menu} from '@hallelujahhomechurch/ui';
import type {RecordingComment} from '@hallelujahhomechurch/hhc-web-client';
import type {createMemberVideoApi} from './api';
import {useAccountAuth} from '@/components/layout/AccountControl';
import {prepareCommentAvatars} from './comment-avatar-cache';
import {CommentAvatar, type CommentProfile} from './CommentAvatar';
import {videoLabels, type VideoLabels as Labels} from './video-labels';
import {relativeVideoTime} from './video-format';
import {VideoCommentsSkeleton} from './VideoLoading';
import {LoadingBlock, LoadingStatus} from '@/components/ui/ContentLoading';
import styles from './VideoComments.module.css';

type Api = ReturnType<typeof createMemberVideoApi>;
type Presentation = {
 mobile: boolean; thread: string | null; composer: string | null; viewer: CommentProfile;
 setScrollNode: (node: HTMLDivElement | null) => void;
 showThread: (id: string | null) => void; selectComposer: (id: string | null) => void;
 close: () => void; measureComposer: (height: number) => void;
};
const PresentationContext = createContext<Presentation>(null!);

export function VideoComments({api,id,locale,count,enabled,onChanged}:{api:Api;id:string;locale:string;count?:number;enabled:boolean;onChanged:()=>void}) {
 const t=videoLabels(locale), auth=useAccountAuth();
 const dialog=useRef<HTMLDialogElement>(null), trigger=useRef<HTMLButtonElement>(null), scrollRef=useRef<HTMLDivElement>(null);
 const positions=useRef(new Map<string|null,number>());
 const [mobile,setMobile]=useState(false),[open,setOpen]=useState(false),[thread,setThread]=useState<string|null>(null),[composer,setComposer]=useState<string|null>(null);
 const setScrollNode=useCallback((node:HTMLDivElement|null)=>{scrollRef.current=node;},[]);
 const [rootRevision,setRootRevision]=useState(0),[preview,setPreview]=useState(''),[composerHeight,setComposerHeight]=useState(64),[geometry,setGeometry]=useState({top:0,bottom:0});
 const user=auth.status==='authenticated'?auth.session?.user:undefined;
 const viewer=useMemo(()=>({displayName:user?.display_name??'',avatarUrl:user?.avatar_url??undefined}),[user?.display_name,user?.avatar_url]);
 useEffect(()=>{const query=window.matchMedia('(max-width:767px)');const change=()=>setMobile(query.matches);change();query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 const showThread=useCallback((next:string|null)=>{positions.current.set(thread,scrollRef.current?.scrollTop??0);setThread(next);setComposer(next);},[thread]);
 const close=useCallback(()=>{positions.current.set(thread,scrollRef.current?.scrollTop??0);setOpen(false);trigger.current?.focus();},[thread]);
 useLayoutEffect(()=>{if(scrollRef.current)scrollRef.current.scrollTop=positions.current.get(thread)??0;},[thread,open,mobile]);
 const updateGeometry=useCallback(()=>{
  const node=dialog.current;if(!node)return;
  const viewport=window.visualViewport,height=viewport?.height??window.innerHeight,offset=viewport?.offsetTop??0;
  const player=node.closest('[data-video-watch]')?.firstElementChild;
  const playerBottom=player?.getBoundingClientRect().bottom??height*.25;
  // Keep controls stationary while a draft loses focus to Back, Cancel or Send.
  const editing=Boolean(node.querySelector('form:not([hidden])[data-editing=true]'))||node.contains(document.activeElement)&&document.activeElement instanceof HTMLTextAreaElement;
  const top=editing?offset:Math.max(offset,Math.min(playerBottom,offset+height-240)),bottom=Math.max(0,window.innerHeight-height-offset);
  setGeometry(previous=>previous.top===top&&previous.bottom===bottom?previous:{top,bottom});
 },[]);
 useLayoutEffect(()=>{if(mobile&&open)updateGeometry();},[mobile,open,thread,composer,composerHeight,updateGeometry]);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  node.toggleAttribute('open',!mobile||open);
  if(!mobile||!open)return;
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  updateGeometry();window.addEventListener('resize',updateGeometry);node.addEventListener('focusin',updateGeometry);node.addEventListener('focusout',updateGeometry);
  window.visualViewport?.addEventListener('resize',updateGeometry);window.visualViewport?.addEventListener('scroll',updateGeometry);
  node.querySelector<HTMLButtonElement>('[data-comments-close]')?.focus();
  return()=>{document.body.style.overflow=overflow;window.removeEventListener('resize',updateGeometry);node.removeEventListener('focusin',updateGeometry);node.removeEventListener('focusout',updateGeometry);window.visualViewport?.removeEventListener('resize',updateGeometry);window.visualViewport?.removeEventListener('scroll',updateGeometry);};
 },[mobile,open,updateGeometry]);
 const heading=`${count===undefined?'—':new Intl.NumberFormat(locale).format(count)} ${t.comments}`;
 const presentation={mobile,thread,composer,viewer,setScrollNode,showThread,selectComposer:setComposer,close,measureComposer:setComposerHeight};
 return <PresentationContext.Provider value={presentation}>
  <button ref={trigger} className={styles.mobileEntry} type="button" onClick={()=>setOpen(true)}><strong>{heading}</strong><span>{preview||(enabled?t.add:t.closed)}</span><ChevronRight aria-hidden="true"/></button>
  <dialog ref={dialog} className={styles.surface} data-mobile={mobile} data-thread={Boolean(thread)} style={{top:geometry.top,bottom:geometry.bottom,'--comments-composer-height':`${composerHeight}px`,'--comments-bottom':`${geometry.bottom}px`} as CSSProperties} aria-label={heading} role={mobile?'dialog':'region'} onCancel={e=>{e.preventDefault();close();}} onKeyDown={e=>{if(mobile&&e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();close();}}}>
   <CommentList api={api} id={id} t={t} locale={locale} enabled={enabled} revision={rootRevision} heading={heading} onPreview={setPreview} onCountChanged={onChanged}>
    {enabled?<CommentComposer api={api} id={id} t={t} active={!mobile||composer===null&&thread===null} onDone={()=>{setRootRevision(v=>v+1);onChanged();}}/>:<p>{t.closed}</p>}
   </CommentList>
  </dialog>
 </PresentationContext.Provider>;
}

function CommentComposer({api,id,t,parent,replyTo,active=true,focusOnOpen=true,onDone,onCancel}:{api:Api;id:string;t:Labels;parent?:string;replyTo?:RecordingComment;active?:boolean;focusOnOpen?:boolean;onDone:()=>void;onCancel?:()=>void}) {
 const presentation=useContext(PresentationContext);
 const {mobile,measureComposer}=presentation;
 const [text,setText]=useState(''),[focused,setFocused]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false),[uncertain,setUncertain]=useState(false);
 const textarea=useRef<HTMLTextAreaElement>(null),form=useRef<HTMLFormElement>(null);
 const intent=useRef<{clientMutationId:string;parentId?:string;replyToId?:string;text:string}|null>(null);
 useLayoutEffect(()=>{const field=textarea.current;if(!active||!field)return;field.style.height='auto';field.style.height=`${Math.min(field.scrollHeight||20,160)}px`;if(mobile)measureComposer(Math.max(64,form.current?.getBoundingClientRect().height??64));},[text,focused,active,mobile,measureComposer]);
 useLayoutEffect(()=>{if(parent&&active&&focusOnOpen)textarea.current?.focus({preventScroll:true});},[parent,active,focusOnOpen]);
 const send=async()=>{
  if(busy||!text.trim())return;setBusy(true);setError(false);
  const input=intent.current??{clientMutationId:crypto.randomUUID(),parentId:parent,replyToId:replyTo?.id,text};intent.current=input;setUncertain(true);
  try{await api.createComment(id,input);intent.current=null;setUncertain(false);setText('');setFocused(false);onDone();}
  catch(e){if((e as {status?:number}).status&&[400,403,404,409].includes((e as {status:number}).status)){intent.current=null;setUncertain(false);}setError(true);}
  finally{setBusy(false);}
 };
 const cancel=()=>{setText('');setFocused(false);onCancel?.();};
 const engaged=focused||Boolean(text)||Boolean(parent);
 return <form ref={form} className={`${styles.composer} ${parent?styles.replyComposer:''}`} hidden={!active} data-engaged={engaged} data-editing={focused||Boolean(text)} onSubmit={e=>{e.preventDefault();void send();}}>
  <span><CommentAvatar comment={presentation.viewer} size={parent?'reply':'composer'}/></span>
  <div className={styles.composerBody}>
   <label className={styles.inputLine}>{replyTo?<span className={styles.replyTarget}>{t.replying} {replyTo.displayName}</span>:null}<span className="sr-only">{parent?t.reply:t.add}</span><textarea ref={textarea} value={text} maxLength={2000} rows={1} placeholder={parent?t.reply:t.add} disabled={busy||uncertain} onFocus={()=>setFocused(true)} onChange={e=>setText(e.target.value)}/></label>
   <div className={styles.composerActions} hidden={!engaged}>
    {engaged?<button type="button" disabled={busy||uncertain} onClick={cancel}>{t.cancel}</button>:null}
    <button className={styles.submit} type="submit" disabled={busy||!text.trim()}>{error?t.retry:parent?t.reply:t.send}</button>
   </div>
   {error?<p role="alert">{t.error}</p>:null}
  </div>
 </form>;
}

function checkThreadPage(items:RecordingComment[],parent:string|undefined,ancestors:string[]) {
 for(const item of items){
  if(typeof item.directChildCount!=='number'||!Number.isSafeInteger(item.directChildCount)||item.directChildCount<0||typeof item.descendantReplyCount!=='number'||!Number.isSafeInteger(item.descendantReplyCount)||item.descendantReplyCount<0||ancestors.includes(item.id)||(parent?item.threadParentId!==parent||item.parentId!==ancestors[0]:Boolean(item.parentId||item.threadParentId)))throw new Error('Invalid threaded comment page');
 }
}

function CommentList({api,id,t,locale,parent,ancestors=[],enabled,revision,heading,onCountChanged,onPreview,children}:{api:Api;id:string;t:Labels;locale:string;parent?:string;ancestors?:string[];enabled:boolean;revision:number;heading?:string;onCountChanged?:()=>void;onPreview?:(text:string)=>void;children?:ReactNode}) {
 const {setScrollNode,...presentation}=useContext(PresentationContext);
 const [items,setItems]=useState<RecordingComment[]>([]),[cursor,setCursor]=useState<string>(),[order,setOrder]=useState<'top'|'newest'>('top'),[error,setError]=useState(false),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
 const request=useRef<AbortController|null>(null),[failedCursor,setFailedCursor]=useState<string>(),[expired,setExpired]=useState(false);
 const ancestry=ancestors.join(':');
 const load=useCallback((next?:string,fresh=false)=>{
  request.current?.abort();const controller=new AbortController();request.current=controller;
  return api.comments(id,{view:'threaded',parentId:parent,cursor:next,order:parent?'oldest':order,refresh:!parent&&order==='top'&&fresh?true:undefined,signal:controller.signal}).then(async page=>{
   checkThreadPage(page.items,parent,ancestry?ancestry.split(':'):[]);
   const prepared=await prepareCommentAvatars(page.items);if(controller.signal.aborted)return;
   setItems(old=>next?[...old,...prepared.filter(item=>!old.some(v=>v.id===item.id))]:prepared);setCursor(page.nextCursor);if(!next)onPreview?.(page.items.find(item=>!item.deleted&&!item.hidden)?.text??'');setError(false);setExpired(false);
  }).catch(error=>{if(!controller.signal.aborted){setError(true);setExpired(error?.code==='recording_comment_cursor_expired'||error?.status===400);setFailedCursor(next);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
 },[api,id,parent,order,onPreview,ancestry]);
 useEffect(()=>{void load();return()=>request.current?.abort();},[load]);
 useEffect(()=>{
  if(!refresh&&!revision)return;const controller=new AbortController(),count=items.length;
  const reconcile=async()=>{
   try{
    let next:string|undefined;const fresh:RecordingComment[]=[];
    do{const page=await api.comments(id,{view:'threaded',parentId:parent,cursor:next,order:parent?'oldest':order,refresh:!parent&&order==='top'&&revision>0&&!next?true:undefined,signal:controller.signal});checkThreadPage(page.items,parent,ancestry?ancestry.split(':'):[]);fresh.push(...page.items);next=page.nextCursor;}while(next&&fresh.length<count);
    const prepared=await prepareCommentAvatars(fresh);if(controller.signal.aborted)return;setItems(prepared);setCursor(next);setError(false);
   }catch{if(!controller.signal.aborted)setError(true);}
  };void reconcile();return()=>controller.abort();
  // Explicit mutations refresh the loaded range; metric polls retain drafts and branches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[refresh,revision]);
 const list=<div className={styles.list}>
  {loading&&!items.length?<VideoCommentsSkeleton label={t.loading} replies={Boolean(parent)}/>:null}
  {loading&&items.length?<LoadingStatus label={t.loading}/>:null}
  {items.map(comment=><CommentItem key={comment.id} api={api} id={id} t={t} locale={locale} comment={comment} ancestors={ancestry?ancestry.split(':'):[]} enabled={enabled} onChanged={()=>{setRefresh(v=>v+1);onCountChanged?.();}}/>)}
  {loading&&items.length?<div aria-busy="true"><LoadingBlock className={styles.skeletonTail}/></div>:null}
  {!loading&&!error&&!items.length&&!parent?<p>{t.empty}</p>:null}
  {error?<p role="status">{t.error} <button type="button" onClick={()=>{setLoading(true);void load(expired?undefined:failedCursor,expired);}}>{t.retry}</button></p>:null}
  {cursor?<button className={styles.loadMore} type="button" disabled={loading} onClick={()=>{setLoading(true);void load(cursor);}}>{t.load}</button>:null}
 </div>;
 if(parent)return list;
 const changeOrder=(next:string)=>{if((next==='top'||next==='newest')&&next!==order){setLoading(true);setOrder(next);}};
 return <div className={styles.discussion}>
  <header className={styles.heading}>
   {presentation.mobile&&presentation.thread?<button className={styles.back} type="button" aria-label={t.back} onClick={()=>presentation.showThread(null)}><ArrowLeft aria-hidden="true"/></button>:null}
   <h3>{presentation.mobile&&presentation.thread?t.reply:heading}</h3>
   <span className={styles.desktopSort}><Menu label={t.sort} items={[{id:'top',label:t.top,isSelected:order==='top'},{id:'newest',label:t.newest,isSelected:order==='newest'}]} onAction={changeOrder} trigger={<Button className={styles.sortButton} variant="ghost"><ArrowDownWideNarrow size={24} aria-hidden="true"/>{t.sort}</Button>}/></span>
   <button className={styles.refresh} type="button" aria-label={t.refresh} title={t.refresh} disabled={loading} onClick={()=>{setLoading(true);void load(undefined,true);}}><RefreshCw size={18} aria-hidden="true"/></button>
   <button className={styles.close} data-comments-close type="button" aria-label={t.close} onClick={presentation.close}><X aria-hidden="true"/></button>
   {presentation.mobile&&!presentation.thread?<div className={styles.mobileSort} aria-label={t.sort}>{(['top','newest'] as const).map(value=><button key={value} type="button" aria-pressed={order===value} onClick={()=>changeOrder(value)}>{value==='top'?t.top:t.newest}</button>)}</div>:null}
  </header>
  <div ref={setScrollNode} className={styles.content}>{children}{list}</div>
 </div>;
}

function CommentItem({api,id,t,locale,comment,ancestors,enabled,onChanged}:{api:Api;id:string;t:Labels;locale:string;comment:RecordingComment;ancestors:string[];enabled:boolean;onChanged:()=>void}) {
 const presentation=useContext(PresentationContext),removed=comment.deleted||comment.hidden,root=comment.parentId??comment.id,isRoot=!comment.parentId;
 const [reaction,setReaction]=useState(comment.reaction??null),[likes,setLikes]=useState(comment.likes??0),[reactionBusy,setReactionBusy]=useState(false),[expanded,setExpanded]=useState(false);
 const desiredReaction=useRef<{reaction:'like'|'dislike'|null}|null>(null);
 useEffect(()=>{if(desiredReaction.current)return;setReaction(comment.reaction??null);setLikes(comment.likes??0);},[comment]);
 const [mode,setMode]=useState<'none'|'edit'|'reply'|'report'|'delete'>('none'),[text,setText]=useState(comment.text),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false),[replies,setReplies]=useState(false),[loaded,setLoaded]=useState(false),[replyRevision,setReplyRevision]=useState(0),[reported,setReported]=useState(false);
 const attempted=useRef<{mode:string;text:string;revision:number}|null>(null);
 useEffect(()=>{const prior=attempted.current;if(!prior||comment.revision===prior.revision)return;if(prior.mode==='edit'&&comment.text===prior.text||prior.mode==='delete'&&comment.deleted){setMode('none');setError(false);}attempted.current=null;},[comment.revision,comment.text,comment.deleted]);
 const react=async(value:'like'|'dislike')=>{
  if(reactionBusy)return;setReactionBusy(true);setError(false);const input=desiredReaction.current??{reaction:reaction===value?null:value};desiredReaction.current=input;
  try{const result=await api.setCommentReaction(id,comment.id,input);setReaction(result.reaction);setLikes(result.likes);desiredReaction.current=null;}catch{setError(true);}finally{setReactionBusy(false);}
 };
 const action=async()=>{
  attempted.current={mode,text,revision:comment.revision};setBusy(true);setError(false);
  try{if(mode==='edit')await api.updateComment(id,comment.id,{text,expectedRevision:comment.revision});if(mode==='delete')await api.deleteComment(id,comment.id,{expectedRevision:comment.revision});if(mode==='report'){await api.reportComment(id,comment.id,{reason});setReported(true);}setMode('none');onChanged();}
  catch{setError(true);onChanged();}finally{setBusy(false);}
 };
 const visible=replies&&(!presentation.mobile||presentation.thread===root);
 const toggle=()=>{setLoaded(true);setReplies(!visible);if(presentation.mobile&&isRoot)presentation.showThread(visible?null:root);};
 const reply=()=>{setMode('reply');if(presentation.mobile){setLoaded(true);setReplies(true);presentation.showThread(root);}presentation.selectComposer(comment.id);};
 const replyTotal=comment.descendantReplyCount??0,hasChildren=(comment.directChildCount??0)>0;
 const long=comment.text.length>300||comment.text.split('\n').length>4;
 return <div className={`${styles.thread} ${isRoot?styles.rootThread:styles.replyThread}`} data-children={hasChildren} hidden={presentation.mobile&&Boolean(presentation.thread)&&isRoot&&presentation.thread!==root}>
  <article className={styles.comment} data-reply={!isRoot}>
   <span className={styles.avatarCell}><CommentAvatar comment={comment} size={isRoot?'root':'reply'}/></span>
   <div className={styles.commentBody}>
    <header className={styles.identity}><strong>{removed?comment.deleted?t.deleted:t.removed:comment.displayName}</strong>{!removed?<><time dateTime={comment.createdAt} title={new Date(comment.createdAt).toLocaleString(locale)}>{relativeVideoTime(comment.createdAt,locale)}</time>{comment.editedAt?<span>{t.edited}</span>:null}</>:null}</header>
    {!removed?<>
     <p className={expanded||!long?styles.text:`${styles.text} ${styles.collapsed}`}>{comment.replyTo?<span className={styles.replyMention}>{comment.replyTo.displayName} </span>:null}{comment.text}</p>
     {long?<button className={styles.textToggle} type="button" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?t.less:t.more}</button>:null}
     <div className={styles.actions}>
      {enabled?<><button className={styles.reaction} type="button" disabled={reactionBusy} aria-label={t.like} aria-pressed={reaction==='like'} onClick={()=>void react('like')}><ThumbsUp size={18} aria-hidden="true"/>{likes?<span>{new Intl.NumberFormat(locale).format(likes)}</span>:null}</button><button className={styles.reaction} type="button" disabled={reactionBusy} aria-label={t.dislike} aria-pressed={reaction==='dislike'} onClick={()=>void react('dislike')}><ThumbsDown size={18} aria-hidden="true"/></button><button type="button" onClick={reply}>{t.reply}</button></>:null}
     </div>
    </>:null}
    {error&&mode==='none'?<p role="alert">{t.error}<button type="button" onClick={()=>desiredReaction.current?void react(desiredReaction.current.reaction??'like'):onChanged()}>{t.retry}</button></p>:null}
    {(mode==='reply'||isRoot&&loaded)&&!removed?<CommentComposer api={api} id={id} t={t} parent={root} replyTo={comment} focusOnOpen={mode==='reply'} active={presentation.mobile?presentation.composer===comment.id&&presentation.thread===root:mode==='reply'} onCancel={()=>{setMode('none');presentation.selectComposer(presentation.thread);}} onDone={()=>{setMode('none');presentation.selectComposer(presentation.thread);setReplies(true);setLoaded(true);setReplyRevision(v=>v+1);onChanged();}}/>:null}
    {['edit','report','delete'].includes(mode)&&!removed?<form className={styles.editForm} onSubmit={e=>{e.preventDefault();void action();}}>{mode==='delete'?<p>{t.confirm}</p>:<label>{mode==='edit'?t.edit:t.reason}<textarea disabled={busy} maxLength={mode==='edit'?2000:500} value={mode==='edit'?text:reason} onChange={e=>mode==='edit'?setText(e.target.value):setReason(e.target.value)}/></label>}<div className={styles.composerActions}><button type="button" disabled={busy} onClick={()=>setMode('none')}>{t.cancel}</button><button type="submit" disabled={busy||mode==='edit'&&!text.trim()||mode==='report'&&!reason.trim()}>{mode==='delete'?t.remove:mode==='report'?t.report:t.save}</button></div>{error?<p role="alert">{t.error}</p>:null}</form>:null}
   </div>
   {!removed?<details className={styles.more}><summary aria-label={t.actions}><MoreVertical size={20}/></summary><div>{comment.mine?<><button type="button" onClick={()=>{setText(comment.text);setMode('edit');}}>{t.edit}</button><button type="button" onClick={()=>setMode('delete')}>{t.remove}</button></>:<button type="button" disabled={reported} onClick={()=>setMode('report')}>{reported?t.reported:t.report}</button>}</div></details>:null}
  </article>
  {loaded?<div className={styles.branch} hidden={!visible}><CommentList api={api} id={id} t={t} locale={locale} parent={comment.id} ancestors={[...ancestors,comment.id]} enabled={enabled} revision={replyRevision} onCountChanged={onChanged}/></div>:null}
  {hasChildren?<div className={styles.branchFooter} hidden={presentation.mobile&&isRoot&&presentation.thread===root}><button className={styles.replyToggle} type="button" aria-expanded={visible} onClick={toggle}>{!visible&&comment.replyPreviewAuthors?.[0]?<><CommentAvatar comment={comment.replyPreviewAuthors[0]} size="preview"/><span aria-hidden="true">·</span></>:null}{visible?t.hideReplies:`${new Intl.NumberFormat(locale).format(replyTotal)} ${t.replies}`}{visible?<ChevronUp size={20} aria-hidden="true"/>:presentation.mobile&&isRoot?<ChevronRight size={20} aria-hidden="true"/>:<ChevronDown size={20} aria-hidden="true"/>}</button></div>:null}
 </div>;
}
