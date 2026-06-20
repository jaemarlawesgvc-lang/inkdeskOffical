import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata: Metadata = {
  title: 'Set new password',
  description: 'Choose a new password for your Inkquire account.',
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
