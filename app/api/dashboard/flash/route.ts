import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const flashSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(100),
  price: z.number().positive('Price must be positive'),
  sizeCm: z.string().trim().max(50).optional().nullable(),
  imagePath: z.string().url('Invalid image URL'),
})

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 })
  }

  const { data: flash, error } = await supabase
    .from('flash_designs')
    .select('*')
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ flash })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = flashSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { title, price, sizeCm, imagePath } = parsed.data
  const adminDb = createSupabaseAdminClient()

  const { data: flash, error } = await adminDb
    .from('flash_designs')
    .insert({
      artist_id: artist.id,
      title,
      price,
      size_cm: sizeCm || null,
      image_path: imagePath,
      status: 'available',
    })
    .select('*')
    .single()

  if (error || !flash) {
    console.error('[flash/create] error:', error)
    return NextResponse.json({ error: 'Failed to create flash design' }, { status: 500 })
  }

  return NextResponse.json({ flash })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist profile not found' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'Missing design ID' }, { status: 400 })
  }

  const adminDb = createSupabaseAdminClient()

  // Verify ownership before deleting
  const { data: flash } = await adminDb
    .from('flash_designs')
    .select('id, artist_id')
    .eq('id', id)
    .single()

  if (!flash) {
    return NextResponse.json({ error: 'Flash design not found' }, { status: 404 })
  }

  if (flash.artist_id !== artist.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminDb
    .from('flash_designs')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
