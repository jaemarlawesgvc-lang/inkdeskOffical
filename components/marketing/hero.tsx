import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-ink">
      {/* Subtle noise texture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-60" />

      {/* Radial gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[700px] w-[700px] rounded-full bg-gold-500/5 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center pt-28 pb-24">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 mb-10">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse-gold"
          />
          <span className="text-xs font-semibold text-gold-400 tracking-wide uppercase">
            For independent tattoo artists
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.05] text-parchment-100 mb-7">
          Your art deserves
          <br />
          a website.{' '}
          <span className="bg-gradient-gold bg-clip-text text-transparent">
            Built&nbsp;in&nbsp;seconds.
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto max-w-2xl text-lg sm:text-xl text-ink-400 leading-relaxed mb-12">
          InkDesk generates a premium portfolio site from your photos, takes
          bookings automatically, and processes deposits — so you can focus on
          what you do best.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className={buttonVariants({ variant: 'primary', size: 'lg' })}
          >
            Start free — no card required
          </Link>
          <a
            href="#how-it-works"
            className={buttonVariants({ variant: 'ghost', size: 'lg' })}
          >
            See how it works ↓
          </a>
        </div>

        {/* Social proof */}
        <p className="mt-14 text-sm text-ink-600">
          Free forever to start · No commission on bookings · Cancel anytime
        </p>
      </div>
    </section>
  )
}
