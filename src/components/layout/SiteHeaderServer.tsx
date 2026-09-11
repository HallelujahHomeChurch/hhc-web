import {getSiteLayout} from '@/features/site-layout/api';
import {getBulletinAccess} from '@/features/weekly/access';
import type {Locale} from '@/i18n/locales';
import {SiteHeader} from './SiteHeader';

type SiteHeaderServerProps = {
  locale: Locale;
  pathname: string;
};

export async function SiteHeaderServer(props: SiteHeaderServerProps) {
  const [layout, access] = await Promise.all([getSiteLayout(props.locale), getBulletinAccess()]);
  return <SiteHeader {...props} layout={layout} bulletinPublicEnabled={access.enabled} />;
}
