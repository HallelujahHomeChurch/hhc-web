import type {LocalizedRecord} from '@/i18n/locales';
import type {NewsItem} from './types';

export const newsByLocale: LocalizedRecord<NewsItem[]> = {
  'zh-Hant': [
    {
      id: 'formation-sharing',
      title: '十年養成計畫｜滿心怡姊妹分享會',
      summary: '邀請你一起回顧信仰旅程，見證神的恩典與帶領。',
      date: '2025 / 05 / 10',
      imageAlt: '十年養成計畫',
      href: '#'
    },
    {
      id: 'rainbow-testimony',
      title: '苦難鑄進彩虹之約｜姊妹見證分享',
      summary: '在困境中經歷神的信實，讓生命綻放彩虹的約定。',
      date: '2025 / 05 / 03',
      imageAlt: '姊妹見證分享',
      href: '#'
    },
    {
      id: 'family-seminar',
      title: '神國寶貝養成記｜親子系列講座',
      summary: '陪伴孩子在愛與真理中長大，是父母最美的使命。',
      date: '2025 / 04 / 26',
      imageAlt: '親子講座',
      href: '#'
    }
  ],
  'zh-Hans': [
    {
      id: 'formation-sharing',
      title: '十年养成计划｜满心怡姊妹分享会',
      summary: '邀请你一起回顾信仰旅程，见证神的恩典与带领。',
      date: '2025 / 05 / 10',
      imageAlt: '十年养成计划',
      href: '#'
    },
    {
      id: 'rainbow-testimony',
      title: '苦难铸进彩虹之约｜姊妹见证分享',
      summary: '在困境中经历神的信实，让生命绽放彩虹的约定。',
      date: '2025 / 05 / 03',
      imageAlt: '姊妹见证分享',
      href: '#'
    },
    {
      id: 'family-seminar',
      title: '神国宝贝养成记｜亲子系列讲座',
      summary: '陪伴孩子在爱与真理中长大，是父母最美的使命。',
      date: '2025 / 04 / 26',
      imageAlt: '亲子讲座',
      href: '#'
    }
  ],
  en: [
    {
      id: 'formation-sharing',
      title: 'Ten-Year Formation Plan | Sharing Gathering',
      summary: "Look back on a journey of faith and witness God's grace.",
      date: '2025 / 05 / 10',
      imageAlt: 'Ten-year formation plan',
      href: '#'
    },
    {
      id: 'rainbow-testimony',
      title: 'A Rainbow Covenant Through Suffering | Testimony',
      summary: "Experience God's faithfulness in difficulty and see life renewed.",
      date: '2025 / 05 / 03',
      imageAlt: 'Testimony sharing',
      href: '#'
    },
    {
      id: 'family-seminar',
      title: 'Raising Kingdom Children | Family Seminar',
      summary: 'Walking with children in love and truth is a beautiful calling.',
      date: '2025 / 04 / 26',
      imageAlt: 'Family seminar',
      href: '#'
    }
  ]
};
