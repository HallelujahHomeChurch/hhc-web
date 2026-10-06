import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {resolveEdition} from './resolve-edition';
import type {WeeklyBulletin} from './types';
beforeEach(() => vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED', 'true'));
afterEach(() => vi.unstubAllEnvs());

const version = (locale: WeeklyBulletin['locale'], extra: Partial<WeeklyBulletin> = {}): WeeklyBulletin => ({issueId:'issue-1',series:'general',locale,issueNumber:1740,date:'2026-10-04',title:locale,downloadName:'weekly.pdf',pdfPublished:true,onlineRevision:2,...extra});
const authorizedEditions = ['zh-Hant','zh-Hans','en'].map(locale=>({series:'general' as const,locale:locale as WeeklyBulletin['locale']}));

describe('whole edition resolution',()=>{
  it('keeps PDF download available with the Online launch gate disabled',()=>{
    vi.stubEnv('NEXT_PUBLIC_WEEKLY_READER_ENABLED',undefined);
    const result=resolveEdition({uiLocale:'en',series:'general',authorizedEditions,publishedEditions:[version('en')]});
    expect(result?.canDownload).toBe(true);
    expect(result?.readUrl).toBeUndefined();
  });
  it.each([['zh-Hant','zh-Hant'],['zh-Hans','zh-Hans'],['en','en'],['ja','zh-Hant'],['ko','zh-Hant']] as const)('resolves %s to %s', (uiLocale, contentLocale)=>{
    const result=resolveEdition({uiLocale,series:'general',authorizedEditions,publishedEditions:authorizedEditions.map(e=>version(e.locale))});
    expect(result?.contentLocale).toBe(contentLocale);
    expect(result?.readUrl).toBe(`/${uiLocale}/literature-ministry/1740/read/general/${contentLocale}`);
  });
  it.each(['zh-Hans','en'] as const)('falls back to authorized Traditional Chinese when %s is absent',uiLocale=>{
    expect(resolveEdition({uiLocale,series:'general',authorizedEditions,publishedEditions:[version('zh-Hant')]})).toMatchObject({contentLocale:'zh-Hant'});
  });
  it('falls back each format independently without borrowing another series',()=>{
    const result=resolveEdition({uiLocale:'en',series:'general',authorizedEditions,publishedEditions:[version('en',{onlineRevision:undefined}),version('zh-Hant'),version('en',{series:'children'})]});
    expect(result).toMatchObject({contentLocale:'en',canDownload:true});
    expect(result?.readUrl).toBe('/en/literature-ministry/1740/read/general/zh-Hant');
    expect(result?.downloadVersion?.locale).toBe('en');
  });
  it('keeps Hans online-only while downloading the available Hant PDF',()=>{
    const result=resolveEdition({uiLocale:'zh-Hans',series:'general',authorizedEditions,publishedEditions:[version('zh-Hans',{pdfPublished:false}),version('zh-Hant')]});
    expect(result?.readUrl).toBe('/zh-Hans/literature-ministry/1740/read/general/zh-Hans');
    expect(result?.downloadVersion?.locale).toBe('zh-Hant');
  });
  it('keeps Online-only and suppresses Download',()=>{
    expect(resolveEdition({uiLocale:'en',series:'general',authorizedEditions,publishedEditions:[version('en',{pdfPublished:false})]})).toMatchObject({canDownload:false,readUrl:'/en/literature-ministry/1740/read/general/en'});
  });
  it.each(['zh-Hant', 'ja', 'ko'] as const)('uses authorized Hans when %s has no authorized matching version', uiLocale=>{
    const result=resolveEdition({uiLocale,series:'general',authorizedEditions:[{series:'general',locale:'zh-Hans'},{series:'children',locale:'zh-Hant'}],publishedEditions:[version('zh-Hant'),version('en'),version('zh-Hans'),version('zh-Hant',{series:'children'})]});
    expect(result?.contentLocale).toBe('zh-Hans');
    expect(result?.downloadVersion?.locale).toBe('zh-Hans');
    expect(result?.readUrl).toBe(`/${uiLocale}/literature-ministry/1740/read/general/zh-Hans`);
  });
  it('falls back to another authorized language when Traditional Chinese is unavailable',()=>{
    expect(resolveEdition({uiLocale:'ja',series:'general',authorizedEditions,publishedEditions:[version('en')]})).toMatchObject({contentLocale:'en'});
  });
  it('does not substitute unentitled, unpublished or other-series versions',()=>{
    expect(resolveEdition({uiLocale:'en',series:'general',authorizedEditions:[{series:'general',locale:'en'}],publishedEditions:[version('zh-Hant')]})).toBeNull();
    expect(resolveEdition({uiLocale:'zh-Hant',series:'general',authorizedEditions:[{series:'children',locale:'zh-Hant'}],publishedEditions:[version('zh-Hant')]})).toBeNull();
    expect(resolveEdition({uiLocale:'zh-Hant',series:'general',authorizedEditions,publishedEditions:[version('zh-Hans',{pdfPublished:false,onlineRevision:undefined})]})).toBeNull();
  });
});
