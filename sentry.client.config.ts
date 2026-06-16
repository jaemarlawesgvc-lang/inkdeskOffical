import * as Sentry from '@sentry/nextjs'
import { clientEnv } from './lib/env.client'

Sentry.init({
  dsn: clientEnv.sentryDsn,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
})
