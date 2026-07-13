import { Button, Card, Dropdown, Modal } from '@heroui/react'
import { Pagination as SharedPagination, Select as SharedSelect } from '@hhc/ui'
import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/auth-context'
import { StatusBadge } from '../components/StatusBadge'
import type { AdminUserDetail, AdminUserSummary, Permission, Role } from '../lib/api'

const DEFAULT_USERS_PER_PAGE = 20
const PAGE_SIZES = [20, 50, 100]

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function UsersPage() {
  const { api } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const querySearch = searchParams.get('search')?.trim() ?? ''
  const roleFilter = searchParams.get('role')?.trim() ?? ''
  const page = positiveInteger(searchParams.get('page'), 1)
  const requestedPageSize = positiveInteger(searchParams.get('per_page'), DEFAULT_USERS_PER_PAGE)
  const perPage = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : DEFAULT_USERS_PER_PAGE
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selectedUserID, setSelectedUserID] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [search, setSearch] = useState(querySearch)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [permissionToRemove, setPermissionToRemove] = useState<string | null>(null)
  const requestSequence = useRef(0)

  const updateSearchParams = useCallback((updates: { search?: string; role?: string; page?: number; perPage?: number }) => {
    const next = new URLSearchParams(searchParams)
    if (updates.search !== undefined) setOptionalParam(next, 'search', updates.search)
    if (updates.role !== undefined) setOptionalParam(next, 'role', updates.role)
    if (updates.page !== undefined) setOptionalParam(next, 'page', updates.page === 1 ? '' : String(updates.page))
    if (updates.perPage !== undefined) setOptionalParam(next, 'per_page', updates.perPage === DEFAULT_USERS_PER_PAGE ? '' : String(updates.perPage))
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserID) ?? users[0] ?? null,
    [selectedUserID, users],
  )

  useEffect(() => {
    if (search.trim() === querySearch) return
    const timer = window.setTimeout(() => updateSearchParams({ search: search.trim(), page: 1 }), 300)
    return () => window.clearTimeout(timer)
  }, [querySearch, search, updateSearchParams])

  useEffect(() => {
    setSearch(querySearch)
  }, [querySearch])

  useEffect(() => {
    let active = true
    async function loadReferenceData() {
      try {
        const [nextRoles, nextPermissions] = await Promise.all([api.listRoles(), api.listPermissions()])
        if (!active) return
        setRoles(nextRoles)
        setPermissions(nextPermissions)
      } catch {
        if (active) setMessage('Unable to load access options.')
      }
    }
    void loadReferenceData()
    return () => { active = false }
  }, [api])

  useEffect(() => {
    const controller = new AbortController()
    const sequence = ++requestSequence.current
    async function loadUsers() {
      setIsLoading(true)
      setError(null)
      try {
        const response = await api.listUsers({
          page,
          perPage,
          search: querySearch,
          role: roleFilter || undefined,
          signal: controller.signal,
        })
        if (sequence !== requestSequence.current) return
        setUsers(response.users)
        setTotal(response.total)
        setSelectedUserID((current) => response.users.some((user) => user.id === current) ? current : response.users[0]?.id ?? null)
      } catch (nextError) {
        if (sequence === requestSequence.current && !isAbortError(nextError)) setError('Unable to load users.')
      } finally {
        if (sequence === requestSequence.current && !controller.signal.aborted) setIsLoading(false)
      }
    }
    void loadUsers()
    return () => controller.abort()
  }, [api, page, perPage, querySearch, retryKey, roleFilter])

  useEffect(() => {
    const controller = new AbortController()
    async function loadDetail() {
      if (!selectedUser) {
        setDetail(null)
        return
      }
      setDetailError(null)
      try {
        setDetail(await api.getUser(selectedUser.id, controller.signal))
      } catch (nextError) {
        if (!isAbortError(nextError)) setDetailError('Unable to load user details.')
      }
    }
    void loadDetail()
    return () => controller.abort()
  }, [api, selectedUser])

  async function refreshCurrentPage() {
    setRetryKey((current) => current + 1)
  }

  async function assignRole(roleID: string) {
    if (!detail) return
    await api.assignRolesToUser(detail.id, [roleID])
    setDetail(await api.getUser(detail.id))
    await refreshCurrentPage()
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
          <h1>Users</h1>
        </div>
      </header>

      <div className="toolbar">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search users</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email or name" />
        </label>
        <Dropdown>
          <Dropdown.Trigger aria-label="Filter by role" className="admin-select-trigger">
            {roleFilter || 'All roles'}
          </Dropdown.Trigger>
          <Dropdown.Popover className="admin-select-popover">
            <Dropdown.Menu
              aria-label="Filter by role"
              className="admin-select-menu"
              onAction={(key) => updateSearchParams({ role: key === 'all' ? '' : String(key), page: 1 })}
            >
              <Dropdown.Item id="all" className="admin-select-item" textValue="All roles">
                All roles
              </Dropdown.Item>
              {roles.map((role) => (
                <Dropdown.Item key={role.id} id={role.name} className="admin-select-item" textValue={role.name}>
                  {role.name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        <SharedSelect
          label="Rows per page"
          items={PAGE_SIZES.map((size) => ({ id: String(size), label: String(size) }))}
          selectedKey={String(perPage)}
          onSelectionChange={(key) => updateSearchParams({ perPage: Number(key), page: 1 })}
        />
      </div>

      {message ? <p className="notice">{message}</p> : null}
      {error ? (
        <div className="error-notice" role="alert">
          <span>{error}</span>
          <Button size="sm" variant="outline" onPress={() => void refreshCurrentPage()}>Retry</Button>
        </div>
      ) : null}

      <div className="split-view">
        <Card className="table-card">
          <Card.Header>
            <Card.Title>Directory</Card.Title>
            <Card.Description>{isLoading ? 'Loading users' : `${total} users`}</Card.Description>
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
              <tbody aria-busy={isLoading}>
                {!isLoading && !error && users.length === 0 ? (
                  <tr><td colSpan={3} className="empty-table-cell">No users match these filters.</td></tr>
                ) : null}
                {users.map((user) => (
                  <tr key={user.id} className={user.id === selectedUser?.id ? 'is-selected' : undefined}>
                    <td>
                      <button className="table-row-action" type="button" onClick={() => setSelectedUserID(user.id)} aria-label={`View ${user.email}`}>
                        <strong>{user.email}</strong>
                        <span>{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name'}</span>
                      </button>
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
            <SharedPagination
              page={page}
              totalPages={Math.ceil(total / perPage)}
              onPageChange={(nextPage) => updateSearchParams({ page: nextPage })}
              labels={{ previous: 'Previous', next: 'Next' }}
            />
          </Card.Content>
        </Card>

        <Card className="inspector-card">
          <Card.Header>
            <Card.Title>User detail</Card.Title>
            <Card.Description>{detail?.email ?? 'Select a user'}</Card.Description>
          </Card.Header>
          <Card.Content>
            {detailError ? <p className="error-copy" role="alert">{detailError}</p> : detail ? (
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
                        aria-label={`Remove permission ${permission}`}
                        size="sm"
                        variant="secondary"
                        onPress={() => setPermissionToRemove(permission)}
                      >
                        {permission}
                      </Button>
                    ))}
                  </div>
                  <Dropdown>
                    <Dropdown.Trigger className="admin-select-trigger">Add permission</Dropdown.Trigger>
                    <Dropdown.Popover className="admin-select-popover">
                      <Dropdown.Menu
                        aria-label="Add direct permission"
                        className="admin-select-menu"
                        onAction={(key) => void addPermission(String(key))}
                      >
                        {permissions.map((permission) => (
                          <Dropdown.Item
                            key={permission.id}
                            id={permission.code}
                            className="admin-select-item"
                            textValue={permission.code}
                          >
                            {permission.code}
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </section>
              </div>
            ) : (
              <p>No user selected.</p>
            )}
          </Card.Content>
        </Card>
      </div>

      <Modal isOpen={Boolean(permissionToRemove)} onOpenChange={(open) => setPermissionToRemove(open ? permissionToRemove : null)}>
        <Modal.Backdrop className="modal-backdrop">
          <Modal.Container className="modal-container" placement="center">
            <Modal.Dialog className="modal-dialog">
              <Modal.Header>
                <Modal.Heading>Remove direct permission</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="modal-form-grid">
                <p className="modal-copy">Remove {permissionToRemove} from {detail?.email}.</p>
              </Modal.Body>
              <Modal.Footer className="modal-actions">
                <Button variant="ghost" onPress={() => setPermissionToRemove(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={async () => {
                    if (!permissionToRemove) return
                    await removePermission(permissionToRemove)
                    setPermissionToRemove(null)
                  }}
                >
                  Remove permission
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  )
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function setOptionalParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value)
  else params.delete(key)
}
