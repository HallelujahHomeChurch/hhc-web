'use client';
import {useState} from 'react';
import {Dialog} from '@hallelujahhomechurch/ui';
import {Mail,MessageCircle,Share2} from 'lucide-react';
import {parseShareTime,videoShareURL} from './share';
import {playerClock} from './PlayerChrome';
import {videoLabels} from './video-labels';
import styles from './VideoInteractions.module.css';
export function VideoShareDialog({open,onClose,title,watchUrl,currentTime,durationSeconds,locale}:{open:boolean;onClose:()=>void;title:string;watchUrl:string;currentTime?:number;durationSeconds?:number;locale:string}){
 const t=videoLabels(locale);const [include,setInclude]=useState(false),[time,setTime]=useState(playerClock(Math.max(0,Math.floor(currentTime??0)))),[notice,setNotice]=useState('');
 const seconds=parseShareTime(time,durationSeconds),invalid=include&&seconds===undefined;
 const url=videoShareURL(watchUrl,include?seconds:undefined),encoded=encodeURIComponent(url);
 const platforms=[['LINE',`https://social-plugins.line.me/lineit/share?url=${encoded}`],['WhatsApp',`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`],['Facebook',`https://www.facebook.com/sharer/sharer.php?u=${encoded}`],['X',`https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent(title)}`],[t.email,`mailto:?subject=${encodeURIComponent(title)}&body=${encoded}`]];
 return <Dialog isOpen={open} onOpenChange={value=>{if(!value)onClose();}} title={t.share} closeLabel={t.close}>
  <div className={styles.shareBody}><div className={styles.platforms}>{platforms.map(([name,href],index)=><a key={name} href={invalid?undefined:href} aria-disabled={invalid} target={index===4?undefined:'_blank'} rel="noopener noreferrer" className={styles.platform}><span aria-hidden="true">{index===4?<Mail/>:index<2?<MessageCircle/>:<Share2/>}</span>{name}</a>)}</div>
  <div className={styles.copyRow}><input aria-label={t.link} readOnly value={url} onFocus={e=>e.target.select()}/><button type="button" disabled={invalid} onClick={async()=>{try{await navigator.clipboard.writeText(url);setNotice(t.copied);}catch{setNotice(t.error);}}}>{t.copy}</button></div>
  {currentTime!==undefined?<div className={styles.timeRow}><label><input type="checkbox" checked={include} onChange={e=>{setInclude(e.target.checked);setNotice('');}}/> {t.startAt}</label><input aria-label={t.startTime} inputMode="numeric" disabled={!include} value={time} aria-invalid={invalid} onChange={e=>{setTime(e.target.value);setNotice('');}}/>{invalid?<p role="alert">{t.invalidTime}</p>:null}</div>:null}
  {notice?<p role="status">{notice}</p>:null}</div>
 </Dialog>;
}
