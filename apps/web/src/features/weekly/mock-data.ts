import type {LocalizedRecord} from '@/i18n/locales';
import type {WeeklyBulletin, WeeklyIssue} from './types';

export const weeklyIssues: WeeklyIssue[] = [
  {
    id: '2025-05-11',
    date: '2025.05.11',
    versions: [
      {
        locale: 'zh-Hant',
        date: '2025.05.11',
        title: '愛在家中成長',
        subtitle: '在愛中建造家庭，在真理中成長',
        href: '/assets/weekly/2025-05-11-zh-Hant.pdf'
      },
      {
        locale: 'zh-Hans',
        date: '2025.05.11',
        title: '爱在家中成长',
        subtitle: '在爱中建造家庭，在真理中成长',
        href: '/assets/weekly/2025-05-11-zh-Hans.pdf'
      },
      {
        locale: 'en',
        date: '2025.05.11',
        title: 'Love grows at home',
        subtitle: 'Building families in love and growing in truth',
        href: '/assets/weekly/2025-05-11-en.pdf'
      }
    ]
  },
  {
    id: '2025-05-04',
    date: '2025.05.04',
    versions: [
      {
        locale: 'zh-Hant',
        date: '2025.05.04',
        title: '同行與更新',
        subtitle: '在關係中彼此扶持，一同走進更新',
        href: '/assets/weekly/2025-05-04-zh-Hant.pdf'
      },
      {
        locale: 'zh-Hans',
        date: '2025.05.04',
        title: '同行与更新',
        subtitle: '在关系中彼此扶持，一同走进更新',
        href: '/assets/weekly/2025-05-04-zh-Hans.pdf'
      },
      {
        locale: 'en',
        date: '2025.05.04',
        title: 'Walking together and renewed',
        subtitle: 'Supporting one another in relationship and renewal',
        href: '/assets/weekly/2025-05-04-en.pdf'
      }
    ]
  }
];

export const weeklyByLocale: LocalizedRecord<WeeklyBulletin> = {
  'zh-Hant': weeklyIssues[0].versions[0],
  'zh-Hans': weeklyIssues[0].versions[1],
  en: weeklyIssues[0].versions[2]
};
