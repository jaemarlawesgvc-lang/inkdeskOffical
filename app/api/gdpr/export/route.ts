import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { env } from '@/lib/env'
import * as Sentry from '@sentry/nextjs'

export async function POST() {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createSupabaseAdminClient()

    // 1. Fetch Profile
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Fetch Artist Profile (if exists)
    const { data: artist } = await adminClient
      .from('artists')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    let bookings: Record<string, unknown>[] = []
    let clients: Record<string, unknown>[] = []

    if (artist) {
      // 3. Fetch bookings for this artist
      const { data: bookingsData } = await adminClient
        .from('bookings')
        .select('*')
        .eq('artist_id', artist.id)

      bookings = bookingsData ?? []

      // 4. Fetch clients for this artist
      const { data: clientsData } = await adminClient
        .from('clients')
        .select('*')
        .eq('artist_id', artist.id)

      clients = clientsData ?? []
    }

    // 5. Fetch email logs
    const { data: emailLogs } = await adminClient
      .from('email_logs')
      .select('*')
      .eq('user_id', user.id)

    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      profile,
      artist: artist ?? null,
      bookings,
      clients,
      email_logs: emailLogs ?? []
    }

    // 6. Upload JSON to private storage bucket
    const fileName = `gdpr-exports/${user.id}/export-${Date.now()}.json`
    const { error: uploadError } = await adminClient.storage
      .from('reference-images')
      .upload(fileName, JSON.stringify(exportData, null, 2), {
        contentType: 'application/json',
        upsert: true
      })

    if (uploadError) {
      console.error('[gdpr-export] Storage upload error:', uploadError)
      Sentry.captureException(uploadError)
      return NextResponse.json({ error: 'Failed to save export data' }, { status: 500 })
    }

    // 7. Generate Signed URL (24h = 86400s)
    const { data: urlData, error: urlError } = await adminClient.storage
      .from('reference-images')
      .createSignedUrl(fileName, 86400)

    if (urlError || !urlData?.signedUrl) {
      console.error('[gdpr-export] Signed URL generation error:', urlError)
      Sentry.captureException(urlError)
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    // 8. Dispatch Email via Resend
    const resend = new Resend(env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: user.email ?? '',
      subject: `Your ${env.NEXT_PUBLIC_APP_NAME} GDPR Data Export`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #080808; color: #f5f1e8; border-radius: 8px;">
          <h2 style="color: #ffb700; border-bottom: 1px solid #1a1a1a; padding-bottom: 10px;">GDPR Data Export</h2>
          <p>Hi,</p>
          <p>You requested an export of all personal data held by ${env.NEXT_PUBLIC_APP_NAME} under GDPR rules.</p>
          <p>Your download link is ready and will expire in 24 hours.</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="${urlData.signedUrl}" style="background-color: #ffb700; color: #080808; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Download Data Export (JSON)</a>
          </div>
          <p style="font-size: 12px; color: #808080; border-top: 1px solid #1a1a1a; padding-top: 20px;">
            If you did not request this, please secure your account immediately.
          </p>
        </div>
      `
    })

    if (emailError) {
      console.error('[gdpr-export] Resend dispatch error:', emailError)
      Sentry.captureException(emailError)
      return NextResponse.json({ error: 'Failed to send export email' }, { status: 500 })
    }

    // Log structured log
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'gdpr.export',
        userId: user.id,
        timestamp: new Date().toISOString()
      })
    )

    return NextResponse.json({ success: true, message: 'Data export link has been emailed' })

  } catch (err) {
    console.error('[gdpr-export] Unexpected error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
