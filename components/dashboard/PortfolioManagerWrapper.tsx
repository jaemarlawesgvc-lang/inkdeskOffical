'use client'

import { useState } from 'react'
import { PortfolioGrid } from './PortfolioGrid'
import { FlashManager } from './FlashManager'
import type { Plan } from '@/lib/stripe/plans'

interface PortfolioImage {
  id: string
  storagePath: string
  publicUrl: string
  displayOrder: number
  caption: string | null
  mediaType: 'image' | 'video'
  posterUrl: string | null
}

interface FlashDesign {
  id: string
  title: string
  price: number
  size_cm: string | null
  image_path: string
  status: 'available' | 'booked' | 'hidden'
  created_at: string
}

interface PortfolioManagerWrapperProps {
  artistId: string
  images: PortfolioImage[]
  flash: FlashDesign[]
  plan: Plan
}

export function PortfolioManagerWrapper({ artistId, images, flash, plan }: PortfolioManagerWrapperProps) {
  const [activeTab, setActiveTab] = useState<'photos' | 'flash'>('photos')

  return (
    <div className="space-y-6">
      {/* Tab bar navigation */}
      <div className="border-b border-white/10 flex gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('photos')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'photos' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}
        >
          Gallery Photos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('flash')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'flash' ? 'text-white border-white' : 'text-white/40 border-transparent hover:text-white/70'}`}
        >
          Flash Designs
        </button>
      </div>

      {activeTab === 'photos' ? (
        <PortfolioGrid artistId={artistId} images={images} plan={plan} />
      ) : (
        <FlashManager artistId={artistId} initialFlash={flash} />
      )}
    </div>
  )
}
