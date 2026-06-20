const STATS = [
  { value: '2,400+', label: 'Bookings taken' },
  { value: '£180k+', label: 'Deposits collected' },
  { value: '94%', label: 'Show-up rate' },
]

export function AuthVisualPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-b from-ink-950 via-black to-ink-950 px-12 py-14">
      {/* Grain + grid texture */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-60" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_30%,#000_40%,transparent_100%)]"
      />
      {/* Gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-20 h-[480px] w-[480px] rounded-full bg-gold-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-crimson-500/10 blur-[100px]"
      />

      {/* Wordmark */}
      <div className="relative z-10 font-display text-xl font-bold text-parchment-100">
        Ink<span className="text-gold-500">Desk</span>
      </div>

      {/* Centrepiece: a stylised browser-frame mockup of a booking page */}
      <div className="relative z-10 flex flex-1 items-center">
        <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur-sm">
          {/* Fake browser chrome */}
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-crimson-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-gold-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/50" />
            <span className="ml-3 truncate rounded bg-white/5 px-2.5 py-1 text-[11px] text-ink-400">
              inkdesk.live/maya-ink
            </span>
          </div>
          {/* Fake hero */}
          <div className="space-y-3 px-6 py-8">
            <div className="h-2 w-20 rounded-full bg-gold-500/40" />
            <div className="h-5 w-3/4 rounded bg-parchment-100/20" />
            <div className="h-3 w-1/2 rounded bg-white/10" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="aspect-square rounded-md bg-gradient-to-br from-gold-500/20 to-white/5" />
              <div className="aspect-square rounded-md bg-gradient-to-br from-white/10 to-white/[0.02]" />
              <div className="aspect-square rounded-md bg-gradient-to-br from-crimson-500/15 to-white/5" />
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-md bg-gold-500 px-4 py-2 text-xs font-bold text-ink-950">
              Book Now
            </div>
          </div>
        </div>
      </div>

      {/* Quote */}
      <blockquote className="relative z-10 space-y-3">
        <p className="text-lg leading-relaxed text-parchment-200">
          &ldquo;I went live in an afternoon. Deposits used to be a headache —
          now they just land in my account.&rdquo;
        </p>
        <footer className="text-sm text-ink-500">
          Maya Chen <span className="text-ink-600">·</span> Blackwork artist
        </footer>
      </blockquote>

      {/* Stats row */}
      <div className="relative z-10 mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <p className="font-display text-xl font-bold text-parchment-100">
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
