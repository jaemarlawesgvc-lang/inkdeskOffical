import { z } from 'zod'

// ---------------------------------------------------------------------------
// Check availability
// ---------------------------------------------------------------------------

export const checkAvailabilitySchema = z.object({
  artistId: z.string().uuid('Invalid artist ID'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
})

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>

// ---------------------------------------------------------------------------
// Create hold
// ---------------------------------------------------------------------------

export const createHoldSchema = z.object({
  artistId: z.string().uuid('Invalid artist ID'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  sessionId: z
    .string()
    .min(8, 'Session ID must be at least 8 characters')
    .max(128, 'Session ID too long'),
  // Optional: reserve the slot for a specific service's duration (not the
  // 30-min consultation default). The server resolves the real duration from
  // the services table — the client cannot dictate the reserved length.
  serviceId: z.string().uuid('Invalid service ID').optional(),
})

export type CreateHoldInput = z.infer<typeof createHoldSchema>

// ---------------------------------------------------------------------------
// Submit booking
// ---------------------------------------------------------------------------

export const submitBookingSchema = z.object({
  artistId: z.string().uuid('Invalid artist ID'),
  holdId: z.string().uuid('Invalid hold ID'),
  sessionId: z.string().min(8),
  clientName: z
    .string()
    .min(1, 'Name is required')
    .max(200, 'Name too long')
    .trim(),
  clientEmail: z.string().email('Invalid email address'),
  clientPhone: z
    .string()
    .max(30, 'Phone number too long')
    .trim()
    .optional()
    .default(''),
  bookingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  bookingTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')
    .optional(),
  durationHours: z
    .number()
    .positive('Duration must be positive')
    .max(24, 'Duration too long')
    .optional(),
  description: z
    .string()
    .max(2000, 'Description too long')
    .trim()
    .optional()
    .default(''),
  referenceImagePaths: z
    .array(z.string().min(1))
    .max(10, 'Maximum 10 reference images')
    .optional()
    .default([]),
  flashDesignId: z
    .string()
    .uuid('Invalid flash design ID')
    .nullable()
    .optional(),
})

export type SubmitBookingInput = z.infer<typeof submitBookingSchema>

// ---------------------------------------------------------------------------
// Booking status lookup
// ---------------------------------------------------------------------------

export const bookingStatusSchema = z.object({
  token: z.string().min(1, 'Access token is required'),
})

export type BookingStatusInput = z.infer<typeof bookingStatusSchema>
