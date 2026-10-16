'use client';
import { useEffect } from 'react';
import { accountSiteUrlForBrowser } from '@/lib/account-origin';
import { legalReturnURL } from '@/lib/legal-return-url';

export function LegalRequiredNavigation() {
  useEffect(() => {
    const required = () => {
      const target = legalReturnURL(window.location.href);
      const query = target ? `?return_to=${encodeURIComponent(target)}` : '';
      window.location.assign(`${accountSiteUrlForBrowser()}/legal${query}`);
    };
    window.addEventListener('hhc:legal-required', required);
    return () => window.removeEventListener('hhc:legal-required', required);
  }, []);
  return null;
}
