import {bulletinEditions} from '@hallelujahhomechurch/preferences';
import {validIssueNumber, weeklyEntryTarget} from '@/features/weekly/entry-target';

/** Selectors identify content only; no identity, tokens or arbitrary redirects survive. */
export function legalReturnURL(value: string): string | undefined {
  if (value.length > 2048 || /[\\\r\n]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    if (url.origin !== 'https://www.alive.org.tw' || url.username || url.password || url.hash) return undefined;
    const route = url.pathname.match(/^\/(zh-Hant|zh-Hans|en|ja|ko)\/(literature-ministry|member-videos|privacy-policy|terms-of-use)(.*)$/);
    if (!route) return undefined;
    if (route[2] !== 'literature-ministry') return !route[3] && !url.search ? url.href : undefined;
    if (route[3]) {
      const reader = route[3].match(/^\/([1-9]\d{0,9})\/read\/(general|children)\/(zh-Hant|zh-Hans|en)$/);
      return !url.search && reader && validIssueNumber(reader[1]) && bulletinEditions.some(edition => edition.series === reader[2] && edition.locale === reader[3]) ? url.href : undefined;
    }
    const allowed: Record<string, (value: string) => boolean> = {
      series: value => value === 'general' || value === 'children',
      contentLocale: value => ['zh-Hant', 'zh-Hans', 'en'].includes(value),
      issueNumber: validIssueNumber,
      page: value => /^[1-9]\d{0,5}$/.test(value),
      mode: value => value === 'online' || value === 'pdf'
    };
    for (const [key, entry] of url.searchParams) {
      if (!Object.hasOwn(allowed, key) || url.searchParams.getAll(key).length !== 1 || !allowed[key](entry)) return undefined;
    }
    return weeklyEntryTarget(url.searchParams) === null ? undefined : url.href;
  } catch { return undefined; }
}
