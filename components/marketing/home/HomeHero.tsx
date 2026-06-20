import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { HERO_SHOTS } from '@/components/marketing/home/portfolio-data'
import { HeroBackground } from '@/components/marketing/home/HeroBackground'

/* eslint-disable @next/next/no-img-element */

export function HomeHero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-ink-950 pt-16">
      {/* ── Animated ornate tattoo backdrop (parallax on scroll, semi-transparent) ── */}
      <HeroBackground />

      {/* Ambient layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-50" />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-0 h-[40rem] w-[40rem] rounded-full bg-gold-500/[0.08] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-gold-700/[0.06] blur-[120px]"
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        {/* ── Left: copy ── */}
        <div className="motion-safe:animate-fade-up">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold-500/25 bg-gold-500/10 px-3.5 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse-gold" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
              Built for tattoo artists
            </span>
          </div>

          <h1 className="font-display text-5xl font-black leading-[0.98] tracking-tight text-parchment-100 sm:text-6xl xl:text-7xl">
            Your ink deserves
            <br />
            more than a{' '}
            <span className="bg-gradient-gold bg-clip-text text-transparent">grid</span>.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
            Inkquire turns your portfolio into a striking website that takes bookings and
            collects deposits — generated from your photos in seconds. The studio runs itself;
            you keep tattooing.
          </p>

          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link href="/signup" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
              Start free — 30 days of Pro
            </Link>
            <a
              href="#feed"
              className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'gap-1.5' })}
            >
              See it in action
              <span aria-hidden>↓</span>
            </a>
          </div>

          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {HERO_SHOTS.map((shot, i) => (
                <img
                  key={i}
                  src={shot.src}
                  alt=""
                  className="h-8 w-8 rounded-full border-2 border-ink-950 object-cover"
                />
              ))}
            </div>
            <p className="text-sm text-ink-400">
              <span className="font-semibold text-parchment-200">1,200+ artists</span> book through Inkquire
            </p>
          </div>
        </div>

        {/* ── Right: floating collage ── */}
        <div className="relative hidden h-[34rem] lg:block" aria-hidden="true">
          {/* Card 1 — back left */}
          <figure className="absolute left-2 top-10 w-52 -rotate-6 overflow-hidden rounded-2xl border border-white/10 shadow-card-hover motion-safe:animate-float-y">
            <img src={HERO_SHOTS[0].src} alt="" className="h-64 w-full object-cover" />
            <figcaption className="flex items-center justify-between bg-ink-900/90 px-3 py-2 text-[0.7rem]">
              <span className="font-medium text-parchment-200">{HERO_SHOTS[0].handle}</span>
              <span className="text-gold-400">♥ {HERO_SHOTS[0].likes}</span>
            </figcaption>
          </figure>

          {/* Card 2 — front center (hero) */}
          <figure className="absolute left-1/2 top-0 w-60 -translate-x-1/3 rotate-3 overflow-hidden rounded-2xl border border-gold-500/30 shadow-gold-lg">
            <img src={HERO_SHOTS[1].src} alt="" className="h-72 w-full object-cover" />
            <figcaption className="flex items-center justify-between bg-ink-900/90 px-3 py-2 text-[0.7rem]">
              <span className="font-medium text-parchment-200">{HERO_SHOTS[1].handle}</span>
              <span className="rounded-full bg-gold-500 px-2 py-0.5 font-semibold text-ink-950">Book</span>
            </figcaption>
          </figure>

          {/* Card 3 — bottom right */}
          <figure
            className="absolute bottom-4 right-2 w-56 rotate-6 overflow-hidden rounded-2xl border border-white/10 shadow-card-hover motion-safe:animate-float-y"
            style={{ animationDelay: '1.2s' }}
          >
            <img src={HERO_SHOTS[2].src} alt="" className="h-60 w-full object-cover" />
            <figcaption className="flex items-center justify-between bg-ink-900/90 px-3 py-2 text-[0.7rem]">
              <span className="font-medium text-parchment-200">{HERO_SHOTS[2].handle}</span>
              <span className="text-gold-400">♥ {HERO_SHOTS[2].likes}</span>
            </figcaption>
          </figure>

          {/* Floating "deposit paid" chip */}
          <div className="absolute bottom-24 left-0 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-900/90 px-3 py-2 shadow-card-hover backdrop-blur-sm motion-safe:animate-float-y" style={{ animationDelay: '0.6s' }}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
            </span>
            <div className="text-[0.7rem] leading-tight">
              <p className="font-semibold text-parchment-100">£80 deposit paid</p>
              <p className="text-ink-500">New booking confirmed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950 to-transparent" />
    </section>
  )
}
