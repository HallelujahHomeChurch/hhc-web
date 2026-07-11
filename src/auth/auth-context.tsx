/* oxlint-disable react/only-export-components */
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
import { MockAdminApi } from '../lib/mock-api'
import {
  buildAuthorizeUrl,
  clearOAuthTransaction,
  createOAuthTransaction,
  readOAuthTransaction,
  saveOAuthTransaction,
} from './pkce'
import { readRuntimeConfig, type RuntimeConfig } from './runtime-config'

export type AdminApiClient = AdminApi | MockAdminApi

type AuthContextValue = {
  api: AdminApiClient
  profile: Profile | null
  accessToken: string | null
  isBootstrapping: boolean
  signIn: (returnTo?: string) => Promise<string | null>
  completeOAuthCallback: (code: string, state: string) => Promise<string>
  logout: () => Promise<void>
  refreshProfile: () => Promise<Profile>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  config = readRuntimeConfig(),
}: {
  children: ReactNode
  config?: RuntimeConfig
}) {
  const tokenRef = useRef<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

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

  const refreshProfile = useCallback(async () => {
    const nextProfile = await api.me()
    setProfile(nextProfile)
    return nextProfile
  }, [api])

  const signIn = useCallback(
    async (returnTo = window.location.pathname) => {
      if (config.mockApi) {
        const token = await api.refreshAccessToken()
    writeAccessToken(token)
    await refreshProfile()
    return returnTo
      }

      const transaction = await createOAuthTransaction(returnTo)
      saveOAuthTransaction(transaction)
    window.location.assign(buildAuthorizeUrl(config, transaction).toString())
    return null
    },
    [api, config, refreshProfile, writeAccessToken],
  )

  const completeOAuthCallback = useCallback(
    async (code: string, state: string) => {
      const transaction = readOAuthTransaction()
      if (!transaction || transaction.state !== state) {
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
    },
    [api, config.adminClientId, config.redirectUri, refreshProfile, writeAccessToken],
  )

  const logout = useCallback(async () => {
    await api.logout()
    writeAccessToken(null)
    setProfile(null)
  }, [api, writeAccessToken])

  useEffect(() => {
    let alive = true

    async function bootstrap() {
      const token = await api.refreshAccessToken()
      if (!alive) return
      if (token) {
        writeAccessToken(token)
        await refreshProfile().catch(() => {
          writeAccessToken(null)
          setProfile(null)
        })
      }
      if (alive) setIsBootstrapping(false)
    }

    bootstrap().catch(() => {
      if (!alive) return
      writeAccessToken(null)
      setProfile(null)
      setIsBootstrapping(false)
    })

    return () => {
      alive = false
    }
  }, [api, refreshProfile, writeAccessToken])

  const value = useMemo(
    () => ({
      api,
      profile,
      accessToken,
      isBootstrapping,
      signIn,
      completeOAuthCallback,
      logout,
      refreshProfile,
    }),
    [accessToken, api, completeOAuthCallback, isBootstrapping, logout, profile, refreshProfile, signIn],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
