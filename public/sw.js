function notificationPath(value) {
  try {
    const target = new URL(value || '/', self.location.origin);
    return target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : '/';
  } catch {
    return '/';
  }
}

function notificationClickBehavior(payload) {
  if (payload?.clickBehavior === 'dismiss') return 'dismiss';
  if (payload?.clickBehavior === 'url') return 'url';
  if (payload?.clickBehavior === 'home') return 'home';
  return payload?.actionUrl ? 'url' : 'home';
}

const readerCodeCache = 'hhc-reader-public-code-v1';
const readerLocales = ['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko'];
const readerRoute = /^\/(zh-Hant|zh-Hans|en|ja|ko)\/literature-ministry\/[1-9]\d{0,8}\/read\/(general|children)\/(zh-Hant|zh-Hans|en)$/;
function readerShell(locale) {return `/${locale}/literature-ministry/offline/reader-shell`;}
function publicCode(url) {
  return url.origin === self.location.origin && !url.search &&
    (url.pathname.startsWith('/_next/static/') || /^\/assets\/weekly\/v[1-9]\d*\/[a-z-]+-[a-f0-9]{64}\.(woff2|png|svg|txt)$/.test(url.pathname));
}
function cacheableCode(response) {
  const policy = response.headers.get('Cache-Control') || '';
  return response.ok && response.type !== 'opaque' && !response.redirected && /\bpublic\b/i.test(policy) && !/\b(private|no-store)\b/i.test(policy);
}
async function codeResponse(request, required = false) {
  const cache = await caches.open(readerCodeCache);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(new Request(request, {credentials: 'omit'}));
  if (cacheableCode(response)) {
    try {await cache.put(request.url, response.clone());}
    catch (error) {if (required) throw error;}
  }
  return response;
}
async function readerNavigation(request, locale) {
  try {return await fetch(request);}
  catch {
    const cache = await caches.open(readerCodeCache);
    return await cache.match(readerShell(locale)) || new Response('Connect to open the reader.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}});
  }
}
async function offlineLaunch(request, preferredLocale) {
  try {return await fetch(request);}
  catch {
    const cache = await caches.open(readerCodeCache);
    const locales = [...new Set([preferredLocale, ...readerLocales].filter(Boolean))];
    for (const locale of locales) {
      if (await cache.match(readerShell(locale))) return Response.redirect(`${self.location.origin}/${locale}/literature-ministry/offline`, 302);
    }
    return new Response('Connect to open the website.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}});
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || request.headers.has('Authorization')) {
    event.respondWith(fetch(request)); return;
  }
  if (request.method !== 'GET') return;
  const route = url.pathname.match(readerRoute);
  if (request.mode === 'navigate' && route) {event.respondWith(readerNavigation(request, route[1])); return;}
  const offlineList = url.pathname.match(/^\/(zh-Hant|zh-Hans|en|ja|ko)\/literature-ministry\/offline$/);
  if (request.mode === 'navigate' && offlineList) {event.respondWith(readerNavigation(request, offlineList[1])); return;}
  const home = url.pathname.match(/^\/(?:(zh-Hant|zh-Hans|en|ja|ko)\/?)?$/);
  if (request.mode === 'navigate' && home) {event.respondWith(offlineLaunch(request, home[1])); return;}
  if (publicCode(url)) event.respondWith(codeResponse(request));
});

async function prepareReaderShell(locale) {
  const path = readerShell(locale);
  const response = await fetch(path, {credentials: 'omit', cache: 'no-store', redirect: 'error'});
  if (!response.ok || response.headers.get('X-HHC-Reader-Shell') !== 'public') throw new Error('invalid_reader_shell');
  const html = await response.clone().text();
  const urls = [...new Set(Array.from(html.matchAll(/(?:src|href)="([^"#]+)"/g), match => match[1]))]
    .map(value => new URL(value, self.location.origin)).filter(publicCode);
  if (!urls.some(url => url.pathname.endsWith('.js'))) throw new Error('invalid_reader_shell');
  for (const url of urls) {
    const asset = await codeResponse(new Request(url), true);
    if (!cacheableCode(asset)) throw new Error('invalid_reader_code');
    if (url.pathname.endsWith('.css')) {
      const css = await asset.clone().text();
      for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const dependency = new URL(match[1], url);
        if (publicCode(dependency) && !cacheableCode(await codeResponse(new Request(dependency), true))) throw new Error('invalid_reader_code');
      }
    }
  }
  const cache = await caches.open(readerCodeCache);
  await cache.put(path, response);
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'PREPARE_READER_SHELL' || !readerLocales.includes(event.data.locale) || !event.source?.url || new URL(event.source.url).origin !== self.location.origin) return;
  event.waitUntil(prepareReaderShell(event.data.locale).then(() => event.ports[0]?.postMessage({ok: true}), () => event.ports[0]?.postMessage({ok: false})));
});

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = {};
  }

  const clickBehavior = notificationClickBehavior(payload);
  event.waitUntil(self.registration.showNotification(payload.title || '哈利路亞家教會', {
    body: payload.body || '',
    icon: '/assets/brand/logo.png',
    data: {
      clickBehavior,
      url: clickBehavior === 'url' ? notificationPath(payload.actionUrl) : '/'
    }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickBehavior = event.notification.data?.clickBehavior;
  if (clickBehavior === 'dismiss') return;
  const path = clickBehavior === 'home' ? '/' : notificationPath(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(path).then(() => existing.focus());
    return self.clients.openWindow(path);
  }));
});
