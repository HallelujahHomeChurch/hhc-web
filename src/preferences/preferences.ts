export const locales = ['zh-Hant', 'zh-Hans', 'en'] as const
export const themes = ['light', 'dark'] as const

export type Locale = (typeof locales)[number]
export type Theme = (typeof themes)[number]

function cookieValue(cookie: string, name: string) {
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase()
    if (normalized.startsWith('zh-cn') || normalized.startsWith('zh-sg') || normalized.startsWith('zh-hans')) {
      return 'zh-Hans'
    }
    if (normalized.startsWith('zh')) return 'zh-Hant'
    if (normalized.startsWith('en')) return 'en'
  }

  return 'en'
}

export function getInitialLocale(cookie: string, languages: readonly string[]): Locale {
  const value = cookieValue(cookie, 'hhc_locale')
  return locales.includes(value as Locale) ? (value as Locale) : detectLocale(languages)
}

export function getInitialTheme(cookie: string, prefersDark: boolean): Theme {
  const value = cookieValue(cookie, 'hhc_theme')
  return themes.includes(value as Theme) ? (value as Theme) : prefersDark ? 'dark' : 'light'
}

export function applyTheme(theme: Theme, root = document.documentElement) {
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}
