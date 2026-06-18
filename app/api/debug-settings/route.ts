import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    const supabase = await createSupabaseServerClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    results.user = user ? { id: user.id, email: user.email } : null
    results.authError = authErr?.message ?? null

    if (!user) {
      return NextResponse.json({ ...results, error: 'Not authenticated' })
    }

    // Test 1: basic artist query
    const { data: artist, error: artistErr } = await supabase
      .from('artists')
      .select('id, user_id, username, display_name')
      .eq('user_id', user.id)
      .single()
    results.artist = artist
    results.artistError = artistErr?.message ?? null

    if (!artist) {
      return NextResponse.json({ ...results, error: 'No artist found' })
    }

    // Test 2: artist with all columns
    const { data: artistFull, error: artistFullErr } = await supabase
      .from('artists')
      .select('*')
      .eq('user_id', user.id)
      .single()
    results.artistFullColumns = artistFull ? Object.keys(artistFull) : null
    results.artistFullError = artistFullErr?.message ?? null

    // Test 3: artist_availability
    const { data: avail, error: availErr } = await supabase
      .from('artist_availability')
      .select('day_of_week, start_time, end_time, timezone')
      .eq('artist_id', artist.id)
    results.availability = avail
    results.availabilityError = availErr?.message ?? null

    // Test 4: artist_faqs
    const { data: faqs, error: faqErr } = await supabase
      .from('artist_faqs')
      .select('id, question, answer, display_order')
      .eq('artist_id', artist.id)
    results.faqs = faqs
    results.faqsError = faqErr?.message ?? null

    // Test 5: artist_credentials
    const { data: creds, error: credErr } = await supabase
      .from('artist_credentials')
      .select('id, type, title')
      .eq('artist_id', artist.id)
    results.credentials = creds
    results.credentialsError = credErr?.message ?? null

    // Test 6: combined query (same as settings page)
    const { data: combined, error: combinedErr } = await supabase
      .from('artists')
      .select(`
        *,
        artist_availability (
          day_of_week,
          start_time,
          end_time,
          timezone
        )
      `)
      .eq('user_id', user.id)
      .single()
    results.combinedQuery = combined ? 'SUCCESS' : 'FAILED'
    results.combinedError = combinedErr?.message ?? null

    // Test 7: subscriptions
    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
    results.subscription = sub
    results.subscriptionError = subErr?.message ?? null

    return NextResponse.json(results)
  } catch (err) {
    return NextResponse.json({
      ...results,
      uncaughtError: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
  }
}
