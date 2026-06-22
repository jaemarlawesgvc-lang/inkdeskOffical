import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ArtistsTable } from '@/components/admin/ArtistsTable'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Artists' }

interface AdminArtistSubscription {
  plan: string
  status: string
}

interface AdminArtistProfile {
  email: string
  subscriptions: AdminArtistSubscription | AdminArtistSubscription[] | null
}

interface AdminArtistRow {
  id: string
  user_id: string
  username: string
  display_name: string | null
  is_verified: boolean | null
  onboarding_complete: boolean | null
  onboarding_step: number | null
  created_at: string
  profiles: AdminArtistProfile | AdminArtistProfile[] | null
}

export default async function AdminArtistsPage() {
  const supabase = createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all artists joined with their profile and subscription
  const { data: artists } = await supabase
    .from('artists')
    .select(`
      id,
      user_id,
      username,
      display_name,
      is_verified,
      onboarding_complete,
      onboarding_step,
      created_at,
      profiles!artists_user_id_fkey (
        email,
        subscriptions (
          plan,
          status
        )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  const mappedArtists = (artists ?? []).map((a: AdminArtistRow) => {
    const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    const sub = profile
      ? (Array.isArray(profile.subscriptions) ? profile.subscriptions[0] : profile.subscriptions)
      : null
    const isActive = sub?.status === 'active' || sub?.status === 'trialing'
    return {
      id: a.id,
      userId: a.user_id,
      username: a.username,
      displayName: a.display_name,
      email: profile?.email ?? '',
      plan: isActive && sub ? sub.plan : 'free',
      onboardingComplete: a.onboarding_complete ?? false,
      onboardingStep: a.onboarding_step ?? 1,
      createdAt: a.created_at,
      isVerified: a.is_verified ?? false,
    }
  })

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Artist Management</h1>
        <p className="text-white/40 text-sm mt-0.5">
          View all artist accounts and their status
        </p>
      </div>

      <ArtistsTable initialArtists={mappedArtists} />
    </div>
  )
}
