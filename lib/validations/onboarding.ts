import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export const RESERVED_USERNAMES = [
  'admin',
  'api',
  'dashboard',
  'login',
  'signup',
  'onboarding',
  'settings',
  'inkdesk',
  'www',
] as const

export const STYLE_TAG_OPTIONS = [
  'Traditional',
  'Neo-Traditional',
  'Japanese',
  'Blackwork',
  'Fine Line',
  'Realism',
  'Watercolour',
  'Geometric',
  'Tribal',
  'Illustrative',
] as const

export type StyleTag = (typeof STYLE_TAG_OPTIONS)[number]

// ---------------------------------------------------------------------------
// Step 1 — Username
// ---------------------------------------------------------------------------

export const step1Schema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(
      /^[a-z0-9-]+$/,
      'Username may only contain lowercase letters, numbers, and hyphens',
    )
    .refine(
      (val) => !RESERVED_USERNAMES.includes(val as (typeof RESERVED_USERNAMES)[number]),
      'That username is reserved',
    )
    .refine((val) => !val.startsWith('-'), 'Username cannot start with a hyphen')
    .refine((val) => !val.endsWith('-'), 'Username cannot end with a hyphen')
    .refine((val) => !val.includes('--'), 'Username cannot contain consecutive hyphens'),
})

export type Step1Values = z.infer<typeof step1Schema>

// ---------------------------------------------------------------------------
// Step 2 — Profile
// ---------------------------------------------------------------------------

export const step2Schema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters')
    .trim(),
  bio: z
    .string()
    .max(500, 'Bio must be at most 500 characters')
    .trim()
    .optional()
    .default(''),
  styleTags: z
    .array(z.enum(STYLE_TAG_OPTIONS))
    .min(1, 'Select at least one style')
    .max(10, 'Cannot select more than 10 styles'),
  instagramHandle: z
    .string()
    .trim()
    .optional()
    .default('')
    .transform((val) => (val ? val.replace(/^@/, '') : val))
    .refine(
      (val) => !val || /^[a-zA-Z0-9_.]{1,30}$/.test(val),
      'Invalid Instagram handle',
    ),
})

export type Step2Values = z.infer<typeof step2Schema>

// ---------------------------------------------------------------------------
// Step 3 — Portfolio Upload
// (client-side only; we validate file count/type; storage paths saved to DB)
// ---------------------------------------------------------------------------

export const portfolioImageMetaSchema = z.object({
  storagePath: z.string().min(1),
  publicUrl: z.string().url(),
  caption: z.string().max(200).optional().default(''),
  displayOrder: z.number().int().min(0),
})

export type PortfolioImageMeta = z.infer<typeof portfolioImageMetaSchema>

export const step3Schema = z.object({
  images: z
    .array(portfolioImageMetaSchema)
    .min(0, 'Portfolio images')
    .max(50, 'Maximum 50 portfolio images'),
})

export type Step3Values = z.infer<typeof step3Schema>

// ---------------------------------------------------------------------------
// Step 4 — Pricing & Availability
// ---------------------------------------------------------------------------

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:MM format'),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'End time must be in HH:MM format'),
})

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>

export const step4Schema = z
  .object({
    hourlyRate: z
      .number({ invalid_type_error: 'Hourly rate must be a number' })
      .positive('Hourly rate must be positive')
      .max(9999.99, 'Hourly rate too large')
      .nullable()
      .optional(),
    depositAmount: z
      .number({ invalid_type_error: 'Deposit amount must be a number' })
      .positive('Deposit amount must be positive')
      .max(9999.99, 'Deposit amount too large')
      .nullable()
      .optional(),
    depositRequired: z.boolean().default(true),
    timezone: z
      .string()
      .min(1, 'Timezone is required')
      .refine(
        (tz) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: tz })
            return true
          } catch {
            return false
          }
        },
        'Invalid timezone',
      ),
    availability: z
      .array(availabilitySlotSchema)
      .refine(
        (slots) => {
          const days = slots.map((s) => s.dayOfWeek)
          return new Set(days).size === days.length
        },
        'Duplicate day entries in availability',
      )
      .refine(
        (slots) =>
          slots.every((slot) => {
            const [sh, sm] = slot.startTime.split(':').map(Number)
            const [eh, em] = slot.endTime.split(':').map(Number)
            return (sh ?? 0) * 60 + (sm ?? 0) < (eh ?? 0) * 60 + (em ?? 0)
          }),
        'End time must be after start time for all slots',
      ),
  })
  .refine(
    (data) => {
      if (data.depositRequired && !data.depositAmount) return false
      return true
    },
    {
      message: 'Deposit amount is required when deposit is required',
      path: ['depositAmount'],
    },
  )

export type Step4Values = z.infer<typeof step4Schema>

// ---------------------------------------------------------------------------
// Step 5 — Generate Site (no user input; just triggers generation)
// ---------------------------------------------------------------------------

export const step5Schema = z.object({
  siteGenerated: z.boolean(),
})

export type Step5Values = z.infer<typeof step5Schema>

// ---------------------------------------------------------------------------
// Combined save-step API payload schemas
// ---------------------------------------------------------------------------

export const saveStep1Payload = step1Schema
export const saveStep2Payload = step2Schema
export const saveStep3Payload = step3Schema
export const saveStep4Payload = step4Schema

export type SaveStep1Payload = z.infer<typeof saveStep1Payload>
export type SaveStep2Payload = z.infer<typeof saveStep2Payload>
export type SaveStep3Payload = z.infer<typeof saveStep3Payload>
export type SaveStep4Payload = z.infer<typeof saveStep4Payload>
