/**
 * lib/utils.ts
 *
 * Utility functions used throughout InkDesk.
 * Safe to import in both server and client code — no env or DB dependencies.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistance, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

// ─── CSS ──────────────────────────────────────────────────────────────────────

/**
 * Merge Tailwind classes with full conflict resolution.
 * Combines clsx (conditional logic) with tailwind-merge (deduplication).
 *
 * @example cn('px-4 py-2', isActive && 'bg-gold-500', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Format an amount (in major units) as a localised currency string.
 * Defaults to GBP / en-GB for the InkDesk target market.
 *
 * @example formatCurrency(19)     // '£19.00'
 * @example formatCurrency(49, 'EUR', 'de-DE') // '49,00 €'
 */
export function formatCurrency(
  amountInMajorUnits: number,
  currency = 'GBP',
  locale = 'en-GB',
): string {
  return new Intl.NumberFormat(locale, {
    style:                'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInMajorUnits)
}

/**
 * Convert a major-unit amount (£19.00) to Stripe minor units (1900 pence).
 * Always rounds to the nearest integer to avoid floating-point drift.
 */
export function toStripeAmount(amountInMajorUnits: number): number {
  return Math.round(amountInMajorUnits * 100)
}

/**
 * Convert Stripe minor units (pence/cents) back to major units.
 */
export function fromStripeAmount(amountInMinorUnits: number): number {
  return amountInMinorUnits / 100
}

// ─── Date & Time ──────────────────────────────────────────────────────────────

/**
 * Format an ISO date string as a long human date.
 * @example formatDate('2024-12-25') // 'Wednesday, 25 December 2024'
 */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'EEEE, d MMMM yyyy')
}

/**
 * Format an ISO date string as a short date.
 * @example formatDateShort('2024-12-25') // '25 Dec 2024'
 */
export function formatDateShort(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy')
}

/**
 * Format a 24h time string (HH:MM or HH:MM:SS) for display.
 * @example formatTime('14:30') // '2:30 PM'
 */
export function formatTime(time: string): string {
  const [hoursStr, minutesStr] = time.split(':')
  const hours   = parseInt(hoursStr   ?? '0', 10)
  const minutes = parseInt(minutesStr ?? '0', 10)
  const date    = new Date()
  date.setHours(hours, minutes, 0, 0)
  return format(date, 'h:mm a')
}

/**
 * Format a duration in decimal hours as a human-readable string.
 * @example formatDuration(1.5)  // '1h 30m'
 * @example formatDuration(2)    // '2h'
 * @example formatDuration(0.5)  // '30m'
 */
export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Format a timestamp as a relative "time ago" string.
 * @example formatRelative('2024-01-01T12:00:00Z') // '3 days ago'
 */
export function formatRelative(isoTimestamp: string): string {
  return formatDistance(parseISO(isoTimestamp), new Date(), { addSuffix: true })
}

/**
 * Convert a UTC timestamp to the artist's local time in their IANA timezone.
 * Used for reminder scheduling and calendar display.
 *
 * @example toLocalTime('2024-12-25T14:00:00Z', 'Europe/London')
 */
export function toLocalTime(utcTimestamp: Date | string, timezone: string): Date {
  const date = typeof utcTimestamp === 'string' ? parseISO(utcTimestamp) : utcTimestamp
  return toZonedTime(date, timezone)
}

/**
 * Return today's date as a YYYY-MM-DD string in UTC.
 * Use this instead of new Date().toISOString() to avoid off-by-one day
 * errors caused by timezone offset around midnight.
 */
export function todayISO(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// ─── String Utilities ─────────────────────────────────────────────────────────

/**
 * Convert any string to a URL-safe slug.
 * @example slugify('Neo-Traditional!') // 'neo-traditional'
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Truncate text to maxLength, appending '…' if shortened.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}…`
}

/**
 * Capitalise the first letter of a string.
 */
export function capitalise(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Generate a high-entropy random token (UUID v4).
 * Works in both Node.js 20+ and Edge runtime.
 *
 * Used for booking access tokens (§3.2), hold session IDs, etc.
 */
export function generateToken(): string {
  return crypto.randomUUID()
}

/**
 * Mask an email address for safe display.
 * @example maskEmail('artist@studio.com') // 'ar***@studio.com'
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.slice(0, 2)
  return `${visible}***@${domain}`
}

// ─── Arrays ───────────────────────────────────────────────────────────────────

/**
 * Move an item within an array (for drag-to-reorder portfolio images).
 * Returns a NEW array — never mutates the original.
 */
export function reorder<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  const result  = [...array]
  const [moved] = result.splice(fromIndex, 1)
  if (moved !== undefined) {
    result.splice(toIndex, 0, moved)
  }
  return result
}

/**
 * Group an array of objects by a derived string key.
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string,
): Record<string, T[]> {
  return array.reduce<Record<string, T[]>>((groups, item) => {
    const key = keyFn(item)
    const existing = groups[key]
    if (existing) {
      existing.push(item)
    } else {
      groups[key] = [item]
    }
    return groups
  }, {})
}

// ─── Async Utilities ──────────────────────────────────────────────────────────

/** Wait for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry an async function with exponential backoff.
 *
 * @param fn          - The async function to attempt
 * @param maxAttempts - Maximum attempts before throwing (default: 3)
 * @param baseDelayMs - Initial delay; doubles on each retry (default: 500ms)
 *
 * @example
 * const data = await retry(() => fetchWithTimeout(url), 3, 500)
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1))
      }
    }
  }
  throw lastError
}

// ─── URL Utilities ────────────────────────────────────────────────────────────

/**
 * Build an absolute URL from a relative path using the app's base URL.
 *
 * @example absoluteUrl('/api/health') // 'https://inkdesk.co/api/health'
 */
export function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://inkdesk.co'
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

/**
 * Build the public artist page URL.
 * Encapsulates the /{username} routing decision (§6.1).
 *
 * @example artistPageUrl('tomm') // 'https://inkdesk.co/tomm'
 */
export function artistPageUrl(username: string): string {
  return absoluteUrl(`/${username}`)
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/**
 * Assert that a value is defined, throwing a descriptive error if not.
 * Use in server actions where undefined means a data integrity problem.
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`[InkDesk] Assertion failed: ${message}`)
  }
}
