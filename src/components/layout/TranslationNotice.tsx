'use client';

import {useEffect} from 'react';
import {ToastProvider, useToast} from '@hallelujahhomechurch/ui';
import type {Locale} from '@/i18n/locales';

type TranslationNoticeProps = {
  locale: Locale;
  message: string;
  dismissLabel: string;
  regionLabel: string;
};

export function TranslationNotice({dismissLabel, regionLabel, ...notice}: TranslationNoticeProps) {
  return <ToastProvider dismissLabel={dismissLabel} regionLabel={regionLabel}><TranslationNoticeEffect {...notice} /></ToastProvider>;
}

function TranslationNoticeEffect({locale, message}: Pick<TranslationNoticeProps, 'locale' | 'message'>) {
  const toast = useToast();

  useEffect(() => {
    if (locale === 'zh-Hant' || locale === 'zh-Hans') return;
    const key = `hhc_translation_notice:${locale}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    toast.add({message, tone: 'warning', durationMs: 8000});
  }, [locale, message, toast]);

  return null;
}
