'use client'
import {Button, Dialog} from '@hallelujahhomechurch/ui'
import {useEffect, useRef, useState} from 'react'
import {useOrganizationApi, useOrganizationMessages} from './context'
import type {OrgJoinRequest} from './api'
import {CollapseDisclosure, joinFailureMessage} from './OrganizationJoinRequests'
import {joinRequestMessages, reviewRequestMessages} from './messages'

export type ReviewIntent = {action:'approve'|'reject';version:number;key:string}

export function JoinRequestDialog({requestId, unitId, isOpen, onClose, onDenied, onDecided, intents}: {requestId: string; unitId: string; isOpen: boolean; intents: Map<string,ReviewIntent>; onClose: () => void; onDenied: () => void; onDecided: () => void}) {
 const {operationsApi}=useOrganizationApi(), {locale,messages:{organizations:t}}=useOrganizationMessages()
 const copy=reviewRequestMessages[locale], join=joinRequestMessages[locale]
 const [request,setRequest]=useState<OrgJoinRequest|null>(null), [error,setError]=useState<unknown>(null), [revision,setRevision]=useState(0), [blocked,setBlocked]=useState(false), [pending,setPending]=useState(false)
 const [intent,setIntent]=useState<ReviewIntent|null>(()=>intents.get(requestId)??null)
 const inFlight=useRef(false), mounted=useRef(true)
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
 useEffect(()=>{
  if(!isOpen)return
  const controller=new AbortController()
  void operationsApi.getReviewableOrgJoinRequest(requestId,controller.signal).then(value=>{
   if(controller.signal.aborted)return
   if(value.id!==requestId||value.orgUnitId!==unitId){onDenied();return}
   setRequest(value)
  }).catch(reason=>{if(!controller.signal.aborted){if([401,403,404].includes(status(reason)))onDenied();else setError(reason)}})
  return()=>controller.abort()
 },[operationsApi,requestId,unitId,revision,onDenied,isOpen])
 async function decide(action:'approve'|'reject') {
  if(!request||request.status!=='pending'||!request.actions[action]||blocked||inFlight.current||intent&&intent.action!==action)return
  const target=intent??{action,version:request.version,key:crypto.randomUUID()};setIntent(target);intents.set(requestId,target);inFlight.current=true;setPending(true);setError(null)
  try {
   await operationsApi[action==='approve'?'approveOrgJoinRequest':'rejectOrgJoinRequest'](requestId,{version:target.version,idempotencyKey:target.key})
   if(mounted.current){intents.delete(requestId);onDecided()}
  } catch(reason) {
   if(mounted.current){if([401,403,404].includes(status(reason))){onDenied();return}setError(reason);if([409,412].includes(status(reason)))setBlocked(true)}
  } finally {inFlight.current=false;if(mounted.current)setPending(false)}
 }
 return <Dialog isOpen={isOpen} onOpenChange={open=>{if(!open&&!pending)onClose()}} title={copy.title} closeLabel={t.back}>
  <div className="organization-dialog-stack">
   {request?<><p>{copy.confirm.replace('{applicant}',request.applicantDisplayName||'—').replace('{unit}',request.orgUnitName)}</p><p>{join[request.status]} · {copy.version} {request.version}</p><p>{copy.consequence}</p>
    <dl className="organization-request-dates"><div><dt>{join.requestedAt}</dt><dd><time dateTime={request.requestedAt}>{new Date(request.requestedAt).toLocaleString(locale)}</time></dd></div>{request.decidedAt?<div><dt>{join.decidedAt}</dt><dd><time dateTime={request.decidedAt}>{new Date(request.decidedAt).toLocaleString(locale)}</time></dd></div>:null}</dl>
    <CollapseDisclosure units={request.ancestorCollapsePreview}/></>:!error?<p role="status">{t.loading}</p>:null}
   {error?<p role="alert" className="form-error">{joinFailureMessage(error,join)}</p>:null}
   <div className="organization-actions"><Button variant="secondary" isDisabled={pending} onPress={onClose}>{t.back}</Button>
   {blocked||!request&&error?<Button isDisabled={pending} onPress={()=>{setRequest(null);setError(null);setBlocked(false);setIntent(null);intents.delete(requestId);setRevision(v=>v+1)}}>{copy.reload}</Button>:request?.status==='pending'?<>{request.actions.approve?<Button isDisabled={pending||Boolean(intent&&intent.action!=='approve')} onPress={()=>void decide('approve')}>{pending&&intent?.action==='approve'?t.sending:copy.approve}</Button>:null}{request.actions.reject?<Button variant="secondary" isDisabled={pending||Boolean(intent&&intent.action!=='reject')} onPress={()=>void decide('reject')}>{pending&&intent?.action==='reject'?t.sending:copy.reject}</Button>:null}</>:null}
   </div>
  </div>
 </Dialog>
}
function status(error:unknown){return error instanceof Error&&'status'in error?Number(error.status):0}
