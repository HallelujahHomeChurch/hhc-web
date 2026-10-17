'use client'
import {createContext, useContext, useState} from 'react'
import {Button, ExpandableSearchField} from '@hallelujahhomechurch/ui'
import {useTranslations} from 'next-intl'

export type OrganizationsSearchState = {query: string; available: boolean; setQuery: (query: string) => void; setAvailable: (status: {unitId: string; available: boolean}) => void}
export const OrganizationsSearchContext = createContext<OrganizationsSearchState | null>(null)
export function useOrganizationsSearch() { return useContext(OrganizationsSearchContext) }
export function OrganizationsSearch({onExpandedChange}: {onExpandedChange: (expanded: boolean) => void}) {
  const search = useOrganizationsSearch()
  const t = useTranslations('site.search')
  const [expanded, setExpanded] = useState(false)
  return <div className="organization-header-search">
    {search?.query.trim() && !expanded ? <div className="organization-search-applied"><span>{search.query}</span><Button size="sm" variant="ghost" aria-label={t('clear')} onPress={() => search.setQuery('')}>×</Button></div> : null}
    <ExpandableSearchField label={t('members')} placeholder={t('members')} submitLabel={t('submit')} clearLabel={t('clear')} closeLabel={t('close')}
      value={search?.query ?? ''} isDisabled={!search?.available} onChange={query => { if (search?.available) search.setQuery(query) }}
      onExpandedChange={open => {setExpanded(open); onExpandedChange(open)}} />
  </div>
}
