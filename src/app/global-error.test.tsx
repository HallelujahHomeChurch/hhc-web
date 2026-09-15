import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/nextjs', () => ({captureException}))

import GlobalError from './global-error'

afterEach(() => vi.clearAllMocks())

describe('global error boundary', () => {
  it('reports the supplied render error', async () => {
    const error = new Error('render failed')

    render(<GlobalError error={error} reset={vi.fn()} />)

    await waitFor(() => expect(captureException).toHaveBeenCalledWith(error))
  })
})
