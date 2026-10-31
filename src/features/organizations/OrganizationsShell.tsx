'use client'
import {useCallback, useLayoutEffect, useRef, useState, type ReactNode} from 'react'
import {usePathname} from 'next/navigation'
import {useAccountIdentity, useOrganizationsAccess} from '@/components/layout/AccountControl'
import {SiteHeader} from '@/components/layout/SiteHeader'
import {SiteFooter} from '@/components/layout/SiteFooter'
import {AboutHero} from '@/components/about/AboutHero'
import type {Locale} from '@/i18n/locales'
import type {SiteLayout} from '@/features/site-layout/types'
import {OrganizationsGate} from './OrganizationsGate'
import {OrganizationsSearchContext} from './OrganizationsSearch'
import {OrganizationRootsSkeleton,OrganizationDirectorySkeleton,OrganizationMemberSkeleton} from './OrganizationLoading'
import type {OrganizationMessages} from './messages'
import './organizations.css'

export function OrganizationsShell({locale, layout, messages, heroTitle, heroSubtitle, children}: {locale: Locale; layout: SiteLayout; messages: OrganizationMessages; heroTitle: string; heroSubtitle: string; children: ReactNode}) {
  const pathname = usePathname()
  const owner = useAccountIdentity()
  const access = useOrganizationsAccess()
  const scope = `${owner}:${pathname}`
  const currentScope = useRef(scope)
  useLayoutEffect(() => { currentScope.current = scope }, [scope])
  const root = `/${locale}/organizations`
  const unitId = pathname.startsWith(`${root}/`) && pathname.slice(root.length + 1).split('/').length === 1 ? pathname.slice(root.length + 1) : ''
  const [search, setSearch] = useState({scope: '', query: ''})
  const [availability, setAvailability] = useState({scope: '', available: false})
  const setAvailable = useCallback((status: {unitId: string; available: boolean}) => {
    if (currentScope.current === scope && status.unitId === unitId) setAvailability({scope, available: status.available})
  }, [scope, unitId])
  return <OrganizationsSearchContext.Provider value={{query: search.scope === scope ? search.query : '', setQuery: query => setSearch({scope, query}), available: access.status === 'allowed' && Boolean(unitId) && availability.scope === scope && availability.available, setAvailable}}>
    <SiteHeader layout={layout} locale={locale} pathname={pathname} />
    <OrganizationsGate locale={locale} messages={messages} loadingFallback={pathname===root?<OrganizationRootsSkeleton label={messages.organizations.loading}/>:pathname.includes('/members/')?<OrganizationMemberSkeleton label={messages.organizations.loading}/>:<OrganizationDirectorySkeleton label={messages.organizations.loading}/>}>
      <main className="organizations">
        {pathname === root ? <AboutHero locale={locale} imageUrl={layout.bannerImageUrl} title={heroTitle} subtitle={heroSubtitle} /> : null}
        <div className="organizations-main">{children}</div>
      </main>
    </OrganizationsGate>
    <SiteFooter layout={layout} locale={locale} pathname={pathname} />
  </OrganizationsSearchContext.Provider>
}
