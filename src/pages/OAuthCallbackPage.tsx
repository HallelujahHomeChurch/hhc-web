import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'

export function OAuthCallbackPage() {
  const { completeOAuthCallback } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setError('Missing OAuth callback parameters.')
      return
    }

    completeOAuthCallback(code, state)
      .then((returnTo) => navigate(returnTo, { replace: true }))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'OAuth callback failed.'))
  }, [completeOAuthCallback, navigate, params])

  return (
    <main className="center-screen">
      <div className="loading-panel">
        <h1>{error ? 'Cannot sign in' : 'Completing sign in'}</h1>
        <p>{error ?? 'Verifying the authorization response.'}</p>
      </div>
    </main>
  )
}
