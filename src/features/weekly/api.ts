import {createHhcWebClient, HhcWebApiError, type BulletinDownloadJob, type ProtectedBulletin} from '@hallelujahhomechurch/hhc-web-client';
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
      const versions = await Promise.all(locales.map((locale) => absentAsUndefined(() => client.getLatestProtectedBulletin(locale, series, signal))));
      return groupBulletins(versions.filter(isPresent))[0] ?? null;
    },

    async fetchArchive(
      series: BulletinSeries,
      locales: readonly BulletinLocale[],
      {page = 1, pageSize = 12}: {page?: number; pageSize?: number} = {},
      signal?: AbortSignal
    ): Promise<WeeklyIssuePage> {
      const normalizedPage = Math.max(1, Math.floor(page));
      const normalizedPageSize = Math.max(1, Math.floor(pageSize));
      const pages = await Promise.all(locales.map((locale) => absentAsUndefined(() => client.listProtectedBulletins({locale, series, page: normalizedPage, pageSize: normalizedPageSize, signal}))));
      const availablePages = pages.filter(isPresent);
      const items = groupBulletins(availablePages.flatMap((result) => result.data));
      const totalItems = Math.max(0, ...availablePages.map((result) => result.meta.total));

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

function createProtectedFetch(authorization: BulletinAuthorization, fetcher: Fetcher): Fetcher {
  return async (input, init) => {
    const token = await authorization.getAccessToken();
    if (!token) throw new WeeklyApiError('not_authenticated', 'An authenticated member session is required.');
    const request = withToken(new Request(input, init), token);
    const response = await fetcher(request.clone());
    if (response.status !== 401) return response;

    const refreshed = await authorization.refreshAfterUnauthorized(token);
    return refreshed ? fetcher(withToken(request, refreshed)) : response;
  };
}

function withToken(request: Request, token: string): Request {
  const headers = new Headers(request.headers);
  headers.set('authorization', `Bearer ${token}`);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  return new Request(request, {headers});
}

async function absentAsUndefined<T>(request: () => Promise<T>): Promise<T | undefined> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof HhcWebApiError && error.status === 404) return undefined;
    throw error;
  }
}

function groupBulletins(bulletins: ProtectedBulletin[]): WeeklyIssue[] {
  const issues = new Map<string, WeeklyIssue>();
  for (const bulletin of bulletins) {
    const issue = issues.get(bulletin.issueId) ?? {
      id: bulletin.issueId,
      issueNumber: bulletin.issueNumber,
      date: bulletin.issueDate,
      versions: []
    };
    issue.versions.push({
      issueId: bulletin.issueId,
      series: bulletin.series,
      locale: bulletin.locale,
      issueNumber: bulletin.issueNumber,
      date: bulletin.issueDate,
      title: bulletin.title,
      subtitle: bulletin.subtitle,
      downloadName: bulletin.downloadName
    });
    issues.set(issue.id, issue);
  }
  return [...issues.values()]
    .map((issue) => ({...issue, versions: issue.versions.toSorted((left, right) => bulletinLocales.indexOf(left.locale) - bulletinLocales.indexOf(right.locale))}))
    .toSorted((left, right) => right.date.localeCompare(left.date));
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}
