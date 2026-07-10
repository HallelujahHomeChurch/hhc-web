import {
  BadgeCheck,
  BookOpen,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/access', label: 'Access', icon: ShieldCheck },
  { to: '/oauth-clients', label: 'OAuth clients', icon: KeyRound },
  { to: '/cms', label: 'CMS', icon: BookOpen },
]

export function AppLayout() {
  const { profile, logout } = useAuth()
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email

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

        <div className="sidebar-account">
          <BadgeCheck size={18} aria-hidden="true" />
          <div>
            <strong>{displayName}</strong>
            <span>{profile?.email}</span>
          </div>
          <button type="button" aria-label="Sign out" onClick={() => void logout()}>
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <Outlet />
      </main>
    </div>
  )
}
