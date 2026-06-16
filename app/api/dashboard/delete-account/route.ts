import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

export async function POST(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // Load subscription for cancellation
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Cancel Stripe subscription
  if (subscription?.stripe_subscription_id) {
    try {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } catch (err) {
      console.error('[delete-account] Stripe cancel error:', err instanceof Error ? err.message : err)
      // Non-fatal — proceed with soft delete
    }
  }

  // Soft-delete artist record
  const { error: artistError } = await supabase
    .from('artists')
    .update({ deleted_at: now, updated_at: now })
    .eq('user_id', user.id)

  if (artistError) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }

  // Soft-delete profile
  await supabase
    .from('profiles')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', user.id)

  // Sign out
  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
