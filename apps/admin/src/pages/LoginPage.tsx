import { safeReturnTo } from '@hhc/account-client'
import { Button, Card } from '@hhc/ui'
import { ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'

export function LoginPage() {
  const { signIn, authError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function continueToAccount() {
    const from = location.state?.from
    const returnTo = from ? safeReturnTo(`${from.pathname}${from.search}${from.hash}`) : '/'
    const destination = await signIn(returnTo)
    if (destination) navigate(destination, { replace: true })
  }

  return (
    <main className="login-screen">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <img src="/assets/brand/logo.png" alt="" />
          <div>
            <h1 id="login-title">HHC Admin Console</h1>
            <p>Hallelujah Home Church</p>
          </div>
        </div>

        <Card className="login-card">
          <Card.Header>
            <ShieldCheck size={28} aria-hidden="true" />
            <div>
              <Card.Title>Sign in required</Card.Title>
              <Card.Description>{authError ?? 'Use your HHC account to manage users, access, and website content.'}</Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <Button
              className="login-action"
              variant="primary"
              onPress={() => void continueToAccount()}
            >
              {authError ? 'Try again' : 'Continue with HHC account'}
            </Button>
          </Card.Content>
        </Card>
      </section>
    </main>
  )
}
