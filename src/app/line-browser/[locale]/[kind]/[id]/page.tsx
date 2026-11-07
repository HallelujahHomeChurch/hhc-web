import {notFound} from 'next/navigation';
import {isLocale} from '@/i18n/locales';
import {recordingIdPattern, recordingShareMetadata, videoPublicIdPattern, videoShareMetadata} from '@/features/member-videos/share-metadata';
import LineBrowserPage from '../../page';

type Props = {params: Promise<{locale: string; kind: string; id: string}>};
export const dynamic = 'force-dynamic';

async function shareParams(params: Props['params']) {
  const value = await params;
  if (!isLocale(value.locale) || !(value.kind === 'video' ? videoPublicIdPattern.test(value.id)
    : value.kind === 'recording' && recordingIdPattern.test(value.id))) notFound();
  return {...value, locale: value.locale};
}

export async function generateMetadata({params}: Props) {
  const {locale, kind, id} = await shareParams(params);
  return kind === 'video' ? videoShareMetadata(id) : recordingShareMetadata(locale, id);
}

export default async function LineVideoBrowserPage({params}: Props) {
  const {locale} = await shareParams(params);
  return LineBrowserPage({params: Promise.resolve({locale})});
}
