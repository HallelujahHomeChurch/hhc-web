export function StatementBody({body, locale}: {body: string; locale: string}) {
  return <div lang={locale} className="whitespace-pre-wrap break-words text-[17px] leading-[1.95] text-ink">{body}</div>;
}
