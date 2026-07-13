import { Button, Card, Form, Input, Label, Modal, TextField } from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import type { OAuthClient } from '../lib/api'

export function OAuthClientsPage() {
  const { api } = useAuth()
  const [clients, setClients] = useState<OAuthClient[]>([])
  const [clientName, setClientName] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)
  const [rotateClient, setRotateClient] = useState<OAuthClient | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.listOAuthClients()
      setClients(response.clients)
    } catch {
      setError('Unable to load OAuth clients.')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  async function createClient(event: React.FormEvent) {
    event.preventDefault()
    if (!clientName.trim() || !redirectUri.trim()) return
    try {
      await api.createOAuthClient({
        client_name: clientName.trim(), client_type: 'public', redirect_uris: [redirectUri.trim()],
        allowed_scopes: ['openid', 'profile', 'email'],
      })
      setClientName('')
      setRedirectUri('')
      setCreateDialogOpen(false)
      await load()
    } catch { setError('Unable to create OAuth client.') }
  }

  async function rotateSecret(clientID: string) {
    try {
      const response = await api.rotateOAuthClientSecret(clientID)
      setSecret(`${response.client_id}: ${response.client_secret}`)
    } catch { setError('Unable to rotate the client secret.') }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h1>OAuth clients</h1>
        </div>
        <div className="page-actions">
          <Button onPress={() => setCreateDialogOpen(true)}>Create client</Button>
        </div>
      </header>

      {secret ? <p className="notice">New secret: {secret}</p> : null}
      {error ? <div className="error-notice" role="alert"><span>{error}</span><Button size="sm" variant="outline" onPress={() => void load()}>Retry</Button></div> : null}

      <Card className="table-card">
        <Card.Header>
          <Card.Title>Registered clients</Card.Title>
          <Card.Description>{isLoading ? 'Loading clients' : `${clients.length} clients`}</Card.Description>
        </Card.Header>
        <Card.Content>
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
                    <Button size="sm" variant="outline" onPress={() => setRotateClient(client)}>
                      Rotate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card.Content>
      </Card>

      <Modal isOpen={isCreateDialogOpen} onOpenChange={setCreateDialogOpen}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container" placement="center">
            <Modal.Dialog className="modal-dialog">
              <Modal.Header>
                <Modal.Heading>Create client</Modal.Heading>
              </Modal.Header>
              <Form onSubmit={(event) => void createClient(event)}>
                <Modal.Body className="modal-form-grid">
                  <TextField isRequired value={clientName} onChange={setClientName}>
                    <Label>Client name</Label>
                    <Input autoFocus />
                  </TextField>
                  <TextField isRequired value={redirectUri} onChange={setRedirectUri}>
                    <Label>Redirect URI</Label>
                    <Input placeholder="https://app.alive.org.tw/oauth/callback" />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="modal-actions">
                  <Button variant="ghost" onPress={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={Boolean(rotateClient)} onOpenChange={(open) => setRotateClient(open ? rotateClient : null)}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container" placement="center">
            <Modal.Dialog className="modal-dialog">
              <Modal.Header>
                <Modal.Heading>Rotate client secret</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="modal-form-grid">
                <p className="modal-copy">Rotate secret for {rotateClient?.client_name}. The new secret is shown once.</p>
              </Modal.Body>
              <Modal.Footer className="modal-actions">
                <Button variant="ghost" onPress={() => setRotateClient(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={async () => {
                    if (!rotateClient) return
                    await rotateSecret(rotateClient.client_id)
                    setRotateClient(null)
                  }}
                >
                  Rotate secret
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  )
}
