import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortfolioGrid } from '@/components/dashboard/PortfolioGrid'
import { resolveActivePlan } from '@/lib/stripe/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Portfolio' }

export default async function PortfolioPage() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) redirect('/onboarding')

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = resolveActivePlan(subscription)

  const { data: imageRows } = await supabase
    .from('portfolio_images')
    .select('id, storage_path, public_url, display_order, caption')
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  const images = (imageRows ?? []).map((img) => ({
    id: img.id,
    storagePath: img.storage_path,
    publicUrl: img.public_url,
    displayOrder: img.display_order,
    caption: img.caption,
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Drag to reorder. Images appear on your public page in this order.
        </p>
      </div>
      <PortfolioGrid artistId={artist.id} images={images} plan={plan} />
    </div>
  )
}
