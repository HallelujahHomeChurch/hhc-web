'use client';

import {
  isLegalSnapshot,
  type LegalSnapshot,
} from '@hallelujahhomechurch/account-client';
import {
  createHhcWebClient,
  HhcWebApiError,
} from '@hallelujahhomechurch/hhc-web-client';
import { flushSync } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  useAccountIdentity,
  useBulletinAuthorization,
} from '@/components/layout/AccountControl';
import { accountSiteUrlForBrowser } from '@/lib/account-origin';
import type { Locale } from '@/i18n/locales';
import { createProtectedFetch } from '@/features/weekly/api';
import { LegalDocument } from './LegalDocument';

const labels = {
  'zh-Hant': {
    review: '查看確認狀態',
    failed: '目前無法載入補充文件。',
    retry: '重試',
  },
  'zh-Hans': {
    review: '查看确认状态',
    failed: '目前无法加载补充文件。',
    retry: '重试',
  },
  en: {
    review: 'View confirmation status',
    failed: 'Additional documents are unavailable.',
    retry: 'Retry',
  },
  ja: {
    review: '確認状況を見る',
    failed: '追加文書を読み込めません。',
    retry: '再試行',
  },
  ko: {
    review: '확인 상태 보기',
    failed: '추가 문서를 불러올 수 없습니다.',
    retry: '다시 시도',
  },
};

export function MemberLegalSupplement({
  locale,
  documentKey,
}: {
  locale: Locale;
  documentKey: 'privacy' | 'terms';
}) {
  const subject = useAccountIdentity();
  const authorization = useBulletinAuthorization();
  const [result, setResult] = useState<{
    key: string;
    snapshot?: LegalSnapshot;
    failed?: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${subject}:${locale}:${attempt}`;
  useEffect(() => {
    if (!subject) return;
    const controller = new AbortController();
    const client = createHhcWebClient({
      baseUrl: '/api',
      getAccessToken: () => null,
      fetcher: createProtectedFetch(
        authorization,
        globalThis.fetch.bind(globalThis),
      ),
    });
    client
      .getMemberLegalSnapshot(locale, controller.signal)
      .then((snapshot) => {
        if (
          !isLegalSnapshot(snapshot) ||
          snapshot.manifest.scope !== 'verified-member' ||
          snapshot.manifest.locale !== locale
        )
          throw new Error('Legal documents unavailable');
        if (!controller.signal.aborted) setResult({ key, snapshot });
      })
      .catch((error) => {
        if (
          !controller.signal.aborted &&
          !(
            error instanceof HhcWebApiError &&
            [401, 403, 404].includes(error.status)
          )
        )
          setResult({ key, failed: true });
      });
    return () => controller.abort();
  }, [subject, locale, authorization, key]);
  useEffect(() => {
    const clear = () => flushSync(() => setResult(null));
    const refresh = () => {
      setResult(null);
      setAttempt((value) => value + 1);
    };
    window.addEventListener('pagehide', clear);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('pagehide', clear);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  if (!subject) return null;
  const current = result?.key === key ? result : null;
  if (current?.failed)
    return (
      <div className="shell" role="alert">
        <p>{labels[locale].failed}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>
          {labels[locale].retry}
        </button>
      </div>
    );
  if (!current?.snapshot) return null;
  const content = current.snapshot.documents[documentKey].data;
  return (
    <>
      <LegalDocument
        content={{ ...content, heroSubtitle: content.heroSubtitle ?? '' }}
      />
      <div className="shell">
        <a href={`${accountSiteUrlForBrowser()}/legal`}>
          {labels[locale].review}
        </a>
      </div>
    </>
  );
}
