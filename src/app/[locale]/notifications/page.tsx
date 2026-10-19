import type {Metadata} from 'next';
import {connection} from 'next/server';
import {notFound} from 'next/navigation';
import {isLocale} from '@/i18n/locales';
import {getMessages} from '@/i18n/messages';
import {getSiteLayout} from '@/features/site-layout/api';
import {SiteHeader} from '@/components/layout/SiteHeader';
import {SiteFooter} from '@/components/layout/SiteFooter';
import {NotificationsPage} from '@/features/notifications/NotificationsPage';
type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata> {
 const {locale}=await params;if(!isLocale(locale))notFound();
 return {title:getMessages(locale).site.inbox.title,robots:{index:false,follow:false}};
}
export default async function Page({params}:Props) {
 await connection();
 const {locale}=await params;if(!isLocale(locale))notFound();const layout=await getSiteLayout(locale),pathname=`/${locale}/notifications`;
 return <><SiteHeader layout={layout} locale={locale} pathname={pathname}/><main><NotificationsPage/></main><SiteFooter layout={layout} locale={locale} pathname={pathname}/></>;
}
