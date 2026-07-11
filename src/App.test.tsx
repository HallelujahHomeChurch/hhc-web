import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('renders the protected admin shell with a dismissible avatar menu', async () => {
    window.history.pushState({}, '', '/')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { name: /^overview$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /access/i })).toBeInTheDocument()
    expect(screen.queryByText('admin@alive.org.tw')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /account menu/i }))
    expect(await screen.findByText('Hi HHC Admin')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Hi HHC Admin')).not.toBeInTheDocument()
  })

  it.each([
    ['/', 'Overview'],
    ['/users', 'Users'],
    ['/access', 'Access'],
    ['/oauth-clients', 'OAuth clients'],
    ['/cms', 'CMS'],
  ])('uses the nav label as the page h1 for %s', async (path, title) => {
    window.history.pushState({}, '', path)
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  it('keeps role creation in a dialog', async () => {
    window.history.pushState({}, '', '/access')
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { name: 'Access' })).toBeInTheDocument()
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
})
