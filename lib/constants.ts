/**
 * lib/constants.ts
 *
 * Application-wide constants. No external dependencies — import freely from
 * both server and client code.
 *
 * Deferred features (custom domains, analytics) are present as stub entries
 * with boolean flags set to false. Plan-gating logic reads from PLAN_LIMITS
 * rather than checking plan names directly, so enabling a feature in v2 is
 * a single-line change here.
 */

// ─── Routing ──────────────────────────────────────────────────────────────────

/** Prefix for all public artist page URLs (§6.1 ruling). */
export const ARTIST_PAGE_PREFIX = '/a' as const

/**
 * Usernames forbidden on the platform.
 *
 * Protects top-level app routes, marketing routes, technical paths,
 * and the `/a` artist namespace prefix from being registered as usernames.
 * Checked during onboarding step 1 and by the username-availability API.
 */
export const RESERVED_USERNAMES = new Set<string>([
  // ── Core app routes
  'admin',
  'api',
  'auth',
  'dashboard',
  'login',
  'logout',
  'signup',
  'register',
  'onboarding',
  'settings',
  'account',
  // ── Marketing routes
  'pricing',
  'features',
  'about',
  'contact',
  'privacy',
  'terms',
  'cookies',
  'blog',
  'press',
  'careers',
  'changelog',
  'status',
  'help',
  'support',
  // ── Technical paths
  'monitoring',   // Sentry tunnel route
  'sitemap',
  'robots',
  '_next',
  // ── Brand protection
  'inkdesk',
  'www',
  'app',
  'mail',
  'shop',
  'legal',
])

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = {
  USERNAME:   1,
  PROFILE:    2,
  PORTFOLIO:  3,
  PRICING:    4,
  GENERATE:   5,
} as const

export const TOTAL_ONBOARDING_STEPS = 5

// ─── Style Tags ───────────────────────────────────────────────────────────────

export const STYLE_TAGS = [
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

export type StyleTag = (typeof STYLE_TAGS)[number]

// ─── Subscription Plans ───────────────────────────────────────────────────────

export type Plan = 'free' | 'pro' | 'studio'

export type PlanLimits = {
  /** Max portfolio images. Infinity = unlimited. */
  portfolioImages:       number
  /** Max AI site generations per month. Infinity = unlimited. */
  aiGenerationsPerMonth: number
  /** Max bookings receivable per calendar month. Infinity = unlimited. */
  bookingsPerMonth:      number
  /** Can take deposit payments via Stripe Connect. */
  stripeDeposits:        boolean
  /** Has a linked Stripe Connect account for payouts. */
  stripeConnect:         boolean
  /** Automated reminder + aftercare emails. */
  emailAutomations:      boolean
  /**
   * Custom domain support.
   * Deferred for v1 — always false. Stub DB table + gating check exist.
   * Flip to true when Vercel Domains API integration is built.
   */
  customDomain:          boolean
  /** Basic = name/email only; full = notes, booking history. */
  clientNotesLevel:      'basic' | 'full'
  /**
   * Page view + booking analytics.
   * Deferred for v1 — always false. Stub DB table + gating check exist.
   */
  analytics:             boolean
  /** Priority email support SLA. */
  prioritySupport:       boolean
  /** CSV export of client + booking data. */
  csvExport:             boolean
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    portfolioImages:       10,
    aiGenerationsPerMonth: 1,
    bookingsPerMonth:      5,
    stripeDeposits:        false,
    stripeConnect:         false,
    emailAutomations:      false,
    customDomain:          false,   // Deferred v1
    clientNotesLevel:      'basic',
    analytics:             false,   // Deferred v1
    prioritySupport:       false,
    csvExport:             false,
  },
  pro: {
    portfolioImages:       Infinity,
    aiGenerationsPerMonth: 5,
    bookingsPerMonth:      Infinity,
    stripeDeposits:        true,
    stripeConnect:         true,
    emailAutomations:      true,
    customDomain:          false,   // Deferred v1
    clientNotesLevel:      'full',
    analytics:             false,   // Deferred v1 (stub tables present)
    prioritySupport:       false,
    csvExport:             true,
  },
  studio: {
    portfolioImages:       Infinity,
    aiGenerationsPerMonth: Infinity,
    bookingsPerMonth:      Infinity,
    stripeDeposits:        true,
    stripeConnect:         true,
    emailAutomations:      true,
    customDomain:          false,   // Deferred v1 (stub tables present)
    clientNotesLevel:      'full',
    analytics:             false,   // Deferred v1 (stub tables present)
    prioritySupport:       true,
    csvExport:             true,
  },
}

export const PLAN_DISPLAY: Record<Plan, { name: string; price: string; interval: string }> = {
  free:   { name: 'Free',   price: '£0',  interval: 'forever' },
  pro:    { name: 'Pro',    price: '£19', interval: 'per month' },
  studio: { name: 'Studio', price: '£49', interval: 'per month' },
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export const BOOKING_STATUS = {
  /** Awaiting artist confirmation (all no-deposit bookings; §3 ruling). */
  PENDING:      'pending',
  /** Artist has confirmed; no deposit required. */
  CONFIRMED:    'confirmed',
  /** Deposit authorised and captured via Stripe Connect. */
  DEPOSIT_PAID: 'deposit_paid',
  /** Session completed. */
  COMPLETED:    'completed',
  /** Cancelled by artist or client. */
  CANCELLED:    'cancelled',
  /** Client did not show up. */
  NO_SHOW:      'no_show',
} as const

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS]

/**
 * Statuses that occupy a slot in the exclusion constraint.
 * 'pending' is included: public bookings start pending, and migration 021 widens
 * the DB exclusion constraint to match — so a pending booking holds its slot.
 */
export const SLOT_OCCUPYING_STATUSES: BookingStatus[] = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.DEPOSIT_PAID,
]

/** How long (minutes) a booking hold reserves a slot before expiring. */
export const BOOKING_HOLD_TTL_MINUTES = 15

export const MAX_REFERENCE_IMAGES = 5

export const MIN_BOOKING_DESCRIPTION_CHARS = 10

export const MAX_BOOKING_DESCRIPTION_CHARS = 1000

/**
 * Public bookings are consultation appointments — not full tattoo sessions.
 * The artist schedules the actual session (duration varies by piece) after
 * the consultation. Clients see this duration everywhere in the booking flow.
 */
export const CONSULTATION_DURATION_HOURS = 0.5

/** Minutes between selectable consultation start times. */
export const CONSULTATION_SLOT_INTERVAL_MINUTES = 30

export const CONSULTATION_DURATION_LABEL = '30 minutes'

export const CONSULTATION_BOOKING_TYPE = 'consultation' as const

// ─── Storage ──────────────────────────────────────────────────────────────────

export const STORAGE_BUCKETS = {
  /** Public bucket — artist portfolio images. */
  PORTFOLIO:  'portfolio-images',
  /**
   * Private bucket — client reference images.
   * Only accessed via service-role signed URLs (§8.2 fix).
   */
  REFERENCES: 'reference-images',
  /** Public bucket — artist and user avatars. */
  AVATARS:    'avatars',
} as const

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** Max upload size: 10 MB in bytes. */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

/** Signed URL TTL for reference images (seconds). 1 hour. */
export const REFERENCE_IMAGE_SIGNED_URL_TTL = 3600

// ─── Email Types ──────────────────────────────────────────────────────────────

export const EMAIL_TYPE = {
  BOOKING_CONFIRMATION:   'booking_confirmation',
  ARTIST_NOTIFICATION:    'artist_notification',
  REMINDER_48H:           'reminder_48h',
  AFTERCARE:              'aftercare',
  PAYMENT_FAILED:         'payment_failed',
  SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
  GDPR_EXPORT:            'gdpr_export',
  GDPR_DELETION:          'gdpr_deletion',
} as const

export type EmailType = (typeof EMAIL_TYPE)[keyof typeof EMAIL_TYPE]

// ─── Rate Limits ──────────────────────────────────────────────────────────────

/**
 * Rate limit configuration consumed by lib/rate-limit.ts (Phase 4).
 * window strings are parsed by @upstash/ratelimit's sliding window algorithm.
 */
export const RATE_LIMITS = {
  signup:         { requests: 5,   window: '1 h'  },
  login:          { requests: 10,  window: '15 m' },
  forgotPassword: { requests: 3,   window: '1 h'  },
  usernameCheck:  { requests: 20,  window: '1 m'  },
  bookings:       { requests: 10,  window: '1 h'  },
  generateSite:   { requests: 5,   window: '1 h'  },
  stripeWebhook:  { requests: 200, window: '1 m'  },
} as const

// ─── User Roles ───────────────────────────────────────────────────────────────

export const USER_ROLES = {
  ARTIST: 'artist',
  ADMIN:  'admin',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

// ─── Stripe ───────────────────────────────────────────────────────────────────

export const STRIPE_METADATA_KEYS = {
  BOOKING_ID:   'booking_id',
  ARTIST_ID:    'artist_id',
  CLIENT_EMAIL: 'client_email',
  TYPE:         'type',
} as const

export const STRIPE_PAYMENT_TYPE = {
  DEPOSIT:      'deposit',
  SUBSCRIPTION: 'subscription',
} as const

/**
 * Free-trial length (days) granted on every new paid subscription checkout.
 *
 * Surfaced as the headline promise on the Pro upgrade ("30 days free").
 * Stripe is told about this via `trial_period_days` on the Checkout session,
 * so the card is collected but not charged until the trial ends. The webhook
 * maps Stripe's `trialing` status → our `trialing` plan state, and
 * `resolveActivePlan` already grants paid features during the trial.
 *
 * Set to 0 to disable trials entirely (copy in the upgrade UI keys off this).
 */
export const SUBSCRIPTION_TRIAL_DAYS = 30

// ─── Cron Paths ───────────────────────────────────────────────────────────────

/** API paths that Vercel Cron will POST to. Must match vercel.json. */
export const CRON_PATHS = {
  SEND_REMINDERS:  '/api/cron/send-reminders',
  SEND_AFTERCARE:  '/api/cron/send-aftercare',
  EXPIRE_HOLDS:    '/api/cron/expire-holds',
  CLEANUP_ORPHANS: '/api/cron/cleanup-orphans',
} as const

// ─── Validation Rules ─────────────────────────────────────────────────────────

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_REGEX      = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/

export const BIO_MAX_LENGTH = 500

export const DISPLAY_NAME_MAX_LENGTH = 60

// ─── Days of the Week ─────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday',    short: 'Sun' },
  { value: 1, label: 'Monday',    short: 'Mon' },
  { value: 2, label: 'Tuesday',   short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday',  short: 'Thu' },
  { value: 5, label: 'Friday',    short: 'Fri' },
  { value: 6, label: 'Saturday',  short: 'Sat' },
] as const

// ─── SEO Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_META = {
  title:       'Inkquire — Bookings & Portfolio for Tattoo Artists',
  description: 'AI-generated portfolio websites and online booking for independent tattoo artists. Start free.',
  twitterHandle: '@inkdesk',
} as const
