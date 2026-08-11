import {describe, expect, it} from 'vitest';
import {getMessages} from '@/i18n/messages';
import {getAlternates, getLocalizedPath} from '@/lib/seo';
import {getHomePageTitle} from '@/lib/home-metadata';

describe('home page metadata', () => {
  it('uses only the site name as the browser title', async () => {
    expect(getHomePageTitle('zh-Hant')).toBe('哈利路亞家教會');
    expect(getHomePageTitle('ja')).toBe('ハレルヤ・ホームチャーチ');
    expect(getHomePageTitle('ko')).toBe('할렐루야 가정교회');
  });

  it('provides localized metadata and static alternates for Japanese and Korean', () => {
    expect(getMessages('ja').home.heroSubtitle).toBe('愛の中で家庭を築き、真理の中で成長する');
    expect(getMessages('ko').home.heroSubtitle).toBe('사랑으로 가정을 세우고 진리 안에서 자라갑니다');
    expect(getLocalizedPath('ja', '/privacy-policy')).toBe('/ja/privacy-policy');
    expect(getAlternates('/terms-of-use')).toMatchObject({
      ja: 'https://www.alive.org.tw/ja/terms-of-use',
      ko: 'https://www.alive.org.tw/ko/terms-of-use'
    });
  });
});
