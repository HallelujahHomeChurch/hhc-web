import { Button, Card } from '@heroui/react'
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
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [nextRoles, nextPermissions] = await Promise.all([api.listRoles(), api.listPermissions()])
    setRoles(nextRoles)
    setPermissions(nextPermissions)
    setSelectedRoleID((current) => current || nextRoles[0]?.id || '')
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  async function createRole(event: React.FormEvent) {
    event.preventDefault()
    if (!roleName.trim()) return
    await api.createRole({ name: roleName.trim() })
    setRoleName('')
    setMessage('Role created.')
    await load()
  }

  async function createPermission(event: React.FormEvent) {
    event.preventDefault()
    if (!permissionCode.trim()) return
    await api.createPermission({ code: permissionCode.trim() })
    setPermissionCode('')
    setMessage('Permission created.')
    await load()
  }

  async function assignPermission(permissionID: string) {
    if (!selectedRoleID) return
    await api.assignPermissionsToRole(selectedRoleID, [permissionID])
    setMessage('Role permissions updated.')
    await load()
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">RBAC</p>
          <h1>Access</h1>
        </div>
      </header>

      {message ? <p className="notice">{message}</p> : null}

      <div className="access-grid">
        <Card className="table-card">
          <Card.Header>
            <Card.Title>Roles</Card.Title>
            <Card.Description>Permission bundles assigned to users.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form className="inline-form" onSubmit={(event) => void createRole(event)}>
              <input value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="role name" />
              <Button type="submit" variant="primary">Create</Button>
            </form>
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
            <Card.Description>Attach permissions to the selected role.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form className="inline-form" onSubmit={(event) => void createPermission(event)}>
              <input
                value={permissionCode}
                onChange={(event) => setPermissionCode(event.target.value)}
                placeholder="service:action"
              />
              <Button type="submit" variant="primary">Create</Button>
            </form>
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
    </section>
  )
}
