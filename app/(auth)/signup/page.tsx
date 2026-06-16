import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Create account',
  description:
    'Create your free InkDesk account. No credit card required.',
}

export default function SignupPage() {
  return <SignupForm />
}
