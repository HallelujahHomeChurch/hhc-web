'use client';

import Link from 'next/link';
import {useState} from 'react';

type Labels = {
  title: string;
  description: string;
  confirm: string;
  pending: string;
  successTitle: string;
  successBody: string;
  invalid: string;
  error: string;
  home: string;
};

type UnsubscribePanelProps = {
  homeHref: string;
  labels: Labels;
  token: string;
};

export function UnsubscribePanel({homeHref, labels, token}: UnsubscribePanelProps) {
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>(token ? 'idle' : 'error');
  const [message, setMessage] = useState(token ? '' : labels.invalid);

  async function unsubscribe() {
    setState('pending');
    const response = await fetch('/api/engagement/v1/newsletter/unsubscribe', {
      body: JSON.stringify({token}),
      headers: {'Content-Type': 'application/json'},
      method: 'POST'
    }).catch(() => null);

    if (!response?.ok) {
      setMessage(response?.status === 400 ? labels.invalid : labels.error);
      setState('error');
      return;
    }

    setState('success');
  }

  if (state === 'success') {
    return (
      <section className="newsletter-unsubscribe" aria-labelledby="unsubscribe-success-title">
        <span className="newsletter-unsubscribe__mark" aria-hidden="true">✓</span>
        <h1 id="unsubscribe-success-title">{labels.successTitle}</h1>
        <p>{labels.successBody}</p>
        <Link className="newsletter-unsubscribe__secondary" href={homeHref}>{labels.home}</Link>
      </section>
    );
  }

  return (
    <section className="newsletter-unsubscribe" aria-labelledby="unsubscribe-title">
      <h1 id="unsubscribe-title">{labels.title}</h1>
      <p>{labels.description}</p>
      {message && <p className="newsletter-unsubscribe__error" role="alert">{message}</p>}
      {token && (
        <button
          className="newsletter-unsubscribe__primary"
          disabled={state === 'pending'}
          onClick={unsubscribe}
          type="button"
        >
          {state === 'pending' ? labels.pending : labels.confirm}
        </button>
      )}
      {!token && <Link className="newsletter-unsubscribe__secondary" href={homeHref}>{labels.home}</Link>}
    </section>
  );
}
