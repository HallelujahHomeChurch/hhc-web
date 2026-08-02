export type HistoryEvent = {
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
