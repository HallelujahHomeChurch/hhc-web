import {getSiteLayout} from '@/features/site-layout/api';
import {SiteFooter, type SiteFooterProps} from './SiteFooter';

export async function SiteFooterServer(props: Omit<SiteFooterProps, 'layout'>) {
  const layout = await getSiteLayout(props.locale);
  return <SiteFooter {...props} layout={layout} />;
}
