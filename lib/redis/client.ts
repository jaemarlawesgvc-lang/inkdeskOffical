import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { env } from '@/lib/env'

// Initialize Redis client
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
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
