import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

/**
 * Verifies the Authorization header is exactly `Bearer {CRON_SECRET}`.
 * Returns null if valid; returns a 401 NextResponse if invalid.
 * Use at the top of every cron route handler.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${env.CRON_SECRET}`

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  return null
}
