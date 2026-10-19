'use client'
import {Button} from '@hallelujahhomechurch/ui'
import Link from 'next/link'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'
import {useOrganizationApi, useOrganizationMessages} from './context'
import type {ReviewableOrgJoinRequestPage} from './api'
import {joinRequestMessages, reviewRequestMessages} from './messages'
import {JoinRequestDialog, type ReviewIntent} from './JoinRequestDialog'

export function ReviewRequestsSection({unitId, enabled, onDecided, consumedLinks}: {unitId: string; enabled: boolean; consumedLinks: Set<string>; onDecided: () => void}) {
 const {locale,messages:{organizations:t}}=useOrganizationMessages(), copy=reviewRequestMessages[locale]
 const router=useRouter(), pathname=usePathname(), params=useSearchParams()
 const query=params.get('joinRequest'), source=params.toString()
 const [selected,setSelected]=useState<string|null>(null), [denied,setDenied]=useState(false), [revision,setRevision]=useState(0)
 const [filter,setFilter]=useState<'pending'|'history'>('pending'),[page,setPage]=useState(1)
 const [intents]=useState(()=>new Map<string,ReviewIntent>())
 const close=useCallback(()=>{
  setSelected(null)
  if(query){consumedLinks.add(query);const next=new URLSearchParams(source);next.delete('joinRequest');router.replace(pathname+(next.size?`?${next}`:'')+'#join-requests',{scroll:false})}
 },[query,source,router,pathname,consumedLinks])
 const deny=useCallback(()=>{setDenied(true);close()},[close])
 useEffect(()=>{
  if(!enabled){queueMicrotask(close);return}
  if(!query){queueMicrotask(()=>setSelected(null));return}
  if(!canonicalRequestId(query)){queueMicrotask(close);return}
  if(!consumedLinks.has(query))queueMicrotask(()=>setSelected(query))
 },[query,enabled,close,consumedLinks])
 useEffect(()=>{
  const revalidate=()=>setRevision(v=>v+1)
  window.addEventListener('focus',revalidate)
  return()=>window.removeEventListener('focus',revalidate)
 },[])
 if(!enabled)return null
 return <section id="join-requests" className="organization-directory-section" aria-label={copy.title}>
  <h2>{copy.title}</h2>
  {denied?<div><p role="alert" className="form-error">{copy.unavailable}</p><Button variant="secondary" onPress={()=>{setDenied(false);setRevision(v=>v+1);window.dispatchEvent(new Event('hhc:organizations-changed'))}}>{t.retry}</Button></div>:<>
   <div className="organization-actions" role="group" aria-label={copy.title}>{(['pending','history'] as const).map(value=><Button key={value} variant={filter===value?'primary':'secondary'} aria-pressed={filter===value} onPress={()=>{setFilter(value);setPage(1)}}>{joinRequestMessages[locale][value==='pending'?'pendingTab':'historyTab']}</Button>)}</div>
   <ReviewRequestList key={`${filter}:${page}:${revision}`} unitId={unitId} filter={filter} page={page} onPage={setPage} onSelect={setSelected} onDenied={deny}/>
   {selected?<JoinRequestDialog intents={intents} key={selected} unitId={unitId} requestId={selected} onClose={close} onDenied={deny} onDecided={()=>{close();setRevision(v=>v+1);window.dispatchEvent(new Event('hhc:organizations-changed'));onDecided()}}/>:null}
  </>}
 </section>
}
export function ReviewRequestsSummary() {
 const {operationsApi}=useOrganizationApi(),{locale,messages:{organizations:t}}=useOrganizationMessages(),copy=reviewRequestMessages[locale]
 const [allowed,setAllowed]=useState<boolean|null>(null),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0),[page,setPage]=useState(1)
 useEffect(()=>{
  const controller=new AbortController()
  void operationsApi.getMyAccess(controller.signal).then(access=>{if(!controller.signal.aborted)setAllowed(access.responsibilities.length>0)}).catch(()=>{if(!controller.signal.aborted){setAllowed(false);setFailed(true)}})
  return()=>controller.abort()
 },[operationsApi,revision])
 useEffect(()=>{const refresh=()=>{setAllowed(null);setFailed(false);setRevision(v=>v+1)};window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[])
 if(failed)return <p role="alert">{copy.unavailable} <Button variant="secondary" onPress={()=>{setFailed(false);setRevision(v=>v+1)}}>{t.retry}</Button></p>
 return allowed?<section className="organization-directory-section" aria-label={copy.title}><h2>{copy.title}</h2><ReviewRequestList key={`${page}:${revision}`} filter="pending" page={page} onPage={setPage}/></section>:null
}
function ReviewRequestList({unitId,filter,page,onPage,onSelect,onDenied}: {unitId?:string;filter:'pending'|'history';page:number;onPage:(page:number)=>void;onSelect?:(id:string)=>void;onDenied?:()=>void}) {
 const {operationsApi}=useOrganizationApi(),{locale,messages:{organizations:t}}=useOrganizationMessages(),copy=reviewRequestMessages[locale],join=joinRequestMessages[locale]
 const [data,setData]=useState<ReviewableOrgJoinRequestPage|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0)
 useEffect(()=>{
  const controller=new AbortController()
  void operationsApi.listReviewableOrgJoinRequests({...(unitId?{orgUnitId:unitId}:{}),status:filter,page,limit:unitId?20:5,signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setData(value)}).catch(reason=>{if(!controller.signal.aborted){setData(null);setError(true);if(reason instanceof Error&&'status'in reason&&[401,403,404].includes(Number(reason.status)))onDenied?.()}})
  return()=>controller.abort()
 },[operationsApi,unitId,filter,page,revision,onDenied])
 if(error)return <div><p role="alert" className="form-error">{copy.unavailable}</p><Button variant="secondary" onPress={()=>{setError(false);setRevision(v=>v+1)}}>{t.retry}</Button></div>
 if(!data)return <p role="status">{t.loading}</p>
 const rows = <>
 {data.items.length?<ul className="organization-unit-list">{data.items.map(item=><li key={item.id}><div className="organization-discovery-row"><span className="organization-unit-name">{item.applicantDisplayName||'—'}<small>{item.orgUnitName} · {join[item.status]} · <time dateTime={item.requestedAt}>{new Date(item.requestedAt).toLocaleString(locale)}</time>{item.decidedAt?<> · {join.decidedAt} <time dateTime={item.decidedAt}>{new Date(item.decidedAt).toLocaleString(locale)}</time></>:null}</small></span>{onSelect?<Button variant="secondary" size="sm" aria-label={`${copy.review} ${item.applicantDisplayName||item.orgUnitName}`} onPress={()=>onSelect(item.id)}>{copy.review}</Button>:<Link prefetch={false} aria-label={`${copy.review} ${item.applicantDisplayName||item.orgUnitName}`} href={`/${locale}/organizations/${item.orgUnitId}?joinRequest=${item.id}#join-requests`}>{copy.review}</Link>}</div></li>)}</ul>:<p>{copy.empty}</p>}
 {page>1||data.nextPage?<nav className="organization-actions" aria-label={copy.title}><Button variant="secondary" isDisabled={page===1} onPress={()=>onPage(page-1)}>{t.previous}</Button><span>{page}</span><Button variant="secondary" isDisabled={!data.nextPage} onPress={()=>data.nextPage&&onPage(data.nextPage)}>{t.next}</Button></nav>:null}</>
 const summary=copy.summary.replace('{count}',String(data.actionablePendingTotal))
 return unitId?<><p role="status">{summary}</p>{rows}</>:<details className="organization-review-summary"><summary>{summary}</summary>{rows}</details>
}
function canonicalRequestId(value:string){return /^(?!00000000-0000-0000-0000-000000000000$)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)}
