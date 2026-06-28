'use server'

import { z } from 'zod'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'

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
    subject:   `Inkquire contact: ${subject}`,
    text:    `From: ${name} <${email}>\n\n${message}`,
  })

  if (error) {
    console.error('[contact] Resend error:', error)
    return {
      success: false,
      message: 'Something went wrong sending your message. Please try again or email us directly.',
    }
  }

  // Auto-reply to the person who submitted
  const appUrl = getAppUrl()
  const autoReplyHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Inkquire</title></head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e5e5e5;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background-color:#171717;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #262626;">
  <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Inkquire</span>
</td></tr>
<tr><td style="padding:32px;">
  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;">We got your message</h1>
  <p style="margin:0 0 24px;font-size:15px;color:#a3a3a3;line-height:1.5;">
    Hi ${name}, thanks for reaching out. We&rsquo;ll get back to you within 48 hours.
  </p>
  <div style="background-color:#262626;border-radius:8px;padding:16px;margin-bottom:24px;">
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.5px;">Your message</p>
    <p style="margin:0;font-size:14px;color:#e5e5e5;line-height:1.5;white-space:pre-wrap;">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
  </div>
  <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.5;">
    Need to add anything or have a follow-up question? Reply to this email or use the button below to send us another message.
  </p>
  <a href="${appUrl}/contact" style="display:inline-block;padding:12px 24px;background-color:#ffffff;color:#000000;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Message us again</a>
</td></tr>
<tr><td style="padding:24px 32px;border-top:1px solid #262626;text-align:center;">
  <p style="margin:0;font-size:12px;color:#737373;line-height:1.5;">&copy; ${new Date().getFullYear()} Inkquire. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  await resend.emails.send({
    from:    env.RESEND_FROM_EMAIL,
    to:      email,
    subject: `We received your message — Inkquire`,
    html:    autoReplyHtml,
  })

  return {
    success: true,
    message: "Thanks for reaching out. We'll get back to you within 48 hours.",
  }
}
