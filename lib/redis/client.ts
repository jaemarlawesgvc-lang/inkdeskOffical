import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// Read Upstash vars straight from process.env rather than importing lib/env.
//
// This module is imported by the root middleware, which runs on the Edge
// runtime. Importing lib/env here would pull the FULL server-side env schema
// (Stripe, Resend, CRON_SECRET, …) into the Edge bundle — and lib/env throws at
// import if any single one is missing. That made one unset, middleware-
// irrelevant variable crash every request with MIDDLEWARE_INVOCATION_FAILED.
// The middleware only needs Upstash, so depend on nothing else.
//
// Construction must never throw: if the Upstash vars are absent we fall back to
// placeholders so the module loads, and the rate-limit calls (which are wrapped
// in try/catch and fail open) simply no-op instead of taking the app down.
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://placeholder.upstash.io'
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'placeholder-token'

// Initialize Redis client
export const redis = new Redis({
  url: UPSTASH_URL,
  token: UPSTASH_TOKEN,
})

// Rate limiters for different types of routes

// 1. API routes (e.g. /api/bookings, /api/auth)
// 100 requests per 10 seconds
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '10 s'),
  analytics: true,
  prefix: '@upstash/ratelimit/api',
})

// 2. Auth routes (e.g. login, sign up, password reset)
// 5 requests per minute
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/auth',
})

// 3. Webhook routes (e.g. Stripe)
// 20 requests per minute
export const webhookRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  analytics: true,
  prefix: '@upstash/ratelimit/webhook',
})
