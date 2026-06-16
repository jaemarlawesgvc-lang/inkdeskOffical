import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PortfolioImageMeta } from '@/lib/validations/onboarding'
import type { Metadata } from 'next'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata: Metadata = {
  title: 'Set up your InkDesk profile',
  description: 'Complete your artist profile to start taking bookings.',
  robots: { index: false, follow: false },
}

interface ArtistRow {
  id: string
  username: string | null
  display_name: string | null
  bio: string | null
  style_tags: string[] | null
  instagram_handle: string | null
  hourly_rate: number | null
  deposit_amount: number | null
  deposit_required: boolean
  onboarding_complete: boolean
  onboarding_step: number
  timezone: string | null
  portfolio_images?: {
    storage_path: string
    public_url: string
    caption: string | null
    display_order: number
  }[]
  artist_availability?: {
    day_of_week: number
    start_time: string
    end_time: string
  }[]
}

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select(
      `
      id,
      username,
      display_name,
      bio,
      style_tags,
      instagram_handle,
      hourly_rate,
      deposit_amount,
      deposit_required,
      onboarding_complete,
      onboarding_step,
      timezone,
      portfolio_images (
        storage_path,
        public_url,
        caption,
        display_order
      ),
      artist_availability (
        day_of_week,
        start_time,
        end_time
      )
    `,
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (artistError) {
    console.error('[onboarding] artist lookup error:', artistError.message)
  }

  if (!artist) {
    const { data: newArtist, error: insertError } = await supabase
      .from('artists')
      .insert({
        user_id: user.id,
        username: `user-${user.id.slice(0, 8)}`,
        onboarding_step: 1,
        onboarding_complete: false,
      })
      .select('id, username, onboarding_step, onboarding_complete')
      .single()

    if (insertError || !newArtist) {
      console.error('[onboarding] self-heal insert error:', insertError?.message)
      redirect('/login?error=setup_failed')
    }

    redirect('/onboarding')
  }

  const typedArtist = artist as unknown as ArtistRow

  if (typedArtist.onboarding_complete) {
    redirect('/dashboard')
  }

  const portfolioImages: PortfolioImageMeta[] = Array.isArray(
    typedArtist.portfolio_images,
  )
    ? [...typedArtist.portfolio_images]
        .sort((a, b) => a.display_order - b.display_order)
        .map((img) => ({
          storagePath: img.storage_path,
          publicUrl: img.public_url,
          caption: img.caption ?? '',
          displayOrder: img.display_order,
        }))
    : []

  const availabilitySource = Array.isArray(typedArtist.artist_availability)
    ? typedArtist.artist_availability
    : []

  const availabilitySlots = availabilitySource
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((s) => ({
      dayOfWeek: s.day_of_week,
      startTime: s.start_time.slice(0, 5),
      endTime: s.end_time.slice(0, 5),
    }))

  const artistForWizard = {
    id: typedArtist.id,
    username: typedArtist.username,
    displayName: typedArtist.display_name,
    bio: typedArtist.bio,
    styleTags: typedArtist.style_tags ?? [],
    instagramHandle: typedArtist.instagram_handle,
    hourlyRate: typedArtist.hourly_rate,
    depositAmount: typedArtist.deposit_amount,
    depositRequired: typedArtist.deposit_required,
    timezone: typedArtist.timezone ?? 'Europe/London',
    onboardingStep: typedArtist.onboarding_step,
    onboardingComplete: typedArtist.onboarding_complete,
    portfolioImages,
    availabilitySlots,
  }

  console.log('[onboarding] artist row OK', {
    id: artistForWizard.id,
    onboardingStep: artistForWizard.onboardingStep,
    portfolioImagesCount: portfolioImages.length,
    availabilitySlotsCount: availabilitySlots.length,
    timezone: artistForWizard.timezone,
  })

  return <OnboardingWizard artist={artistForWizard} />
}