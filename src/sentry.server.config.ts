import * as Sentry from '@sentry/nextjs'

import { sanitizeBreadcrumb, sanitizeSentryEvent, sanitizeSentrySpan } from './lib/observability'
import { contentServerTracing } from './features/content/server-tracing'

const dsn = (process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN)?.trim()

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    ...contentServerTracing(),
    beforeSend: (event) => sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    beforeSendSpan: Sentry.withStreamedSpan((span) => sanitizeSentrySpan(span as unknown as Record<string, unknown>) as unknown as typeof span),
    beforeSendTransaction: (event) => sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    beforeBreadcrumb: sanitizeBreadcrumb,
  })
}
