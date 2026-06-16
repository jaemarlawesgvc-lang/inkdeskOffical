import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  bookingId: z.string().uuid(),
  artistId: z.string().uuid(),
  action: z.enum(['confirm', 'cancel', 'complete', 'add_note']),
  note: z.string().max(1000).optional(),
})

const STATUS_TRANSITIONS: Record<string, string> = {
  confirm: 'confirmed',
  cancel: 'cancelled',
  complete: 'completed',
}

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

  const { bookingId, artistId, action, note } = parsed.data

  // Confirm this artist belongs to the authed user
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (action === 'add_note') {
    if (!note) {
      return NextResponse.json({ error: 'Note is required' }, { status: 422 })
    }
    // Append to existing notes using a simple timestamped format
    const { data: existing } = await supabase
      .from('bookings')
      .select('notes')
      .eq('id', bookingId)
      .eq('artist_id', artistId)
      .single()

    const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
    const newNote = existing?.notes
      ? `${existing.notes}\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`

    const { error } = await supabase
      .from('bookings')
      .update({ notes: newNote, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('artist_id', artistId)

    if (error) return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const newStatus = STATUS_TRANSITIONS[action]
  if (!newStatus) {
    return NextResponse.json({ error: 'Unknown action' }, { status: 422 })
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('artist_id', artistId)

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
