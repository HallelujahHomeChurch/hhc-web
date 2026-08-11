import type {ContentLocaleMetadata} from '@/features/content/locale';

export type HistoryEvent = ContentLocaleMetadata & {
  date: string;
  body: string;
  continued?: boolean;
};

export type HistoryTimelinePayload = {
  events: HistoryEvent[];
};

export type HistoryTimelinePage = HistoryTimelinePayload & {
  meta: {page: number; pageSize: number; total: number};
};
