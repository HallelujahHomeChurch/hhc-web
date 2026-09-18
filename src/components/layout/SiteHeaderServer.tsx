import {getSiteLayout} from '@/features/site-layout/api';
import type {Locale} from '@/i18n/locales';
import {SiteHeader} from './SiteHeader';

type SiteHeaderServerProps = {
  locale: Locale;
  pathname: string;
};

export async function SiteHeaderServer(props: SiteHeaderServerProps) {
  return <SiteHeader {...props} layout={await getSiteLayout(props.locale)} />;
}
