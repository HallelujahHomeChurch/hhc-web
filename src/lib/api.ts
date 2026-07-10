export type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type Profile = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  roles?: string[]
  permissions?: string[]
}

export type TokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

export type AdminUserSummary = {
  id: string
  email: string
  first_name?: string
  last_name?: string
  avatar_url?: string
  is_email_verified: boolean
  has_password: boolean
  is_active: boolean
  mfa_enabled: boolean
  roles: string[]
  linked_providers: string[]
  created_at?: string
  updated_at?: string
}

export type AdminUserDetail = AdminUserSummary & {
  direct_permissions: string[]
  linked_identities: Array<{ provider: string; created_at?: string }>
  mfa: { enabled: boolean; methods: Array<{ type: string; created_at?: string }> }
}

export type AdminUserListResponse = {
  users: AdminUserSummary[]
  total: number
  page: number
  per_page: number
}

export type Role = {
  id: string
  name: string
  description?: string
  permissions?: Permission[]
}

export type Permission = {
  id: string
  code: string
  description?: string
}

export type OAuthClient = {
  client_id: string
  client_name: string
  client_type: string
  redirect_uris: string[]
  allowed_scopes?: string[]
  description?: string
  is_active?: boolean
}

export type OAuthClientInput = {
  client_id?: string
  client_name: string
  client_type: string
  redirect_uris: string[]
  allowed_scopes: string[]
  description?: string
}

export type AdminApiOptions = {
  baseUrl: string
  fetcher?: Fetcher
  getAccessToken?: () => string | null
  setAccessToken?: (token: string | null) => void
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  retry?: boolean
  form?: URLSearchParams
}

export class ApiError extends Error {
  status: number
  code?: string
  data: unknown

  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.data = data
  }
}

export class AdminApi {
  private readonly baseUrl: string
  private readonly fetcher: Fetcher
  private readonly getAccessToken?: () => string | null
  private readonly setAccessToken?: (token: string | null) => void
  private csrfToken: string | null = null

  constructor(options: AdminApiOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis)
    this.getAccessToken = options.getAccessToken
    this.setAccessToken = options.setAccessToken
  }

  exchangeCode(input: {
    code: string
    codeVerifier: string
    clientId: string
    redirectUri: string
  }) {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      code_verifier: input.codeVerifier,
    })
    return this.request<TokenResponse>('/oauth/token', { method: 'POST', auth: false, form })
  }

  async refreshAccessToken() {
    try {
      const response = await this.request<TokenResponse>('/refresh', {
        method: 'POST',
        auth: false,
        retry: false,
        body: {},
      })
      const token = response.access_token ?? null
      this.setAccessToken?.(token)
      return token
    } catch {
      this.setAccessToken?.(null)
      return null
    }
  }

  me() {
    return this.request<Profile>('/me')
  }

  logout() {
    return this.request<void>('/logout', { method: 'POST', body: {} })
  }

  listUsers(params: {
    page?: number
    perPage?: number
    search?: string
    role?: string
    provider?: string
    emailVerified?: boolean
    mfaEnabled?: boolean
  } = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', String(params.page))
    if (params.perPage) query.set('per_page', String(params.perPage))
    if (params.search) query.set('search', params.search)
    if (params.role) query.set('role', params.role)
    if (params.provider) query.set('provider', params.provider)
    if (params.emailVerified !== undefined) query.set('email_verified', String(params.emailVerified))
    if (params.mfaEnabled !== undefined) query.set('mfa_enabled', String(params.mfaEnabled))

    return this.request<AdminUserListResponse>(`/admin/users${query.size ? `?${query}` : ''}`)
  }

  getUser(userID: string) {
    return this.request<AdminUserDetail>(`/admin/users/${encodeURIComponent(userID)}`)
  }

  assignRolesToUser(userID: string, roleIDs: string[]) {
    return this.request<{ message?: string }>(`/admin/users/${encodeURIComponent(userID)}/roles`, {
      method: 'POST',
      body: { role_ids: roleIDs },
    })
  }

  removeRolesFromUser(userID: string, roleIDs: string[]) {
    return this.request<void>(`/admin/users/${encodeURIComponent(userID)}/roles`, {
      method: 'DELETE',
      body: { role_ids: roleIDs },
    })
  }

  addDirectPermissionsToUser(userID: string, permissions: string[]) {
    return this.request<{ message?: string }>(`/admin/users/${encodeURIComponent(userID)}/permissions`, {
      method: 'POST',
      body: { permissions },
    })
  }

  removeDirectPermissionsFromUser(userID: string, permissions: string[]) {
    return this.request<void>(`/admin/users/${encodeURIComponent(userID)}/permissions`, {
      method: 'DELETE',
      body: { permissions },
    })
  }

  listRoles() {
    return this.request<Role[]>('/admin/rbac/roles')
  }

  createRole(input: { name: string; description?: string }) {
    return this.request<Role>('/admin/rbac/roles', { method: 'POST', body: input })
  }

  listPermissions() {
    return this.request<Permission[]>('/admin/rbac/permissions')
  }

  createPermission(input: { code: string; description?: string }) {
    return this.request<Permission>('/admin/rbac/permissions', { method: 'POST', body: input })
  }

  assignPermissionsToRole(roleID: string, permissionIDs: string[]) {
    return this.request<{ message?: string }>(`/admin/rbac/roles/${encodeURIComponent(roleID)}/permissions`, {
      method: 'POST',
      body: { permission_ids: permissionIDs },
    })
  }

  removePermissionsFromRole(roleID: string, permissionIDs: string[]) {
    return this.request<void>(`/admin/rbac/roles/${encodeURIComponent(roleID)}/permissions`, {
      method: 'DELETE',
      body: { permission_ids: permissionIDs },
    })
  }

  listOAuthClients() {
    return this.request<{ clients: OAuthClient[]; total: number }>('/admin/oauth-clients')
  }

  createOAuthClient(input: OAuthClientInput) {
    return this.request<OAuthClient>('/admin/oauth-clients', { method: 'POST', body: input })
  }

  rotateOAuthClientSecret(clientID: string) {
    return this.request<{ client_id: string; client_secret: string }>(
      `/admin/oauth-clients/${encodeURIComponent(clientID)}/rotate-secret`,
      { method: 'POST', body: {} },
    )
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const headers = new Headers()

    if (options.auth !== false) {
      const token = this.getAccessToken?.()
      if (token) headers.set('Authorization', `Bearer ${token}`)
    }

    let body: BodyInit | undefined
    if (options.form) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded')
      body = options.form
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    if (method !== 'GET' && !options.form) {
      headers.set('X-CSRF-Token', await this.getCSRFToken())
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers,
      body,
      credentials: 'include',
    })

    if (!response.ok) {
      throw await this.toApiError(response)
    }

    if (response.status === 204) return undefined as T
    const text = await response.text()
    return text ? JSON.parse(text) as T : undefined as T
  }

  private async getCSRFToken() {
    if (this.csrfToken) return this.csrfToken
    const response = await this.fetcher(`${this.baseUrl}/csrf-token`, {
      credentials: 'include',
    })
    if (!response.ok) throw await this.toApiError(response)
    const data = await response.json() as { csrf_token?: string }
    this.csrfToken = data.csrf_token ?? ''
    return this.csrfToken
  }

  private async toApiError(response: Response) {
    let data: unknown
    try {
      data = await response.json()
    } catch {
      data = undefined
    }

    const record = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return new ApiError(
      response.status,
      typeof record.message === 'string' ? record.message : response.statusText,
      typeof record.error_code === 'string' ? record.error_code : undefined,
      data,
    )
  }
}
