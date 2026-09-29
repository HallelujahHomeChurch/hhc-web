export function taipeiDay(epochMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit'}).format(epochMs);
}
export function statementIsActive(statement: {popupStartsAt?: string | null; popupEndsAt?: string | null}, now: number): boolean {
  return Boolean(statement.popupStartsAt && statement.popupEndsAt && Date.parse(statement.popupStartsAt) <= now && now < Date.parse(statement.popupEndsAt));
}
export const hiddenDayKey = (id: string) => `hhc:statement:${id}:hidden-day`;
const sharedCookie = 'hhc_statement_hidden_day';
export function sharedHiddenDay(id: string, day: string): boolean {
  return document.cookie.split('; ').includes(`${sharedCookie}=${encodeURIComponent(id)}.${day}`);
}
export function setSharedHiddenDay(id: string, day: string): void {
  const domain = location.hostname === 'alive.org.tw' || location.hostname.endsWith('.alive.org.tw') ? '; Domain=alive.org.tw' : '';
  document.cookie = `${sharedCookie}=${encodeURIComponent(id)}.${day}; Path=/; Max-Age=86400; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${domain}`;
}

export const isStatementSuppressedPath = (pathname: string) => /^\/[^/]+\/(?:maintenance|privacy-policy|terms-of-use)\/?$/.test(pathname);
export const isStatementDetailPath = (pathname: string) => /^\/[^/]+\/statements\/[^/]+\/?$/.test(pathname);
