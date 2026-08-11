import {bulletinEditions, isBulletinEdition, type BulletinEdition} from '@hallelujahhomechurch/preferences';
import {type WeeklyBulletin, type WeeklyIssue, type WeeklyIssuePage} from './types';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type PublicBulletin = {
  issueNumber?: number;
  issueDate: string;
  locale: string;
  title: string;
  subtitle?: string;
  downloadUrl: string;
  downloadFileName?: string;
  publishedAt: string;
  version: number;
};
type PublicIssue = {
  issueNumber?: number;
  issueDate: string;
  versions: PublicBulletin[];
};
type Envelope<T> = {
  data: T;
  meta: {page?: number; pageSize?: number; total?: number};
  error: {code: string; message: string} | null;
};
type ClientOptions = {fetcher?: Fetcher; baseUrl?: string; signal?: AbortSignal};

export class WeeklyApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'WeeklyApiError';
  }
}

export async function fetchLatestWeekly(options: ClientOptions = {}) {
  const latest = (await fetchWeeklyArchive({page: 1, pageSize: 1}, options)).items[0];
  if (!latest?.versions.length) {
    throw new WeeklyApiError('not_found', 'The latest bulletin is unavailable.');
  }
  return latest;
}

export async function fetchWeeklyArchive(
  {page = 1, pageSize = 12}: {page?: number; pageSize?: number},
  options: ClientOptions = {}
): Promise<WeeklyIssuePage> {
  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const query = `page=${normalizedPage}&pageSize=${normalizedPageSize}`;
  const response = await request<PublicIssue[]>(`/bulletins?${query}`, options);
  const order = new Map(bulletinEditions.map((locale, index) => [locale, index]));
  const items: WeeklyIssue[] = response.data.map((issue) => ({
    id: issue.issueDate,
    issueNumber: issue.issueNumber,
    date: issue.issueDate,
    versions: issue.versions
      .filter((version): version is PublicBulletin & {locale: BulletinEdition} => isBulletinEdition(version.locale))
      .map(toWeekly)
      .sort((left, right) => (order.get(left.locale) ?? 0) - (order.get(right.locale) ?? 0))
  }));
  const totalItems = response.meta.total ?? items.length;

  return {
    items,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / normalizedPageSize))
  };
}

function toWeekly(value: PublicBulletin & {locale: BulletinEdition}): WeeklyBulletin {
  const href = value.downloadFileName && !value.downloadUrl.includes('filename=')
    ? `${value.downloadUrl}${value.downloadUrl.includes('?') ? '&' : '?'}filename=${encodeURIComponent(value.downloadFileName)}`
    : value.downloadUrl;
  return {locale: value.locale, issueNumber: value.issueNumber, date: value.issueDate, title: value.title, subtitle: value.subtitle ?? '', href};
}

async function request<T>(path: string, options: ClientOptions) {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const baseUrl = (options.baseUrl ?? process.env.NEXT_PUBLIC_HHC_WEB_API_BASE_URL ?? '/api').replace(/\/$/, '');
  const response = await fetcher(`${baseUrl}${path}`, {headers: {Accept: 'application/json'}, signal: options.signal});
  const envelope = await response.json() as Envelope<T>;
  if (!response.ok || envelope.error) {
    throw new WeeklyApiError(envelope.error?.code ?? 'request_failed', envelope.error?.message ?? response.statusText);
  }
  return envelope;
}
