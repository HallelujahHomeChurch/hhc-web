import {describe, expect, it} from 'vitest';
import zhHans from './locales/zh-Hans.json';
import zhHant from './locales/zh-Hant.json';
import en from './locales/en.json';
import {defaultLocale, detectLocale, getLocaleCookie, getStoredLocale, localeLabels, locales} from './locales';

describe('locales', () => {
  it('defines the supported locales and default locale', () => {
    expect(locales).toEqual(['zh-Hant', 'zh-Hans', 'en']);
    expect(defaultLocale).toBe('zh-Hant');
    expect(localeLabels).toEqual({
      'zh-Hant': '繁中',
      'zh-Hans': '简中',
      en: 'EN'
    });
  });

  it('detects the locale from browser languages and falls back to English', () => {
    expect(detectLocale(['zh-TW', 'en-US'])).toBe('zh-Hant');
    expect(detectLocale(['zh-CN', 'en-US'])).toBe('zh-Hans');
    expect(detectLocale(['en-US'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('en');
  });

  it('prefers a valid stored locale before browser language detection', () => {
    expect(getStoredLocale('theme=dark; hhc_locale=zh-Hans')).toBe('zh-Hans');
    expect(getStoredLocale('hhc_locale=fr')).toBeUndefined();
  });

  it('builds a shareable locale cookie', () => {
    expect(getLocaleCookie('en', '.alive.org.tw')).toContain('hhc_locale=en; Max-Age=31536000; Path=/; SameSite=Lax; Domain=.alive.org.tw');
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
});
