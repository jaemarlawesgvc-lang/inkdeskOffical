import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { step1Schema, RESERVED_USERNAMES } from '@/lib/validations/onboarding'
import { z } from 'zod'

const querySchema = z.object({
  username: z.string().min(1),
})

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const raw = querySchema.safeParse({ username: searchParams.get('username') ?? '' })

  if (!raw.success) {
    return NextResponse.json({ available: false, error: 'Invalid input' }, { status: 400 })
  }

  const formatCheck = step1Schema.safeParse({ username: raw.data.username })
  if (!formatCheck.success) {
    return NextResponse.json(
      { available: false, error: formatCheck.error.errors[0]?.message ?? 'Invalid username' },
      { status: 200 },
    )
  }

  const username = raw.data.username.toLowerCase()

  if (RESERVED_USERNAMES.includes(username as (typeof RESERVED_USERNAMES)[number])) {
    return NextResponse.json({ available: false, error: 'That username is reserved' })
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('artists')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    console.error('[check-username] DB error:', error.message)
    return NextResponse.json({ available: false, error: 'Could not check availability' }, { status: 500 })
  }

  return NextResponse.json({ available: data === null })
}
