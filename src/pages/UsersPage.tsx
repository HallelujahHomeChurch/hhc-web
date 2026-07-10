import { Button, Card } from '@heroui/react'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../auth/auth-context'
import { StatusBadge } from '../components/StatusBadge'
import type { AdminUserDetail, AdminUserSummary, Permission, Role } from '../lib/api'

export function UsersPage() {
  const { api } = useAuth()
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserID) ?? users[0] ?? null,
    [selectedUserID, users],
  )

  useEffect(() => {
    async function loadReferenceData() {
      const [nextRoles, nextPermissions] = await Promise.all([api.listRoles(), api.listPermissions()])
      setRoles(nextRoles)
      setPermissions(nextPermissions)
    }
    void loadReferenceData()
  }, [api])

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true)
      const response = await api.listUsers({ search, role: roleFilter || undefined })
      setUsers(response.users)
      setSelectedUserID((current) => current ?? response.users[0]?.id ?? null)
      setIsLoading(false)
    }
    void loadUsers()
  }, [api, roleFilter, search])

  useEffect(() => {
    async function loadDetail() {
      if (!selectedUser) {
        setDetail(null)
        return
      }
      setDetail(await api.getUser(selectedUser.id))
    }
    void loadDetail()
  }, [api, selectedUser])

  async function assignRole(roleID: string) {
    if (!detail) return
    await api.assignRolesToUser(detail.id, [roleID])
    setDetail(await api.getUser(detail.id))
    setUsers((await api.listUsers({ search, role: roleFilter || undefined })).users)
    setMessage('User roles updated.')
  }

  async function addPermission(code: string) {
    if (!detail) return
    await api.addDirectPermissionsToUser(detail.id, [code])
    setDetail(await api.getUser(detail.id))
    setMessage('Direct permission added.')
  }

  async function removePermission(code: string) {
    if (!detail) return
    await api.removeDirectPermissionsFromUser(detail.id, [code])
    setDetail(await api.getUser(detail.id))
    setMessage('Direct permission removed.')
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Users</h1>
        </div>
      </header>

      <div className="toolbar">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search users</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email or name" />
        </label>
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.name}>{role.name}</option>
          ))}
        </select>
      </div>

      {message ? <p className="notice">{message}</p> : null}

      <div className="split-view">
        <Card className="table-card">
          <Card.Header>
            <Card.Title>Directory</Card.Title>
            <Card.Description>{isLoading ? 'Loading users' : `${users.length} users`}</Card.Description>
          </Card.Header>
          <Card.Content>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>MFA</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={user.id === selectedUser?.id ? 'is-selected' : undefined}
                    onClick={() => setSelectedUserID(user.id)}
                  >
                    <td>
                      <strong>{user.email}</strong>
                      <span>{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name'}</span>
                    </td>
                    <td>{user.roles.join(', ') || 'none'}</td>
                    <td>
                      <StatusBadge tone={user.mfa_enabled ? 'success' : 'warning'}>
                        {user.mfa_enabled ? 'Enabled' : 'Off'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card.Content>
        </Card>

        <Card className="inspector-card">
          <Card.Header>
            <Card.Title>User detail</Card.Title>
            <Card.Description>{detail?.email ?? 'Select a user'}</Card.Description>
          </Card.Header>
          <Card.Content>
            {detail ? (
              <div className="inspector-stack">
                <dl className="detail-list">
                  <div>
                    <dt>Status</dt>
                    <dd>{detail.is_active ? 'Active' : 'Inactive'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{detail.is_email_verified ? 'Verified' : 'Not verified'}</dd>
                  </div>
                  <div>
                    <dt>MFA</dt>
                    <dd>{detail.mfa.enabled ? detail.mfa.methods.map((method) => method.type).join(', ') : 'Off'}</dd>
                  </div>
                </dl>

                <section>
                  <h3>Roles</h3>
                  <div className="chip-row">
                    {roles.map((role) => (
                      <Button
                        key={role.id}
                        size="sm"
                        variant={detail.roles.includes(role.name) ? 'primary' : 'outline'}
                        onPress={() => void assignRole(role.id)}
                      >
                        {role.name}
                      </Button>
                    ))}
                  </div>
                </section>

                <section>
                  <h3>Direct permissions</h3>
                  <div className="chip-row">
                    {detail.direct_permissions.map((permission) => (
                      <Button
                        key={permission}
                        size="sm"
                        variant="secondary"
                        onPress={() => void removePermission(permission)}
                      >
                        {permission}
                      </Button>
                    ))}
                  </div>
                  <select
                    aria-label="Add direct permission"
                    defaultValue=""
                    onChange={(event) => {
                      const value = event.target.value
                      event.currentTarget.value = ''
                      if (value) void addPermission(value)
                    }}
                  >
                    <option value="">Add permission</option>
                    {permissions.map((permission) => (
                      <option key={permission.id} value={permission.code}>{permission.code}</option>
                    ))}
                  </select>
                </section>
              </div>
            ) : (
              <p>No user selected.</p>
            )}
          </Card.Content>
        </Card>
      </div>
    </section>
  )
}
