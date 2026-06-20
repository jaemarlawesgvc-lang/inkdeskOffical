import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params

  const parsedId = z.string().uuid().safeParse(id)
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 422 })
  }

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

  // Fetch first so we can also remove the stored PDF, and to enforce ownership.
  const { data: submission, error: fetchError } = await supabase
    .from('consent_form_submissions')
    .select('id, pdf_path')
    .eq('id', parsedId.data)
    .eq('artist_id', artist.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[api/consent-forms DELETE] fetch failed:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!submission) {
    return NextResponse.json({ error: 'Consent form not found' }, { status: 404 })
  }

  const admin = createSupabaseAdminClient()

  // Remove the signed PDF from storage (best-effort; don't block deletion on it).
  if (submission.pdf_path) {
    const { error: storageErr } = await admin.storage
      .from('consent-forms')
      .remove([submission.pdf_path])
    if (storageErr) {
      console.warn('[api/consent-forms DELETE] storage remove failed:', storageErr.message)
    }
  }

  const { error: deleteError } = await admin
    .from('consent_form_submissions')
    .delete()
    .eq('id', parsedId.data)
    .eq('artist_id', artist.id)

  if (deleteError) {
    console.error('[api/consent-forms DELETE] delete failed:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
