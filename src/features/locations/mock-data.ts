import type {LocalizedRecord} from '@/i18n/locales';
import type {LocationItem} from './types';

const mapLinks = {
  taipei: 'https://maps.app.goo.gl/fDus6nVswbuhSEAd8',
  zhongli: 'https://maps.app.goo.gl/A1SDTSZC2XLHqkST7'
} as const;

const englishAddresses = {
  taipei: "B1, No. 29, Sec. 3, Ren'ai Rd., Da'an Dist., Taipei City 106675, Taiwan (R.O.C.).",
  zhongli: '2 F., No. 25, Fuzhou Rd., Zhongli Dist., Taoyuan City 320048, Taiwan (R.O.C.).'
} as const;

export const locationsByLocale: LocalizedRecord<LocationItem[]> = {
  'zh-Hant': [
    {id: 'taipei', name: '台北哈利路亞家教會', address: '106臺北市大安區民輝里仁愛路三段29號B1', mapHref: mapLinks.taipei},
    {id: 'zhongli', name: '中壢哈利路亞家教會', address: '320桃園市中壢區正義里福州路25號2樓', mapHref: mapLinks.zhongli}
  ],
  'zh-Hans': [
    {id: 'taipei', name: '台北哈利路亚家教会', address: '106台北市大安区民辉里仁爱路三段29号B1', mapHref: mapLinks.taipei},
    {id: 'zhongli', name: '中坜哈利路亚家教会', address: '320桃园市中坜区正义里福州路25号2楼', mapHref: mapLinks.zhongli}
  ],
  en: [
    {id: 'taipei', name: 'Taipei Hallelujah Home Church', address: englishAddresses.taipei, mapHref: mapLinks.taipei},
    {id: 'zhongli', name: 'Zhongli Hallelujah Home Church', address: englishAddresses.zhongli, mapHref: mapLinks.zhongli}
  ],
  ja: [
    {id: 'taipei', name: '台北ハレルヤ・ホームチャーチ', address: englishAddresses.taipei, mapHref: mapLinks.taipei},
    {id: 'zhongli', name: '中壢ハレルヤ・ホームチャーチ', address: englishAddresses.zhongli, mapHref: mapLinks.zhongli}
  ],
  ko: [
    {id: 'taipei', name: '타이베이 할렐루야 가정교회', address: englishAddresses.taipei, mapHref: mapLinks.taipei},
    {id: 'zhongli', name: '중리 할렐루야 가정교회', address: englishAddresses.zhongli, mapHref: mapLinks.zhongli}
  ]
};
