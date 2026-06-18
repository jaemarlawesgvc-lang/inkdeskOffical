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

  // ── Load artist (try with availability join, fallback to plain select) ──
  let artist: Record<string, unknown> | null = null

  const { data: artistWithAvail, error: joinError } = await supabase
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

  if (!joinError && artistWithAvail) {
    artist = artistWithAvail
  } else {
    // Fallback: try without the join (timezone column may not exist)
    console.warn('[settings] Join query failed, trying without availability join:', joinError?.message)
    const { data: artistOnly } = await supabase
      .from('artists')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (artistOnly) {
      artist = { ...artistOnly, artist_availability: [] }
    }
  }

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
      startTime: s.start_time?.slice(0, 5) ?? '09:00',
      endTime: s.end_time?.slice(0, 5) ?? '17:00',
    }))

  const firstSlot = (
    artist.artist_availability as { timezone: string }[] | null
  )?.[0]

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

  // ── Credentials (table may not exist yet) ──
  let credentials: {
    id: string
    type: 'license' | 'award' | 'publication'
    title: string
    issuingBody: string | null
    year: number | null
    expiryDate: string | null
    url: string | null
    storagePath: string | null
  }[] = []
  try {
    const { data: credentialRows } = await supabase
      .from('artist_credentials')
      .select('id, type, title, issuing_body, year, expiry_date, url, storage_path')
      .eq('artist_id', artist.id as string)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    credentials = (credentialRows ?? []).map((c) => ({
      id: c.id,
      type: c.type as 'license' | 'award' | 'publication',
      title: c.title,
      issuingBody: c.issuing_body,
      year: c.year,
      expiryDate: c.expiry_date,
      url: c.url,
      storagePath: c.storage_path,
    }))
  } catch {
    console.warn('[settings] artist_credentials query failed — table may not exist')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Manage your profile, pricing, and account.</p>
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
          displayName: (artist.display_name as string) ?? '',
          bio: (artist.bio as string) ?? '',
          styleTags: (artist.style_tags as string[]) ?? [],
          instagramHandle: (artist.instagram_handle as string) ?? '',
          studioName: (artist.studio_name as string) ?? '',
          studioAddress: (artist.studio_address as string) ?? '',
          studioLat: (artist.studio_lat as number) ?? null,
          studioLng: (artist.studio_lng as number) ?? null,
          hourlyRate: (artist.hourly_rate as number) ?? null,
          depositAmount: (artist.deposit_amount as number) ?? null,
          depositRequired: (artist.deposit_required as boolean) ?? true,
          pricingNotes: (artist.pricing_notes as string) ?? '',
          priceTier: (artist.price_tier as string) ?? '££',
          timezone: firstSlot?.timezone ?? 'Europe/London',
          availability,
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

      <section id="credentials" className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Credentials</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Licenses are kept private — only a &ldquo;Licensed&rdquo; badge is shown publicly. Awards and publications appear on your page.
          </p>
        </div>
        <CredentialsManager artistId={artist.id as string} initialCredentials={credentials} />
      </section>
    </div>
  )
}
