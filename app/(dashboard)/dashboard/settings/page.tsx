import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/dashboard/SettingsForm'
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
      id,
      display_name,
      bio,
      style_tags,
      instagram_handle,
      studio_name,
      studio_address,
      hourly_rate,
      deposit_amount,
      deposit_required,
      email_booking_confirmation,
      email_reminders,
      email_aftercare,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Manage your profile, pricing, and account.</p>
      </div>

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
          hourlyRate: artist.hourly_rate,
          depositAmount: artist.deposit_amount,
          depositRequired: artist.deposit_required ?? true,
          timezone: firstSlot?.timezone ?? 'Europe/London',
          availability,
          emailBookingConfirmation: artist.email_booking_confirmation ?? true,
          emailReminders: artist.email_reminders ?? true,
          emailAftercare: artist.email_aftercare ?? true,
        }}
      />
    </div>
  )
}
