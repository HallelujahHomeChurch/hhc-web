import type {
  AdminUserDetail,
  AdminUserListResponse,
  AdminUserSummary,
  OAuthClient,
  OAuthClientInput,
  Permission,
  Profile,
  Role,
  TokenResponse,
} from './api'

const now = new Date().toISOString()

const permissions: Permission[] = [
  { id: 'perm-wildcard', code: '*', description: 'Full platform access' },
  { id: 'perm-users-manage', code: 'users:manage', description: 'Manage account users' },
  { id: 'perm-rbac-manage', code: 'rbac:manage', description: 'Manage roles and permissions' },
  { id: 'perm-oauth-manage', code: 'oauth:manage', description: 'Manage OAuth clients' },
]

const roles: Role[] = [
  {
    id: 'role-admin',
    name: 'admin',
    description: 'Full administrator',
    permissions: [permissions[0]],
  },
  {
    id: 'role-editor',
    name: 'editor',
    description: 'Content editor preview role',
    permissions: [permissions[1], permissions[2]],
  },
  {
    id: 'role-user',
    name: 'user',
    description: 'Default account user',
    permissions: [],
  },
]

const users: AdminUserDetail[] = [
  {
    id: '018f0c1f-18d0-7e81-9f6f-69c456db7001',
    email: 'admin@alive.org.tw',
    first_name: 'HHC',
    last_name: 'Admin',
    is_email_verified: true,
    has_password: true,
    is_active: true,
    mfa_enabled: true,
    roles: ['admin'],
    direct_permissions: [],
    linked_providers: ['google', 'microsoft'],
    linked_identities: [
      { provider: 'google', created_at: now },
      { provider: 'microsoft', created_at: now },
    ],
    mfa: { enabled: true, methods: [{ type: 'totp', created_at: now }] },
    created_at: now,
    updated_at: now,
  },
  {
    id: '018f0c1f-18d0-7e81-9f6f-69c456db7002',
    email: 'editor@alive.org.tw',
    first_name: 'Content',
    last_name: 'Editor',
    is_email_verified: true,
    has_password: false,
    is_active: true,
    mfa_enabled: false,
    roles: ['editor'],
    direct_permissions: ['oauth:manage'],
    linked_providers: ['google'],
    linked_identities: [{ provider: 'google', created_at: now }],
    mfa: { enabled: false, methods: [] },
    created_at: now,
    updated_at: now,
  },
  {
    id: '018f0c1f-18d0-7e81-9f6f-69c456db7003',
    email: 'member@alive.org.tw',
    first_name: 'Church',
    last_name: 'Member',
    is_email_verified: false,
    has_password: true,
    is_active: true,
    mfa_enabled: false,
    roles: ['user'],
    direct_permissions: [],
    linked_providers: [],
    linked_identities: [],
    mfa: { enabled: false, methods: [] },
    created_at: now,
    updated_at: now,
  },
]

const oauthClients: OAuthClient[] = [
  {
    client_id: 'admin-web',
    client_name: 'Admin Console',
    client_type: 'public',
    redirect_uris: ['https://admin.alive.org.tw/oauth/callback', 'http://localhost:5175/oauth/callback'],
    allowed_scopes: ['openid', 'profile', 'email'],
    description: 'HHC administrative console',
    is_active: true,
  },
  {
    client_id: 'hhc-desktop',
    client_name: 'HHC Desktop',
    client_type: 'public',
    redirect_uris: ['hhc://callback'],
    allowed_scopes: ['openid', 'profile', 'email'],
    description: 'Desktop application login',
    is_active: true,
  },
]

export class MockAdminApi {
  async exchangeCode(): Promise<TokenResponse> {
    return { access_token: 'mock-admin-access-token', token_type: 'Bearer', expires_in: 3600 }
  }

  async refreshAccessToken() {
    return 'mock-admin-access-token'
  }

  async me(): Promise<Profile> {
    return {
      id: users[0].id,
      email: users[0].email,
      first_name: users[0].first_name,
      last_name: users[0].last_name,
      roles: ['admin'],
      permissions: ['*'],
    }
  }

  async logout() {
    return undefined
  }

  async listUsers(params: { search?: string; role?: string } = {}): Promise<AdminUserListResponse> {
    let filtered = [...users]
    if (params.search) {
      const q = params.search.toLowerCase()
      filtered = filtered.filter((user) => {
        const values = [user.email, user.first_name, user.last_name].filter((value): value is string => Boolean(value))
        return values.some((value) => value.toLowerCase().includes(q))
      })
    }
    if (params.role) {
      filtered = filtered.filter((user) => user.roles.includes(params.role ?? ''))
    }

    return {
      users: filtered.map(summaryFromDetail),
      total: filtered.length,
      page: 1,
      per_page: 20,
    }
  }

  async getUser(userID: string) {
    const user = users.find((item) => item.id === userID)
    if (!user) throw new Error('User not found')
    return structuredClone(user)
  }

  async assignRolesToUser(userID: string, roleIDs: string[]) {
    const user = mustFindUser(userID)
    user.roles = roleIDs.map((roleID) => roles.find((role) => role.id === roleID)?.name).filter(Boolean) as string[]
    return { message: 'Roles assigned' }
  }

  async removeRolesFromUser(userID: string, roleIDs: string[]) {
    const roleNames = roleIDs.map((roleID) => roles.find((role) => role.id === roleID)?.name).filter(Boolean)
    const user = mustFindUser(userID)
    user.roles = user.roles.filter((role) => !roleNames.includes(role))
  }

  async addDirectPermissionsToUser(userID: string, nextPermissions: string[]) {
    const user = mustFindUser(userID)
    user.direct_permissions = Array.from(new Set([...user.direct_permissions, ...nextPermissions]))
    return { message: 'Permissions added' }
  }

  async removeDirectPermissionsFromUser(userID: string, nextPermissions: string[]) {
    const user = mustFindUser(userID)
    user.direct_permissions = user.direct_permissions.filter((permission) => !nextPermissions.includes(permission))
  }

  async listRoles() {
    return structuredClone(roles)
  }

  async createRole(input: { name: string; description?: string }) {
    const role = { id: `role-${input.name}`, name: input.name, description: input.description ?? '', permissions: [] }
    roles.push(role)
    return role
  }

  async listPermissions() {
    return structuredClone(permissions)
  }

  async createPermission(input: { code: string; description?: string }) {
    const permission = { id: `perm-${input.code}`, code: input.code, description: input.description ?? '' }
    permissions.push(permission)
    return permission
  }

  async assignPermissionsToRole(roleID: string, permissionIDs: string[]) {
    const role = mustFindRole(roleID)
    role.permissions = permissions.filter((permission) => permissionIDs.includes(permission.id))
    return { message: 'Permissions assigned' }
  }

  async removePermissionsFromRole(roleID: string, permissionIDs: string[]) {
    const role = mustFindRole(roleID)
    role.permissions = role.permissions?.filter((permission) => !permissionIDs.includes(permission.id)) ?? []
  }

  async listOAuthClients() {
    return { clients: structuredClone(oauthClients), total: oauthClients.length }
  }

  async createOAuthClient(input: OAuthClientInput) {
    const client = {
      ...input,
      client_id: input.client_id || input.client_name.toLowerCase().replace(/\s+/g, '-'),
      is_active: true,
    }
    oauthClients.push(client)
    return client
  }

  async rotateOAuthClientSecret(clientID: string) {
    return { client_id: clientID, client_secret: 'mock-secret-shown-once' }
  }
}

function summaryFromDetail(user: AdminUserDetail): AdminUserSummary {
  const { direct_permissions: _directPermissions, linked_identities: _linkedIdentities, mfa: _mfa, ...summary } = user
  return summary
}

function mustFindUser(userID: string) {
  const user = users.find((item) => item.id === userID)
  if (!user) throw new Error('User not found')
  return user
}

function mustFindRole(roleID: string) {
  const role = roles.find((item) => item.id === roleID)
  if (!role) throw new Error('Role not found')
  return role
}
