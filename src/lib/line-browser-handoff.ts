export const isLineBrowser = (userAgent: string) => /\bLINE\/\d/i.test(userAgent);

export function externalBrowserHref(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.set('openExternalBrowser', '1');
  return url.href;
}
