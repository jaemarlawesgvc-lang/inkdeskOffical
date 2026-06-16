'use server'

import { redirect } from 'next/navigation'
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { env } from '@/lib/env'

interface AuthState {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}


export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return {
      success: false,
      message: 'Invalid email or password.',
    }
  }

  redirect('/dashboard')
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return {
      success: false,
      message: 'Unable to create your account. Please try again.',
    }
  }

  return {
    success: true,
    message:
      "Check your inbox — we've sent a confirmation link. You can close this tab.",
  }
}

export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get('email'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = createSupabaseServerClient()

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?type=recovery`,
  })

  return {
    success: true,
    message:
      "If an account exists with that email, you will receive a reset link shortly. Check your spam folder if it doesn't arrive within a few minutes.",
  }
}

export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  })

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return {
      success: false,
      message:
        'Unable to update your password. Your reset link may have expired — please request a new one.',
    }
  }

  await supabase.auth.signOut({ scope: 'others' })

  redirect('/login?message=password_updated')
}

export async function signInWithGoogle(_formData: FormData): Promise<void> {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    redirect('/login?error=oauth_failed')
  }

  redirect(data.url)
}