import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

const unauthorised = () =>
  NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

/**
 * Verifies the Authorization header is exactly `Bearer {CRON_SECRET}`.
 * Returns null if valid; returns a 401 NextResponse if invalid.
 * Use at the top of every cron route handler.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const secret = env.CRON_SECRET

  // Reject if the secret is unset or too short to be trustworthy. Without this,
  // an undefined secret would be compared against the literal 'Bearer undefined'.
  if (!secret || secret.length < 32) {
    return unauthorised()
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return unauthorised()
  }

  const expected = `Bearer ${secret}`

  // Constant-time comparison. timingSafeEqual requires equal-length buffers, so
  // guard on length first (a length mismatch is already a definitive rejection).
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return unauthorised()
  }

  return null
}
