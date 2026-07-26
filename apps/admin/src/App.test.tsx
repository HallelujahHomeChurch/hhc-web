import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { MockAdminApi } from './lib/mock-api'
import { MockCmsApi } from './lib/mock-cms-api'

afterEach(() => {
  vi.restoreAllMocks()
	vi.unstubAllGlobals()
	sessionStorage.clear()
})

describe('App', () => {
	it('automatically starts Account authorization when the admin host has no session', async () => {
		const fetcher = vi.fn()
			.mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: 'csrf' }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ error_code: 'ACC_AUTH_REFRESH_TOKEN_REQUIRED' }), { status: 400 }))
		vi.stubGlobal('fetch', fetcher)
		const navigateExternal = vi.fn()
		window.history.pushState({}, '', '/users?page=2#detail')

		render(<App
			config={{
				accountAuthorizeBaseUrl: 'https://account.alive.org.tw/api/account/v1',
				redirectUri: 'http://localhost:5175/oauth/callback',
				mockApi: false,
			}}
			navigateExternal={navigateExternal}
		/>)

		await vi.waitFor(() => expect(navigateExternal).toHaveBeenCalledOnce())
		const authorize = new URL(navigateExternal.mock.calls[0][0])
		expect(authorize.origin).toBe('https://account.alive.org.tw')
		expect(authorize.searchParams.get('client_id')).toBe('admin-web')
		expect(screen.queryByText('Sign in required')).not.toBeInTheDocument()
		expect(sessionStorage.getItem('hhc_admin_oauth_transaction')).toContain('/users?page=2#detail')
	})

	it('keeps the authenticated console visible when global sign-out fails', async () => {
		vi.spyOn(MockAdminApi.prototype, 'logoutAll').mockRejectedValueOnce(new Error('unavailable'))
		window.history.pushState({}, '', '/')
		render(<App config={{ mockApi: true }} />)

		await userEvent.click(await screen.findByRole('button', { name: /account menu/i }))
		await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))

		expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign out. Try again.')
		expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
	})

	it('leaves the console only after global sign-out succeeds', async () => {
		const navigateExternal = vi.fn()
		window.history.pushState({}, '', '/')
		render(<App config={{ mockApi: true }} navigateExternal={navigateExternal} />)

		await userEvent.click(await screen.findByRole('button', { name: /account menu/i }))
		await userEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))

		await vi.waitFor(() => expect(navigateExternal).toHaveBeenCalledWith(
			'http://localhost:5173/login?signed_out=1',
			true,
		))
	})

	it('shows a recoverable OAuth callback error', async () => {
		window.history.pushState({}, '', '/oauth/callback?error=access_denied&state=state-value')
		render(<App config={{ mockApi: true }} />)

		expect(await screen.findByRole('heading', { name: 'Cannot sign in' })).toBeInTheDocument()
		expect(screen.getByText('Sign in was cancelled.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
	})
  it('enters the protected console after mocked sign-in', async () => {
    window.history.pushState({}, '', '/login')
    render(<App config={{ mockApi: true }} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Continue with HHC account' }))
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('renders the protected admin shell with a dismissible avatar menu', async () => {
    window.history.pushState({}, '', '/')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { name: /^overview$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /roles & permissions/i })).toBeInTheDocument()
    const navigation = screen.getByRole('navigation', { name: 'Admin' })
    expect(Array.from(navigation.querySelectorAll('.sidebar-nav-group-label'), (element) => element.textContent)).toContain('Website content')
    expect(screen.queryByText('CMS')).not.toBeInTheDocument()
    expect(screen.queryByText('admin@alive.org.tw')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
    expect(await screen.findByText('Hi HHC Admin')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Manage account' })).toHaveAttribute(
      'href',
      'http://localhost:5173/profile',
    )

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Hi HHC Admin')).not.toBeInTheDocument()
  })

  it('opens and dismisses the mobile admin navigation drawer', async () => {
    window.history.pushState({}, '', '/')
    render(<App config={{ mockApi: true }} />)

    await userEvent.click(await screen.findByRole('button', { name: /open navigation/i }))
    expect(await screen.findByRole('dialog', { name: /admin navigation/i })).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /admin navigation/i })).not.toBeInTheDocument()
  })

  it('uses the shared locale for the brand and canonical legal links', async () => {
    document.cookie = 'hhc_locale=zh-Hant; Path=/'
    window.history.pushState({}, '', '/')
    render(<App config={{ mockApi: true }} />)

    expect((await screen.findAllByText('HHC 管理中心')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Hallelujah Home Church')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '隱私權' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/zh-Hant/privacy-policy',
    )
    expect(screen.getByRole('link', { name: '條款' })).toHaveAttribute(
      'href',
      'https://www.alive.org.tw/zh-Hant/terms-of-use',
    )
    expect(screen.getByRole('button', { name: '帳號選單' }).querySelector('.hhc-avatar')).toBeInTheDocument()
  })

  it.each([
    ['/', 'Overview'],
    ['/users', 'Users'],
    ['/access', 'Roles & permissions'],
    ['/oauth-clients', 'OAuth clients'],
    ['/content/bulletins', 'Weekly bulletins'],
    ['/content/news', 'Latest news'],
    ['/content/history', 'History'],
    ['/content/videos', 'Kingdom Joy'],
  ])('uses the nav label as the page h1 for %s', async (path, title) => {
    window.history.pushState({}, '', path)
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('keeps role creation in a dialog', async () => {
    window.history.pushState({}, '', '/access')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { name: 'Roles & permissions' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Role name')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create role/i }))
    await userEvent.type(await screen.findByLabelText('Role name'), 'publisher')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    expect(await screen.findByText('Role created.')).toBeInTheDocument()
    expect(await screen.findByText('publisher')).toBeInTheDocument()
  })

  it('uses dialogs for OAuth client creation and secret rotation', async () => {
    window.history.pushState({}, '', '/oauth-clients')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { name: 'OAuth clients' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Client name')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create client/i }))
    await userEvent.type(await screen.findByLabelText('Client name'), 'CMS Console')
    await userEvent.type(screen.getByLabelText('Redirect URI'), 'https://cms.alive.org.tw/oauth/callback')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))
    expect(await screen.findByText('CMS Console')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /^rotate$/i })[0])
    expect(await screen.findByRole('heading', { name: 'Rotate client secret' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^rotate secret$/i }))
    expect(await screen.findByText(/new secret:/i)).toBeInTheDocument()
  })

  it('shows a retry action when the user directory fails to load', async () => {
    const listUsers = vi
      .spyOn(MockAdminApi.prototype, 'listUsers')
      .mockRejectedValueOnce(new Error('Directory unavailable'))
      .mockResolvedValueOnce({ users: [], total: 0, page: 1, per_page: 20 })

    window.history.pushState({}, '', '/users')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByText('Unable to load users.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(listUsers).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('No users match these filters.')).toBeInTheDocument()
  })

  it('paginates the user directory using the API total', async () => {
    const listUsers = vi.spyOn(MockAdminApi.prototype, 'listUsers').mockImplementation(async ({ page = 1 } = {}) => ({
      users: [{
        id: `user-${page}`,
        email: `page-${page}@example.com`,
        is_email_verified: true,
        has_password: true,
        is_active: true,
        mfa_enabled: false,
        roles: ['user'],
        linked_providers: [],
      }],
      total: 41,
      page,
      per_page: 20,
    }))
    vi.spyOn(MockAdminApi.prototype, 'getUser').mockImplementation(async (userID) => ({
      id: userID,
      email: `${userID.replace('user-', 'page-')}@example.com`,
      is_email_verified: true,
      has_password: true,
      is_active: true,
      mfa_enabled: false,
      roles: ['user'],
      linked_providers: [],
      direct_permissions: [],
      linked_identities: [],
      mfa: { enabled: false, methods: [] },
    }))

    window.history.pushState({}, '', '/users')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByText('page-1@example.com')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect((await screen.findAllByText('page-2@example.com')).length).toBeGreaterThan(0)
    expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, perPage: 20 }))
  })

  it('restores user directory filters and pagination from the URL', async () => {
    const listUsers = vi.spyOn(MockAdminApi.prototype, 'listUsers')

    window.history.pushState({}, '', '/users?search=ada&role=admin&page=2&per_page=50')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByDisplayValue('ada')).toBeInTheDocument()
    expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      perPage: 50,
      role: 'admin',
      search: 'ada',
    }))
  })

  it('stores user search state in the URL and exposes a keyboard-safe row action', async () => {
    window.history.pushState({}, '', '/users')
    render(<App config={{ mockApi: true }} />)

    const search = await screen.findByPlaceholderText('Search email or name')
    await userEvent.type(search, 'admin')

    await vi.waitFor(() => expect(window.location.search).toContain('search=admin'))
    expect(await screen.findByRole('button', { name: 'View admin@alive.org.tw' })).toBeInTheDocument()
  })

  it('does not let a stale user search replace the latest result', async () => {
    let resolveInitial: ((value: Awaited<ReturnType<MockAdminApi['listUsers']>>) => void) | undefined
    const initial = new Promise<Awaited<ReturnType<MockAdminApi['listUsers']>>>((resolve) => {
      resolveInitial = resolve
    })
    vi.spyOn(MockAdminApi.prototype, 'listUsers')
      .mockReturnValueOnce(initial)
      .mockResolvedValue({
        users: [{
          id: 'latest-user', email: 'latest@example.com', is_email_verified: true, has_password: true,
          is_active: true, mfa_enabled: false, roles: ['user'], linked_providers: [],
        }],
        total: 1,
        page: 1,
        per_page: 20,
      })

    window.history.pushState({}, '', '/users')
    render(<App config={{ mockApi: true }} />)

    await userEvent.type(await screen.findByPlaceholderText('Search email or name'), 'latest')
    expect(await screen.findByText('latest@example.com')).toBeInTheDocument()

    resolveInitial?.({
      users: [{
        id: 'stale-user', email: 'stale@example.com', is_email_verified: true, has_password: true,
        is_active: true, mfa_enabled: false, roles: ['user'], linked_providers: [],
      }],
      total: 1,
      page: 1,
      per_page: 20,
    })

    await Promise.resolve()
    expect(screen.queryByText('stale@example.com')).not.toBeInTheDocument()
    expect(screen.getByText('latest@example.com')).toBeInTheDocument()
  })

  it('recovers when access data fails to load', async () => {
    const listRoles = vi.spyOn(MockAdminApi.prototype, 'listRoles').mockRejectedValueOnce(new Error('unavailable'))
    window.history.pushState({}, '', '/access')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByText('Unable to load access data.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(listRoles).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('admin')).toBeInTheDocument()
  })

  it('recovers when OAuth clients fail to load', async () => {
    const listClients = vi.spyOn(MockAdminApi.prototype, 'listOAuthClients').mockRejectedValueOnce(new Error('unavailable'))
    window.history.pushState({}, '', '/oauth-clients')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByText('Unable to load OAuth clients.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(listClients).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('Admin Console')).toBeInTheDocument()
  })

	it('creates a weekly bulletin issue from the content workspace', async () => {
		window.history.pushState({}, '', '/content/bulletins')
		render(<App config={{ mockApi: true }} />)

		expect(await screen.findByRole('heading', { level: 1, name: 'Weekly bulletins' })).toBeInTheDocument()
		expect((await screen.findAllByText('2026-07-13')).length).toBeGreaterThan(0)
		await userEvent.click(screen.getByRole('button', { name: 'Create issue' }))
		await userEvent.type(await screen.findByLabelText('Issue date'), '2026-07-20')
		await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

		expect((await screen.findAllByText('2026-07-20')).length).toBeGreaterThan(0)
	})

	it('restores bulletin filters and pagination from the URL', async () => {
		const listBulletins = vi.spyOn(MockCmsApi.prototype, 'listBulletins')
		window.history.pushState({}, '', '/content/bulletins?status=published&page=2&page_size=50')
		render(<App config={{ mockApi: true }} />)

		await screen.findByRole('heading', { level: 1, name: 'Weekly bulletins' })
		expect(listBulletins).toHaveBeenCalledWith(expect.objectContaining({
			page: 2,
			pageSize: 50,
			status: 'published',
		}))
	})

	it('uses a button to select a weekly bulletin', async () => {
		window.history.pushState({}, '', '/content/bulletins')
		render(<App config={{ mockApi: true }} />)

		expect(await screen.findByRole('button', { name: 'View bulletin 2026-07-13' })).toBeInTheDocument()
	})

	it('uploads and publishes a localized weekly bulletin', async () => {
		const createUpload = vi.spyOn(MockCmsApi.prototype, 'createBulletinUpload')
		const completeUpload = vi.spyOn(MockCmsApi.prototype, 'completeBulletinUpload')
		const publish = vi.spyOn(MockCmsApi.prototype, 'publishBulletin')
		window.history.pushState({}, '', '/content/bulletins')
		render(<App config={{ mockApi: true }} />)

		await screen.findByRole('heading', { level: 1, name: 'Weekly bulletins' })
		await userEvent.click(await screen.findByRole('button', { name: 'Upload PDF for English' }))
		const file = new File(['%PDF-1.4\n%%EOF'], 'weekly-en.pdf', { type: 'application/pdf' })
		await userEvent.upload(await screen.findByLabelText('PDF file'), file)
		await userEvent.type(screen.getByLabelText('Title'), 'Weekly bulletin')
		await userEvent.click(screen.getByRole('button', { name: 'Upload and attach' }))

		expect(createUpload).toHaveBeenCalled()
		expect(completeUpload).toHaveBeenCalled()
		await userEvent.click(await screen.findByRole('button', { name: 'Publish English' }))
		expect(await screen.findByRole('heading', { name: 'Publish English bulletin?' })).toBeInTheDocument()
		await userEvent.click(screen.getByRole('button', { name: /^publish$/i }))
		expect(publish).toHaveBeenCalled()
		expect(await screen.findByText('Publication started.')).toBeInTheDocument()
	})

	it('retries a failed bulletin unpublish instead of offering publish', async () => {
		const unpublish = vi.spyOn(MockCmsApi.prototype, 'unpublishBulletin')
		window.history.pushState({}, '', '/content/bulletins')
		render(<App config={{ mockApi: true }} />)

		await userEvent.click(await screen.findByRole('button', { name: 'View bulletin 2026-06-29' }))
		await userEvent.click(await screen.findByRole('button', { name: 'Retry unpublish English' }))
		expect(await screen.findByRole('heading', { name: 'Unpublish English bulletin?' })).toBeInTheDocument()
		await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }))

		expect(unpublish).toHaveBeenCalled()
		expect(await screen.findByText('Unpublishing started.')).toBeInTheDocument()
	})

  it('creates a typed video draft from the editorial workspace', async () => {
    const createContent = vi.spyOn(MockCmsApi.prototype, 'createContent')
    window.history.pushState({}, '', '/content/videos')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Kingdom Joy' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    await userEvent.type(screen.getByLabelText('YouTube video ID'), 'g2sP4m4T2Y0')
    await userEvent.type(screen.getByLabelText('Title'), '驚天動地')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(createContent).toHaveBeenCalledWith('videos', expect.objectContaining({
      youtubeVideoId: 'g2sP4m4T2Y0',
      translations: [expect.objectContaining({ locale: 'zh-Hant', title: '驚天動地' })],
    }), expect.any(String))
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
  })

  it('requires confirmation before changing content publication', async () => {
    const unpublish = vi.spyOn(MockCmsApi.prototype, 'unpublishContent')
    window.history.pushState({}, '', '/content/history')
    render(<App config={{ mockApi: true }} />)

    await screen.findByRole('heading', { level: 1, name: 'History' })
    await userEvent.click(await screen.findByRole('button', { name: 'Unpublish' }))
    expect(await screen.findByRole('alertdialog', { name: 'Unpublish this content?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Unpublish' }))
    expect(unpublish).toHaveBeenCalled()
  })

  it('uploads a news cover through the coordinated asset flow', async () => {
    const createUpload = vi.spyOn(MockCmsApi.prototype, 'createNewsCoverUpload')
    const completeUpload = vi.spyOn(MockCmsApi.prototype, 'completeNewsCoverUpload')
    window.history.pushState({}, '', '/content/news')
    render(<App config={{ mockApi: true }} />)

    await screen.findByRole('heading', { level: 1, name: 'Latest news' })
    await userEvent.upload(screen.getByLabelText('Cover image'), new File(['image'], 'cover.jpg', { type: 'image/jpeg' }))

    expect(createUpload).toHaveBeenCalled()
    expect(completeUpload).toHaveBeenCalled()
    expect(await screen.findByText(/Security scanning and image processing are in progress/)).toBeInTheDocument()
  })
})
