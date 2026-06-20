import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ConsentFormFilledDocument } from '@/lib/pdf/ConsentFormFilledDocument'
import { sendEmail } from '@/lib/resend/client'
import { consentFormSubmittedTemplate } from '@/lib/resend/templates'
import { clientEnv } from '@/lib/env.client'
import { MEDICAL_QUESTIONS } from '@/lib/consent/questions'
import { z } from 'zod'

export const runtime = 'nodejs'

const medicalAnswersSchema = z.object(
  Object.fromEntries(MEDICAL_QUESTIONS.map((q) => [q.id, z.enum(['yes', 'no'])])),
)

const submitSchema = z.object({
  artistId: z.string().uuid(),
  bookingId: z.string().uuid().nullable().optional(),
  clientName: z.string().trim().min(2, 'Please enter your full name').max(120),
  clientDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date of birth'),
  clientPhone: z.string().trim().max(40).optional(),
  tattooDescription: z.string().trim().min(5, 'Please describe the tattoo').max(2000),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: 'You must confirm you are 18 or older' }) }),
  medicalAnswers: medicalAnswersSchema,
  consentAgreed: z.literal(true, { errorMap: () => ({ message: 'You must agree to the consent statement' }) }),
  signatureName: z.string().trim().min(2, 'Please type your full name as a signature').max(120),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = submitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Validation failed' },
      { status: 422 },
    )
  }

  const data = parsed.data
  const supabase = createSupabaseAdminClient()

  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('id, user_id, display_name, username, studio_name, onboarding_complete, profiles ( email )')
    .eq('id', data.artistId)
    .is('deleted_at', null)
    .maybeSingle()

  if (artistError || !artist || !artist.onboarding_complete) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const profile = artist.profiles as unknown as { email: string } | null
  const artistName = artist.display_name ?? artist.username
  const artistEmail = profile?.email ?? null

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null

  const { data: submission, error: insertError } = await supabase
    .from('consent_form_submissions')
    .insert({
      artist_id: artist.id,
      booking_id: data.bookingId ?? null,
      client_name: data.clientName,
      client_dob: data.clientDob,
      client_phone: data.clientPhone ?? null,
      tattoo_description: data.tattooDescription,
      age_confirmed: true,
      medical_answers: data.medicalAnswers,
      signature_name: data.signatureName,
      ip_address: ipAddress,
    })
    .select('id, signed_at')
    .single()

  if (insertError || !submission) {
    console.error('[consent-form/submit] insert error:', insertError)
    return NextResponse.json({ error: 'Failed to submit consent form' }, { status: 500 })
  }

  // Render and store a signed PDF copy for the artist's records.
  try {
    const buffer = await renderToBuffer(
      ConsentFormFilledDocument({
        artistName,
        studioName: artist.studio_name,
        contactEmail: artistEmail ?? 'support@inkdesk.live',
        clientName: data.clientName,
        clientDob: data.clientDob,
        clientPhone: data.clientPhone ?? null,
        tattooDescription: data.tattooDescription,
        medicalAnswers: data.medicalAnswers,
        signatureName: data.signatureName,
        signedAt: submission.signed_at,
        ipAddress,
      }),
    )

    const pdfPath = `${artist.id}/${submission.id}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('consent-forms')
      .upload(pdfPath, buffer, { contentType: 'application/pdf', upsert: true })

    if (!uploadError) {
      await supabase
        .from('consent_form_submissions')
        .update({ pdf_path: pdfPath })
        .eq('id', submission.id)
    } else {
      console.error('[consent-form/submit] upload error:', uploadError)
    }
  } catch (pdfErr) {
    console.error('[consent-form/submit] PDF generation error:', pdfErr)
  }

  // Notify the artist — never block the client response on email delivery.
  if (artistEmail) {
    const { subject, html } = consentFormSubmittedTemplate({
      artistName,
      clientName: data.clientName,
      tattooDescription: data.tattooDescription,
      dashboardUrl: `${clientEnv.appUrl}/dashboard/consent-forms`,
      artistEmail,
    })

    void sendEmail({
      to: artistEmail,
      subject,
      html,
      emailType: 'consent_form_submitted',
      bookingId: data.bookingId ?? null,
      userId: artist.user_id,
      supabase,
    })
  }

  return NextResponse.json({ ok: true })
}
