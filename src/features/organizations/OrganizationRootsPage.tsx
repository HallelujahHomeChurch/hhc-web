'use client'

import { Button, Card, Skeleton } from '@hallelujahhomechurch/ui'
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { organizationHref } from './routes'

import { useOrganizationApi } from './context'
import { useOrganizationMessages } from './context'
import type { ManagedUnit } from './api'

export function OrganizationRootsPage() {
  const { operationsApi } = useOrganizationApi()
  const { locale, messages: t } = useOrganizationMessages()
  const [roots, setRoots] = useState<ManagedUnit[] | null>(null)
  const [status, setStatus] = useState<'ok' | 'forbidden' | 'error'>('ok')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) { setRoots(null); setStatus('ok') } })
    void operationsApi.listManagedRoots(controller.signal)
      .then(value => { if (!controller.signal.aborted) setRoots(value) })
      .catch(error => { if (!controller.signal.aborted) { setRoots([]); setStatus(error instanceof Error && 'status' in error && error.status === 403 ? 'forbidden' : 'error') } })
    return () => controller.abort()
  }, [operationsApi, revision])

  if (roots === null) return <Skeleton className="account-page-skeleton" label={t.organizations.loading} />
  return <section className="organization-document organization-page organization-roots-page">
    <div className="page-heading"><h2>{t.organizations.roots}</h2></div>
    {status !== 'ok' ? <Card className="panel-card"><Card.Content><p className="form-error" role="alert">{status === 'forbidden' ? t.organizations.forbidden : t.organizations.loadFailed}</p><Button variant="secondary" onPress={() => setRevision(value => value + 1)}>{t.organizations.retry}</Button></Card.Content></Card> : null}
    {status === 'ok' ? roots.length ? <ul className="organization-unit-list" aria-label={t.organizations.roots}>
      {roots.map(unit => <li key={unit.id}>
        <Link href={organizationHref(locale, '/organizations/' + unit.id)} aria-label={t.organizations.view + ' ' + unit.name}>
          <span className="organization-unit-name">{unit.name}</span>
          <span className="organization-unit-enter" aria-hidden="true">{t.organizations.view}<ChevronRight size={18} /></span>
        </Link>
      </li>)}
    </ul> : <p role="status" className="organization-unit-empty">{t.organizations.empty}</p> : null}
  </section>
}
