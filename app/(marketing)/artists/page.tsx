'use client'

import { useState, useEffect } from 'react'
import { ArtistSearchBar } from '@/components/public/ArtistSearchBar'
import { ArtistFilters } from '@/components/public/ArtistFilters'
import { ArtistCard } from '@/components/public/ArtistCard'

interface Artist {
  id: string
  username: string
  displayName: string
  bio: string | null
  styleTags: string[]
  studioName: string | null
  studioAddress: string | null
  depositRequired: boolean
  depositAmount: number | null
  portfolioImages: string[]
  rating: number
  reviewCount: number
  isVerified?: boolean
  priceTier?: string
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('')
  const [selectedPriceTier, setSelectedPriceTier] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function fetchArtists() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set('q', searchQuery)
        if (selectedStyle) params.set('style', selectedStyle)
        if (selectedPriceTier) params.set('priceTier', selectedPriceTier)

        const res = await fetch(`/api/artists/search?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Failed to fetch artists')
        }
        const data = (await res.json()) as { artists: Artist[] }
        if (active) {
          setArtists(data.artists)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'An error occurred')
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchArtists()

    return () => {
      active = false
    }
  }, [searchQuery, selectedStyle, selectedPriceTier])

  return (
    <section className="relative min-h-screen bg-gradient-ink pt-32 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Subtle noise texture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-60" />

      {/* Radial glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-gold-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 mb-6">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse-gold"
            />
            <span className="text-xs font-semibold text-gold-400 tracking-wide uppercase">
              Tattoo Discovery
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-black leading-tight text-parchment-100 mb-6">
            Find Your Next{' '}
            <span className="bg-gradient-gold bg-clip-text text-transparent">
              Tattoo Artist
            </span>
          </h1>

          <p className="text-base sm:text-lg text-ink-400 leading-relaxed">
            Browse portfolios, filter by styles, check availability, and book your session directly with independent artists.
          </p>
        </div>

        {/* Search & Filter section */}
        <div className="max-w-4xl mx-auto space-y-8 mb-16 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
          <ArtistSearchBar value={searchQuery} onChange={setSearchQuery} />
          <ArtistFilters
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            selectedPriceTier={selectedPriceTier}
            onPriceTierChange={setSelectedPriceTier}
          />
        </div>

        {/* Results section */}
        <div className="w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-ink-500">Searching for artists...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl max-w-xl mx-auto p-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-12 h-12 text-rose-500/80 mx-auto mb-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              <h3 className="text-base font-semibold text-white mb-2">Failed to Load Artists</h3>
              <p className="text-xs text-ink-500 mb-6">{error}</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Reset Search
              </button>
            </div>
          ) : artists.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] border border-white/[0.06] rounded-2xl max-w-xl mx-auto p-8">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
                className="w-16 h-16 text-white/10 mx-auto mb-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                />
              </svg>
              <h3 className="text-base font-semibold text-white mb-2">No Artists Found</h3>
              <p className="text-xs text-ink-500 mb-6">
                We couldn&apos;t find any artists matching &quot;{searchQuery || selectedStyle}&quot;. Try broadening your search terms or filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedStyle('')
                  setSelectedPriceTier('')
                }}
                className="px-4 py-2 bg-gold-500 text-ink-950 rounded-lg text-xs font-semibold hover:bg-gold-400 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {artists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  username={artist.username}
                  displayName={artist.displayName}
                  bio={artist.bio}
                  styleTags={artist.styleTags}
                  studioName={artist.studioName}
                  studioAddress={artist.studioAddress}
                  portfolioImages={artist.portfolioImages}
                  rating={artist.rating}
                  reviewCount={artist.reviewCount}
                  depositRequired={artist.depositRequired}
                  depositAmount={artist.depositAmount}
                  isVerified={artist.isVerified}
                  priceTier={artist.priceTier}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
