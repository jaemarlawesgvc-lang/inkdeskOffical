import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { BottomNav } from '@/components/dashboard/BottomNav'
import { TopBar } from '@/components/dashboard/TopBar'
import { DashboardTour } from '@/components/dashboard/DashboardTour'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Dashboard', template: '%s — Inkquire' },
  robots: { index: false, follow: false },
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If there is no user, just render an empty shell for now.
  // (You can add a login redirect later once loops are fixed.)
  if (!user) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center text-parchment-300">
        <p>Please log in to view your dashboard.</p>
      </div>
    )
  }

  // Load artist (may be null)
  const { data: artist } = await supabase
    .from('artists')
    .select('id, user_id, username, display_name, onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle()

  console.log('[dashboard/layout] user', user.id, 'artist', artist)

  const username = artist?.username ?? ''
  const displayName = artist?.display_name ?? user.email ?? 'Artist'

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan =
    subscription?.status === 'active' || subscription?.status === 'trialing'
      ? (subscription.plan as 'free' | 'pro' | 'studio')
      : 'free'

  return (
    <div className="relative min-h-screen bg-ink-950 flex">
      {/* Ambient layers — fixed so they don't scroll with content */}
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-noise opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 right-0 h-[32rem] w-[32rem] rounded-full bg-gold-500/[0.05] blur-3xl"
      />

      {/* Desktop sidebar */}
      <Sidebar username={username} />

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 lg:ml-60">
        <TopBar displayName={displayName} plan={plan} />
        <main className="flex-1 px-4 sm:px-6 py-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav username={username} />

      {/* First-run welcome popup + spotlight walkthrough of the dashboard */}
      <DashboardTour />
    </div>
  )
}