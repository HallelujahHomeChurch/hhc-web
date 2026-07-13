'use client';

import {useEffect, useMemo, useState} from 'react';
import {UserRound} from 'lucide-react';
import {
  createAccountSessionClient,
  type AccountSession,
  type AccountSessionClient
} from '@hhc/account-client';
import {AccountMenu} from '@hhc/ui';

interface AccountControlLabels {
  menu: string;
  manageAccount: string;
  signIn: string;
  signOut: string;
}

interface AccountControlProps {
  accountSiteUrl?: string;
  client?: AccountSessionClient;
  labels: AccountControlLabels;
}

export function AccountControl({
  accountSiteUrl = accountSiteUrlForBrowser(),
  client,
  labels
}: AccountControlProps) {
  const sessionClient = useMemo(() => client ?? createAccountSessionClient(), [client]);
  const [session, setSession] = useState<AccountSession | null>(null);

  useEffect(() => {
    let active = true;
    sessionClient.getSession()
      .then((nextSession) => { if (active) setSession(nextSession); })
      .catch(() => { if (active) setSession({authenticated: false}); });
    return () => { active = false; };
  }, [sessionClient]);

  if (session === null) {
    return <span className="inline-block size-10 shrink-0" aria-hidden="true" />;
  }

  if (!session.authenticated) {
    return (
      <a
        className="grid size-10 shrink-0 place-items-center rounded-full text-ink hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href={`${accountSiteUrl}/login`}
        aria-label={labels.signIn}
      >
        <UserRound size={21} aria-hidden="true" />
      </a>
    );
  }

  const user = session.user;
  const displayName = user.display_name || user.email.split('@')[0] || user.email;

  return (
    <AccountMenu
      labels={{
        menu: labels.menu,
        greeting: `Hi ${displayName}`,
        manageAccount: labels.manageAccount,
        signOut: labels.signOut
      }}
      manageAccountHref={`${accountSiteUrl}/profile`}
      onSignOut={() => {
        void sessionClient.logout()
          .then(() => setSession({authenticated: false}))
          .catch(() => undefined);
      }}
      user={{
        name: displayName,
        email: user.email,
        avatarUrl: user.avatar_url
      }}
    />
  );
}

function accountSiteUrlForBrowser() {
  const configured = process.env.NEXT_PUBLIC_ACCOUNT_SITE_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window === 'undefined') return 'https://account.alive.org.tw';
  if (window.location.hostname === 'www-test.alive.org.tw') return 'https://account-test.alive.org.tw';
  if (window.location.hostname === 'www.alive.org.tw') return 'https://account.alive.org.tw';
  return 'http://localhost:5173';
}
