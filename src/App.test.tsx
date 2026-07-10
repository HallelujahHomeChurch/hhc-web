import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('renders the admin dashboard with mock auth enabled', async () => {
    render(<App config={{ mockApi: true }} />)

    expect(await screen.findByRole('heading', { name: /^admin console$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /users/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /access/i })).toBeInTheDocument()
  })
})
