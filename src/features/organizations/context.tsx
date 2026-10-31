'use client'

import {createContext, useContext, useMemo, type ReactNode} from 'react'
import {createOperationsClient} from '@hallelujahhomechurch/operations-client'
import {useAccountAuthorization, useAccountIdentity} from '@/components/layout/AccountControl'
import type {Locale} from '@/i18n/locales'
import {OperationsApi} from './api'
import {UnitNotificationsApi} from './notifications-api'
import type {OrganizationMessages} from './messages'

const Context = createContext<{locale: Locale; messages: OrganizationMessages; operationsApi: OperationsApi; unitNotificationsApi: UnitNotificationsApi} | null>(null)
export function OrganizationClientsProvider({locale, messages, children}: {locale: Locale; messages: OrganizationMessages; children: ReactNode}) {
  const authorization = useAccountAuthorization()
  const owner = useAccountIdentity()
  const value = useMemo(() => ({locale, messages, owner,
    operationsApi: new OperationsApi(createOperationsClient({baseUrl: '', ...authorization, fetcher: (input, init) => fetch(input, {...init, cache: 'no-store'})})),
    unitNotificationsApi: new UnitNotificationsApi(authorization),
  }), [locale, messages, authorization, owner])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useOrganizationApi() {
  const context = useContext(Context)
  if (!context) throw new Error('Management requires an authorized organization scope')
  return context
}
export function useOrganizationMessages() {
  const {locale, messages} = useOrganizationApi()
  return {locale, messages}
}
