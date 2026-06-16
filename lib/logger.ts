import * as Sentry from '@sentry/nextjs'

interface LogData {
  event: string
  [key: string]: unknown
}

export const logger = {
  info: (message: string, data?: LogData) => {
    console.log(JSON.stringify({ level: 'info', message, ...data }))
  },
  warn: (message: string, data?: LogData) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...data }))
    Sentry.captureMessage(message, { level: 'warning', extra: data })
  },
  error: (message: string, error?: Error | unknown, data?: LogData) => {
    console.error(JSON.stringify({ level: 'error', message, error, ...data }))
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: data })
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: { error, ...data } })
    }
  },
}
