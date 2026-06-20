import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const DEFAULT_FAQS = [
  { question: 'Does it hurt?', answer: 'Pain varies by placement and individual tolerance, but most clients describe it as a manageable discomfort rather than unbearable pain. We’ll talk you through what to expect for your specific design.' },
  { question: 'Can I use numbing cream?', answer: 'Yes — over-the-counter numbing creams are fine for most placements. Apply as directed on the packaging before your appointment and let your artist know you’ve used it.' },
  { question: 'How should I prepare?', answer: 'Get a good night’s sleep, eat a full meal beforehand, stay hydrated, and avoid alcohol for 24 hours before your session.' },
  { question: 'What should I wear?', answer: 'Wear loose, comfortable clothing that gives easy access to the area being tattooed.' },
  { question: 'How long will it take to heal?', answer: 'Surface healing usually takes 2–3 weeks, with full healing underneath taking 4–6 weeks. Follow the aftercare instructions you’re given for the best results.' },
  { question: 'Can I bring someone with me?', answer: 'One guest is usually welcome, but please check with your artist ahead of time as studio space can be limited.' },
] as const

async function getOwnArtistId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<string | null> {
  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', userId)
    .single()
  return artist?.id ?? null
}

// ---------------------------------------------------------------------------
// POST — create a FAQ entry, or seed the six default questions if the
// request body is { seedDefaults: true } and the artist currently has none.
// ---------------------------------------------------------------------------

const createSchema = z.object({
  question: z.string().min(1).max(200).trim(),
  answer: z.string().min(1).max(2000).trim(),
})

const seedSchema = z.object({ seedDefaults: z.literal(true) })

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const artistId = await getOwnArtistId(supabase, user.id)
  if (!artistId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const seedParsed = seedSchema.safeParse(body)
  if (seedParsed.success) {
    const { count } = await supabase
      .from('artist_faqs')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', artistId)

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'FAQs already exist' }, { status: 409 })
    }

    const { data: seeded, error } = await supabase.from('artist_faqs').insert(
      DEFAULT_FAQS.map((faq, i) => ({
        artist_id: artistId,
        question: faq.question,
        answer: faq.answer,
        display_order: i,
      })),
    ).select('id, question, answer, display_order')

    if (error) {
      console.error('[api/faq] seed failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, faqs: seeded ?? [] })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { count: existingCount } = await supabase
    .from('artist_faqs')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', artistId)

  const { data, error } = await supabase
    .from('artist_faqs')
    .insert({
      artist_id: artistId,
      question: parsed.data.question,
      answer: parsed.data.answer,
      display_order: existingCount ?? 0,
    })
    .select('id, question, answer, display_order')
    .single()

  if (error || !data) {
    console.error('[api/faq] create failed:', error)
    return NextResponse.json({ error: error?.message ?? 'Failed to create FAQ' }, { status: 500 })
  }

  return NextResponse.json({ faq: data })
}

// ---------------------------------------------------------------------------
// PATCH — update question/answer/display_order on an existing FAQ entry
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1).max(200).trim().optional(),
  answer: z.string().min(1).max(2000).trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
})

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const artistId = await getOwnArtistId(supabase, user.id)
  if (!artistId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const { id, question, answer, displayOrder } = parsed.data

  const update: Record<string, string | number> = {}
  if (question !== undefined) update.question = question
  if (answer !== undefined) update.answer = answer
  if (displayOrder !== undefined) update.display_order = displayOrder

  const { error } = await supabase
    .from('artist_faqs')
    .update(update)
    .eq('id', id)
    .eq('artist_id', artistId)

  if (error) return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// DELETE — remove a FAQ entry (?id=)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const artistId = await getOwnArtistId(supabase, user.id)
  if (!artistId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 422 })
  }

  const { error } = await supabase
    .from('artist_faqs')
    .delete()
    .eq('id', parsedId.data)
    .eq('artist_id', artistId)

  if (error) return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
