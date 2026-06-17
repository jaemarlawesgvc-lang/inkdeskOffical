import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RESERVED = new Set([
  'admin', 'api', 'auth', 'dashboard', 'login', 'signup', 'onboarding',
  'review', 'conversation', 'booking', 'settings', 'help', 'support',
  'about', 'terms', 'privacy', 'pricing', 'blog', 'docs', 'app',
])

const schema = z.object({
  newUsername: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z0-9][a-z0-9_-]*[a-z0-9]$/, 'Username must start and end with a letter or number, and can contain hyphens/underscores'),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { newUsername } = parsed.data

  if (RESERVED.has(newUsername)) {
    return NextResponse.json({ error: 'This username is reserved' }, { status: 422 })
  }

  const { data: existing } = await supabase
    .from('artists')
    .select('id')
    .eq('username', newUsername)
    .neq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Username is already taken' }, { status: 409 })
  }

  const { error: updateError } = await supabase
    .from('artists')
    .update({ username: newUsername, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update username' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
