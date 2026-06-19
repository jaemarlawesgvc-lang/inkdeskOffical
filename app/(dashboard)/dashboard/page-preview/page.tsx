import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PagePreviewClient } from '@/components/dashboard/PagePreviewClient'
import { MyPageSettingsForm } from '@/components/dashboard/MyPageSettingsForm'
import { CredentialsManager } from '@/components/dashboard/CredentialsManager'
import { resolveActivePlan } from '@/lib/stripe/plans'
import { PLAN_LIMITS } from '@/lib/stripe/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'My Page' }

export default async function PagePreviewPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // ── Load artist with availability join ──
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
    console.warn('[page-preview] Join query failed, trying without availability join:', joinError?.message)
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

  // Count AI generations this month
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count: generationsThisMonth } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('action', 'ai_generation')
    .gte('created_at', monthStart.toISOString())

  const generationLimit = PLAN_LIMITS[plan].aiGenerationsPerMonth
  const generationsUsed = generationsThisMonth ?? 0
  const canRegenerate =
    generationLimit === Infinity || generationsUsed < generationLimit

  // ── Availability ──
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
    console.warn('[page-preview] artist_credentials query failed — table may not exist')
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My Page</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Manage your public artist page details.
          </p>
        </div>
        {(artist.username as string) && (
          <a
            href={`/${artist.username as string}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 text-white text-sm font-semibold rounded-lg hover:bg-white/20 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
            View live page
          </a>
        )}
      </div>

      {/* ── Profile, Studio, Pricing, Availability form ── */}
      <MyPageSettingsForm
        artistId={artist.id as string}
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
        }}
      />

      {/* ── Credentials ── */}
      <section className="bg-white/5 border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">Credentials</h2>
          <p className="text-white/40 text-sm mt-0.5">Licenses, awards, and publications shown on your public page.</p>
        </div>
        <CredentialsManager initialCredentials={credentials} />
      </section>

      {/* ── AI Page Builder ── */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Page builder</h2>
        <PagePreviewClient
          artistId={artist.id as string}
          siteData={artist.site_data as Record<string, unknown> | null}
          canRegenerate={canRegenerate}
          generationsUsed={generationsUsed}
          generationLimit={generationLimit === Infinity ? null : generationLimit}
          plan={plan}
          initialProfile={{
            displayName: (artist.display_name as string) ?? '',
            bio: (artist.bio as string) ?? '',
            styleTags: (artist.style_tags as string[]) ?? [],
            instagramHandle: (artist.instagram_handle as string) ?? '',
            studioName: (artist.studio_name as string) ?? '',
            studioAddress: (artist.studio_address as string) ?? '',
            studioLat: (artist.studio_lat as number) ?? null,
            studioLng: (artist.studio_lng as number) ?? null,
          }}
          initialCredentials={credentials}
        />
      </section>
    </div>
  )
}
