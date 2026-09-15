import * as Sentry from '@sentry/nextjs'
import type { Breadcrumb } from '@sentry/nextjs'

const sensitiveValue = /\b(code|token|access_token|refresh_token|id_token|verification_token|reset_token|sig|signature)=([^\s&#]+)/gi
const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const absoluteUrl = /https?:\/\/[^\s"'<>]+/gi

function sanitizeText(value: string) {
  return value
    .replace(absoluteUrl, (candidate) => {
      try {
        const url = new URL(candidate)
        return `${url.origin}${url.pathname}`
      } catch {
        return '[redacted-url]'
      }
    })
    .replace(email, '[redacted-email]')
    .replace(sensitiveValue, '$1=[redacted]')
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[truncated]'
  if (typeof value === 'string') return sanitizeText(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
  )
}

export function sanitizeSentryEvent(event: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeValue(event) as Record<string, unknown>
  delete sanitized.user

  const request = event.request
  if (request && typeof request === 'object' && 'url' in request && typeof request.url === 'string') {
    try {
      const url = new URL(request.url)
      sanitized.request = { url: `${url.origin}${url.pathname}` }
    } catch {
      delete sanitized.request
    }
  } else {
    delete sanitized.request
  }

  return sanitized
}

export const sanitizeBreadcrumb = (breadcrumb: Breadcrumb) => sanitizeValue(breadcrumb) as Breadcrumb

type ErrorContext = {
  operation: string
  level?: 'warning' | 'error'
  tags?: Record<string, string | number | boolean | null | undefined>
}

export function errorTags(error: unknown) {
  if (!error || typeof error !== 'object') return {}
  const value = error as { status?: unknown; code?: unknown }
  return {
    ...(typeof value.status === 'number' ? { status: value.status } : {}),
    ...(typeof value.code === 'string' ? { code: value.code } : {}),
  }
}

export function captureHandledError(error: unknown, { operation, level = 'error', tags = {} }: ErrorContext) {
  return Sentry.withScope((scope) => {
    scope.setLevel(level)
    scope.setTag('operation', operation)
    for (const [key, value] of Object.entries(tags)) {
      if (value !== undefined && value !== null) scope.setTag(key.slice(0, 64), String(value).slice(0, 200))
    }
    return Sentry.captureException(error instanceof Error ? error : new Error(String(error)))
  })
}
