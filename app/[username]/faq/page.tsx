import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { clientEnv } from '@/lib/env.client'
import { PublicHeader } from '@/components/public/PublicHeader'
import { FaqAccordion } from '@/components/public/FaqAccordion'
import { Footer } from '@/components/public/Footer'

export const dynamic = 'force-dynamic'

interface ArtistFaqRecord {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  style_tags: string[] | null
  onboarding_complete: boolean
  site_data: { colorScheme?: { accent?: string } } | null
  artist_faqs: { id: string; question: string; answer: string; display_order: number }[]
}

const DEFAULT_ACCENT = '#d4af37'

async function loadArtistWithFaqs(username: string): Promise<ArtistFaqRecord | null> {
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
      onboarding_complete,
      site_data,
      artist_faqs (
        id,
        question,
        answer,
        display_order
      )
    `,
    )
    .eq('username', username.toLowerCase())
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null
  return data as unknown as ArtistFaqRecord
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>
}): Promise<Metadata> {
  const { username } = await params
  const artist = await loadArtistWithFaqs(username)

  if (!artist || !artist.onboarding_complete) {
    return { title: 'Artist not found — Inkquire', robots: { index: false, follow: false } }
  }

  const name = artist.display_name ?? artist.username
  const canonical = `${clientEnv.appUrl}/${artist.username}/faq`

  return {
    title: `FAQ — ${name}`,
    description: `Frequently asked questions for booking a tattoo with ${name}.`,
    alternates: { canonical },
    robots: { index: true, follow: true },
  }
}

export default async function ArtistFaqPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const artist = await loadArtistWithFaqs(username)

  if (!artist || !artist.onboarding_complete) {
    notFound()
  }

  const name = artist.display_name ?? artist.username
  const accent = artist.site_data?.colorScheme?.accent ?? DEFAULT_ACCENT
  const styleTags = Array.isArray(artist.style_tags) ? artist.style_tags : []

  const faqs = (artist.artist_faqs ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((f) => ({ id: f.id, question: f.question, answer: f.answer }))

  return (
    <div id="top" className="min-h-screen bg-black text-white">
      <PublicHeader
        artistName={name}
        username={artist.username}
        accentColor={accent}
        showAbout={false}
        showFaq={false}
      />

      <section className="px-6 py-20 sm:py-28" aria-label="Frequently asked questions">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>
              {styleTags.length > 0 ? styleTags.join(' · ') : 'Good to know'}
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: '#f5f5f0' }}>
              Frequently asked questions
            </h1>
            <div className="w-12 h-[2px] mx-auto mt-4 rounded-full" style={{ backgroundColor: accent }} />
          </div>

          {faqs.length > 0 ? (
            <FaqAccordion faqs={faqs} accentColor={accent} />
          ) : (
            <p className="text-center text-white/40 text-sm">
              {name} hasn&rsquo;t added any FAQs yet.{' '}
              <a href={`/${artist.username}#book`} className="underline underline-offset-2 hover:text-white transition-colors">
                Get in touch to book directly
              </a>
              .
            </p>
          )}
        </div>
      </section>

      <Footer artistName={name} />
    </div>
  )
}
