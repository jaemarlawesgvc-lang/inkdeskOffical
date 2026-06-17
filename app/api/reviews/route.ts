import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  token: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).trim().optional(),
  photoStoragePath: z.string().max(500).optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { token, rating, body, photoStoragePath } = parsed.data
  const supabase = createSupabaseAdminClient()

  const { data: review, error } = await supabase
    .from('reviews')
    .select('id, token_used, token_expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !review) {
    return NextResponse.json({ error: 'Review link not found' }, { status: 404 })
  }

  if (review.token_used) {
    return NextResponse.json({ error: 'This review has already been submitted' }, { status: 409 })
  }

  if (new Date(review.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'This review link has expired' }, { status: 410 })
  }

  let photoUrl: string | null = null
  if (photoStoragePath) {
    const { data: urlData } = supabase.storage.from('review-photos').getPublicUrl(photoStoragePath)
    photoUrl = urlData.publicUrl
  }

  const { error: updateError } = await supabase
    .from('reviews')
    .update({
      rating,
      body: body || null,
      photo_url: photoUrl,
      token_used: true,
    })
    .eq('token', token)
    .eq('token_used', false)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
