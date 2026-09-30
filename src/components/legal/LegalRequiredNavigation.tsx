'use client';
import { useEffect } from 'react';
import { accountSiteUrlForBrowser } from '@/lib/account-origin';

export function LegalRequiredNavigation() {
  useEffect(() => {
    const required = () => {
      const path = window.location.pathname;
      const valid =
        /^\/(zh-Hant|zh-Hans|en|ja|ko)\/(literature-ministry|member-videos|privacy-policy|terms-of-use)$/.test(
          path,
        );
      const query =
        valid && window.location.origin === 'https://www.alive.org.tw'
          ? `?return_to=${encodeURIComponent(window.location.origin + path)}`
          : '';
      window.location.assign(`${accountSiteUrlForBrowser()}/legal${query}`);
    };
    window.addEventListener('hhc:legal-required', required);
    return () => window.removeEventListener('hhc:legal-required', required);
  }, []);
  return null;
}
