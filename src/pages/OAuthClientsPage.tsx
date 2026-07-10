import { Button, Card } from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import type { OAuthClient } from '../lib/api'

export function OAuthClientsPage() {
  const { api } = useAuth()
  const [clients, setClients] = useState<OAuthClient[]>([])
  const [clientName, setClientName] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [secret, setSecret] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await api.listOAuthClients()
    setClients(response.clients)
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  async function createClient(event: React.FormEvent) {
    event.preventDefault()
    if (!clientName.trim() || !redirectUri.trim()) return
    await api.createOAuthClient({
      client_name: clientName.trim(),
      client_type: 'public',
      redirect_uris: [redirectUri.trim()],
      allowed_scopes: ['openid', 'profile', 'email'],
    })
    setClientName('')
    setRedirectUri('')
    await load()
  }

  async function rotateSecret(clientID: string) {
    const response = await api.rotateOAuthClientSecret(clientID)
    setSecret(`${response.client_id}: ${response.client_secret}`)
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">OAuth</p>
          <h1>OAuth clients</h1>
        </div>
      </header>

      {secret ? <p className="notice">New secret: {secret}</p> : null}

      <Card className="table-card">
        <Card.Header>
          <Card.Title>Registered clients</Card.Title>
          <Card.Description>First-party web, desktop, and service clients.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="inline-form oauth-form" onSubmit={(event) => void createClient(event)}>
            <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" />
            <input
              value={redirectUri}
              onChange={(event) => setRedirectUri(event.target.value)}
              placeholder="https://app.alive.org.tw/oauth/callback"
            />
            <Button type="submit" variant="primary">Create</Button>
          </form>

          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Redirect URIs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.client_id}>
                  <td>
                    <strong>{client.client_name}</strong>
                    <span>{client.client_id}</span>
                  </td>
                  <td>{client.client_type}</td>
                  <td>{client.redirect_uris.join(', ')}</td>
                  <td>
                    <Button size="sm" variant="outline" onPress={() => void rotateSecret(client.client_id)}>
                      Rotate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card.Content>
      </Card>
    </section>
  )
}
