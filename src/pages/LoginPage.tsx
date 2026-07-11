import { Button, Card } from '@heroui/react'
import { ShieldCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'

export function LoginPage() {
  const { signIn } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  async function continueToAccount() {
    const destination = await signIn(location.state?.from?.pathname ?? '/')
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
              <Card.Description>Use your HHC account to manage users, access, and CMS operations.</Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <Button
              className="login-action"
              variant="primary"
        onPress={() => void continueToAccount()}
            >
              Continue with HHC account
            </Button>
          </Card.Content>
        </Card>
      </section>
    </main>
  )
}
