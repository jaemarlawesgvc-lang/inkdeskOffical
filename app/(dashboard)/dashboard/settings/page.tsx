import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/dashboard/SettingsForm'
import { AccountSection } from '@/components/dashboard/AccountSection'
import { FaqManager } from '@/components/dashboard/FaqManager'
import { CredentialsManager } from '@/components/dashboard/CredentialsManager'
import { resolveActivePlan } from '@/lib/stripe/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: artist } = await supabase
    .from('artists')
    .select(
      `
      *,
      artist_availability (
        day_of_week,
        start_time,
        end_time,
        timezone
      )
    `,
    )
    .eq('user_id', user.id)
    .single()

  if (!artist) redirect('/onboarding')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  const availability = (
    (artist.artist_availability as {
      day_of_week: number
      start_time: string
      end_time: string
      timezone: string
    }[]) ?? []
  )
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((s) => ({
      dayOfWeek: s.day_of_week,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
    }))

  const firstSlot = (
    artist.artist_availability as { timezone: string }[] | null
  )?.[0]

  const { data: faqRows } = await supabase
    .from('artist_faqs')
    .select('id, question, answer, display_order')
    .eq('artist_id', artist.id)
    .order('display_order', { ascending: true })

  const faqs = (faqRows ?? []).map((f) => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    displayOrder: f.display_order,
  }))

  const { data: credentialRows } = await supabase
    .from('artist_credentials')
    .select('id, type, title, issuing_body, year, expiry_date, url, storage_path')
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const credentials = (credentialRows ?? []).map((c) => ({
    id: c.id,
    type: c.type as 'license' | 'award' | 'publication',
    title: c.title,
    issuingBody: c.issuing_body,
    year: c.year,
    expiryDate: c.expiry_date,
    url: c.url,
    storagePath: c.storage_path,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Manage your profile, pricing, and account.</p>
      </div>

      <AccountSection
        userEmail={user.email ?? ''}
        lastSignIn={user.last_sign_in_at ?? null}
        username={artist.username}
      />

      <SettingsForm
        artistId={artist.id}
        plan={plan}
        initialData={{
          displayName: artist.display_name ?? '',
          bio: artist.bio ?? '',
          styleTags: (artist.style_tags as string[]) ?? [],
          instagramHandle: artist.instagram_handle ?? '',
          studioName: artist.studio_name ?? '',
          studioAddress: artist.studio_address ?? '',
          studioLat: artist.studio_lat ?? null,
          studioLng: artist.studio_lng ?? null,
          hourlyRate: artist.hourly_rate ?? null,
          depositAmount: artist.deposit_amount ?? null,
          depositRequired: artist.deposit_required ?? true,
          pricingNotes: artist.pricing_notes ?? '',
          priceTier: artist.price_tier ?? '££',
          timezone: firstSlot?.timezone ?? 'Europe/London',
          availability,
          emailBookingConfirmation: artist.email_booking_confirmation ?? true,
          emailReminders: artist.email_reminders ?? true,
          emailAftercare: artist.email_aftercare ?? true,
        }}
      />

      <section id="faq" className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">FAQ</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Shown on your public FAQ page at /{artist.username}/faq
          </p>
        </div>
        <FaqManager initialFaqs={faqs} />
      </section>

      <section id="credentials" className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Credentials</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Licenses are kept private — only a &ldquo;Licensed&rdquo; badge is shown publicly. Awards and publications appear on your page.
          </p>
        </div>
        <CredentialsManager artistId={artist.id} initialCredentials={credentials} />
      </section>
    </div>
  )
}
