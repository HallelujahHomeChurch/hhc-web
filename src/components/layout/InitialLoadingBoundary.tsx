'use client';

import {BrandLoadingScreen} from '@hallelujahhomechurch/ui';
import {useSyncExternalStore, type ReactNode} from 'react';

const subscribe = () => () => undefined;

export function InitialLoadingBoundary({children, label}: {children: ReactNode; label: string}) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <>
      {children}
      {hydrated ? null : <BrandLoadingScreen className="hhc-initial-loading-screen" label={label} />}
      <noscript><style>{'.hhc-initial-loading-screen{display:none!important}'}</style></noscript>
    </>
  );
}
