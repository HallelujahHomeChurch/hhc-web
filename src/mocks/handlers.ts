import {http, HttpResponse} from 'msw';
import {historyByLocale} from '@/features/history/mock-data';
import type {Locale} from '@/i18n/locales';
import {isLocale} from '@/i18n/locales';
import {locationsByLocale} from '@/features/locations/mock-data';
import {newsByLocale} from '@/features/news/mock-data';
import {videosByLocale} from '@/features/videos/mock-data';
import {weeklyIssues} from '@/features/weekly/mock-data';

const payloads = {
  locations: locationsByLocale,
  history: historyByLocale,
  news: newsByLocale,
  videos: videosByLocale
};

type PayloadKey = keyof typeof payloads | 'weekly';

export function getMockPayload(key: PayloadKey, locale: Locale) {
  if (key === 'weekly') return weeklyIssues[0];
  return payloads[key][locale] ?? payloads[key]['zh-Hant'];
}

function getLocale(url: URL) {
  const locale = url.searchParams.get('locale') ?? 'zh-Hant';
  return isLocale(locale) ? locale : 'zh-Hant';
}

export const handlers = [
  http.get('/api/news', ({request}) => HttpResponse.json(getMockPayload('news', getLocale(new URL(request.url))))),
  http.get('/api/weekly', ({request}) => HttpResponse.json(getMockPayload('weekly', getLocale(new URL(request.url))))),
  http.get('/api/videos', ({request}) => HttpResponse.json(getMockPayload('videos', getLocale(new URL(request.url))))),
  http.get('/api/locations', ({request}) => HttpResponse.json(getMockPayload('locations', getLocale(new URL(request.url))))),
  http.get('/api/history', ({request}) => HttpResponse.json(getMockPayload('history', getLocale(new URL(request.url)))))
];
