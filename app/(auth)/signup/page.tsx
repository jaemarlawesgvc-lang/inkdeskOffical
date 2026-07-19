import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Create account',
  description:
    'Create your free Inkquire account. No credit card required.',
}

interface SignupPageProps {
  searchParams: { email?: string }
}

export default function SignupPage({ searchParams }: SignupPageProps) {
  return <SignupForm defaultEmail={searchParams.email} />
}
