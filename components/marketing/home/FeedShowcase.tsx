import { SHOTS, AVATAR_SHOT } from '@/components/marketing/home/portfolio-data'

/* eslint-disable @next/next/no-img-element */

export function FeedShowcase() {
  return (
    <section id="feed" className="relative overflow-hidden bg-ink-950 py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-gold-500/[0.05] blur-[130px]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 lg:px-8">
        {/* Header — asymmetric */}
        <div className="mb-12 max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
            Looks like Instagram. Works like a studio.
          </span>
          <h2 className="mt-4 font-display text-4xl font-black leading-tight tracking-tight text-parchment-100 sm:text-5xl">
            The feed you already post —
            <br />
            <span className="text-ink-400">now it takes the booking.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-400">
            Inkquire lays your work out the way clients already browse, then makes every piece
            a path to your calendar. Tap a tattoo, request that style, pay the deposit. Done.
          </p>
        </div>

        {/* The "profile" card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-surface shadow-card-hover">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-20" />

          {/* Powered-by tag */}
          <div className="absolute right-4 top-4 z-20 rounded-full border border-gold-500/25 bg-ink-950/70 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-400 backdrop-blur-sm">
            Made with Inkquire
          </div>

          {/* Profile header */}
          <div className="relative z-10 flex flex-col gap-6 border-b border-white/[0.07] p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="relative shrink-0">
              <div className="rounded-full bg-gradient-gold p-[2px]">
                <img
                  src={AVATAR_SHOT.src}
                  alt="Studio avatar"
                  className="h-20 w-20 rounded-full border-2 border-ink-900 object-cover sm:h-24 sm:w-24"
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl font-bold text-parchment-100">Iron &amp; Ink Studio</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-gold-400">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
                  Books open
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink-400">@iron.and.ink · London, UK</p>

              <div className="mt-3 flex gap-6 text-sm">
                <span className="text-parchment-200"><strong className="font-semibold text-parchment-100">248</strong> <span className="text-ink-500">pieces</span></span>
                <span className="text-parchment-200"><strong className="font-semibold text-parchment-100">18.4k</strong> <span className="text-ink-500">followers</span></span>
                <span className="text-parchment-200"><strong className="font-semibold text-gold-400">4.9★</strong> <span className="text-ink-500">rated</span></span>
              </div>

              <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-300">
                Custom fine-line, blackwork &amp; neo-traditional. Healed photos only. Deposit secures your slot.
              </p>
            </div>

            <div className="flex shrink-0 gap-2.5 sm:flex-col">
              <span className="inline-flex flex-1 items-center justify-center rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-gold">
                Book now
              </span>
              <span className="inline-flex flex-1 items-center justify-center rounded-lg border border-ink-600 px-5 py-2.5 text-sm font-semibold text-parchment-200">
                Message
              </span>
            </div>
          </div>

          {/* Post grid */}
          <div className="relative z-10 grid grid-cols-3 gap-1 p-1 sm:gap-1.5 sm:p-1.5">
            {SHOTS.map((shot, i) => (
              <div key={i} className="group relative aspect-square overflow-hidden bg-ink-900">
                <img
                  src={shot.src}
                  alt={`${shot.style} tattoo`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Hover overlay — IG engagement */}
                <div className="absolute inset-0 flex items-center justify-center gap-5 bg-ink-950/65 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.739.739 0 01-.69.001l-.002-.001z" /></svg>
                    {shot.likes}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M10 2c-4.418 0-8 3.134-8 7 0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0010 16c4.418 0 8-3.134 8-7s-3.582-7-8-7z" clipRule="evenodd" /></svg>
                    {shot.comments}
                  </span>
                  {/* Tag + book pill */}
                  <span className="absolute bottom-2 left-2 rounded bg-ink-950/70 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-400">
                    {shot.style}
                  </span>
                  <span className="absolute bottom-2 right-2 rounded bg-gold-500 px-2 py-0.5 text-[0.65rem] font-bold text-ink-950">
                    Book this
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Generated from your photos — no web design, no drag-and-drop builders, no monthly agency.
        </p>
      </div>
    </section>
  )
}
