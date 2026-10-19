'use client'
import {useEffect, type ReactNode} from 'react'
import {useRouter} from 'next/navigation'
import {Button} from '@hallelujahhomechurch/ui'
import {useAccountIdentity, useOrganizationsAccess, useAccountAuth} from '@/components/layout/AccountControl'
import type {Locale} from '@/i18n/locales'
import {OrganizationClientsProvider} from './context'
import {OrganizationRootsSkeleton} from './OrganizationLoading'
import {joinRequestMessages, organizationMessages} from './messages'

export function OrganizationsGate({locale, children, loadingFallback, ownerOnly = false}: {locale: Locale; children: ReactNode; loadingFallback?: ReactNode; ownerOnly?: boolean}) {
  const access = useOrganizationsAccess()
  const auth = useAccountAuth()
  const status = ownerOnly ? auth.status === 'checking' ? 'loading' : auth.status === 'unavailable' ? 'unavailable' : auth.status !== 'authenticated' ? 'denied' : auth.session.permissionAvailability.status === 'available' ? 'allowed' : 'unavailable' : access.status
  const retry = access.retry
  const owner = useAccountIdentity()
  const router = useRouter()
  const t = organizationMessages[locale]
  useEffect(() => { if (!ownerOnly && status === 'denied') router.replace(`/${locale}`) }, [status, locale, router, ownerOnly])
  if (status === 'denied') return ownerOnly ? <p role="status">{joinRequestMessages[locale].signIn}</p> : null
  if (status === 'loading') return <div className="shell py-12">{loadingFallback ?? <OrganizationRootsSkeleton label={t.loading}/>}</div>
  if (status === 'unavailable') return <div className="shell py-12"><p role="alert">{t.loadFailed}</p><Button onPress={retry}>{t.retry}</Button></div>
  return <OrganizationClientsProvider key={owner} locale={locale}>{children}</OrganizationClientsProvider>
}
