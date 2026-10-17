import type {Locale} from '@/i18n/locales'

export function organizationHref(locale: Locale, path: string) { return `/${locale}${path}` }
