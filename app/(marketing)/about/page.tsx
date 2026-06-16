import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About',
  description:
    'InkDesk is built to help independent tattoo artists run their business without the admin overhead.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — InkDesk',
    description:
      'InkDesk is built to help independent tattoo artists run their business without the admin overhead.',
    url: '/about',
  },
  twitter: {
    title: 'About — InkDesk',
    description:
      'InkDesk is built to help independent tattoo artists run their business without the admin overhead.',
  },
}

const VALUES = [
  {
    title: 'Artists first',
    body: 'Every feature is designed around how tattoo artists actually work — not how a product manager thinks they should work. If it doesn\'t solve a real problem, it doesn\'t ship.',
  },
  {
    title: 'Honest pricing',
    body: 'We charge a flat monthly fee. We take no commission on your bookings. Your earnings are your earnings — we never want a percentage.',
  },
  {
    title: 'Your data, your client list',
    body: 'Your client database belongs to you. You can export everything at any time, in full, in a format you can open in Excel. No lock-in.',
  },
  {
    title: 'Built to last',
    body: 'InkDesk is built on infrastructure designed for years of operation — not a prototype that pivots next month. Your site and bookings need to be reliable.',
  },
] as const

export default function AboutPage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="py-24 sm:py-32 bg-gradient-ink border-b border-ink-800 text-center px-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-parchment-100 mb-6">
            Built for artists,{' '}
            <span className="bg-gradient-gold bg-clip-text text-transparent">
              not agencies
            </span>
          </h1>
          <p className="text-lg text-ink-400 max-w-xl mx-auto leading-relaxed">
            InkDesk exists because talented, independent tattoo artists deserve
            professional tools without the enterprise price tag.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 sm:py-28 bg-ink-950 border-b border-ink-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-gold-500 mb-4 block">
                Why we built this
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-parchment-100 mb-6">
                Booking admin shouldn&apos;t be a full-time job
              </h2>
            </div>
            <div className="space-y-5">
              <p className="text-ink-400 leading-relaxed">
                Independent tattoo artists are running a business on top of a
                craft. They&apos;re fielding DMs at midnight, chasing deposits over
                text, managing schedules across three apps, and hand-typing the
                same aftercare instructions after every session.
              </p>
              <p className="text-ink-400 leading-relaxed">
                The software that exists either caters to large studios with
                complex team management needs, or is so generic it doesn&apos;t
                understand anything specific about how tattoo bookings work —
                reference photos, custom deposit amounts, session descriptions,
                the whole thing.
              </p>
              <p className="text-ink-400 leading-relaxed">
                InkDesk is purpose-built for the independent artist: one
                platform that generates your portfolio site, takes your
                bookings, collects your deposits, and sends your follow-up
                emails — while you focus on the actual work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 sm:py-28 bg-gradient-surface border-b border-ink-800">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-parchment-100 mb-14 text-center">
            What we believe
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {VALUES.map((value) => (
              <div
                key={value.title}
                className="rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8"
              >
                <h3 className="font-display text-lg font-bold text-parchment-100 mb-3">
                  {value.title}
                </h3>
                <p className="text-ink-400 leading-relaxed text-sm sm:text-base">
                  {value.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-ink-950 text-center px-4">
        <h2 className="font-display text-4xl font-bold text-parchment-100 mb-5">
          Join us
        </h2>
        <p className="text-ink-400 mb-10 max-w-sm mx-auto">
          Create your account and have a live booking site before the end of
          the day.
        </p>
        <Link
          href="/signup"
          className={buttonVariants({ variant: 'primary', size: 'lg' })}
        >
          Start free
        </Link>
      </section>
    </div>
  )
}
