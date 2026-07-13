import { Button } from '@hhc/ui'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { clearOAuthTransaction } from '../auth/pkce'

export function OAuthCallbackPage() {
  const { completeOAuthCallback, signIn } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const callbackError = params.get('error')
    if (callbackError) {
      clearOAuthTransaction()
      setError(callbackError === 'access_denied' ? 'Sign in was cancelled.' : 'Your HHC account session could not be started.')
      return
    }
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
        {error ? <Button variant="primary" onPress={() => void signIn('/')}>Try again</Button> : null}
      </div>
    </main>
  )
}
