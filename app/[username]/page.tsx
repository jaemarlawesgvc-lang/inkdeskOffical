import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { isFullyBookedNext14Days } from '@/lib/booking/availability'
import { clientEnv } from '@/lib/env.client'
import { PublicHeader } from '@/components/public/PublicHeader'
import { HeroSection } from '@/components/public/HeroSection'
import { PortfolioMarquee } from '@/components/public/PortfolioMarquee'
import { PortfolioSection } from '@/components/public/PortfolioSection'
import { AboutSection } from '@/components/public/AboutSection'
import { ServicesSection } from '@/components/public/ServicesSection'
import { CredentialsSection } from '@/components/public/CredentialsSection'
import { StudioSection } from '@/components/public/StudioSection'
import { ReviewsSection } from '@/components/public/ReviewsSection'
import { WaitlistButton } from '@/components/public/WaitlistButton'
import { BookingSection } from '@/components/public/BookingSection'
import { StickyBookCta } from '@/components/public/StickyBookCta'
import { Footer } from '@/components/public/Footer'
import { JsonLd } from '@/components/public/JsonLd'

// Always render from live DB state. ISR caching previously meant a 404 rendered
// before onboarding completed could be served stale for up to an hour after the
// page went live. Booking pages are low-traffic and must reflect the current
// published state immediately, so we render dynamically.
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SiteData {
  hero?: { headline?: string; subheadline?: string; ctaText?: string }
  about?: { title?: string; body?: string }
  services?: { name: string; description: string; priceFrom: string }[]
  seoTitle?: string
  seoDescription?: string
  colorScheme?: { primary?: string; secondary?: string; accent?: string }
}

interface ArtistRecord {
  id: string
  user_id: string
  username: string
  display_name: string | null
  bio: string | null
  style_tags: string[] | null
  years_experience: number | null
  deposit_required: boolean
  deposit_amount: number | null
  studio_name: string | null
  studio_address: string | null
  studio_lat: number | null
  studio_lng: number | null
  instagram_handle: string | null
  pricing_notes: string | null
  site_data: SiteData | null
  onboarding_complete: boolean
  portfolio_images: { public_url: string; caption: string | null; display_order: number }[]
  profiles: { email: string } | null
}

const DEFAULT_ACCENT = '#d4af37' // gold

// ---------------------------------------------------------------------------
// Data loader (shared by page + generateMetadata)
// ---------------------------------------------------------------------------

async function loadArtist(username: string): Promise<ArtistRecord | null> {
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('artists')
    .select(
      `
      *,
      portfolio_images (
        public_url,
        caption,
        display_order
      ),
      profiles (
        email
      )
    `,
    )
    .eq('username', username.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) {
    console.error('[loadArtist] Query failed:', { error, data, username })
    return null
  }
  console.log('[loadArtist] Found artist:', { username: data.username, onboarding_complete: data.onboarding_complete })
  return data as unknown as ArtistRecord
}

// ---------------------------------------------------------------------------
// SEO metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const artist = await loadArtist(username)

  if (!artist || !artist.onboarding_complete) {
    return {
      title: 'Artist not found — InkDesk',
      robots: { index: false, follow: false },
    }
  }

  const site = artist.site_data ?? {}
  const name = artist.display_name ?? artist.username
  const title = site.seoTitle ?? `${name} — Tattoo Artist`
  const description =
    site.seoDescription ??
    artist.bio ??
    `Book a tattoo session with ${name}. View portfolio and availability.`
  const canonical = `${clientEnv.appUrl}/${artist.username}`
  const ogImage = artist.portfolio_images
    ?.slice()
    .sort((a, b) => a.display_order - b.display_order)[0]?.public_url

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'profile',
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const artist = await loadArtist(username)

  if (!artist) {
    notFound()
  }

  // The page goes "live" (publicly visible) once onboarding is complete.
  // Before then, only the artist who owns this profile may preview it — so
  // the dashboard "View live page" link works during setup. Everyone else 404s.
  let isOwnerPreview = false
  if (!artist.onboarding_complete) {
    const sessionClient = createSupabaseServerClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()

    if (user && user.id === artist.user_id) {
      isOwnerPreview = true
    } else {
      notFound()
    }
  }

  const site = artist.site_data ?? {}
  const name = artist.display_name ?? artist.username
  const accent = site.colorScheme?.accent ?? DEFAULT_ACCENT
  // Primary themes the page background; secondary adds an atmospheric tint.
  // Every section is translucent, so they inherit these automatically.
  const primary = site.colorScheme?.primary ?? '#0a0a0a'
  const secondary = site.colorScheme?.secondary ?? '#111827'

  const portfolio = (artist.portfolio_images ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((img) => ({ publicUrl: img.public_url, caption: img.caption ?? '' }))

  const styleTags = Array.isArray(artist.style_tags) ? artist.style_tags : []
  const services = site.services ?? []
  const canonical = `${clientEnv.appUrl}/${artist.username}`

  const heroHeadline = site.hero?.headline ?? name
  const heroSub =
    site.hero?.subheadline ??
    (styleTags.length > 0 ? styleTags.join(' · ') : 'Custom tattoos by appointment')
  const heroCta = site.hero?.ctaText ?? 'Book Now'

  const aboutTitle = site.about?.title ?? 'About'
  const aboutBody = site.about?.body ?? artist.bio ?? ''

  const supabase = createSupabaseAdminClient()
  const { count: faqCount } = await supabase
    .from('artist_faqs')
    .select('id', { count: 'exact', head: true })
    .eq('artist_id', artist.id)

  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('id, rating, body, photo_url, client_name')
    .eq('artist_id', artist.id)
    .eq('approved', true)
    .eq('flagged', false)
    .not('rating', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  const reviews = (reviewRows ?? []).map((r) => {
    const parts = r.client_name.trim().split(/\s+/)
    const first = parts[0] ?? 'Client'
    const lastInitial = parts.length > 1 ? `${parts[parts.length - 1]?.charAt(0)}.` : ''
    return {
      id: r.id,
      rating: r.rating ?? 0,
      body: r.body,
      photoUrl: r.photo_url,
      clientDisplayName: lastInitial ? `${first} ${lastInitial}` : first,
    }
  })

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null

  const fullyBooked = await isFullyBookedNext14Days(supabase, artist.id)

  const today = new Date().toISOString().slice(0, 10)
  const { data: credentialRows } = await supabase
    .from('artist_credentials')
    .select('id, type, title, issuing_body, year, url, storage_path, expiry_date')
    .eq('artist_id', artist.id)
    .is('deleted_at', null)

  const isLicensed = (credentialRows ?? []).some(
    (c) => c.type === 'license' && (!c.expiry_date || c.expiry_date >= today),
  )

  const hasAward = (credentialRows ?? []).some((c) => c.type === 'award')

  const publicCredentials = await Promise.all(
    (credentialRows ?? [])
      .filter((c) => c.type === 'award' || c.type === 'publication')
      .map(async (c) => {
        let imageUrl: string | null = null
        if (c.storage_path) {
          const { data: signed } = await supabase.storage
            .from('credentials')
            .createSignedUrl(c.storage_path, 3600)
          imageUrl = signed?.signedUrl ?? null
        }
        return {
          id: c.id,
          type: c.type as 'award' | 'publication',
          title: c.title,
          issuingBody: c.issuing_body,
          year: c.year,
          url: c.url,
          imageUrl,
        }
      }),
  )

  return (
    <>
      <JsonLd
        name={name}
        description={artist.bio ?? heroSub}
        url={canonical}
        image={portfolio[0]?.publicUrl ?? null}
        address={artist.studio_address}
      />

      <div
        id="top"
        className="min-h-screen text-white"
        style={{
          backgroundColor: primary,
          backgroundImage: `radial-gradient(75% 55% at 50% -8%, ${secondary}66 0%, transparent 70%)`,
          backgroundAttachment: 'fixed',
        }}
      >
        {isOwnerPreview && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-sm text-center px-4 py-2.5">
            Preview only — finish onboarding to publish this page publicly.
          </div>
        )}

        <PublicHeader
          artistName={name}
          username={artist.username}
          accentColor={accent}
          showAbout={Boolean(aboutBody || styleTags.length > 0)}
          showFaq={(faqCount ?? 0) > 0}
        />

        <HeroSection
          headline={heroHeadline}
          subheadline={heroSub}
          ctaText={heroCta}
          accentColor={accent}
          primaryColor={primary}
          artistName={name}
          instagramHandle={artist.instagram_handle}
          styleTags={styleTags}
          images={portfolio}
          yearsExperience={artist.years_experience}
          rating={avgRating}
          reviewCount={reviews.length}
          isLicensed={isLicensed}
        />

        {/* About now appears before the portfolio (swapped per request). */}
        {(aboutBody || styleTags.length > 0) && (
          <AboutSection
            title={aboutTitle}
            body={aboutBody}
            styleTags={styleTags}
            yearsExperience={artist.years_experience}
            instagramHandle={artist.instagram_handle}
            accentColor={accent}
          />
        )}

        <PortfolioMarquee images={portfolio} accentColor={accent} />

        <PortfolioSection images={portfolio} accentColor={accent} />

        <ServicesSection services={services} accentColor={accent} pricingNotes={artist.pricing_notes} />

        <ReviewsSection reviews={reviews} accentColor={accent} />

        <StudioSection
          studioName={artist.studio_name}
          studioAddress={artist.studio_address}
          lat={artist.studio_lat}
          lng={artist.studio_lng}
          accentColor={accent}
        />

        {fullyBooked && (
          <div className="px-6 py-12 text-center bg-white/[0.02]">
            <WaitlistButton artistId={artist.id} accentColor={accent} />
          </div>
        )}

        {/* Credentials sits just above booking, and only when an award exists. */}
        {hasAward && (
          <CredentialsSection credentials={publicCredentials} isLicensed={isLicensed} accentColor={accent} />
        )}

        <BookingSection
          artistId={artist.id}
          depositRequired={artist.deposit_required}
          depositAmount={artist.deposit_amount}
          accentColor={accent}
        />

        <Footer artistName={name} artistId={artist.id} artistEmail={artist.profiles?.email ?? undefined} />

        <StickyBookCta accentColor={accent} ctaText={heroCta} artistName={name} />
      </div>
    </>
  )
}
