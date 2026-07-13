import { Button, Card, Form, Input, Label, Modal, TextField } from '@heroui/react'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import type { Permission, Role } from '../lib/api'

export function AccessPage() {
  const { api } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [roleName, setRoleName] = useState('')
  const [permissionCode, setPermissionCode] = useState('')
  const [selectedRoleID, setSelectedRoleID] = useState('')
  const [isRoleDialogOpen, setRoleDialogOpen] = useState(false)
  const [isPermissionDialogOpen, setPermissionDialogOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [nextRoles, nextPermissions] = await Promise.all([api.listRoles(), api.listPermissions()])
      setRoles(nextRoles)
      setPermissions(nextPermissions)
      setSelectedRoleID((current) => current || nextRoles[0]?.id || '')
    } catch {
      setError('Unable to load access data.')
    } finally {
      setIsLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  async function createRole(event: React.FormEvent) {
    event.preventDefault()
    if (!roleName.trim()) return
    try {
      await api.createRole({ name: roleName.trim() })
      setRoleName('')
      setRoleDialogOpen(false)
      setMessage('Role created.')
      await load()
    } catch { setError('Unable to create role.') }
  }

  async function createPermission(event: React.FormEvent) {
    event.preventDefault()
    if (!permissionCode.trim()) return
    try {
      await api.createPermission({ code: permissionCode.trim() })
      setPermissionCode('')
      setPermissionDialogOpen(false)
      setMessage('Permission created.')
      await load()
    } catch { setError('Unable to create permission.') }
  }

  async function assignPermission(permissionID: string) {
    if (!selectedRoleID) return
    try {
      await api.assignPermissionsToRole(selectedRoleID, [permissionID])
      setMessage('Role permissions updated.')
      await load()
    } catch { setError('Unable to update role permissions.') }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <h1>Access</h1>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onPress={() => setPermissionDialogOpen(true)}>
            Create permission
          </Button>
          <Button onPress={() => setRoleDialogOpen(true)}>Create role</Button>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}
      {error ? <div className="error-notice" role="alert"><span>{error}</span><Button size="sm" variant="outline" onPress={() => void load()}>Retry</Button></div> : null}

      <div className="access-grid">
        <Card className="table-card">
          <Card.Header>
            <Card.Title>Roles</Card.Title>
            <Card.Description>{isLoading ? 'Loading roles' : `${roles.length} roles`}</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="list-stack">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={role.id === selectedRoleID ? 'list-item is-selected' : 'list-item'}
                  onClick={() => setSelectedRoleID(role.id)}
                >
                  <strong>{role.name}</strong>
                  <span>{role.permissions?.map((permission) => permission.code).join(', ') || 'No permissions'}</span>
                </button>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card className="table-card">
          <Card.Header>
            <Card.Title>Permissions</Card.Title>
            <Card.Description>{isLoading ? 'Loading permissions' : `${permissions.length} permissions`}</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="chip-row">
              {permissions.map((permission) => (
                <Button
                  key={permission.id}
                  size="sm"
                  variant="outline"
                  onPress={() => void assignPermission(permission.id)}
                >
                  {permission.code}
                </Button>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>

      <Modal isOpen={isRoleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container" placement="center">
            <Modal.Dialog className="modal-dialog">
              <Modal.Header>
                <Modal.Heading>Create role</Modal.Heading>
              </Modal.Header>
              <Form onSubmit={(event) => void createRole(event)}>
                <Modal.Body className="modal-form-grid">
                  <TextField isRequired value={roleName} onChange={setRoleName}>
                    <Label>Role name</Label>
                    <Input autoFocus />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="modal-actions">
                  <Button variant="ghost" onPress={() => setRoleDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={isPermissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container" placement="center">
            <Modal.Dialog className="modal-dialog">
              <Modal.Header>
                <Modal.Heading>Create permission</Modal.Heading>
              </Modal.Header>
              <Form onSubmit={(event) => void createPermission(event)}>
                <Modal.Body className="modal-form-grid">
                  <TextField isRequired value={permissionCode} onChange={setPermissionCode}>
                    <Label>Permission code</Label>
                    <Input autoFocus />
                  </TextField>
                </Modal.Body>
                <Modal.Footer className="modal-actions">
                  <Button variant="ghost" onPress={() => setPermissionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  )
}
