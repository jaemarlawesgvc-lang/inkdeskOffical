import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  artistId: z.string().uuid(),
  clientName: z.string().min(1).max(200).trim(),
  clientEmail: z.string().email(),
  preferredStyles: z.array(z.string().max(50)).max(10).optional().default([]),
  flexibleOnDate: z.boolean().optional().default(true),
  preferredDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  preferredDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const supabase = createSupabaseAdminClient()
  const d = parsed.data

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', d.artistId)
    .eq('onboarding_complete', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { error } = await supabase.from('waitlist').insert({
    artist_id: d.artistId,
    client_name: d.clientName,
    client_email: d.clientEmail,
    preferred_styles: d.preferredStyles,
    flexible_on_date: d.flexibleOnDate,
    preferred_date_from: d.preferredDateFrom ?? null,
    preferred_date_to: d.preferredDateTo ?? null,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
