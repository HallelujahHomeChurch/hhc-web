'use client'
import {useEffect, type ReactNode} from 'react'
import {useRouter} from 'next/navigation'
import {Button} from '@hallelujahhomechurch/ui'
import {useAccountIdentity, useOrganizationsAccess} from '@/components/layout/AccountControl'
import type {Locale} from '@/i18n/locales'
import {OrganizationClientsProvider} from './context'
import {OrganizationRootsSkeleton} from './OrganizationLoading'
import type {OrganizationMessages} from './messages'

export function OrganizationsGate({locale, messages, children, loadingFallback}: {locale: Locale; messages: OrganizationMessages; children: ReactNode; loadingFallback?: ReactNode}) {
  const {status, retry} = useOrganizationsAccess()
  const owner = useAccountIdentity()
  const router = useRouter()
  const t = messages.organizations
  useEffect(() => { if (status === 'denied') router.replace(`/${locale}`) }, [status, locale, router])
  if (status === 'denied') return null
  if (status === 'loading') return <div className="shell py-12">{loadingFallback ?? <OrganizationRootsSkeleton label={t.loading}/>}</div>
  if (status === 'unavailable') return <div className="shell py-12"><p role="alert">{t.loadFailed}</p><Button onPress={retry}>{t.retry}</Button></div>
  return <OrganizationClientsProvider key={owner} locale={locale} messages={messages}>{children}</OrganizationClientsProvider>
}
