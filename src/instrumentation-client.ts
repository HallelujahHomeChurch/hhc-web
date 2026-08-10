import * as Sentry from '@sentry/react'

import { sanitizeBreadcrumb, sanitizeSentryEvent } from './lib/observability'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    tracePropagationTargets: [/^\/api\//, /^https:\/\/(?:www|account|admin)\.alive\.org\.tw\/api\//],
    beforeSend: (event) => sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    beforeSendTransaction: (event) => sanitizeSentryEvent(event as unknown as Record<string, unknown>) as unknown as typeof event,
    beforeBreadcrumb: sanitizeBreadcrumb,
  })
}
