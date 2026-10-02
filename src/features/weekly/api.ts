import {createHhcWebClient, HhcWebApiError, type BulletinDownloadJob, type ProtectedBulletin, type OnlineBulletinDiscovery} from '@hallelujahhomechurch/hhc-web-client';
import {bulletinLocales, type BulletinLocale, type BulletinSeries} from '@hallelujahhomechurch/preferences';
import type {WeeklyBulletin, WeeklyIssue, WeeklyIssuePage} from './types';

type BulletinAuthorization = {
  getAccessToken: () => Promise<string | null>;
  refreshAfterUnauthorized: (rejectedToken: string) => Promise<string | null>;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type WeeklyBulletinApi = ReturnType<typeof createWeeklyBulletinApi>;

export class WeeklyApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'WeeklyApiError';
  }
}

export function createWeeklyBulletinApi(authorization: BulletinAuthorization, fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {
  const protectedFetch = createProtectedFetch(authorization, fetcher);
  const client = createHhcWebClient({
    baseUrl: '/api',
    getAccessToken: () => null,
    fetcher: protectedFetch
  });

  return {
    async fetchLatest(series: BulletinSeries, locales: readonly BulletinLocale[], signal?: AbortSignal): Promise<WeeklyIssue | null> {
      if (!locales.length) return null;
      try {
        const result = await client.listOnlineBulletinDiscovery({series, locales, offset: 0, limit: 1, signal});
        return groupBulletins(result.items.map(fromDiscovery))[0] ?? null;
      } catch (error) {
        if (!isTransient(error) || signal?.aborted) throw error;
        const versions = await Promise.all(locales.map(locale => client.getLatestProtectedBulletin(locale, series, signal)));
        return groupBulletins(versions.map(fromPDF).toSorted((a, b) => b.date.localeCompare(a.date)))[0] ?? null;
      }
    },

    async fetchArchive(
      series: BulletinSeries,
      locales: readonly BulletinLocale[],
      {page = 1, pageSize = 12}: {page?: number; pageSize?: number} = {},
      signal?: AbortSignal
    ): Promise<WeeklyIssuePage> {
      const normalizedPage = Math.max(1, Math.floor(page));
      const normalizedPageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
      if (!locales.length) return {items: [], page: normalizedPage, pageSize: normalizedPageSize, totalItems: 0, totalPages: 1};
      let items: WeeklyIssue[];
      let totalItems: number;
      try {
        const result = await client.listOnlineBulletinDiscovery({series, locales, offset: (normalizedPage - 1) * normalizedPageSize, limit: normalizedPageSize, signal});
        items = groupBulletins(result.items.map(fromDiscovery));
        totalItems = result.total;
      } catch (error) {
        // The legacy PDF API cannot page a multi-language union authoritatively.
        if (!isTransient(error) || signal?.aborted || locales.length !== 1) throw error;
        const result = await client.listProtectedBulletins({series, locale: locales[0], page: normalizedPage, pageSize: normalizedPageSize, signal});
        items = groupBulletins(result.data.map(fromPDF));
        totalItems = result.meta.total;
      }

      return {
        items,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / normalizedPageSize))
      };
    },

    async download(bulletin: WeeklyBulletin, signal?: AbortSignal): Promise<Response> {
      const response = await protectedFetch(`/api/member/bulletins/${bulletin.issueId}/versions/${bulletin.locale}/download?series=${encodeURIComponent(bulletin.series)}`, {
        cache: 'no-store',
        headers: {accept: 'application/pdf'},
        signal
      });
      if (!response.ok) throw new WeeklyApiError(`http_${response.status}`, 'Bulletin download is unavailable.');
      return response;
    },

    createDownloadJob(bulletin: WeeklyBulletin, idempotencyKey: string, signal?: AbortSignal): Promise<BulletinDownloadJob> {
      return client.createBulletinDownloadJob(bulletin.issueId, bulletin.locale, bulletin.series, idempotencyKey, signal);
    },

    getDownloadJob(bulletin: WeeklyBulletin, id: string, signal?: AbortSignal): Promise<BulletinDownloadJob> {
      return client.getBulletinDownloadJob(id, bulletin.locale, bulletin.series, signal);
    },

    async downloadPreparedBulletin(bulletin: WeeklyBulletin, id: string, signal?: AbortSignal): Promise<Response> {
      const response = await protectedFetch(new URL(`/api/member/bulletin-download-jobs/${encodeURIComponent(id)}/file?locale=${encodeURIComponent(bulletin.locale)}&series=${encodeURIComponent(bulletin.series)}`, globalThis.location.origin), {
        cache: 'no-store',
        headers: {accept: 'application/pdf'},
        signal
      });
      if (!response.ok) throw new WeeklyApiError(`http_${response.status}`, 'Prepared bulletin download is unavailable.');
      return response;
    }
  };
}

export function createProtectedFetch(authorization: BulletinAuthorization, fetcher: Fetcher): Fetcher {
  return async (input, init) => {
    const token = await authorization.getAccessToken();
    if (!token) throw new WeeklyApiError('not_authenticated', 'An authenticated member session is required.');
    const request = withToken(new Request(input, init), token);
    const response = await fetcher(request.clone());
    if (response.status !== 401) return legalResponse(response);

    const refreshed = await authorization.refreshAfterUnauthorized(token);
    return legalResponse(refreshed ? await fetcher(withToken(request, refreshed)) : response);
  };
}

function legalResponse(response: Response): Response {
  if (response.status === 428 && typeof window !== 'undefined') window.dispatchEvent(new Event('hhc:legal-required'));
  return response;
}

function withToken(request: Request, token: string): Request {
  const headers = new Headers(request.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  return new Request(request, {headers});
}

function isTransient(error: unknown) {
  return error instanceof HhcWebApiError ? [502, 503, 504].includes(error.status) : error instanceof TypeError;
}

function fromPDF(bulletin: ProtectedBulletin): WeeklyBulletin {
  return {...bulletin, date: bulletin.issueDate, pdfPublished: true};
}

function fromDiscovery(bulletin: OnlineBulletinDiscovery['items'][number]): WeeklyBulletin {
  return {
    issueId: bulletin.issueId, series: bulletin.series, locale: bulletin.contentLocale,
    issueNumber: bulletin.issueNumber ?? undefined, date: bulletin.issueDate,
    title: bulletin.canonicalMetadata.title, subtitle: bulletin.canonicalMetadata.subtitle,
    downloadName: `${bulletin.issueNumber ?? bulletin.issueDate}-${bulletin.contentLocale}.pdf`,
    pdfPublished: bulletin.pdfPublished, onlineRevision: bulletin.onlineRevision ?? undefined,
    documentId: bulletin.documentId
  };
}

function groupBulletins(bulletins: WeeklyBulletin[]): WeeklyIssue[] {
  const issues = new Map<string, WeeklyIssue>();
  for (const bulletin of bulletins) {
    const issue = issues.get(bulletin.issueId) ?? {
      id: bulletin.issueId,
      issueNumber: bulletin.issueNumber,
      date: bulletin.date,
      versions: []
    };
    issue.versions.push(bulletin);
    issues.set(issue.id, issue);
  }
  return [...issues.values()]
    .map((issue) => ({...issue, versions: issue.versions.toSorted((left, right) => bulletinLocales.indexOf(left.locale) - bulletinLocales.indexOf(right.locale))}));
}
