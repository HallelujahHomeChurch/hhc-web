import {NextResponse, type NextRequest} from 'next/server';
import {isLineBrowser} from '@/lib/line-browser-handoff';
import {resolveRootLocale} from '@/lib/root-locale';
import {getLocaleCookie, isLocale} from '@/i18n/locales';

export function proxy(request: NextRequest) {
  if (!['GET', 'HEAD'].includes(request.method)) return NextResponse.next();
  const destination = request.nextUrl.clone();
  const first = destination.pathname.split('/')[1];
  const locale = isLocale(first) ? first : resolveRootLocale(request.headers.get('cookie') ?? '', request.headers.get('accept-language') ?? '') ?? 'zh-Hant';
  if (isLineBrowser(request.headers.get('user-agent') ?? '')) {
    const video = destination.pathname.match(/^\/(?:(?:zh-Hant|zh-Hans|en|ja|ko)\/)?video\/([A-Za-z0-9_-]{11})$/);
    const recording = destination.pathname.match(/^\/(?:zh-Hant|zh-Hans|en|ja|ko)\/member-videos\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/);
    destination.pathname = video ? `/line-browser/${locale}/video/${video[1]}`
      : recording ? `/line-browser/${locale}/recording/${recording[1]}` : `/line-browser/${locale}`;
    return NextResponse.rewrite(destination, {headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow'
    }});
  }
  if (/^\/video\/[A-Za-z0-9_-]{11}$/.test(destination.pathname)) {
    destination.pathname = `/${locale}${destination.pathname}`;
    const response = NextResponse.rewrite(destination, {headers: {
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive'
    }});
    response.headers.append('Set-Cookie', getLocaleCookie(locale));
    return response;
  }
  const response = NextResponse.next();
  if (/^\/(zh-Hant|zh-Hans|en|ja|ko)\/member-videos\/[a-f0-9-]{36}$/.test(destination.pathname)) {
    response.headers.append('Set-Cookie', getLocaleCookie(locale));
  }
  return response;
}

export const config = {
  matcher: ['/', '/video/:path*', '/:locale(zh-Hant|zh-Hans|en|ja|ko)/:path*']
};
