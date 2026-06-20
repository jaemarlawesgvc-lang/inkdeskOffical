import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { SHOTS } from '@/components/marketing/home/portfolio-data'

/* eslint-disable @next/next/no-img-element */

export function HomeCTA() {
  const marquee = [...SHOTS, ...SHOTS]

  return (
    <section className="relative overflow-hidden bg-ink-950 py-24 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500/[0.07] blur-[130px]"
      />

      {/* Tattoo marquee */}
      <div className="relative mb-16 overflow-hidden">
        <div className="flex w-max gap-3 motion-safe:animate-marquee-x">
          {marquee.map((s, i) => (
            <div key={i} className="h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-white/10 opacity-70 sm:h-36 sm:w-36">
              <img src={s.src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
        {/* Edge fades */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-ink-950 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink-950 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-4xl font-black leading-tight tracking-tight text-parchment-100 sm:text-6xl">
          Your next client is
          <br />
          already scrolling.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-300">
          Build your Inkquire site free and try Pro for 30 days — bookings, deposits and
          automations included. No card to start.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/signup" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            Create your free site
          </Link>
          <Link href="/pricing" className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            See pricing
          </Link>
        </div>

        <p className="mt-7 text-sm text-ink-500">
          Free forever to start · 30-day Pro trial · No commission on bookings
        </p>
      </div>
    </section>
  )
}
