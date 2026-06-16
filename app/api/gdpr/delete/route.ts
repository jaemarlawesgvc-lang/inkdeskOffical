import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
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
    const stripe = getStripe()

    // 1. Fetch Profile for Stripe Customer ID
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Cancel Stripe Subscriptions
    if (profile.stripe_customer_id) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: 'active'
        })
        for (const sub of subscriptions.data) {
          await stripe.subscriptions.cancel(sub.id)
        }
      } catch (stripeErr) {
        console.error('[gdpr-delete] Failed to cancel stripe subscriptions:', stripeErr)
        Sentry.captureException(stripeErr)
        // Proceed with deletion even if Stripe fails
      }
    }

    const now = new Date().toISOString()

    // 3. Soft-delete Artist record
    const { error: artistError } = await adminClient
      .from('artists')
      .update({ deleted_at: now })
      .eq('user_id', user.id)

    if (artistError) {
      console.error('[gdpr-delete] Failed to soft-delete artist:', artistError)
      Sentry.captureException(artistError)
      return NextResponse.json({ error: 'Failed to delete artist record' }, { status: 500 })
    }

    // 4. Soft-delete Profile record
    const { error: profileDelError } = await adminClient
      .from('profiles')
      .update({ deleted_at: now })
      .eq('id', user.id)

    if (profileDelError) {
      console.error('[gdpr-delete] Failed to soft-delete profile:', profileDelError)
      Sentry.captureException(profileDelError)
      return NextResponse.json({ error: 'Failed to delete profile record' }, { status: 500 })
    }

    // 5. Send confirmation email
    const resend = new Resend(env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: profile.email ?? user.email ?? '',
      subject: `Account Deletion Confirmation - ${env.NEXT_PUBLIC_APP_NAME}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #080808; color: #f5f1e8; border-radius: 8px;">
          <h2 style="color: #ef4444; border-bottom: 1px solid #1a1a1a; padding-bottom: 10px;">Account Deleted</h2>
          <p>Hi,</p>
          <p>This email confirms that your account on ${env.NEXT_PUBLIC_APP_NAME} has been successfully deleted.</p>
          <p>All associated data has been soft-deleted and will be permanently removed in accordance with our retention policy.</p>
          <p>Any active subscriptions have been cancelled immediately.</p>
          <p>We're sorry to see you go!</p>
          <p style="font-size: 12px; color: #808080; border-top: 1px solid #1a1a1a; padding-top: 20px;">
            If you did not request this deletion, please reply to this email immediately.
          </p>
        </div>
      `
    })

    if (emailError) {
      console.error('[gdpr-delete] Resend dispatch error:', emailError)
      Sentry.captureException(emailError)
      // Do not fail the request if just the email fails
    }

    // Optional: Log out user? The client handles clearing session

    console.log(
      JSON.stringify({
        level: 'info',
        event: 'gdpr.delete',
        userId: user.id,
        timestamp: new Date().toISOString()
      })
    )

    return NextResponse.json({ success: true, message: 'Account successfully deleted' })

  } catch (err) {
    console.error('[gdpr-delete] Unexpected error:', err)
    Sentry.captureException(err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
