'use client';
import {useState} from 'react';
import type {RecordingMemberMetrics} from '@hallelujahhomechurch/hhc-web-client';
import {videoLabels} from './video-labels';
import styles from './VideoInteractions.module.css';
import {LoadingBlock, LoadingStatus} from '@/components/ui/ContentLoading';
import {formatVideoViews, relativeVideoTime} from './video-format';
export function VideoInformation({description='',date,dateKind='uploaded',metrics,locale,live=false,loadingMetrics=false}:{description?:string;date?:string|null;dateKind?:'uploaded'|'live'|'scheduled';metrics:RecordingMemberMetrics|null;locale:string;live?:boolean;loadingMetrics?:boolean}){
 const [expanded,setExpanded]=useState(false);const t=videoLabels(locale);
 const stats=metrics?.status==='not_started'?t.notStarted:metrics?live?`${new Intl.NumberFormat(locale).format(metrics.currentViewers)} ${t.watching}`:`${t.viewPrefix}${formatVideoViews(metrics.totalViews,locale,expanded)}${t.viewSeparator}${t.views}`:t.unavailable;
 const dateLabel=dateKind==='uploaded'?t.uploaded:dateKind==='scheduled'?t.scheduled:t.liveDate;
 const validDate=date&&Number.isFinite(Date.parse(date))?date:null;
 const exactDate=validDate?new Intl.DateTimeFormat(locale,{timeZone:'Asia/Taipei',year:'numeric',month:expanded?'long':'short',day:'numeric',...(dateKind==='scheduled'?{hour:'2-digit',minute:'2-digit'} as const:{})}).format(new Date(validDate)):'';
 return <div className={styles.information} data-expanded={expanded}><div className={styles.metadata}>{loadingMetrics?<><LoadingStatus label={t.loading}/><div aria-busy="true"><LoadingBlock className={styles.metricsSkeleton}/></div></>:<span>{stats}</span>}{validDate?<time dateTime={validDate} title={`${dateLabel} · ${exactDate}`}>{dateKind==='scheduled'?`${dateLabel} · ${exactDate}`:expanded?exactDate:relativeVideoTime(validDate,locale)}</time>:null}</div>
 <div className={expanded?undefined:styles.descriptionPreview}>{description?<p className={expanded?styles.description:styles.preview}>{description.split(/(https?:\/\/[^\s<>]+)/g).map((part,i)=>/^https?:\/\//.test(part)?<a href={part} target="_blank" rel="noopener noreferrer" key={i}>{part}</a>:part)}</p>:null}{description||validDate?<button className={styles.informationToggle} type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?t.less:t.more}</button>:null}</div></div>;
}
