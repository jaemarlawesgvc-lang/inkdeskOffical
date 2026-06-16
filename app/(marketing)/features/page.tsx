import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Smart booking, AI portfolio sites, Stripe deposits, and automated email reminders — built for tattoo artists.',
  alternates: { canonical: '/features' },
  openGraph: {
    title: 'Features — InkDesk',
    description:
      'Smart booking, AI portfolio sites, Stripe deposits, and automated email reminders — built for tattoo artists.',
    url: '/features',
  },
  twitter: {
    title: 'Features — InkDesk',
    description:
      'Smart booking, AI portfolio sites, Stripe deposits, and automated email reminders — built for tattoo artists.',
  },
}

interface FeatureSection {
  tag:         string
  headline:    string
  body:        string[]
  highlights:  string[]
}

const SECTIONS: FeatureSection[] = [
  {
    tag:      'Booking',
    headline: 'A booking system that works for you',
    body: [
      'Clients visit your InkDesk page, pick an available slot, describe their idea, and upload reference photos — all without you lifting a finger.',
      'Every request lands in your dashboard for review. You see the full picture before confirming: the idea, the references, the slot. Confirm it or decline it in one click.',
      'Require a deposit before a booking is locked. Stripe handles the money — it goes straight to your bank account.',
    ],
    highlights: [
      'Custom availability windows per day of the week',
      'Per-session deposit amounts you control',
      'Block dates for holidays, conventions, or personal time',
      'Client no-show protection via upfront deposits',
      '48-hour reminder emails sent automatically',
    ],
  },
  {
    tag:      'AI Portfolio',
    headline: 'A portfolio site that represents your work honestly',
    body: [
      'You upload your photos. You answer a few questions about your style and studio. InkDesk sends everything to Google Gemini, which generates a portfolio site tailored to your aesthetic — not a generic template.',
      'The result is a clean, fast, mobile-first page at inkdesk.co/yourusername. Your booking calendar is embedded directly on the page.',
      'If Gemini is unavailable, InkDesk falls back to a high-quality default layout so your page is never blank.',
    ],
    highlights: [
      'AI-generated colour palette matched to your style',
      'Custom tagline and bio written from your inputs',
      'Fast-loading gallery with your portfolio images',
      'Live booking calendar embedded on your page',
      'Regenerate your site any time you update your portfolio',
    ],
  },
  {
    tag:      'Payments',
    headline: 'Stripe payments, zero platform commission',
    body: [
      'InkDesk uses Stripe Connect so deposits go directly from your client to your bank account. InkDesk never holds your money.',
      'You choose the deposit amount per session. Stripe charges their standard card processing fee (approximately 1.5% + 20p for UK cards). InkDesk takes nothing extra.',
      'Deposits are authorised at booking submission and captured on confirmation, so a client can never claim money back for a simple change of mind.',
    ],
    highlights: [
      'Direct payouts via Stripe Connect',
      'No commission on deposits or total session price',
      'Deposits authorised at submission, captured on confirmation',
      'Automatic void on cancellation before confirmation',
      'Stripe dashboard for full payment history',
    ],
  },
  {
    tag:      'Client Management',
    headline: 'Know your clients, not just their bookings',
    body: [
      'Every client who books through InkDesk is automatically added to your client list. Name, email, phone, and their full booking history — all in one place.',
      'Add private notes to any client profile. Track their style preferences, allergies, previous work, or anything else you need to remember before their next session.',
    ],
    highlights: [
      'Auto-built client list from every booking',
      'Full booking history per client',
      'Private artist-only notes on each client',
      'CSV export of your full client database',
    ],
  },
  {
    tag:      'Email Automations',
    headline: 'Emails that run themselves',
    body: [
      'Booking confirmations go out the moment you confirm. 48-hour reminders go out automatically before each session. Aftercare instructions go out the day after.',
      'Every email is sent from your InkDesk domain and uses plain, professional formatting. You choose when to enable or disable each automation from your dashboard.',
    ],
    highlights: [
      'Booking confirmation to client and artist',
      '48-hour appointment reminder',
      'Aftercare email the day after the session',
      'Payment receipt on deposit capture',
      'Automatic, zero additional setup required',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="py-24 sm:py-32 bg-gradient-ink border-b border-ink-800 text-center px-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-parchment-100 mb-6">
            Built for the way you{' '}
            <span className="bg-gradient-gold bg-clip-text text-transparent">
              actually work
            </span>
          </h1>
          <p className="text-lg text-ink-400 mb-10 max-w-xl mx-auto">
            Every feature in InkDesk exists because a real artist needed it.
            Nothing is there to impress a VC.
          </p>
          <Link
            href="/signup"
            className={buttonVariants({ variant: 'primary', size: 'lg' })}
          >
            Start free
          </Link>
        </div>
      </section>

      {/* Feature sections */}
      {SECTIONS.map((section, i) => (
        <section
          key={section.tag}
          className={`py-20 sm:py-28 border-b border-ink-800 ${
            i % 2 === 0 ? 'bg-ink-950' : 'bg-gradient-surface'
          }`}
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              {/* Text */}
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-gold-500 mb-4 block">
                  {section.tag}
                </span>
                <h2 className="font-display text-3xl sm:text-4xl font-bold text-parchment-100 mb-6">
                  {section.headline}
                </h2>
                {section.body.map((para, j) => (
                  <p key={j} className="text-ink-400 leading-relaxed mb-4 last:mb-0">
                    {para}
                  </p>
                ))}
              </div>

              {/* Highlights */}
              <div className="rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
                <ul className="space-y-4">
                  {section.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-1 text-gold-500 font-bold shrink-0"
                      >
                        ✓
                      </span>
                      <span className="text-parchment-200 text-sm leading-relaxed">
                        {highlight}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section className="py-24 bg-ink-950 text-center px-4">
        <h2 className="font-display text-4xl font-bold text-parchment-100 mb-6">
          See it all in action
        </h2>
        <p className="text-ink-400 mb-10 max-w-md mx-auto">
          Create your free account. Your site will be live before you finish
          your coffee.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className={buttonVariants({ variant: 'primary', size: 'lg' })}
          >
            Start free
          </Link>
          <Link
            href="/pricing"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            View pricing
          </Link>
        </div>
      </section>
    </div>
  )
}
