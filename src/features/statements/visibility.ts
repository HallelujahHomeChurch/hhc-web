export function taipeiDay(epochMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'}).format(epochMs);
}
export function statementIsActive(statement: {popupStartsAt?: string | null; popupEndsAt?: string | null}, now: number): boolean {
  return Boolean(statement.popupStartsAt && statement.popupEndsAt && Date.parse(statement.popupStartsAt) <= now && now < Date.parse(statement.popupEndsAt));
}
export const hiddenDayKey = (id: string) => `hhc:statement:${id}:hidden-day`;
