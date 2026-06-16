import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { verifyCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handler(request)
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const supabase = createSupabaseAdminClient()

  // Delete all holds whose TTL has passed
  const { error, count } = await supabase
    .from('booking_holds')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())

  if (error) {
    console.error('[cron/expire-holds] delete error:', error.message)
    return NextResponse.json({ error: 'Failed to expire holds' }, { status: 500 })
  }

  const deleted = count ?? 0
  if (deleted > 0) {
    console.info(`[cron/expire-holds] deleted ${deleted} expired hold(s)`)
  }

  return NextResponse.json({ deleted })
}
