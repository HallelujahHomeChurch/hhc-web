import type {LocalizedRecord} from '@/i18n/locales';
import type {LocationItem} from './types';

const mapLinks = {
  taipei: 'https://maps.app.goo.gl/fDus6nVswbuhSEAd8',
  zhongli: 'https://maps.app.goo.gl/A1SDTSZC2XLHqkST7'
} as const;

export const locationsByLocale: LocalizedRecord<LocationItem[]> = {
  'zh-Hant': [
    {id: 'taipei', name: '台北哈利路亞家教會', address: '106臺北市大安區民權里仁愛路三段29號B1', mapHref: mapLinks.taipei},
    {id: 'zhongli', name: '中壢哈利路亞家教會', address: '320桃園市中壢區正義里福州路25號2樓', mapHref: mapLinks.zhongli}
  ],
  'zh-Hans': [
    {id: 'taipei', name: '台北哈利路亚家教会', address: '106台北市大安区民权里仁爱路三段29号B1', mapHref: mapLinks.taipei},
    {id: 'zhongli', name: '中坜哈利路亚家教会', address: '320桃园市中坜区正义里福州路25号2楼', mapHref: mapLinks.zhongli}
  ],
  en: [
    {id: 'taipei', name: 'Taipei Hallelujah Home Church', address: 'B1, No. 29, Sec. 3, Renai Rd., Da-an District, Taipei', mapHref: mapLinks.taipei},
    {id: 'zhongli', name: 'Zhongli Hallelujah Home Church', address: '2F, No. 25, Fuzhou Rd., Zhongli District, Taoyuan', mapHref: mapLinks.zhongli}
  ]
};
