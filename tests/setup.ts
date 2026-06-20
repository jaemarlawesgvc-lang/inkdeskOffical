import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'

// ─── Global Mock: Next.js Navigation ─────────────────────────────────────────
// Prevents "invariant expected app router" errors in component tests.

vi.mock('next/navigation', () => ({
  useRouter:          vi.fn(() => ({
    push:     vi.fn(),
    replace:  vi.fn(),
    prefetch: vi.fn(),
    back:     vi.fn(),
    forward:  vi.fn(),
    refresh:  vi.fn(),
  })),
  useSearchParams:    vi.fn(() => new URLSearchParams()),
  usePathname:        vi.fn(() => '/'),
  useParams:          vi.fn(() => ({})),
  redirect:           vi.fn(),
  notFound:           vi.fn(),
}))

// ─── Global Mock: Next.js Headers ────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get:    vi.fn(),
    set:    vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
  headers: vi.fn(() => new Headers()),
}))

// ─── Global Mock: Environment Variables ───────────────────────────────────────
// Provide safe defaults so lib/env.ts doesn't throw during unit tests.
// Individual tests can override specific vars with vi.stubEnv().

process.env.NEXT_PUBLIC_SUPABASE_URL         = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY    = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY        = 'test-service-role-key'
process.env.STRIPE_SECRET_KEY                = 'sk_test_placeholder'
process.env.STRIPE_WEBHOOK_SECRET            = 'whsec_test_placeholder'
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_placeholder'
process.env.STRIPE_PRICE_PRO_MONTHLY         = 'price_test_pro'
process.env.STRIPE_PRICE_STUDIO_MONTHLY      = 'price_test_studio'
process.env.GEMINI_API_KEY                   = 'test-gemini-key'
process.env.RESEND_API_KEY                   = 're_test_placeholder'
process.env.RESEND_FROM_EMAIL                = 'noreply@inkdesk.live'
process.env.UPSTASH_REDIS_REST_URL           = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN         = 'test-upstash-token'
process.env.NEXT_PUBLIC_APP_URL              = 'http://localhost:3000'
process.env.NEXT_PUBLIC_APP_NAME             = 'InkDesk'
process.env.CRON_SECRET                      = 'test-cron-secret-at-least-32-chars-long'

// ─── Cleanup after each test ──────────────────────────────────────────────────
afterEach(() => {
  vi.clearAllMocks()
})
