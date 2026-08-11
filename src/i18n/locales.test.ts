import {describe, expect, it} from 'vitest';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import {defaultLocale, detectLocale, getLocaleCookie, getStoredLocale, localeLabels, locales} from './locales';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

function messageShape(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => messageShape(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => messageShape(item, path ? `${path}.${key}` : key));
  }
  return [`${path}:${typeof value}`];
}

describe('locales', () => {
  it('defines the supported locales and default locale', () => {
    expect(locales).toEqual(['zh-Hant', 'zh-Hans', 'en', 'ja', 'ko']);
    expect(defaultLocale).toBe('zh-Hant');
    expect(localeLabels).toEqual({
      'zh-Hant': '繁中',
      'zh-Hans': '简中',
      en: 'EN',
      ja: '日本語',
      ko: '한국어'
    });
  });

  it('keeps all HHC frontend packages on the same released version', () => {
    expect(Object.fromEntries(Object.entries(packageJson.dependencies).filter(([name]) => name.startsWith('@hallelujahhomechurch/')))).toEqual({
      '@hallelujahhomechurch/account-client': '0.6.6',
      '@hallelujahhomechurch/hhc-web-client': '0.6.6',
      '@hallelujahhomechurch/preferences': '0.6.6',
      '@hallelujahhomechurch/ui': '0.6.6'
    });
  });

  it('keeps Japanese and Korean message schemas complete', () => {
    const expectedShape = messageShape(zhHant);
    for (const locale of ['ja', 'ko']) {
      const path = join(process.cwd(), `src/i18n/locales/${locale}.json`);
      expect(existsSync(path), `${locale}.json must exist`).toBe(true);
      if (!existsSync(path)) continue;
      expect(messageShape(JSON.parse(readFileSync(path, 'utf8')))).toEqual(expectedShape);
    }
  });

  it('detects the locale from browser languages and falls back to English', () => {
    expect(detectLocale(['zh-TW', 'en-US'])).toBe('zh-Hant');
    expect(detectLocale(['zh-CN', 'en-US'])).toBe('zh-Hans');
    expect(detectLocale(['ja-JP', 'en-US'])).toBe('ja');
    expect(detectLocale(['ko-KR', 'en-US'])).toBe('ko');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('en');
  });

  it('prefers a valid stored locale before browser language detection', () => {
    expect(getStoredLocale('theme=dark; hhc_locale=zh-Hans')).toBe('zh-Hans');
    expect(getStoredLocale('hhc_locale=ja')).toBe('ja');
    expect(getStoredLocale('hhc_locale=ko')).toBe('ko');
    expect(getStoredLocale('hhc_locale=fr')).toBeUndefined();
  });

  it('builds a shareable locale cookie', () => {
    expect(getLocaleCookie('en', '.alive.org.tw')).toContain('hhc_locale=en; Max-Age=31536000; Path=/; SameSite=Lax; Domain=.alive.org.tw');
    expect(getLocaleCookie('ja', '.alive.org.tw')).toContain('hhc_locale=ja;');
  });

  it('keeps weekly file-language labels out of translated messages', () => {
    expect(zhHant.literatureMinistry).not.toHaveProperty('versionLabels');
    expect(zhHans.literatureMinistry).not.toHaveProperty('versionLabels');
    expect(en.literatureMinistry).not.toHaveProperty('versionLabels');
  });

  it('keeps latest-news banner subtitles free of redundant punctuation', () => {
    expect(zhHant.news.heroSubtitle).toBe('教會近況、活動資訊與重要公告');
    expect(zhHans.news.heroSubtitle).toBe('教会近况、活动资讯与重要公告');
    expect(en.news.heroSubtitle).toBe('Church updates, event information, and important announcements');
  });

  it('describes the three independent weekly-paper editions in Japanese and Korean', () => {
    expect(ja.literatureMinistry.archiveIntro).toBe('週報は繁体字中国語、簡体字中国語、英語の3言語版をご用意しています。ご家族での閲覧や分かち合いにご利用ください。');
    expect(ko.literatureMinistry.archiveIntro).toBe('주보는 번체 중국어, 간체 중국어, 영어의 세 가지 언어판으로 제공됩니다. 가족과 함께 읽고 나누는 데 활용해 주세요.');
  });

  it('uses natural Japanese copy for the About call to action', () => {
    expect(ja.home.aboutCta).toBe('教会について知る');
  });
});
