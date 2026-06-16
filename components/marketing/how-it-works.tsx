const STEPS = [
  {
    number: '01',
    title: 'Sign up',
    description:
      'Create your free InkDesk account in under two minutes. No credit card, no commitment required.',
  },
  {
    number: '02',
    title: 'Upload your work',
    description:
      'Add your portfolio photos, set your weekly availability, your deposit amount, and your session prices.',
  },
  {
    number: '03',
    title: 'Go live',
    description:
      'InkDesk AI generates your portfolio website instantly. Share your booking link and start filling your calendar.',
  },
] as const

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 sm:py-32 bg-ink-950 border-t border-ink-800"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-20">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-parchment-100 mb-4">
            Up and running in minutes
          </h2>
          <p className="text-lg text-ink-400">
            Three steps from zero to a live booking site.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-16">
          {STEPS.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-start">
              {/* Connector (desktop only, not on last item) */}
              {index < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute top-5 left-[calc(50%+3rem)] right-[-3rem] h-px bg-gradient-to-r from-gold-500/40 to-transparent"
                />
              )}

              {/* Number badge */}
              <div className="flex items-center justify-center w-11 h-11 rounded-full border border-gold-500/40 bg-gold-500/10 mb-6 shrink-0">
                <span className="font-display text-base font-bold text-gold-500">
                  {step.number}
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-parchment-100 mb-3">
                {step.title}
              </h3>
              <p className="text-ink-400 leading-relaxed text-sm sm:text-base">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
