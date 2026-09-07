'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useStatement} from './StatementProvider';
export function StatementStrip() {
  const notice = useStatement();
  const pathname = usePathname();
  if (!notice?.statement || /^\/[^/]+\/statements\/[^/]+\/?$/.test(pathname ?? '')) return null;
  return <aside className="border-b border-primary/20 bg-primary/10 text-ink" aria-label={notice.labels.notice}>
    <Link href={notice.statement.href ?? '#'} className="shell flex min-h-12 items-center justify-center gap-3 py-2 text-center text-sm">
      <span className="min-w-0 break-words font-semibold" lang={notice.statement.resolvedLocale}>{notice.statement.title}</span><span className="shrink-0 font-semibold text-primary">{notice.labels.readFull} →</span>
    </Link>
  </aside>;
}
