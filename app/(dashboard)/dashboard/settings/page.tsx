import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/dashboard/SettingsForm'
import { AccountSection } from '@/components/dashboard/AccountSection'
import { FaqManager } from '@/components/dashboard/FaqManager'
import { resolveActivePlan } from '@/lib/stripe/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Use select('*') so the query never fails if any notification column is
  // missing from the database (older schemas may not have them yet).
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (artistError) console.error('[settings] artist query failed:', artistError)
  if (!artist) redirect('/onboarding')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  // ── FAQs (table may not exist yet) ──
  let faqs: { id: string; question: string; answer: string; displayOrder: number }[] = []
  try {
    const { data: faqRows } = await supabase
      .from('artist_faqs')
      .select('id, question, answer, display_order')
      .eq('artist_id', artist.id as string)
      .order('display_order', { ascending: true })

    faqs = (faqRows ?? []).map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      displayOrder: f.display_order,
    }))
  } catch {
    console.warn('[settings] artist_faqs query failed — table may not exist')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Manage your notifications, billing, and account.</p>
      </div>

      <AccountSection
        userEmail={user.email ?? ''}
        lastSignIn={user.last_sign_in_at ?? null}
        username={(artist.username as string) ?? ''}
      />

      <SettingsForm
        artistId={artist.id as string}
        plan={plan}
        initialData={{
          emailBookingConfirmation: (artist.email_booking_confirmation as boolean) ?? true,
          emailReminders: (artist.email_reminders as boolean) ?? true,
          emailAftercare: (artist.email_aftercare as boolean) ?? true,
        }}
      />

      <section id="faq" className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">FAQ</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Shown on your public FAQ page at /{artist.username as string}/faq
          </p>
        </div>
        <FaqManager initialFaqs={faqs} />
      </section>
    </div>
  )
}
