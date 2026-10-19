'use client'
import {useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react'
import {usePathname, useSearchParams} from 'next/navigation'
import {useAccountIdentity, useOrganizationsAccess} from '@/components/layout/AccountControl'
import {SiteHeader} from '@/components/layout/SiteHeader'
import {SiteFooter} from '@/components/layout/SiteFooter'
import {AboutHero} from '@/components/about/AboutHero'
import type {Locale} from '@/i18n/locales'
import type {SiteLayout} from '@/features/site-layout/types'
import {OrganizationsGate} from './OrganizationsGate'
import {OrganizationsSearchContext} from './OrganizationsSearch'
import {OrganizationRootsSkeleton,OrganizationDirectorySkeleton,OrganizationMemberSkeleton} from './OrganizationLoading'
import {organizationMessages} from './messages'
import {organizationCopy} from './messages'
import './organizations.css'

export function OrganizationsShell({locale, layout, children}: {locale: Locale; layout: SiteLayout; children: ReactNode}) {
  const pathname = usePathname()
  const params = useSearchParams()
  const owner = useAccountIdentity()
  const access = useOrganizationsAccess()
  const root = `/${locale}/organizations`
  const rootQuery = [...(params.get('q') ?? '').trim()].slice(0,100).join('')
  const scope = `${owner}:${pathname}`
  const source = params.toString()
  const currentScope = useRef(scope)
  useLayoutEffect(() => { currentScope.current = scope }, [scope])
  const ownerOnly = new RegExp(`^/${locale}/organizations/requests/[^/]+$`).test(pathname)
  const unitId = pathname.startsWith(`${root}/`) && pathname.slice(root.length + 1).split('/').length === 1 ? pathname.slice(root.length + 1) : ''
  const [search, setSearch] = useState({scope, source, query: pathname === root ? rootQuery : '', composing: false, navigations: [] as string[], navigationVersion: 0})
  if (search.scope !== scope) {
    setSearch({scope, source, query: pathname === root ? rootQuery : '', composing: false, navigations: [], navigationVersion: search.navigationVersion + 1})
  } else if (pathname === root && search.source !== source) {
    // A delayed acknowledgement must not replace input typed since navigation started.
    const ownNavigation = search.navigations.includes(source)
    setSearch({...search, source, query: ownNavigation ? search.query : rootQuery, composing: ownNavigation && search.composing, navigations: ownNavigation ? search.navigations.filter(value => value !== source) : [], navigationVersion: search.navigationVersion + (ownNavigation ? 0 : 1)})
  }
  const onNavigate = useCallback((source: string) => {
    if (currentScope.current === scope) setSearch(previous => ({...previous, navigations: [...new Set([...previous.navigations, source])]}))
  }, [scope, setSearch])
  useEffect(() => {
    if (pathname !== root) return
    const reset = () => {if (currentScope.current === scope) setSearch(previous => ({...previous, scope: '', navigations: []}))}
    window.addEventListener('popstate', reset)
    return () => window.removeEventListener('popstate', reset)
  }, [pathname, root, scope])
  const [availability, setAvailability] = useState({scope: '', available: false})
  const setAvailable = useCallback((status: {unitId: string; available: boolean}) => {
    if (currentScope.current === scope && status.unitId === unitId) setAvailability({scope, available: status.available})
  }, [scope, unitId])
  const copy = organizationCopy[locale]
  return <OrganizationsSearchContext.Provider value={{query: search.query, kind: pathname === root ? 'groups' : 'members', setQuery: query => {if (currentScope.current === scope) setSearch(previous => ({...previous, query}))}, composing: search.composing, setComposing: composing => {if (currentScope.current === scope) setSearch(previous => ({...previous, composing}))}, onNavigate, navigationVersion: search.navigationVersion, available: access.status === 'allowed' && (pathname === root || Boolean(unitId) && availability.scope === scope && availability.available), setAvailable}}>
    <SiteHeader layout={layout} locale={locale} pathname={pathname} />
    <OrganizationsGate locale={locale} ownerOnly={ownerOnly} loadingFallback={pathname===root?<OrganizationRootsSkeleton label={organizationMessages[locale].loading}/>:pathname.includes('/members/')?<OrganizationMemberSkeleton label={organizationMessages[locale].loading}/>:<OrganizationDirectorySkeleton label={organizationMessages[locale].loading}/>}>
      <main className="organizations">
        {pathname === root ? <AboutHero locale={locale} imageUrl={layout.bannerImageUrl} title={copy.heroTitle} subtitle={copy.heroSubtitle} /> : null}
        <div className="organizations-main">{children}</div>
      </main>
    </OrganizationsGate>
    <SiteFooter layout={layout} locale={locale} pathname={pathname} />
  </OrganizationsSearchContext.Provider>
}
