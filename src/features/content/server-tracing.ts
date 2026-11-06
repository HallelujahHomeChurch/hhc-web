import * as Sentry from '@sentry/nextjs';
import {privateContentBaseUrl, publicContentBaseUrl} from './config';

export function contentTraceTarget(baseUrl = publicContentBaseUrl(), exactPath = false) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Public content API tracing requires an HTTP base URL without credentials, query or fragment');
  }
  const base = `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  const boundary = exactPath ? '(?:\\?|$)' : '(?:/|\\?|$)';
  return new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${boundary}`);
}

export function serverTraceSampleRate(value = process.env.SENTRY_TRACES_SAMPLE_RATE) {
  const rate = value?.trim() ? Number(value) : 0.01;
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.1) {
    throw new Error('SENTRY_TRACES_SAMPLE_RATE must be between 0 and 0.1');
  }
  return rate;
}

export function contentServerTracing() {
  const targets = [contentTraceTarget()];
  const privateHistory = privateContentBaseUrl('HHC_WEB_HISTORY_API_BASE_URL');
  const privateAbout = privateContentBaseUrl('HHC_WEB_ABOUT_API_BASE_URL');
  const privateNews = privateContentBaseUrl('HHC_WEB_NEWS_API_BASE_URL');
  if (privateNews) targets.push(contentTraceTarget(`${privateNews}/news`));
  if (privateAbout) targets.push(contentTraceTarget(`${privateAbout}/pages/about`, true));
  if (privateHistory) targets.push(contentTraceTarget(`${privateHistory}/history`, true));
  const rate = serverTraceSampleRate();
  return {
    // A remote sampled=1 is not authority to increase this service's budget.
    tracesSampler: () => rate,
    traceLifecycle: 'stream' as const,
    propagateTraceparent: true,
    tracePropagationTargets: targets,
    integrations: [Sentry.nativeNodeFetchIntegration({
      responseHook(span, {request, response}) {
        if (!targets.some((target) => target.test(`${request.origin}${request.path}`))) return;
        const canonical: string[] = [];
        const legacy: string[] = [];
        for (let i = 0; i < response.headers.length; i += 2) {
          const name = response.headers[i].toString().toLowerCase();
          if (name === 'x-hhc-request-id') canonical.push(response.headers[i + 1].toString());
          else if (name === 'x-request-id') legacy.push(response.headers[i + 1].toString());
        }
        // Read the API's diagnostic identity only on real network responses, not cache hits.
        // An invalid canonical header must not be rescued by a legacy value.
        const ids = canonical.length ? canonical : legacy;
        if (ids.length === 1 && /^[A-Za-z0-9._:-]{1,128}$/.test(ids[0])) {
          span.setAttribute('hhc.api_request_id', ids[0]);
        }
      }
    })]
  };
}
