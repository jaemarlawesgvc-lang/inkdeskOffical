import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  saveStep1Payload,
  saveStep2Payload,
  saveStep3Payload,
  saveStep4Payload,
} from '@/lib/validations/onboarding'
import { z } from 'zod'

const stepNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])

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

  if (typeof body !== 'object' || body === null || !('step' in body)) {
    return NextResponse.json({ error: 'Missing step field' }, { status: 400 })
  }

  const stepParse = stepNumberSchema.safeParse(
    (body as Record<string, unknown>).step,
  )
  if (!stepParse.success) {
    return NextResponse.json({ error: 'Invalid step number' }, { status: 400 })
  }

  const step = stepParse.data
  const payload = (body as Record<string, unknown>).data

  // Look up the artist row for this user
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, onboarding_step')
    .eq('user_id', user.id)
    .maybeSingle()

  if (artistError) {
    console.error('[save-step] artist lookup error:', artistError.message)
    return NextResponse.json(
      { error: 'Failed to load artist record' },
      { status: 500 },
    )
  }

  if (!artist) {
    return NextResponse.json(
      { error: 'Artist record not found' },
      { status: 404 },
    )
  }

  // Ownership is verified above (artist row fetched by user_id). Perform the
  // writes with the service-role client so they don't depend on every RLS
  // policy / helper function being present in the database — a missing
  // current_artist_id() or absent DELETE policy previously made portfolio and
  // availability saves fail with "new row violates row-level security policy".
  // All writes are scoped to this user's own artist.id, so this is safe.
  const db = createSupabaseAdminClient()

  switch (step) {
    case 1: {
      const parsed = saveStep1Payload.safeParse(payload)
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
          { status: 422 },
        )
      }

      // Confirm username is still available (prevent race between debounce and submit)
      const { data: existing } = await supabase
        .from('artists')
        .select('id')
        .eq('username', parsed.data.username)
        .neq('id', artist.id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'Username is already taken' },
          { status: 409 },
        )
      }

      const { error: updateError } = await db
        .from('artists')
        .update({
          username: parsed.data.username,
          onboarding_step: Math.max(artist.onboarding_step ?? 1, 2),
          updated_at: new Date().toISOString(),
        })
        .eq('id', artist.id)

      if (updateError) {
        console.error('[save-step/1] update error:', updateError.message)
        return NextResponse.json(
          { error: 'Failed to save username' },
          { status: 500 },
        )
      }

      return NextResponse.json({ ok: true })
    }

    case 2: {
      const parsed = saveStep2Payload.safeParse(payload)
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
          { status: 422 },
        )
      }

      const { error: updateError } = await db
        .from('artists')
        .update({
          display_name: parsed.data.displayName,
          bio: parsed.data.bio ?? '',
          style_tags: parsed.data.styleTags,
          instagram_handle: parsed.data.instagramHandle ?? '',
          onboarding_step: Math.max(artist.onboarding_step ?? 1, 3),
          updated_at: new Date().toISOString(),
        })
        .eq('id', artist.id)

      if (updateError) {
        console.error('[save-step/2] update error:', updateError.message)
        return NextResponse.json(
          { error: 'Failed to save profile' },
          { status: 500 },
        )
      }

      return NextResponse.json({ ok: true })
    }

    case 3: {
      const parsed = saveStep3Payload.safeParse(payload)
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
          { status: 422 },
        )
      }

      // Delete existing portfolio images for this artist (re-sync on each step-3 save)
      const { error: deleteError } = await db
        .from('portfolio_images')
        .delete()
        .eq('artist_id', artist.id)

      if (deleteError) {
        console.error('[save-step/3] delete error:', deleteError.message)
        return NextResponse.json(
          { error: 'Failed to sync portfolio images' },
          { status: 500 },
        )
      }

      if (parsed.data.images.length > 0) {
        const rows = parsed.data.images.map((img) => ({
          artist_id: artist.id,
          storage_path: img.storagePath,
          public_url: img.publicUrl,
          caption: img.caption ?? '',
          display_order: img.displayOrder,
        }))

        const { error: insertError } = await db
          .from('portfolio_images')
          .insert(rows)

        if (insertError) {
          console.error('[save-step/3] insert error:', insertError.message)
          return NextResponse.json(
            { error: 'Failed to save portfolio images' },
            { status: 500 },
          )
        }
      }

      const { error: updateError } = await db
        .from('artists')
        .update({
          onboarding_step: Math.max(artist.onboarding_step ?? 1, 4),
          updated_at: new Date().toISOString(),
        })
        .eq('id', artist.id)

      if (updateError) {
        console.error(
          '[save-step/3] artist update error:',
          updateError.message,
        )
        return NextResponse.json(
          { error: 'Failed to advance onboarding step' },
          { status: 500 },
        )
      }

      return NextResponse.json({ ok: true })
    }

    case 4: {
      const parsed = saveStep4Payload.safeParse(payload)
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
          { status: 422 },
        )
      }

      // Update artist pricing + timezone fields
      const { error: artistUpdateError } = await db
        .from('artists')
        .update({
          hourly_rate: parsed.data.hourlyRate ?? null,
          deposit_amount: parsed.data.depositAmount ?? null,
          deposit_required: parsed.data.depositRequired,
          timezone: parsed.data.timezone,
          onboarding_step: Math.max(artist.onboarding_step ?? 1, 5),
          updated_at: new Date().toISOString(),
        })
        .eq('id', artist.id)

      if (artistUpdateError) {
        console.error(
          '[save-step/4] artist update error:',
          artistUpdateError.message,
        )
        return NextResponse.json(
          { error: 'Failed to save pricing' },
          { status: 500 },
        )
      }

      // Upsert availability slots
      if (parsed.data.availability.length > 0) {
        // Delete existing availability and re-insert to handle day removals
        const { error: delAvailError } = await db
          .from('artist_availability')
          .delete()
          .eq('artist_id', artist.id)

        if (delAvailError) {
          console.error(
            '[save-step/4] availability delete error:',
            delAvailError.message,
          )
          return NextResponse.json(
            { error: 'Failed to update availability' },
            { status: 500 },
          )
        }

        const availRows = parsed.data.availability.map((slot) => ({
          artist_id: artist.id,
          day_of_week: slot.dayOfWeek,
          start_time: slot.startTime,
          end_time: slot.endTime,
          // NOTE: no timezone column here; artist_availability doesn’t have one
        }))

        const { error: insertAvailError } = await db
          .from('artist_availability')
          .insert(availRows)

        if (insertAvailError) {
          console.error(
            '[save-step/4] availability insert error:',
            insertAvailError.message,
          )
          return NextResponse.json(
            { error: 'Failed to save availability' },
            { status: 500 },
          )
        }
      }

      return NextResponse.json({ ok: true })
    }
  }
}