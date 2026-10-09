export function statementIsActive(statement: {popupStartsAt?: string | null; popupEndsAt?: string | null}, now: number): boolean {
  return Boolean(statement.popupStartsAt && statement.popupEndsAt && Date.parse(statement.popupStartsAt) <= now && now < Date.parse(statement.popupEndsAt));
}
export const isStatementSuppressedPath = (pathname: string) => /^\/[^/]+\/(?:maintenance|privacy-policy|terms-of-use)\/?$/.test(pathname);
export const isStatementDetailPath = (pathname: string) => /^\/[^/]+\/statements\/[^/]+\/?$/.test(pathname);
