import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PortfolioManagerWrapper } from '@/components/dashboard/PortfolioManagerWrapper'
import { resolveActivePlan } from '@/lib/stripe/plans'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Portfolio & Flash' }

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

  // 1. Fetch gallery photos
  const { data: imageRows } = await supabase
    .from('portfolio_images')
    .select('id, storage_path, public_url, display_order, caption, media_type, poster_url')
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })

  const images = (imageRows ?? []).map((img) => ({
    id: img.id,
    storagePath: img.storage_path,
    publicUrl: img.public_url,
    displayOrder: img.display_order,
    caption: img.caption,
    mediaType: (img.media_type === 'video' ? 'video' : 'image') as 'image' | 'video',
    posterUrl: img.poster_url ?? null,
  }))

  // 2. Fetch flash designs
  const { data: flashRows } = await supabase
    .from('flash_designs')
    .select('id, title, price, size_cm, image_path, status, created_at')
    .eq('artist_id', artist.id)
    .order('created_at', { ascending: false })

  const flash = (flashRows ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    price: Number(f.price),
    size_cm: f.size_cm,
    image_path: f.image_path,
    status: f.status as 'available' | 'booked' | 'hidden',
    created_at: f.created_at,
  }))

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Portfolio & Flash</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Manage your public gallery photos and upload flash designs for client booking.
        </p>
      </div>
      <PortfolioManagerWrapper
        artistId={artist.id}
        images={images}
        flash={flash}
        plan={plan}
      />
    </div>
  )
}
