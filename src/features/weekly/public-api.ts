import {locales, type Locale} from '@/i18n/locales';
import type {WeeklyBulletin, WeeklyIssue, WeeklyIssuePage} from './types';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type PublicBulletin = {
  issueDate: string;
  locale: Locale;
  title: string;
  downloadUrl: string;
  publishedAt: string;
  version: number;
};
type PublicIssue = {
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

export async function fetchLatestWeekly(locale: Locale, options: ClientOptions = {}) {
  const latest = (await fetchWeeklyArchive({page: 1, pageSize: 1}, options)).items[0];
  const weekly = latest?.versions.find((version) => version.locale === locale)
    ?? latest?.versions.find((version) => version.locale === 'zh-Hant');
  if (!weekly) {
    throw new WeeklyApiError('not_found', 'The latest bulletin is unavailable for this locale.');
  }
  return weekly;
}

export async function fetchWeeklyArchive(
  {page = 1, pageSize = 12}: {page?: number; pageSize?: number},
  options: ClientOptions = {}
): Promise<WeeklyIssuePage> {
  const normalizedPage = Math.max(1, Math.floor(page));
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const query = `page=${normalizedPage}&pageSize=${normalizedPageSize}`;
  const response = await request<PublicIssue[]>(`/bulletins?${query}`, options);
  const order = new Map(locales.map((locale, index) => [locale, index]));
  const items: WeeklyIssue[] = response.data.map((issue) => ({
    id: issue.issueDate,
    date: issue.issueDate,
    versions: issue.versions
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

function toWeekly(value: PublicBulletin): WeeklyBulletin {
  return {locale: value.locale, date: value.issueDate, title: value.title, href: value.downloadUrl};
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
