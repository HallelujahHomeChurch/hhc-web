import type {LocalizedRecord} from '@/i18n/locales';
import type {VideoItem} from './types';

const videoLinks = {
  breakthrough: 'https://youtu.be/K3ckFWeSQ-k?si=RRGK8h5JROAFqbCf',
  earthshaking: 'https://youtu.be/g2sP4m4T2Y0?si=ecveDiwuuR8Q6nYD',
  allIsYou: 'https://youtu.be/6nZ8ZwZeM1c?si=LVsr5fg-HWSuK_K3'
} as const;

const videoThumbnails = {
  breakthrough: 'https://img.youtube.com/vi/K3ckFWeSQ-k/maxresdefault.jpg',
  earthshaking: 'https://img.youtube.com/vi/g2sP4m4T2Y0/maxresdefault.jpg',
  allIsYou: 'https://img.youtube.com/vi/6nZ8ZwZeM1c/maxresdefault.jpg'
} as const;

export const videosByLocale: LocalizedRecord<VideoItem[]> = {
  'zh-Hant': [
    {id: 'breakthrough', title: '為祢而闖', imageSrc: videoThumbnails.breakthrough, imageAlt: '為祢而闖', href: videoLinks.breakthrough},
    {id: 'earthshaking', title: '驚天動地', imageSrc: videoThumbnails.earthshaking, imageAlt: '驚天動地', href: videoLinks.earthshaking},
    {id: 'all-is-you', title: '全部攏是祢', imageSrc: videoThumbnails.allIsYou, imageAlt: '全部攏是祢', href: videoLinks.allIsYou}
  ],
  'zh-Hans': [
    {id: 'breakthrough', title: '为祢而闯', imageSrc: videoThumbnails.breakthrough, imageAlt: '为祢而闯', href: videoLinks.breakthrough},
    {id: 'earthshaking', title: '惊天动地', imageSrc: videoThumbnails.earthshaking, imageAlt: '惊天动地', href: videoLinks.earthshaking},
    {id: 'all-is-you', title: '全部拢是祢', imageSrc: videoThumbnails.allIsYou, imageAlt: '全部拢是祢', href: videoLinks.allIsYou}
  ],
  en: [
    {id: 'breakthrough', title: '為祢而闖', imageSrc: videoThumbnails.breakthrough, imageAlt: '為祢而闖', href: videoLinks.breakthrough},
    {id: 'earthshaking', title: '驚天動地', imageSrc: videoThumbnails.earthshaking, imageAlt: '驚天動地', href: videoLinks.earthshaking},
    {id: 'all-is-you', title: '全部攏是祢', imageSrc: videoThumbnails.allIsYou, imageAlt: '全部攏是祢', href: videoLinks.allIsYou}
  ]
};
