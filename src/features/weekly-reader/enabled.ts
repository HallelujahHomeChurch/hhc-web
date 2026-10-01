// Build-time rollout gate; enable only after reader/private-data and visual acceptance.
export function isWeeklyReaderEnabled() {
  return process.env.NEXT_PUBLIC_WEEKLY_READER_ENABLED === 'true';
}
