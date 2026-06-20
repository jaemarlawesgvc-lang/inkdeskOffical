import type { Metadata } from 'next'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Inkquire account.',
}

interface LoginPageProps {
  searchParams: {
    message?: string
    error?: string
    next?: string
  }
}

// URL → human-readable messages
const SUCCESS_MESSAGES: Record<string, string> = {
  password_updated: 'Your password has been updated. Please sign in.',
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback: 'Authentication failed. Please try again.',
  oauth_failed:  'Could not connect to Google. Please try again or use email and password.',
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const successMessage = searchParams.message
    ? (SUCCESS_MESSAGES[searchParams.message] ?? null)
    : null

  const errorMessage = searchParams.error
    ? (ERROR_MESSAGES[searchParams.error] ?? null)
    : null

  return (
    <LoginForm
      successMessage={successMessage}
      errorMessage={errorMessage}
    />
  )
}
