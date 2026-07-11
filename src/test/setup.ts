import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  window.history.pushState({}, '', '/')
  document.cookie = 'hhc_locale=; Max-Age=0; Path=/'
  document.cookie = 'hhc_theme=; Max-Age=0; Path=/'
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})
