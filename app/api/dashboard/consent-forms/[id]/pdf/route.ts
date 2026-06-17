import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
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
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: submission } = await supabase
    .from('consent_form_submissions')
    .select('pdf_path, viewed_at')
    .eq('id', id)
    .eq('artist_id', artist.id)
    .maybeSingle()

  if (!submission || !submission.pdf_path) {
    return NextResponse.json({ error: 'Consent form not found' }, { status: 404 })
  }

  if (!submission.viewed_at) {
    await supabase
      .from('consent_form_submissions')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', id)
  }

  const adminClient = createSupabaseAdminClient()
  const { data: signed, error: signError } = await adminClient.storage
    .from('consent-forms')
    .createSignedUrl(submission.pdf_path, 300)

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
