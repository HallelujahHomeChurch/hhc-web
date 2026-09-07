'use client';
import Link from 'next/link';
import {useStatement} from './StatementProvider';
export function StatementStrip() {
  const notice = useStatement();
  if (!notice?.statement) return null;
  return <aside className="border-b border-primary/20 bg-primary/10 text-ink" aria-label={notice.labels.notice}>
    <Link href={notice.statement.href ?? '#'} className="shell flex min-h-12 items-center justify-between gap-4 py-2 text-sm">
      <span className="min-w-0 break-words font-semibold" lang={notice.statement.resolvedLocale}>{notice.statement.title}</span><span className="shrink-0 font-semibold text-primary">{notice.labels.readFull} →</span>
    </Link>
  </aside>;
}
