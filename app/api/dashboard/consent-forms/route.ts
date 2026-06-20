import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: submissions, error } = await supabase
    .from('consent_form_submissions')
    .select('id, client_name, client_dob, tattoo_description, signed_at, viewed_at, booking_id, pdf_path')
    .eq('artist_id', artist.id)
    .order('signed_at', { ascending: false })

  if (error) {
    console.error('[api/consent-forms] load failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    submissions: (submissions ?? []).map((s) => ({
      id: s.id,
      clientName: s.client_name,
      clientDob: s.client_dob,
      tattooDescription: s.tattoo_description,
      signedAt: s.signed_at,
      viewedAt: s.viewed_at,
      bookingId: s.booking_id,
      hasPdf: !!s.pdf_path,
    })),
  })
}
