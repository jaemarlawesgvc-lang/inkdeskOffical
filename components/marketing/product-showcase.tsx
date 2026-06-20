const PORTFOLIO_TILES = [
  { from: 'from-gold-500/30', to: 'to-ink-950', icon: 'rose' },
  { from: 'from-ink-700', to: 'to-ink-950', icon: 'skull' },
  { from: 'from-crimson-500/25', to: 'to-ink-950', icon: 'snake' },
  { from: 'from-ink-700', to: 'to-ink-950', icon: 'dagger' },
  { from: 'from-gold-500/20', to: 'to-ink-950', icon: 'wave' },
  { from: 'from-ink-700', to: 'to-ink-950', icon: 'eye' },
] as const

function TattooIcon({ name }: { name: string }) {
  const common = 'w-7 h-7 text-white/25'
  switch (name) {
    case 'rose':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={common} aria-hidden="true">
          <circle cx="12" cy="9" r="4" />
          <path d="M12 13v8M9 21h6" />
        </svg>
      )
    case 'skull':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={common} aria-hidden="true">
          <path d="M12 3a7 7 0 00-7 7c0 2.5 1.2 4 2 5v3h10v-3c.8-1 2-2.5 2-5a7 7 0 00-7-7z" />
          <circle cx="9.5" cy="10" r="1" />
          <circle cx="14.5" cy="10" r="1" />
        </svg>
      )
    case 'snake':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={common} aria-hidden="true">
          <path d="M5 12c0-4 3-7 7-7s5 3 2 5-6 1-6 4 4 3 7 1" />
        </svg>
      )
    case 'dagger':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={common} aria-hidden="true">
          <path d="M12 2v14M8 6h8M9 16l3 6 3-6" />
        </svg>
      )
    case 'wave':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={common} aria-hidden="true">
          <path d="M3 10c2-3 4-3 6 0s4 3 6 0 4-3 6 0M3 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </svg>
      )
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={common} aria-hidden="true">
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )
  }
}

export function ProductShowcase() {
  return (
    <section className="relative px-4 sm:px-6 lg:px-8 pb-24 sm:pb-32 -mt-8">
      <div className="mx-auto max-w-5xl">
        <div className="relative rounded-2xl border border-white/10 bg-ink-950 shadow-2xl shadow-black/60 overflow-hidden">
          {/* Glow behind the mockup */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[140%] rounded-full bg-gold-500/10 blur-3xl"
          />

          {/* Fake browser chrome */}
          <div className="relative flex items-center gap-2 border-b border-white/10 bg-black/40 px-5 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-crimson-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
            <span className="ml-3 truncate rounded bg-white/5 px-3 py-1 text-xs text-ink-400">
              inkdesk.live/maya-ink
            </span>
          </div>

          {/* Fake booking page content */}
          <div className="relative grid grid-cols-1 md:grid-cols-5 gap-0">
            {/* Left: hero + portfolio grid */}
            <div className="md:col-span-3 px-6 sm:px-10 py-10 sm:py-14 space-y-7 border-b md:border-b-0 md:border-r border-white/10">
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold-500">
                  Maya Chen · Blackwork &amp; Fine Line
                </p>
                <h3 className="font-display text-2xl sm:text-3xl font-bold leading-tight text-parchment-100">
                  Custom tattoos, built to last a lifetime.
                </h3>
                <p className="text-sm text-ink-400 max-w-sm">
                  Private studio in East London. Booking by appointment only.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {PORTFOLIO_TILES.map((tile) => (
                  <div
                    key={tile.icon}
                    className={`aspect-square rounded-lg bg-gradient-to-br ${tile.from} ${tile.to} border border-white/5 flex items-center justify-center`}
                  >
                    <TattooIcon name={tile.icon} />
                  </div>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-5 py-2.5 text-sm font-bold text-ink-950">
                Book Now
              </div>
            </div>

            {/* Right: booking form mockup */}
            <div className="md:col-span-2 px-6 sm:px-8 py-10 sm:py-14 space-y-4 bg-white/[0.02]">
              <h4 className="font-display text-base font-bold text-parchment-100">
                Book a session
              </h4>
              <div className="space-y-1.5">
                <p className="text-xs text-ink-500">Name</p>
                <div className="h-9 rounded-md border border-white/10 bg-ink-950/60 px-3 flex items-center text-sm text-ink-300">
                  Alex Morgan
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-ink-500">Email</p>
                <div className="h-9 rounded-md border border-white/10 bg-ink-950/60 px-3 flex items-center text-sm text-ink-300">
                  alex@email.com
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs text-ink-500">Date</p>
                  <div className="h-9 rounded-md border border-white/10 bg-ink-950/60 px-3 flex items-center text-sm text-ink-300">
                    14 Aug
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-ink-500">Time</p>
                  <div className="h-9 rounded-md border border-white/10 bg-ink-950/60 px-3 flex items-center text-sm text-ink-300">
                    2:00 PM
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gold-500/30 bg-gold-500/10 px-4 py-3 mt-2">
                <p className="text-xs text-gold-400 font-semibold">£50 deposit secures your slot</p>
              </div>
              <div className="h-10 rounded-md bg-gold-500/90 flex items-center justify-center text-xs font-bold text-ink-950">
                Continue to deposit
              </div>
            </div>
          </div>
        </div>

        {/* Caption */}
        <p className="mt-6 text-center text-sm text-ink-500">
          Every Inkquire site looks like this — generated from your portfolio in minutes.
        </p>
      </div>
    </section>
  )
}
