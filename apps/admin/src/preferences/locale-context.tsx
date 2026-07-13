/* oxlint-disable react/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { getInitialLocale, type Locale } from './preferences'

const messages = {
  'zh-Hant': {
    brand: 'HHC 管理中心',
    privacy: '隱私權',
    terms: '條款',
    accountMenu: '帳號選單',
    adminNavigation: '管理中心導覽',
    openNavigation: '開啟導覽',
    closeNavigation: '關閉導覽',
    manageAccount: '管理帳號',
    signOut: '登出',
  },
  'zh-Hans': {
    brand: 'HHC 管理中心',
    privacy: '隐私权',
    terms: '条款',
    accountMenu: '帐号菜单',
    adminNavigation: '管理中心导航',
    openNavigation: '打开导航',
    closeNavigation: '关闭导航',
    manageAccount: '管理帐号',
    signOut: '退出登录',
  },
  en: {
    brand: 'HHC Admin',
    privacy: 'Privacy',
    terms: 'Terms',
    accountMenu: 'Account menu',
    adminNavigation: 'Admin navigation',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
    manageAccount: 'Manage account',
    signOut: 'Sign out',
  },
} satisfies Record<Locale, Record<string, string>>

type LocaleContextValue = {
  locale: Locale
  messages: (typeof messages)[Locale]
}

const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', messages: messages.en })

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale] = useState(() =>
    getInitialLocale(
      typeof document === 'undefined' ? '' : document.cookie,
      typeof navigator === 'undefined' ? ['en'] : navigator.languages,
    ),
  )
  const value = useMemo(() => ({ locale, messages: messages[locale] }), [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
