'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: {error: Error & {digest?: string}; reset: () => void}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="zh-Hant">
      <body className="grid min-h-screen place-items-center bg-paper px-6 text-ink">
        <main className="grid justify-items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold">頁面暫時無法載入</h1>
          <p className="text-muted">請稍後再試。</p>
          <button type="button" onClick={reset} className="min-h-11 rounded-full bg-primary-solid px-5 font-semibold text-primary-foreground">
            再試一次
          </button>
        </main>
      </body>
    </html>
  )
}
