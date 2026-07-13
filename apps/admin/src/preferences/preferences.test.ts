import { describe, expect, it } from 'vitest'

import { applyTheme, getInitialLocale, getInitialTheme } from './preferences'

describe('shared account preferences', () => {
  it('reads supported locale and theme cookies', () => {
    const cookie = 'hhc_locale=zh-Hant; hhc_theme=dark'

    expect(getInitialLocale(cookie, ['en-US'])).toBe('zh-Hant')
    expect(getInitialTheme(cookie, false)).toBe('dark')
  })

  it('falls back to browser preferences', () => {
    expect(getInitialLocale('', ['zh-CN'])).toBe('zh-Hans')
    expect(getInitialTheme('', true)).toBe('dark')
  })

  it('applies a before-paint compatible root theme', () => {
    applyTheme('dark')

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveClass('dark')
  })
})
