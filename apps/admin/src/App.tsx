import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'

import { AuthProvider, useAuth } from './auth/auth-context'
import { readRuntimeConfig, type RuntimeConfig } from './auth/runtime-config'
import { AppLayout } from './components/AppLayout'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { LoginPage } from './pages/LoginPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { LocaleProvider } from './preferences/locale-context'

const AccessPage = lazy(() => import('./pages/AccessPage').then((module) => ({ default: module.AccessPage })))
const CmsPage = lazy(() => import('./pages/CmsPage').then((module) => ({ default: module.CmsPage })))
const ContentModulePage = lazy(() => import('./pages/content/ContentModulePage').then((module) => ({ default: module.ContentModulePage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const OAuthClientsPage = lazy(() => import('./pages/OAuthClientsPage').then((module) => ({ default: module.OAuthClientsPage })))
const UsersPage = lazy(() => import('./pages/UsersPage').then((module) => ({ default: module.UsersPage })))

type AppProps = {
  config?: Partial<RuntimeConfig>
}

function App({ config }: AppProps) {
  return (
    <LocaleProvider>
      <BrowserRouter>
        <AuthProvider config={{ ...readRuntimeConfig(), ...config }}>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AppLayout />}>
              <Route index element={<Deferred><DashboardPage /></Deferred>} />
              <Route path="/users" element={<Deferred><UsersPage /></Deferred>} />
              <Route path="/access" element={<Deferred><AccessPage /></Deferred>} />
              <Route path="/oauth-clients" element={<Deferred><OAuthClientsPage /></Deferred>} />
              <Route path="/content/bulletins" element={<Deferred><CmsPage /></Deferred>} />
              <Route path="/content/news" element={<Deferred><ContentModulePage module="news" /></Deferred>} />
              <Route path="/content/history" element={<Deferred><ContentModulePage module="history" /></Deferred>} />
              <Route path="/content/videos" element={<Deferred><ContentModulePage module="videos" /></Deferred>} />
              <Route path="/cms" element={<Navigate to="/content/bulletins" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </LocaleProvider>
  )
}

function Deferred({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="inline-status">Loading</p>}>{children}</Suspense>
}

function RequireAdmin() {
  const { profile, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return (
      <main className="center-screen">
        <div className="loading-panel">
          <h1>Loading admin console</h1>
          <p>Checking your HHC account session.</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!hasAdminAccess(profile.roles ?? [], profile.permissions ?? [])) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}

function hasAdminAccess(roles: string[], permissions: string[]) {
  return roles.includes('admin') || permissions.includes('*') || permissions.some((permission) => permission.endsWith(':manage'))
}

export default App
