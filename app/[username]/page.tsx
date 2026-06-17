import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env.client'
import { PublicHeader } from '@/components/public/PublicHeader'
import { HeroSection } from '@/components/public/HeroSection'
import { PortfolioMarquee } from '@/components/public/PortfolioMarquee'
import { PortfolioSection } from '@/components/public/PortfolioSection'
import { AboutSection } from '@/components/public/AboutSection'
import { ServicesSection } from '@/components/public/ServicesSection'
import { CredentialsSection } from '@/components/public/CredentialsSection'
import { BookingSection } from '@/components/public/BookingSection'
import { Footer } from '@/components/public/Footer'
import { JsonLd } from '@/components/public/JsonLd'

// Public pages are served fresh; revalidate hourly to balance freshness and cost.
export const revalidate = 3600

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
  username: string
  display_name: string | null
  bio: string | null
  style_tags: string[] | null
  years_experience: number | null
  deposit_required: boolean
  deposit_amount: number | null
  studio_name: string | null
  studio_address: string | null
  instagram_handle: string | null
  pricing_notes: string | null
  site_data: SiteData | null
  onboarding_complete: boolean
  portfolio_images: { public_url: string; caption: string | null; display_order: number }[]
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
      id,
      username,
      display_name,
      bio,
      style_tags,
      years_experience,
      deposit_required,
      deposit_amount,
      studio_name,
      studio_address,
      instagram_handle,
      pricing_notes,
      site_data,
      onboarding_complete,
      portfolio_images (
        public_url,
        caption,
        display_order
      )
    `,
    )
    .eq('username', username.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null
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

  if (!artist || !artist.onboarding_complete) {
    notFound()
  }

  const site = artist.site_data ?? {}
  const name = artist.display_name ?? artist.username
  const accent = site.colorScheme?.accent ?? DEFAULT_ACCENT

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

  const today = new Date().toISOString().slice(0, 10)
  const { data: credentialRows } = await supabase
    .from('artist_credentials')
    .select('id, type, title, issuing_body, year, url, storage_path, expiry_date')
    .eq('artist_id', artist.id)
    .is('deleted_at', null)

  const isLicensed = (credentialRows ?? []).some(
    (c) => c.type === 'license' && (!c.expiry_date || c.expiry_date >= today),
  )

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

      <div id="top" className="min-h-screen bg-black text-white">
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
          artistName={name}
          styleTags={styleTags}
          images={portfolio}
        />

        <PortfolioMarquee images={portfolio} accentColor={accent} />

        <PortfolioSection images={portfolio} accentColor={accent} />

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

        <ServicesSection services={services} accentColor={accent} pricingNotes={artist.pricing_notes} />

        <CredentialsSection credentials={publicCredentials} isLicensed={isLicensed} accentColor={accent} />

        <BookingSection
          artistId={artist.id}
          depositRequired={artist.deposit_required}
          depositAmount={artist.deposit_amount}
          accentColor={accent}
        />

        <Footer artistName={name} artistId={artist.id} />
      </div>
    </>
  )
}
