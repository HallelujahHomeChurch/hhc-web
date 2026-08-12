'use client';

import {BrandLoadingScreen} from '@hallelujahhomechurch/ui';
import {useTranslations} from 'next-intl';

export default function Loading() {
  const t = useTranslations('site');
  return <BrandLoadingScreen label={t('loading')} />;
}
