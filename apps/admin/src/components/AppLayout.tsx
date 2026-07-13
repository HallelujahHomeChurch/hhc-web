import { Drawer, Dropdown } from '@heroui/react'
import { BookOpen, KeyRound, LayoutDashboard, LogOut, Menu, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { readRuntimeConfig } from '../auth/runtime-config'
import { AccountAvatar } from './AccountAvatar'
import { displayAccountName } from '../lib/account-display'
import { useLocale } from '../preferences/locale-context'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/access', label: 'Access', icon: ShieldCheck },
  { to: '/oauth-clients', label: 'OAuth clients', icon: KeyRound },
  { to: '/cms', label: 'CMS', icon: BookOpen },
]

export function AppLayout() {
  const { profile, logout } = useAuth()
  const { locale, messages } = useLocale()
  const displayName = displayAccountName(profile, 'Admin')
  const publicSiteUrl = readRuntimeConfig().publicSiteUrl
  const [isNavigationOpen, setNavigationOpen] = useState(false)

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img src="/assets/brand/logo.png" alt="" />
          <strong>{messages.brand}</strong>
        </a>

        <nav className="sidebar-nav" aria-label="Admin">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
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
          <Drawer>
            <button
              aria-label={messages.openNavigation}
              className="mobile-navigation-trigger"
              type="button"
              onClick={() => setNavigationOpen(true)}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <Drawer.Backdrop isOpen={isNavigationOpen} onOpenChange={setNavigationOpen}>
              <Drawer.Content placement="left">
                <Drawer.Dialog className="mobile-navigation-drawer">
                  <Drawer.CloseTrigger aria-label={messages.closeNavigation} />
                  <Drawer.Header className="mobile-navigation-heading">
                    <Drawer.Heading>{messages.adminNavigation}</Drawer.Heading>
                  </Drawer.Header>
                  <Drawer.Body className="mobile-navigation-body">
                    <a className="brand mobile-navigation-brand" href="/" onClick={() => setNavigationOpen(false)}>
                      <img src="/assets/brand/logo.png" alt="" />
                      <strong>{messages.brand}</strong>
                    </a>
                    <nav className="sidebar-nav mobile-navigation-links" aria-label={messages.adminNavigation}>
                      {navItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            onClick={() => setNavigationOpen(false)}
                          >
                            <Icon size={18} aria-hidden="true" />
                            <span>{item.label}</span>
                          </NavLink>
                        )
                      })}
                    </nav>
                    <div className="sidebar-legal-links mobile-navigation-legal">
                      <a href={`${publicSiteUrl}/${locale}/privacy-policy`} rel="noopener noreferrer" target="_blank">
                        {messages.privacy}
                      </a>
                      <span aria-hidden="true">/</span>
                      <a href={`${publicSiteUrl}/${locale}/terms-of-use`} rel="noopener noreferrer" target="_blank">
                        {messages.terms}
                      </a>
                    </div>
                  </Drawer.Body>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
          <a className="mobile-shell-brand" href="/">
            <img src="/assets/brand/logo.png" alt="" />
            <strong>{messages.brand}</strong>
          </a>
          <Dropdown>
            <Dropdown.Trigger aria-label={messages.accountMenu} className="account-menu-trigger">
              <AccountAvatar profile={profile} size="md" />
            </Dropdown.Trigger>
            <Dropdown.Popover className="account-menu-popover" placement="bottom end">
              <div className="account-menu-greeting">Hi {displayName}</div>
              <Dropdown.Menu
                aria-label={messages.accountMenu}
                className="account-menu-list"
                onAction={(key) => {
                  if (key === 'sign-out') void logout()
                }}
              >
                <Dropdown.Item id="sign-out" className="account-menu-item" textValue={messages.signOut}>
                  <LogOut size={16} aria-hidden="true" />
                  {messages.signOut}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </header>
        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
