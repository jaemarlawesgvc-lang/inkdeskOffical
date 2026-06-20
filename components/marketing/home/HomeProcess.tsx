import { QUOTE_SHOT } from '@/components/marketing/home/portfolio-data'

/* eslint-disable @next/next/no-img-element */

const STEPS = [
  {
    n: '01',
    title: 'Add your work',
    body: 'Drop in your best healed photos. No captions to write, no layout to fuss over.',
  },
  {
    n: '02',
    title: 'Inkquire builds it',
    body: 'A full site, gallery and booking page — designed, written and live in seconds.',
  },
  {
    n: '03',
    title: 'Get booked',
    body: 'Share one link. Clients browse, request a style, and pay a deposit to lock it in.',
  },
]

export function HomeProcess() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-gradient-surface py-24 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-30" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 lg:px-8">
        <div className="max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
            From camera roll to calendar
          </span>
          <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-parchment-100 sm:text-5xl">
            Three steps. No web designer.
          </h2>
        </div>

        {/* Steps */}
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="group relative bg-ink-950/40 p-7 transition-colors hover:bg-ink-900/40">
              <span className="font-display text-5xl font-black text-gold-500/30 transition-colors group-hover:text-gold-500/60">
                {step.n}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-parchment-100">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{step.body}</p>
            </div>
          ))}
        </div>

        {/* Editorial testimonial */}
        <figure className="mt-16 grid grid-cols-1 items-center gap-8 lg:grid-cols-[auto_1fr]">
          <div className="relative mx-auto h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-gold-500/30 shadow-gold lg:mx-0">
            <img src={QUOTE_SHOT.src} alt="" className="h-full w-full object-cover" />
          </div>
          <div>
            <span aria-hidden className="font-display text-5xl leading-none text-gold-500">“</span>
            <blockquote className="-mt-4 font-display text-2xl font-bold leading-snug text-parchment-100 sm:text-3xl">
              I went from DMs and lost deposits to a fully-booked month. My clients think I hired a
              studio manager. It&apos;s just Inkquire.
            </blockquote>
            <figcaption className="mt-4 text-sm text-ink-400">
              <span className="font-semibold text-parchment-200">Kade R.</span> · Biomechanical &amp; abstract · @kade.bio
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  )
}
