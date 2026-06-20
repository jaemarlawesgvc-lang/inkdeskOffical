import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Pulls a column name out of either Postgres or PostgREST "missing column" errors.
function extractMissingColumn(message: string): string | null {
  // PostgREST schema cache: Could not find the 'price_tier' column of 'artists'
  const postgrest = /'(\w+)' column/i.exec(message)
  if (postgrest?.[1]) return postgrest[1]
  // Postgres native: column "price_tier" of relation "artists" does not exist
  const native = /column "?(\w+)"? of relation/i.exec(message)
  if (native?.[1]) return native[1]
  return null
}

// All fields are optional and lenient so debounced auto-save never rejects
// transient empty values while the user is still editing a field.
const schema = z.object({
  artistId: z.string().uuid(),
  displayName: z.string().max(100).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  styleTags: z.array(z.string()).max(10).optional(),
  instagramHandle: z.string().max(30).trim().optional(),
  studioName: z.string().max(200).trim().optional(),
  studioAddress: z.string().max(500).trim().optional(),
  studioLat: z.number().min(-90).max(90).nullable().optional(),
  studioLng: z.number().min(-180).max(180).nullable().optional(),
  hourlyRate: z.number().nonnegative().max(9999.99).nullable().optional(),
  depositAmount: z.number().nonnegative().max(9999.99).nullable().optional(),
  depositRequired: z.boolean().optional(),
  pricingNotes: z.string().max(1000).trim().optional(),
  priceTier: z.string().optional(),
  timezone: z.string().optional(),
  availability: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ).optional(),
  emailBookingConfirmation: z.boolean().optional(),
  emailReminders: z.boolean().optional(),
  emailAftercare: z.boolean().optional(),
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

  const d = parsed.data

  // Verify artist belongs to user
  const { data: artist, error: ownershipError } = await supabase
    .from('artists')
    .select('id')
    .eq('id', d.artistId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (ownershipError) {
    console.error('[api/settings] ownership check failed:', ownershipError)
    return NextResponse.json({ error: ownershipError.message }, { status: 500 })
  }
  if (!artist) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date().toISOString()

  // Build update payload dynamically. Empty strings for text fields are saved as null.
  const updatePayload: Record<string, unknown> = {}
  if (d.displayName !== undefined) updatePayload.display_name = d.displayName || null
  if (d.bio !== undefined) updatePayload.bio = d.bio || null
  if (d.styleTags !== undefined) updatePayload.style_tags = d.styleTags
  if (d.instagramHandle !== undefined) updatePayload.instagram_handle = d.instagramHandle.replace(/^@/, '') || null
  if (d.studioName !== undefined) updatePayload.studio_name = d.studioName || null
  if (d.studioAddress !== undefined) updatePayload.studio_address = d.studioAddress || null
  if (d.studioLat !== undefined) updatePayload.studio_lat = d.studioLat ?? null
  if (d.studioLng !== undefined) updatePayload.studio_lng = d.studioLng ?? null
  if (d.hourlyRate !== undefined) updatePayload.hourly_rate = d.hourlyRate ?? null
  if (d.depositAmount !== undefined) updatePayload.deposit_amount = d.depositAmount ?? null
  if (d.depositRequired !== undefined) updatePayload.deposit_required = d.depositRequired
  if (d.pricingNotes !== undefined) updatePayload.pricing_notes = d.pricingNotes || null
  if (d.priceTier !== undefined) updatePayload.price_tier = d.priceTier || '££'
  if (d.emailBookingConfirmation !== undefined) updatePayload.email_booking_confirmation = d.emailBookingConfirmation
  if (d.emailReminders !== undefined) updatePayload.email_reminders = d.emailReminders
  if (d.emailAftercare !== undefined) updatePayload.email_aftercare = d.emailAftercare
  // Timezone lives on the artists table (NOT artist_availability).
  if (d.timezone !== undefined) updatePayload.timezone = d.timezone || 'Europe/London'

  if (Object.keys(updatePayload).length > 0) {
    updatePayload.updated_at = now

    // Retry while dropping unknown columns. Two formats both mean "column missing":
    //   • Postgres native: code 42703, "column \"price_tier\" of relation ..."
    //   • PostgREST cache: code PGRST204, "Could not find the 'price_tier' column ..."
    let attempts = 0
    while (attempts < 20) {
      const { error: updateErr } = await supabase
        .from('artists')
        .update(updatePayload)
        .eq('id', d.artistId)

      if (!updateErr) break

      const missingCol = extractMissingColumn(updateErr.message)
      if (missingCol && missingCol in updatePayload) {
        console.warn(`[api/settings] dropping unknown column "${missingCol}" and retrying`)
        delete updatePayload[missingCol]
        attempts++
        // If nothing left except updated_at, stop trying.
        const remaining = Object.keys(updatePayload).filter((k) => k !== 'updated_at')
        if (remaining.length === 0) break
        continue
      }

      console.error('[api/settings] artist update failed:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  // Resync availability slots only if provided in request body
  if (d.availability !== undefined) {
    const { error: deleteErr } = await supabase
      .from('artist_availability')
      .delete()
      .eq('artist_id', d.artistId)

    if (deleteErr) {
      console.error('[api/settings] availability delete failed:', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    if (d.availability.length > 0) {
      // NOTE: artist_availability has no timezone column — timezone is stored
      // on the artists row above. Only insert the columns that exist here.
      const { error: availError } = await supabase.from('artist_availability').insert(
        d.availability.map((s) => ({
          artist_id: d.artistId,
          day_of_week: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime,
        })),
      )
      if (availError) {
        console.error('[api/settings] availability insert failed:', availError)
        return NextResponse.json({ error: availError.message }, { status: 500 })
      }
    }
  }
  return NextResponse.json({ ok: true })
}
