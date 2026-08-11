import type {ContentLocaleMetadata} from '@/features/content/locale';

export type VideoItem = ContentLocaleMetadata & {
  id: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  href: string;
};
