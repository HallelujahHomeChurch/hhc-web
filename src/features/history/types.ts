export type HistoryEvent = {
  date: string;
  body: string;
  continued?: boolean;
};

export type HistoryTimelinePayload = {
  events: HistoryEvent[];
};
