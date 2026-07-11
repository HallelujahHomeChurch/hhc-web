import { Dropdown } from '@heroui/react'
import { BookOpen, KeyRound, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { AccountAvatar } from './AccountAvatar'
import { displayAccountName } from '../lib/account-display'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/access', label: 'Access', icon: ShieldCheck },
  { to: '/oauth-clients', label: 'OAuth clients', icon: KeyRound },
  { to: '/cms', label: 'CMS', icon: BookOpen },
]

export function AppLayout() {
  const { profile, logout } = useAuth()
  const displayName = displayAccountName(profile, 'Admin')

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img src="/assets/brand/logo.png" alt="" />
          <span>
            <strong>HHC Admin</strong>
            <small>Hallelujah Home Church</small>
          </span>
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
      </aside>

      <div className="admin-content">
        <header className="account-header">
          <Dropdown>
            <Dropdown.Trigger aria-label="Account menu" className="account-menu-trigger">
              <AccountAvatar profile={profile} size="sm" />
            </Dropdown.Trigger>
            <Dropdown.Popover className="account-menu-popover" placement="bottom end">
              <div className="account-menu-greeting">Hi {displayName}</div>
              <Dropdown.Menu
                aria-label="Account menu"
                className="account-menu-list"
                onAction={(key) => {
                  if (key === 'sign-out') void logout()
                }}
              >
                <Dropdown.Item id="sign-out" className="account-menu-item" textValue="Sign out">
                  <LogOut size={16} aria-hidden="true" />
                  Sign out
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
