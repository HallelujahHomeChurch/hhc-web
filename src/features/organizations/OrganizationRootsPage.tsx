'use client'
import {Button, Dialog} from '@hallelujahhomechurch/ui'
import {ChevronRight} from 'lucide-react'
import {Suspense, useEffect, useRef, useState} from 'react'
import Link from 'next/link'
import {usePathname, useRouter, useSearchParams} from 'next/navigation'
import {useNotificationInbox} from '@/features/notifications/provider'
import {useOrganizationApi, useOrganizationMessages} from './context'
import {useOrganizationsSearch} from './OrganizationsSearch'
import {OrganizationRootsSkeleton} from './OrganizationLoading'
import {joinRequestMessages} from './messages'
import {CollapseDisclosure, OwnRequestsSection, joinFailureMessage} from './OrganizationJoinRequests'
import type {DirectoryUnit, OrgUnitDirectoryPage, OrgJoinRequest} from './api'

const pageNumber = (value: string | null) => value && /^[1-9]\d*$/.test(value) && Number(value) <= 10000 ? Number(value) : 1
function queryState(value: string, navigationVersion = 0) {
  const params = new URLSearchParams(value)
  return {source: value, navigationVersion, q: [...(params.get('q') ?? '').trim()].slice(0, 100).join(''), minePage: pageNumber(params.get('minePage')), allPage: pageNumber(params.get('allPage'))}
}
export function OrganizationRootsPage() {
  return <Suspense fallback={<OrganizationRootsSkeleton label="…"/>}><Directory/></Suspense>
}
function Directory() {
  const {operationsApi} = useOrganizationApi()
  const {locale, messages: {organizations: t}} = useOrganizationMessages()
  const copy = joinRequestMessages[locale]
  const inbox = useNotificationInbox()
  const search = useOrganizationsSearch()
  const params = useSearchParams(), router = useRouter(), pathname = usePathname()
  const source = params.toString()
  const navigationVersion = search?.navigationVersion ?? 0, onNavigate = search?.onNavigate
  const [selection, setSelection] = useState(() => queryState(source, navigationVersion))
  const current = selection.source === source && selection.navigationVersion === navigationVersion ? selection : queryState(source, navigationVersion)
  const [draft, setDraft] = useState({source, value: current.q})
  const value = search?.query ?? (draft.source === source ? draft.value : current.q)
  const [composing, setComposing] = useState(false)
  const isComposing = composing || Boolean(search?.composing)
  const [revision, setRevision] = useState(0)
  const [target, setTarget] = useState<DirectoryUnit | null>(null)
  const [created, setCreated] = useState<OrgJoinRequest | null>(null)
  const [denied, setDenied] = useState(false)

  function navigate(next: typeof current) {
    setSelection(next)
    const query = new URLSearchParams()
    if (next.q) query.set('q', next.q)
    if (next.minePage > 1) query.set('minePage', String(next.minePage))
    if (next.allPage > 1) query.set('allPage', String(next.allPage))
    onNavigate?.(query.toString())
    router.replace(pathname + (query.size ? `?${query}` : ''), {scroll: false})
  }
  useEffect(() => {
    if (isComposing) return
    const q = [...value.trim()].slice(0, 100).join('')
    if (q === current.q) return
    const timer = setTimeout(() => {
      const next = {source, navigationVersion, q, minePage: 1, allPage: 1}
      setSelection(next)
      const query = new URLSearchParams(q ? {q} : {})
      onNavigate?.(query.toString())
      router.replace(pathname + (query.size ? `?${query}` : ''), {scroll: false})
    }, 250)
    return () => clearTimeout(timer)
  }, [value, isComposing, current.q, source, pathname, router, navigationVersion, onNavigate])

  if (denied) return <section className="organization-document organization-page"><p role="alert" className="form-error">{copy.unavailable}</p><Button variant="secondary" onPress={() => {setDenied(false); setRevision(value => value + 1)}}>{t.retry}</Button></section>
  return <div className="organization-document organization-page organization-roots-page">
    <label className="organization-group-search">{copy.searchGroups}<input type="search" className="organization-input" placeholder={copy.searchGroups} value={value} maxLength={200} onCompositionStart={() => search?.setComposing ? search.setComposing(true) : setComposing(true)} onCompositionEnd={() => search?.setComposing ? search.setComposing(false) : setComposing(false)} onChange={event => {const value = [...event.target.value].slice(0, 100).join(''); if (search) search.setQuery(value); else setDraft({source, value})}}/></label>
    {(['mine', 'all'] as const).map(relation => {
      const page = relation === 'mine' ? current.minePage : current.allPage
      return <DirectorySection key={`${relation}:${current.q}:${page}:${revision}`} relation={relation} q={current.q} page={page} onPage={page => navigate({...current, [relation === 'mine' ? 'minePage' : 'allPage']: page})} onApply={unit => {setCreated(null); setTarget(unit)}}/>
    })}
    {created ? <p role="status">{created.status === 'pending' ? copy.pendingNotice : copy[created.status]} <Link prefetch={false} href={`/${locale}/organizations/requests/${created.id}`}>{copy.viewRequest}</Link></p> : null}
    <OwnRequestsSection key={revision}/>
    {target ? <ApplyDialog key={target.id} unit={target} onDenied={() => {setTarget(null); setCreated(null); setDenied(true)}} onClose={() => setTarget(null)} onCreated={request => {setTarget(null); setCreated(request); setRevision(value => value + 1); void inbox?.store.invalidate()}} operationsApi={operationsApi}/> : null}
    <span className="sr-only">{t.title}</span>
  </div>
}
function DirectorySection({relation, q, page, onPage, onApply}: {relation: 'mine' | 'all'; q: string; page: number; onPage: (page: number) => void; onApply: (unit: DirectoryUnit) => void}) {
  const {operationsApi} = useOrganizationApi()
  const {locale, messages: {organizations: t}} = useOrganizationMessages()
  const copy = joinRequestMessages[locale], title = relation === 'mine' ? t.roots : copy.allGroups
  const [data, setData] = useState<OrgUnitDirectoryPage | null>(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    void operationsApi.listOrgUnitDirectory({relation, q, page, limit: 20, signal: controller.signal})
      .then(value => {if (!controller.signal.aborted) setData(value)})
      .catch(() => {if (!controller.signal.aborted) setError(true)})
    return () => controller.abort()
  }, [operationsApi, relation, q, page, revision])
  const units = data ? [...new Map(data.items.map(unit => [unit.id, unit])).values()] : []
  return <section aria-label={title} className="organization-directory-section">
    <div className="page-heading"><h2>{title}</h2></div>
    {error ? <div><p className="form-error" role="alert">{t.loadFailed}</p><Button variant="secondary" onPress={() => {setError(false); setData(null); setRevision(value => value + 1)}}>{t.retry}</Button></div> : !data ? <OrganizationRootsSkeleton label={t.loading}/> : units.length ? <ul className="organization-unit-list" aria-label={title}>
      {units.map(unit => <li key={unit.id}>
        {relation === 'mine' ? <Link prefetch={false} href={`/${locale}/organizations/${unit.id}`} aria-label={`${t.view} ${unit.name}`}><span className="organization-unit-name">{unit.name}</span><span className="organization-unit-enter" aria-hidden="true">{t.view}<ChevronRight size={18}/></span></Link> : <div className="organization-discovery-row">
          <div className="organization-unit-name">{unit.name}<small>{t[unit.kind]}{unit.ancestorLabels.length ? ` · ${unit.ancestorLabels.join(' / ')}` : ''}</small></div>
          <div className="organization-discovery-actions">
            {unit.relationship === 'joined' || unit.applicationAvailability === 'already_joined' ? <span>{copy.alreadyJoined}</span> : null}
            {unit.relationship !== 'none' ? <Link prefetch={false} href={`/${locale}/organizations/${unit.id}`} aria-label={`${t.view} ${unit.name}`}>{t.view}<ChevronRight size={18}/></Link> : null}
            {unit.applicationAvailability === 'pending' ? <><span>{copy.pending}</span>{unit.ownPendingRequestId ? <Link prefetch={false} href={`/${locale}/organizations/requests/${unit.ownPendingRequestId}`} aria-label={`${copy.viewRequest} ${unit.name}`}>{copy.viewRequest}</Link> : null}</> : unit.relationship !== 'joined' && unit.applicationAvailability !== 'already_joined' ? <>
              <Button variant="secondary" size="sm" aria-label={`${copy.apply} ${unit.name}`} isDisabled={unit.applicationAvailability !== 'available'} onPress={() => onApply(unit)}>{copy.apply}</Button>
              {unit.applicationAvailability === 'no_reviewer' ? <small>{copy.noReviewer}</small> : unit.applicationAvailability === 'affiliation_change_required' ? <small>{copy.affiliationChange}</small> : null}
            </> : null}
          </div>
        </div>}
      </li>)}
    </ul> : <p role="status" className="organization-unit-empty">{q ? t.noResults : t.empty}</p>}
    {data && !error && (page > 1 || data.nextPage) ? <nav className="organization-actions" aria-label={title}><Button variant="secondary" isDisabled={page === 1} onPress={() => onPage(page - 1)}>{t.previous}</Button><span>{page}</span><Button variant="secondary" isDisabled={!data.nextPage} onPress={() => data.nextPage && onPage(data.nextPage)}>{t.next}</Button></nav> : null}
  </section>
}
function ApplyDialog({unit, onClose, onCreated, onDenied, operationsApi}: {unit: DirectoryUnit; onDenied: () => void; onClose: () => void; onCreated: (request: OrgJoinRequest) => void; operationsApi: ReturnType<typeof useOrganizationApi>['operationsApi']}) {
  const {locale, messages: {organizations: t}} = useOrganizationMessages()
  const copy = joinRequestMessages[locale]
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [existingRequestId, setExistingRequestId] = useState<string>()
  const [blocked, setBlocked] = useState(false)
  const intent = useRef<string | null>(null), inFlight = useRef(false), mounted = useRef(true)
  useEffect(() => {mounted.current = true; return () => {mounted.current = false}}, [])
  async function submit() {
    if (inFlight.current || blocked) return
    inFlight.current = true; setPending(true); setError(null)
    intent.current ??= crypto.randomUUID()
    try {
      const request = await operationsApi.createOrgJoinRequest({orgUnitId: unit.id, idempotencyKey: intent.current})
      if (mounted.current) onCreated(request)
    } catch (error) {
      if (mounted.current) {
        setError(error)
        const status = error instanceof Error && 'status' in error ? Number(error.status) : 0
        if ([401, 403, 404].includes(status)) {onDenied(); return}
        setBlocked([400, 409, 412].includes(status))
        if (error instanceof Error && 'existingRequestId' in error && typeof error.existingRequestId === 'string') setExistingRequestId(error.existingRequestId)
      }
    } finally {inFlight.current = false; if (mounted.current) setPending(false)}
  }
  const forbidden = error instanceof Error && 'status' in error && [401, 403, 404].includes(Number(error.status))
  return <Dialog isOpen onOpenChange={open => {if (!open && !pending) onClose()}} title={copy.apply} closeLabel={t.cancel}>
    <div className="organization-dialog-stack">
      {!forbidden ? <><p>{copy.confirm.replace('{title}', unit.name)}</p><CollapseDisclosure units={unit.ancestorCollapsePreview}/></> : null}
      {error ? <p className="form-error" role="alert">{joinFailureMessage(error, copy)}</p> : null}
      {existingRequestId ? <Link prefetch={false} href={`/${locale}/organizations/requests/${existingRequestId}`}>{copy.viewRequest}</Link> : null}
      <div className="organization-actions"><Button variant="secondary" isDisabled={pending} onPress={onClose}>{t.cancel}</Button><Button isDisabled={pending || blocked} onPress={() => void submit()}>{pending ? t.sending : copy.submit}</Button></div>
    </div>
  </Dialog>
}
