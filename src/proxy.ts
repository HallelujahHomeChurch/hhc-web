import {NextResponse, type NextRequest} from 'next/server';
import {isLineBrowser} from '@/lib/line-browser-handoff';
import {resolveRootLocale} from '@/lib/root-locale';

export function proxy(request: NextRequest) {
  if (!['GET', 'HEAD'].includes(request.method) || !isLineBrowser(request.headers.get('user-agent') ?? '')) {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  const locale = destination.pathname.split('/')[1] || resolveRootLocale(request.headers.get('cookie') ?? '', request.headers.get('accept-language') ?? '') || 'zh-Hant';
  destination.pathname = `/line-browser/${locale}`;
  return NextResponse.rewrite(destination, {headers: {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow'
  }});
}

export const config = {
  matcher: ['/', '/:locale(zh-Hant|zh-Hans|en|ja|ko)/:path*']
};
