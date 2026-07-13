/* oxlint-disable react/only-export-components */
import { currentReturnTo } from '@hhc/account-client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { AdminApi, type Profile } from '../lib/api'
import { CmsApi } from '../lib/cms-api'
import { MockAdminApi } from '../lib/mock-api'
import { MockCmsApi } from '../lib/mock-cms-api'
import {
  buildAuthorizeUrl,
  clearOAuthTransaction,
  createOAuthTransaction,
  readOAuthTransaction,
  saveOAuthTransaction,
  validateOAuthState,
} from './pkce'
import { readRuntimeConfig, type RuntimeConfig } from './runtime-config'

export type AdminApiClient = AdminApi | MockAdminApi
export type CmsApiClient = CmsApi | MockCmsApi

type AuthContextValue = {
  api: AdminApiClient
  cmsApi: CmsApiClient
  profile: Profile | null
  accessToken: string | null
  isBootstrapping: boolean
  authError: string | null
  logoutError: string | null
  signIn: (returnTo?: string) => Promise<string | null>
  completeOAuthCallback: (code: string, state: string) => Promise<string>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Profile>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function defaultNavigateExternal(url: string, replace = false) {
  if (replace) window.location.replace(url)
  else window.location.assign(url)
}

export function AuthProvider({
  children,
  config = readRuntimeConfig(),
  navigateExternal = defaultNavigateExternal,
}: {
  children: ReactNode
  config?: RuntimeConfig
  navigateExternal?: (url: string, replace?: boolean) => void
}) {
  const tokenRef = useRef<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const writeAccessToken = useCallback((token: string | null) => {
    tokenRef.current = token
    setAccessToken(token)
  }, [])

  const api = useMemo<AdminApiClient>(() => {
    if (config.mockApi) return new MockAdminApi()
    return new AdminApi({
      baseUrl: config.accountApiBaseUrl,
      getAccessToken: () => tokenRef.current,
      setAccessToken: writeAccessToken,
    })
  }, [config.accountApiBaseUrl, config.mockApi, writeAccessToken])

  const cmsApi = useMemo<CmsApiClient>(() => {
    if (config.mockApi) return new MockCmsApi()
    return new CmsApi({ baseUrl: config.hhcWebApiBaseUrl, getAccessToken: () => tokenRef.current })
  }, [config.hhcWebApiBaseUrl, config.mockApi])

  const refreshProfile = useCallback(async () => {
    const nextProfile = await api.me()
    setProfile(nextProfile)
    return nextProfile
  }, [api])

  const beginAuthorization = useCallback(async (returnTo: string) => {
    const transaction = await createOAuthTransaction(returnTo)
    saveOAuthTransaction(transaction)
    navigateExternal(buildAuthorizeUrl(config, transaction).toString())
  }, [config, navigateExternal])

  const signIn = useCallback(async (returnTo = currentReturnTo(window.location)) => {
    setAuthError(null)
    if (config.mockApi) {
      const token = await api.refreshAccessToken()
      writeAccessToken(token)
      await refreshProfile()
      return returnTo
    }

    await beginAuthorization(returnTo)
    return null
  }, [api, beginAuthorization, config.mockApi, refreshProfile, writeAccessToken])

  const completeOAuthCallback = useCallback(async (code: string, state: string) => {
    const transaction = readOAuthTransaction()
    if (!validateOAuthState(transaction, state)) {
      throw new Error('OAuth state did not match this browser session.')
    }

    const response = await api.exchangeCode({
      code,
      codeVerifier: transaction.codeVerifier,
      clientId: config.adminClientId,
      redirectUri: config.redirectUri,
    })

    writeAccessToken(response.access_token ?? null)
    clearOAuthTransaction()
    await refreshProfile()
    return transaction.returnTo
  }, [api, config.adminClientId, config.redirectUri, refreshProfile, writeAccessToken])

  const logout = useCallback(async () => {
    setLogoutError(null)
    try {
      await api.logoutAll()
      writeAccessToken(null)
      setProfile(null)
      navigateExternal(`${config.accountSiteUrl}/login?signed_out=1`, true)
    } catch {
      setLogoutError('Unable to sign out. Try again.')
    }
  }, [api, config.accountSiteUrl, navigateExternal, writeAccessToken])

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      if (window.location.pathname === '/oauth/callback') {
        setIsBootstrapping(false)
        return
      }

      const token = await api.refreshAccessToken()
      if (!alive) return
      if (token) {
        writeAccessToken(token)
        await refreshProfile().catch(() => {
          writeAccessToken(null)
          setProfile(null)
        })
        if (alive) setIsBootstrapping(false)
        return
      }
      if (config.mockApi) {
        if (alive) setIsBootstrapping(false)
        return
      }
      await beginAuthorization(currentReturnTo(window.location))
    }

    bootstrap().catch(() => {
      if (!alive) return
      writeAccessToken(null)
      setProfile(null)
      setAuthError('Unable to check your HHC account. Try again.')
      setIsBootstrapping(false)
    })

    return () => {
      alive = false
    }
  }, [api, beginAuthorization, config.mockApi, refreshProfile, writeAccessToken])

  const value = useMemo(() => ({
    api,
    cmsApi,
    profile,
    accessToken,
    isBootstrapping,
    authError,
    logoutError,
    signIn,
    completeOAuthCallback,
    logout,
    refreshProfile,
  }), [accessToken, api, authError, cmsApi, completeOAuthCallback, isBootstrapping, logout, logoutError, profile, refreshProfile, signIn])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
