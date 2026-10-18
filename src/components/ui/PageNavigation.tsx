import Link from 'next/link';
import {NavigationPendingIndicator} from './NavigationPendingIndicator';

type PageNavigationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  labels: {navigation: string; previous: string; next: string};
};

export function PageNavigation({basePath, page, totalPages, labels}: PageNavigationProps) {
  if (totalPages <= 1) return null;
  const href = (value: number) => value === 1 ? basePath : `${basePath}?page=${value}`;

  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label={labels.navigation}>
      {page > 1 ? <Link className="relative grid size-11 place-items-center rounded-full border border-line bg-paper text-xl hover:border-primary hover:text-primary" href={href(page - 1)} aria-label={labels.previous}>‹<NavigationPendingIndicator/></Link> : <span className="relative grid size-11 place-items-center text-xl text-muted/40" aria-hidden="true">‹</span>}
      <span className="min-w-16 text-center font-semibold text-muted">{page} / {totalPages}</span>
      {page < totalPages ? <Link className="relative grid size-11 place-items-center rounded-full border border-line bg-paper text-xl hover:border-primary hover:text-primary" href={href(page + 1)} aria-label={labels.next}>›<NavigationPendingIndicator/></Link> : <span className="relative grid size-11 place-items-center text-xl text-muted/40" aria-hidden="true">›</span>}
    </nav>
  );
}
