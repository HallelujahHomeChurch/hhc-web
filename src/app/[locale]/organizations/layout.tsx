import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {isLocale} from '@/i18n/locales'
import {getSiteLayout} from '@/features/site-layout/api'
import {OrganizationsShell} from '@/features/organizations/OrganizationsShell'
import {messages, organizationCopy} from '@/features/organizations/messages'
import {onDemandLocaleParams} from '@/lib/on-demand-locale-params'

type Props = {params: Promise<{locale: string}>; children: React.ReactNode}
export const generateStaticParams = onDemandLocaleParams
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale} = await params
  if (!isLocale(locale)) notFound()
  return {title: organizationCopy[locale].heroTitle, robots: {index: false, follow: false}}
}
export default async function OrganizationsLayout({params, children}: Props) {
  const {locale} = await params
  if (!isLocale(locale)) notFound()
  return <OrganizationsShell locale={locale} layout={await getSiteLayout(locale)} messages={messages[locale]} heroTitle={organizationCopy[locale].heroTitle} heroSubtitle={organizationCopy[locale].heroSubtitle}>{children}</OrganizationsShell>
}
