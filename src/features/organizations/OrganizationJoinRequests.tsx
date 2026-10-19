'use client'
import {Button, Dialog} from '@hallelujahhomechurch/ui'
import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useEffect, useRef, useState} from 'react'
import {useOrganizationsAccess} from '@/components/layout/AccountControl'
import {useNotificationInbox} from '@/features/notifications/provider'
import {useOrganizationApi, useOrganizationMessages} from './context'
import type {OrgJoinRequest, OrgJoinRequestPage} from './api'
import {joinRequestMessages} from './messages'

type JoinCopy = {[K in keyof typeof joinRequestMessages.en]: string}
export function joinFailureMessage(error: unknown, copy: JoinCopy) {
  const status = error instanceof Error && 'status' in error ? Number(error.status) : 0
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  if ([401, 403, 404].includes(status)) return copy.unavailable
  if (code === 'already_pending') return copy.alreadyPending
  if (code === 'already_joined') return copy.alreadyJoined
  if (code === 'no_reviewer') return copy.noReviewer
  if (code === 'affiliation_change_required') return copy.affiliationChange
  return [409, 412].includes(status) ? copy.changed : copy.failure
}
export function CollapseDisclosure({units}: {units: OrgJoinRequest['ancestorCollapsePreview']}) {
  const {locale} = useOrganizationMessages(), copy = joinRequestMessages[locale]
  return <section className="organization-confirmation"><p>{copy.collapseRule}</p><strong>{copy.affected}</strong>{units.length ? <ul>{units.map(unit => <li key={unit.id}>{unit.name}</li>)}</ul> : <p>{copy.noneAffected}</p>}</section>
}
export function OwnRequestsSection() {
  const {locale} = useOrganizationMessages(), copy = joinRequestMessages[locale]
  const [status, setStatus] = useState<'pending' | 'history'>('pending')
  const [page, setPage] = useState(1)
  return <section aria-label={copy.ownRequests} className="organization-directory-section">
    <h2>{copy.ownRequests}</h2>
    <div className="organization-actions" role="group" aria-label={copy.ownRequests}><Button variant={status === 'pending' ? 'primary' : 'secondary'} aria-pressed={status === 'pending'} onPress={() => {setStatus('pending'); setPage(1)}}>{copy.pendingTab}</Button><Button variant={status === 'history' ? 'primary' : 'secondary'} aria-pressed={status === 'history'} onPress={() => {setStatus('history'); setPage(1)}}>{copy.historyTab}</Button></div>
    <OwnRequestsList key={`${status}:${page}`} status={status} page={page} onPage={setPage}/>
  </section>
}
function OwnRequestsList({status, page, onPage}: {status: 'pending' | 'history'; page: number; onPage: (page: number) => void}) {
  const {operationsApi} = useOrganizationApi(), {locale, messages: {organizations: t}} = useOrganizationMessages(), copy = joinRequestMessages[locale]
  const [result, setResult] = useState<OrgJoinRequestPage | null>(null)
  const [error, setError] = useState(false), [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh=()=>setRevision(value=>value+1)
    window.addEventListener('hhc:organizations-changed',refresh)
    return()=>window.removeEventListener('hhc:organizations-changed',refresh)
  },[])
  useEffect(() => {
    const controller = new AbortController()
    void operationsApi.listOwnOrgJoinRequests({status, page, limit: 20, signal: controller.signal})
      .then(value => {if (!controller.signal.aborted) setResult(value)})
      .catch(() => {if (!controller.signal.aborted) {setResult(null); setError(true)}})
    return () => controller.abort()
  }, [operationsApi, status, page, revision])
  if (error) return <div><p className="form-error" role="alert">{t.loadFailed}</p><Button variant="secondary" onPress={() => {setError(false); setRevision(value => value + 1)}}>{t.retry}</Button></div>
  if (!result) return <p role="status">{t.loading}</p>
  return <>
    {!result.items.length ? <p role="status">{copy.emptyRequests}</p> : <ul className="organization-unit-list" aria-label={copy.ownRequests}>{[...new Map(result.items.map(item => [item.id, item])).values()].map(item => <li key={item.id}><Link prefetch={false} href={`/${locale}/organizations/requests/${item.id}`} aria-label={`${copy.viewRequest} ${item.orgUnitName}`}><span className="organization-unit-name">{item.orgUnitName}<small>{copy.requestedAt} <time dateTime={item.requestedAt}>{new Date(item.requestedAt).toLocaleString(locale)}</time>{item.decidedAt ? <> · {copy.decidedAt} <time dateTime={item.decidedAt}>{new Date(item.decidedAt).toLocaleString(locale)}</time></> : null}</small></span><span>{copy[item.status]}</span></Link></li>)}</ul>}
    {page > 1 || result.nextPage ? <nav className="organization-actions" aria-label={copy.ownRequests}><Button variant="secondary" isDisabled={page === 1} onPress={() => onPage(page - 1)}>{t.previous}</Button><span>{page}</span><Button variant="secondary" isDisabled={!result.nextPage} onPress={() => result.nextPage && onPage(result.nextPage)}>{t.next}</Button></nav> : null}
  </>
}
export function OwnJoinRequestPage() {
  const {requestId} = useParams<{requestId: string}>()
  return <OwnRequest key={requestId} requestId={requestId}/>
}
function OwnRequest({requestId}: {requestId: string}) {
  const {operationsApi} = useOrganizationApi(), {locale, messages: {organizations: t}} = useOrganizationMessages(), copy = joinRequestMessages[locale]
  const inbox = useNotificationInbox()
  const access = useOrganizationsAccess()
  const [request, setRequest] = useState<OrgJoinRequest | null>(null)
  const [error, setError] = useState<unknown>(null), [revision, setRevision] = useState(0)
  const [confirming, setConfirming] = useState(false), [pending, setPending] = useState(false)
  const [mutationError, setMutationError] = useState<unknown>(null)
  const intent = useRef<{version: number; key: string} | null>(null), inFlight = useRef(false), mounted = useRef(true)
  useEffect(() => {mounted.current = true; return () => {mounted.current = false}}, [])
  useEffect(() => {
    const controller = new AbortController()
    void operationsApi.getOwnOrgJoinRequest(requestId, controller.signal)
      .then(value => {if (!controller.signal.aborted) setRequest(value)})
      .catch(error => {if (!controller.signal.aborted) {setRequest(null); setError(error)}})
    return () => controller.abort()
  }, [operationsApi, requestId, revision])
  async function cancel() {
    if (!request || request.status !== 'pending' || !request.actions.cancel || inFlight.current) return
    const action = intent.current ?? {version: request.version, key: crypto.randomUUID()}
    intent.current = action; inFlight.current = true; setPending(true); setMutationError(null)
    try {
      const next = await operationsApi.cancelOrgJoinRequest(requestId, {version: action.version, idempotencyKey: action.key})
      if (mounted.current) {setRequest(next); setConfirming(false); intent.current = null; window.dispatchEvent(new Event('hhc:organizations-changed')); void inbox?.store.invalidate()}
    } catch (error) {
      if (mounted.current) {
        const status = error instanceof Error && 'status' in error ? Number(error.status) : 0
        if ([401, 403, 404].includes(status)) {setRequest(null); setError(error); setConfirming(false)}
        else if ([409, 412].includes(status)) {setRequest(null); setConfirming(false); intent.current = null; setRevision(value => value + 1)}
        else setMutationError(error)
      }
    } finally {inFlight.current = false; if (mounted.current) setPending(false)}
  }
  if (error) return <section className="organization-document organization-page"><p className="form-error" role="alert">{joinFailureMessage(error, copy)}</p><Button variant="secondary" onPress={() => {setError(null); setRevision(value => value + 1)}}>{t.retry}</Button></section>
  if (!request) return <p role="status">{t.loading}</p>
  return <section className="organization-document organization-page">
    <h1>{request.orgUnitName}</h1><p>{copy[request.status]}</p>
    {request.status === 'pending' ? <p>{copy.pendingNotice}</p> : null}
    <dl className="organization-request-dates"><div><dt>{copy.requestedAt}</dt><dd><time dateTime={request.requestedAt}>{new Date(request.requestedAt).toLocaleString(locale)}</time></dd></div>{request.decidedAt ? <div><dt>{copy.decidedAt}</dt><dd><time dateTime={request.decidedAt}>{new Date(request.decidedAt).toLocaleString(locale)}</time></dd></div> : null}{request.cancellationReason ? <div><dt>{copy.reason}</dt><dd>{copy[request.cancellationReason]}</dd></div> : null}</dl>
    {request.status === 'approved' && access.status === 'allowed' ? <ApprovedUnitEntry key={request.orgUnitId} unitId={request.orgUnitId} title={request.orgUnitName}/> : null}
    <CollapseDisclosure units={request.ancestorCollapsePreview}/>
    {request.status === 'pending' && request.actions.cancel ? <Button variant="secondary" onPress={() => {setMutationError(null); setConfirming(true)}}>{copy.cancelRequest}</Button> : null}
    <Dialog isOpen={confirming} onOpenChange={open => {if (!pending) setConfirming(open)}} title={copy.cancelRequest} closeLabel={t.back}>
      <div className="organization-dialog-stack"><p>{copy.cancelConfirm}</p>{mutationError ? <p className="form-error" role="alert">{joinFailureMessage(mutationError, copy)}</p> : null}<div className="organization-actions"><Button variant="secondary" isDisabled={pending} onPress={() => setConfirming(false)}>{t.back}</Button><Button isDisabled={pending} onPress={() => void cancel()}>{pending ? t.sending : copy.cancelRequest}</Button></div></div>
    </Dialog>
  </section>
}


function ApprovedUnitEntry({unitId,title}:{unitId:string;title:string}) {
 const {operationsApi}=useOrganizationApi(),{locale,messages:{organizations:t}}=useOrganizationMessages()
 const [available,setAvailable]=useState(false)
 useEffect(()=>{
  const controller=new AbortController()
  void operationsApi.getManagedUnit(unitId,controller.signal).then(folder=>{if(!controller.signal.aborted)setAvailable(folder.unit.id===unitId&&folder.unit.status==='active')}).catch(()=>{if(!controller.signal.aborted)setAvailable(false)})
  return()=>controller.abort()
 },[operationsApi,unitId])
 return available?<Link prefetch={false} href={`/${locale}/organizations/${unitId}`}>{t.view} {title}</Link>:null
}
