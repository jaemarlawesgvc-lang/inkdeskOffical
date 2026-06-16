'use server'

import { z } from 'zod'
import { Resend } from 'resend'
import { env } from '@/lib/env'

// ─── Schema ───────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name:    z.string().min(2,  'Name must be at least 2 characters.'),
  email:   z.string().email('Please enter a valid email address.'),
  subject: z.string().min(5,  'Subject must be at least 5 characters.'),
  message: z
    .string()
    .min(20,  'Message must be at least 20 characters.')
    .max(2000, 'Message must be 2000 characters or fewer.'),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactState {
  success:  boolean
  message:  string
  errors?:  Partial<Record<keyof z.infer<typeof contactSchema>, string[]>>
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function submitContact(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // 1. Validate
  const raw = {
    name:    formData.get('name'),
    email:   formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
  }

  const parsed = contactSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      success: false,
      message: 'Please fix the errors below.',
      errors:  parsed.error.flatten().fieldErrors,
    }
  }

  const { name, email, subject, message } = parsed.data

  // 2. Send via Resend
  const resend = new Resend(env.RESEND_API_KEY)

  const { error } = await resend.emails.send({
    from:      env.RESEND_FROM_EMAIL,
    to:        env.RESEND_FROM_EMAIL,
    reply_to:  email,
    subject:   `InkDesk contact: ${subject}`,
    text:    `From: ${name} <${email}>\n\n${message}`,
  })

  if (error) {
    console.error('[contact] Resend error:', error)
    return {
      success: false,
      message: 'Something went wrong sending your message. Please try again or email us directly.',
    }
  }

  return {
    success: true,
    message: "Thanks for reaching out. We'll get back to you within 48 hours.",
  }
}
