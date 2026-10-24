export function formatVideoViews(value: number, locale: string, exact = false) {
  return new Intl.NumberFormat(locale, exact || value < 10_000 ? {} : {notation: 'compact', maximumFractionDigits: 1}).format(value);
}

export function relativeVideoTime(value: string, locale: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 365 * 86400], ['month', 30 * 86400], ['week', 7 * 86400], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  const [unit, size] = units.find(([, size]) => seconds >= size) ?? units[units.length - 1];
  return new Intl.RelativeTimeFormat(locale, {numeric: 'always'}).format(-Math.floor(seconds / size), unit);
}
