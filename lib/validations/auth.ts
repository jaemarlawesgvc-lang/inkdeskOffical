import { z } from 'zod'

// ─── Shared field schemas ──────────────────────────────────────────────────────

/** Normalised to lowercase; validated as a proper RFC-5321 address. */
const emailField = z
  .string({ required_error: 'Email is required.' })
  .email('Please enter a valid email address.')
  .toLowerCase()
  .trim()

/**
 * Password rules:
 *   - Minimum 8 characters (NIST SP 800-63B §5.1.1)
 *   - Maximum 72 characters (bcrypt input limit)
 */
const passwordField = z
  .string({ required_error: 'Password is required.' })
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be 72 characters or fewer.')

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailField,
  // Accept any non-empty string — let the API return the auth error.
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.'),
})

export const signupSchema = z.object({
  fullName: z
    .string({ required_error: 'Your name is required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be 100 characters or fewer.')
    .trim(),
  email: emailField,
  password: passwordField,
})

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z
  .object({
    password:        passwordField,
    confirmPassword: z.string({ required_error: 'Please confirm your password.' }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match.",
    path:    ['confirmPassword'],
  })

// ─── Inferred types ───────────────────────────────────────────────────────────

export type LoginInput         = z.infer<typeof loginSchema>
export type SignupInput         = z.infer<typeof signupSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput  = z.infer<typeof resetPasswordSchema>
