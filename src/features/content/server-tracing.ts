import * as Sentry from '@sentry/nextjs';
import {publicContentBaseUrl} from './config';

export function contentTraceTarget(baseUrl = publicContentBaseUrl()) {
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Public content API tracing requires an HTTP base URL without credentials, query or fragment');
  }
  const base = `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  return new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|\\?|$)`);
}

export function serverTraceSampleRate(value = process.env.SENTRY_TRACES_SAMPLE_RATE) {
  const rate = value?.trim() ? Number(value) : 0.01;
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.1) {
    throw new Error('SENTRY_TRACES_SAMPLE_RATE must be between 0 and 0.1');
  }
  return rate;
}

export function contentServerTracing() {
  const target = contentTraceTarget();
  const rate = serverTraceSampleRate();
  return {
    // A remote sampled=1 is not authority to increase this service's budget.
    tracesSampler: () => rate,
    traceLifecycle: 'stream' as const,
    propagateTraceparent: true,
    tracePropagationTargets: [target],
    integrations: [Sentry.nativeNodeFetchIntegration({
      responseHook(span, {request, response}) {
        if (!target.test(`${request.origin}${request.path}`)) return;
        const ids: string[] = [];
        for (let i = 0; i < response.headers.length; i += 2) {
          if (response.headers[i].toString().toLowerCase() === 'x-request-id') ids.push(response.headers[i + 1].toString());
        }
        // Read the API's diagnostic identity only on real network responses, not cache hits.
        if (ids.length === 1 && /^[A-Za-z0-9._:-]{1,128}$/.test(ids[0])) {
          span.setAttribute('hhc.api_request_id', ids[0]);
        }
      }
    })]
  };
}
