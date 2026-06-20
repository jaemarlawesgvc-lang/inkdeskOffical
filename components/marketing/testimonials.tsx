const TESTIMONIALS = [
  {
    quote:
      'Inkquire sorted my booking chaos in one afternoon. Now I take deposits automatically and clients actually show up to their appointments.',
    name:     'Mia Torres',
    role:     'Traditional artist · London',
    initials: 'MT',
  },
  {
    quote:
      'I used to spend hours DMing people just to get basic info. Now they book themselves, I get a notification, and I confirm or decline. It\'s completely changed my workflow.',
    name:     'Callum Reid',
    role:     'Neo-traditional artist · Glasgow',
    initials: 'CR',
  },
  {
    quote:
      'The portfolio site Inkquire generated looks better than anything I could have paid an agency for. My inquiry rate doubled in the first month.',
    name:     'Priya Subramaniam',
    role:     'Fine-line artist · Manchester',
    initials: 'PS',
  },
] as const

export function Testimonials() {
  return (
    <section className="py-24 sm:py-32 bg-ink-950 border-t border-ink-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-xl text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-parchment-100 mb-4">
            Artists love it
          </h2>
          <p className="text-lg text-ink-400">
            From chaotic DMs to a fully-booked calendar.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col gap-5 rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8"
            >
              {/* Decorative quote mark */}
              <span
                aria-hidden
                className="font-display text-5xl leading-none text-gold-500/25 select-none"
              >
                &ldquo;
              </span>

              <blockquote className="flex-1 -mt-2">
                <p className="text-parchment-200 leading-relaxed text-sm sm:text-base">
                  {t.quote}
                </p>
              </blockquote>

              <figcaption className="flex items-center gap-3 pt-2 border-t border-ink-800">
                {/* Monogram avatar */}
                <div
                  aria-hidden
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-gold-500/15 text-gold-400 text-xs font-bold shrink-0"
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-parchment-100">
                    {t.name}
                  </p>
                  <p className="text-xs text-ink-400">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
