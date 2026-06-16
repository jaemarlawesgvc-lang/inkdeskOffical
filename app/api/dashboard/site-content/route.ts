import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { siteDataSchema } from '@/lib/gemini/client'
import { z } from 'zod'

const schema = z.object({
  artistId: z.string().uuid(),
  siteData: siteDataSchema,
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { artistId, siteData } = parsed.data

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('artists')
    .update({
      site_data: siteData,
      site_generated: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artistId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to save site content' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
