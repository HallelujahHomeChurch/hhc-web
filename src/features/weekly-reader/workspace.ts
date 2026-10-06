import type {BulletinLocale, BulletinSeries} from '@hallelujahhomechurch/preferences';
import type {Locale} from '@/i18n/locales';

export type ReaderTab = {issueNumber: number; series: BulletinSeries; contentLocale: BulletinLocale; title?: string};
export const tabKey = (tab: ReaderTab) => `${tab.series}:${tab.contentLocale}:${tab.issueNumber}`;
export const tabHref = (locale: Locale, tab: ReaderTab) => `/${locale}/literature-ministry/${tab.issueNumber}/read/${tab.series}/${tab.contentLocale}`;
export const addTab = (tabs: ReaderTab[], tab: ReaderTab) => tabs.some(item => tabKey(item) === tabKey(tab)) ? tabs.map(item => tabKey(item) === tabKey(tab) && tab.title ? {...item, title: tab.title} : item) : [...tabs, tab];
export function closeTab(tabs: ReaderTab[], activeKey: string, closingKey: string) {
  const index = tabs.findIndex(tab => tabKey(tab) === closingKey);
  const next = tabs.filter(tab => tabKey(tab) !== closingKey);
  return {tabs: next, active: next.find(tab => tabKey(tab) === activeKey) ?? next[Math.max(0, index - 1)] ?? null};
}
export function readTabs(accountId: string): ReaderTab[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`weekly-reader-tabs:${accountId}`) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((tab): tab is ReaderTab => !!tab && Number.isInteger(tab.issueNumber) && tab.issueNumber > 0 && tab.issueNumber < 1e9 && ['general', 'children'].includes(tab.series) && ['zh-Hant', 'zh-Hans', 'en'].includes(tab.contentLocale)).reduce<ReaderTab[]>((tabs, tab) => addTab(tabs, {issueNumber: tab.issueNumber, series: tab.series, contentLocale: tab.contentLocale, ...(typeof tab.title === 'string' && tab.title.trim() ? {title: tab.title.slice(0, 512)} : {})}), []);
  } catch {return [];}
}
export function writeTabs(accountId: string, tabs: ReaderTab[]) {
  try {sessionStorage.setItem(`weekly-reader-tabs:${accountId}`, JSON.stringify(tabs.map(({issueNumber, series, contentLocale, title}) => ({issueNumber, series, contentLocale, ...(typeof title === 'string' && title.trim() ? {title: title.slice(0, 512)} : {})}))));} catch { /* Storage is optional. */ }
}
export type PaperView = {zoom: number; direction: 'vertical' | 'horizontal'};
export function readPaperView(key: string): PaperView {
  try {
    const value = JSON.parse(sessionStorage.getItem(`weekly-reader-view:${key}`) ?? 'null');
    if (value && Number.isFinite(value.zoom) && value.zoom >= 1 && value.zoom <= 4 && ['vertical', 'horizontal'].includes(value.direction)) return {zoom: value.zoom, direction: value.direction};
  } catch { /* Optional local preferences. */ }
  return {zoom: 1, direction: 'vertical'};
}
export function writePaperView(key: string, view: PaperView) {
  try {sessionStorage.setItem(`weekly-reader-view:${key}`, JSON.stringify(view));} catch { /* Optional local preferences. */ }
}
