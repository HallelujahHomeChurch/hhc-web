import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {resolveRootLocale} from '@/lib/root-locale';

export default async function RootPage() {
  const requestHeaders = await headers();
  redirect(`/${resolveRootLocale(requestHeaders.get('cookie') ?? '', requestHeaders.get('accept-language') ?? '')}`);
}
