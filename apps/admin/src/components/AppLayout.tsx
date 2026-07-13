import { AccountMenu, Button, Drawer } from '@hhc/ui'
import { BookOpen, History, KeyRound, LayoutDashboard, Menu, Newspaper, ShieldCheck, Users, Video } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { readRuntimeConfig } from '../auth/runtime-config'
import { displayAccountName } from '../lib/account-display'
import { useLocale } from '../preferences/locale-context'

const navGroups = [
  { label: 'Overview', items: [{ to: '/', label: 'Overview', icon: LayoutDashboard }] },
  { label: 'Website content', items: [
    { to: '/content/news', label: 'Latest news', icon: Newspaper },
    { to: '/content/bulletins', label: 'Weekly bulletins', icon: BookOpen },
    { to: '/content/history', label: 'History', icon: History },
    { to: '/content/videos', label: 'Kingdom Joy', icon: Video },
  ] },
  { label: 'Account & access', items: [
    { to: '/users', label: 'Users', icon: Users },
    { to: '/access', label: 'Roles & permissions', icon: ShieldCheck },
    { to: '/oauth-clients', label: 'OAuth clients', icon: KeyRound },
  ] },
]

export function AppLayout() {
  const { profile, logout } = useAuth()
  const { locale, messages } = useLocale()
  const displayName = displayAccountName(profile, 'Admin')
  const runtimeConfig = readRuntimeConfig()
  const publicSiteUrl = runtimeConfig.publicSiteUrl

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img src="/assets/brand/logo.png" alt="" />
          <strong>{messages.brand}</strong>
        </a>

        <Navigation />
        <div className="sidebar-legal-links">
          <a href={`${publicSiteUrl}/${locale}/privacy-policy`} rel="noopener noreferrer" target="_blank">
            {messages.privacy}
          </a>
          <span aria-hidden="true">/</span>
          <a href={`${publicSiteUrl}/${locale}/terms-of-use`} rel="noopener noreferrer" target="_blank">
            {messages.terms}
          </a>
        </div>
      </aside>

      <div className="admin-content">
        <header className="account-header">
          <Drawer
            closeLabel={messages.closeNavigation}
            placement="left"
            title={messages.adminNavigation}
            trigger={
              <Button aria-label={messages.openNavigation} className="mobile-navigation-trigger" variant="ghost">
                <Menu size={21} aria-hidden="true" />
              </Button>
            }
          >
            {(close) => (
              <div className="mobile-navigation-body">
                <a className="brand mobile-navigation-brand" href="/" onClick={close}>
                  <img src="/assets/brand/logo.png" alt="" />
                  <strong>{messages.brand}</strong>
                </a>
                <Navigation className="mobile-navigation-links" label={messages.adminNavigation} onNavigate={close} />
                <div className="sidebar-legal-links mobile-navigation-legal">
                  <a href={`${publicSiteUrl}/${locale}/privacy-policy`} rel="noopener noreferrer" target="_blank">
                    {messages.privacy}
                  </a>
                  <span aria-hidden="true">/</span>
                  <a href={`${publicSiteUrl}/${locale}/terms-of-use`} rel="noopener noreferrer" target="_blank">
                    {messages.terms}
                  </a>
                </div>
              </div>
            )}
          </Drawer>
          <a className="mobile-shell-brand" href="/">
            <img src="/assets/brand/logo.png" alt="" />
            <strong>{messages.brand}</strong>
          </a>
          <AccountMenu
            labels={{
              menu: messages.accountMenu,
              greeting: `Hi ${displayName}`,
              manageAccount: messages.manageAccount,
              signOut: messages.signOut,
            }}
            manageAccountHref={`${runtimeConfig.accountSiteUrl}/profile`}
            onSignOut={() => void logout()}
            user={{
              name: displayName,
              email: profile?.email ?? '',
              avatarUrl: profile?.avatar_url,
            }}
          />
        </header>
        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Navigation({ className = '', label = 'Admin', onNavigate }: { className?: string; label?: string; onNavigate?: () => void }) {
  return (
    <nav className={`sidebar-nav ${className}`.trim()} aria-label={label}>
      {navGroups.map((group) => (
        <section className="sidebar-nav-group" key={group.label}>
          <span className="sidebar-nav-group-label">{group.label}</span>
          <div>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onNavigate}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )
}
