import {getSiteLayout} from '@/features/site-layout/api';
import {SiteHeader, type SiteHeaderProps} from './SiteHeader';

export async function SiteHeaderServer(props: Omit<SiteHeaderProps, 'layout'>) {
  const layout = await getSiteLayout(props.locale);
  return <SiteHeader {...props} layout={layout} />;
}
