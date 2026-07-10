import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider, useAuth } from './auth/auth-context'
import { readRuntimeConfig, type RuntimeConfig } from './auth/runtime-config'
import { AppLayout } from './components/AppLayout'
import { AccessPage } from './pages/AccessPage'
import { CmsPage } from './pages/CmsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { LoginPage } from './pages/LoginPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { OAuthClientsPage } from './pages/OAuthClientsPage'
import { UsersPage } from './pages/UsersPage'

type AppProps = {
  config?: Partial<RuntimeConfig>
}

function App({ config }: AppProps) {
  return (
    <BrowserRouter>
      <AuthProvider config={{ ...readRuntimeConfig(), ...config }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route element={<RequireAdmin />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/access" element={<AccessPage />} />
              <Route path="/oauth-clients" element={<OAuthClientsPage />} />
              <Route path="/cms" element={<CmsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
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
