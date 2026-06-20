import { SHOTS } from '@/components/marketing/home/portfolio-data'

/* eslint-disable @next/next/no-img-element */

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

const PATHS = {
  calendar: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  card: 'M3 10h18M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  users: 'M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m6-1a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 10-2.5-1.34',
  mail: 'M3 8l9 6 9-6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
}

export function HomeFeatures() {
  return (
    <section className="relative bg-ink-950 py-24 sm:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-30" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
              One studio, fully wired
            </span>
            <h2 className="mt-4 font-display text-4xl font-black tracking-tight text-parchment-100 sm:text-5xl">
              Everything the front desk used to do.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-400">
            Site, calendar, deposits, client history and follow-ups — one place, no plugins, no
            cut of your earnings.
          </p>
        </div>

        {/* Bento */}
        <div className="grid auto-rows-[12rem] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* A — big: generated site */}
          <article className="group relative overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-surface p-6 shadow-inset-top sm:col-span-2 lg:row-span-2">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/[0.1] blur-3xl" />
            <div className="relative flex h-full flex-col">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25">
                <Icon path="M4 5a1 1 0 011-1h14a1 1 0 011 1v3H4V5zm0 5h16v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9z" />
              </span>
              <h3 className="mt-4 font-display text-2xl font-bold text-parchment-100">
                A website that designs itself
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-300">
                Upload your work. Inkquire writes the copy, picks the palette, and lays out a
                gallery built for healed-photo detail — live in under a minute.
              </p>

              {/* mini preview strip */}
              <div className="mt-auto flex gap-2 pt-5">
                {SHOTS.slice(0, 4).map((s, i) => (
                  <div key={i} className="relative h-20 flex-1 overflow-hidden rounded-lg border border-white/10">
                    <img src={s.src} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                ))}
              </div>
            </div>
          </article>

          {/* B — bookings */}
          <Tile
            icon={PATHS.calendar}
            title="Bookings, 24/7"
            body="Clients pick a real open slot. Holds expire, double-bookings can't happen."
          />

          {/* C — deposits */}
          <Tile
            icon={PATHS.card}
            title="Deposits that stick"
            body="Stripe collects upfront and pays straight to your bank. Fewer no-shows."
          />

          {/* D — CRM */}
          <Tile
            icon={PATHS.users}
            title="Client history"
            body="Notes, past pieces and contact details — kept for every guest."
          />

          {/* E — emails */}
          <Tile
            icon={PATHS.mail}
            title="Follow-ups on autopilot"
            body="Reminders and aftercare emails send themselves, in your voice."
          />

          {/* F — commission highlight */}
          <article className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-gold-500/[0.06] p-6 shadow-inset-top">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-noise opacity-30" />
            <p className="font-display text-4xl font-black text-gold-400">0%</p>
            <p className="mt-1 text-sm font-semibold text-parchment-100">commission on bookings</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              Flat monthly price. Your earnings stay yours — always.
            </p>
          </article>
        </div>
      </div>
    </section>
  )
}

function Tile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <article className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors duration-200 hover:border-gold-500/25 hover:bg-white/[0.05]">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-gold-400 transition-colors group-hover:bg-gold-500/15">
        <Icon path={icon} />
      </span>
      <h3 className="mt-4 font-display text-lg font-bold text-parchment-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{body}</p>
    </article>
  )
}
