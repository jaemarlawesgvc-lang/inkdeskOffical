import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PagePreviewClient } from '@/components/dashboard/PagePreviewClient'
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

  const { data: artist } = await supabase
    .from('artists')
    .select('id, username, site_data, site_generated')
    .eq('user_id', user.id)
    .single()

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">My Page</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Preview and manage your public artist page.
          </p>
        </div>
        {artist.username && (
          <a
            href={`/${artist.username}`}
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

      <PagePreviewClient
        artistId={artist.id}
        siteData={artist.site_data as Record<string, unknown> | null}
        canRegenerate={canRegenerate}
        generationsUsed={generationsUsed}
        generationLimit={generationLimit === Infinity ? null : generationLimit}
        plan={plan}
      />
    </div>
  )
}
