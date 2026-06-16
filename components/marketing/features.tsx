import type { ReactElement } from 'react'

// ─── Icons ────────────────────────────────────────────────────────────────────
// Defined as named function components so they can be referenced as
// `Feature.Icon` in JSX without JSX-in-array TypeScript issues.

function CalendarIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function SparkleIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function CardIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Feature {
  Icon: () => ReactElement
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    Icon: CalendarIcon,
    title: 'Smart booking system',
    description:
      "Clients pick an open slot, describe their idea, and upload reference photos — all before you've said a word. You review, confirm, and the calendar fills itself. Require a deposit before confirming and never lose a booking to a no-show again.",
  },
  {
    Icon: SparkleIcon,
    title: 'AI portfolio sites',
    description:
      'Upload your work, answer a few quick questions, and Gemini AI generates a premium portfolio site that looks like you hired a designer. No code, no templates, no drag-and-drop — just your art, presented the way it deserves.',
  },
  {
    Icon: CardIcon,
    title: 'Stripe payments built in',
    description:
      'Connect your Stripe account and take deposits directly to your bank. InkDesk never holds your money and takes no cut of your earnings. Capture the deposit on confirmation or on the day — your call.',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function Features() {
  return (
    <section className="py-24 sm:py-32 bg-gradient-surface border-t border-ink-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-parchment-100 mb-4">
            Everything you need.{' '}
            <span className="bg-gradient-gold bg-clip-text text-transparent">
              Nothing&nbsp;you&nbsp;don&apos;t.
            </span>
          </h2>
          <p className="text-lg text-ink-400">
            Built specifically for tattoo artists. No bloat, no gatekeeping.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-ink-700 bg-ink-900 p-6 sm:p-8 hover:border-gold-500/40 hover:shadow-gold transition-all duration-300"
            >
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-gold-500/10 text-gold-500">
                <feature.Icon />
              </div>

              <h3 className="font-display text-xl font-bold text-parchment-100 mb-3">
                {feature.title}
              </h3>
              <p className="text-ink-400 leading-relaxed text-sm sm:text-base">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}