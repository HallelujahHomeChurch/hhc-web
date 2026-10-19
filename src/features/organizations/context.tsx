'use client'

import {createContext, useContext, useMemo, type ReactNode} from 'react'
import {createOperationsClient} from '@hallelujahhomechurch/operations-client'
import {useAccountAuthorization, useAccountIdentity, useInboxAuthRuntime} from '@/components/layout/AccountControl'
import type {Locale} from '@/i18n/locales'
import {OperationsApi} from './api'
import {UnitNotificationsApi} from './notifications-api'
import {messages} from './messages'

const Context = createContext<{locale: Locale; operationsApi: OperationsApi; unitNotificationsApi: UnitNotificationsApi} | null>(null)
export function OrganizationClientsProvider({locale, children}: {locale: Locale; children: ReactNode}) {
  const authorization = useAccountAuthorization()
  const owner = useAccountIdentity()
  const auth = useInboxAuthRuntime()
  const value = useMemo(() => ({locale, owner,
    operationsApi: new OperationsApi(createOperationsClient({baseUrl: '', ...authorization, auth, fetcher: (input, init) => fetch(input, {...init, cache: 'no-store'})})),
    unitNotificationsApi: new UnitNotificationsApi(authorization),
  }), [locale, authorization, owner, auth])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useOrganizationApi() {
  const context = useContext(Context)
  if (!context) throw new Error('Management requires an authorized organization scope')
  return context
}
export function useOrganizationMessages() {
  const {locale} = useOrganizationApi()
  return {locale, messages: messages[locale]}
}
