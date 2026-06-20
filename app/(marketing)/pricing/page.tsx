import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  PLAN_DISPLAY,
  PLAN_LIMITS,
  type Plan,
  type PlanLimits,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple pricing for tattoo artists. Free forever to start. Upgrade to Pro or Studio when you need more.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Inkquire',
    description:
      'Simple pricing for tattoo artists. Free forever to start. Upgrade to Pro or Studio when you need more.',
    url: '/pricing',
  },
  twitter: {
    title: 'Pricing — Inkquire',
    description:
      'Simple pricing for tattoo artists. Free forever to start. Upgrade to Pro or Studio when you need more.',
  },
}

const PLANS: Plan[] = ['free', 'pro', 'studio']

// ─── Comparison table rows ────────────────────────────────────────────────────

interface ComparisonRow {
  category: string
  label:    string
  key:      keyof PlanLimits
}

const COMPARISON_ROWS: ComparisonRow[] = [
  // Portfolio
  { category: 'Portfolio',  label: 'Portfolio images',                key: 'portfolioImages'       },
  { category: 'Portfolio',  label: 'AI site generations per month',   key: 'aiGenerationsPerMonth' },
  // Booking
  { category: 'Booking',   label: 'Bookings per month',               key: 'bookingsPerMonth'      },
  { category: 'Booking',   label: 'Stripe deposit collection',        key: 'stripeDeposits'        },
  { category: 'Booking',   label: 'Stripe Connect payout account',    key: 'stripeConnect'         },
  // Automation
  { category: 'Automation',label: 'Email automations (reminders, aftercare)', key: 'emailAutomations' },
  // Clients
  { category: 'Clients',   label: 'Full client notes',                key: 'clientNotesLevel'      },
  { category: 'Clients',   label: 'CSV export of clients & bookings', key: 'csvExport'             },
  // Platform
  { category: 'Platform',  label: 'Custom domain',                    key: 'customDomain'          },
  { category: 'Platform',  label: 'Analytics dashboard',              key: 'analytics'             },
  { category: 'Platform',  label: 'Priority support',                 key: 'prioritySupport'       },
]

function renderCell(val: PlanLimits[keyof PlanLimits]): { text: string; active: boolean } {
  if (typeof val === 'boolean') return { text: val ? '✓' : '—', active: val }
  if (typeof val === 'number')  return {
    text:   val === Infinity ? 'Unlimited' : String(val),
    active: val > 0,
  }
  // clientNotesLevel
  return { text: val === 'full' ? 'Full' : 'Basic', active: val === 'full' }
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Can I cancel at any time?',
    a: 'Yes. Cancel or downgrade from your account settings at any time. Your plan stays active until the end of the billing period.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your portfolio and booking history stay accessible for 30 days after cancellation. You can export a full CSV of your client and booking data at any time.',
  },
  {
    q: 'Does Inkquire take a commission on bookings?',
    a: 'No. Inkquire never takes a cut of your bookings or deposits. You pay the flat monthly subscription and Stripe\'s standard card processing fee (approximately 1.5% + 20p per UK card transaction).',
  },
  {
    q: 'Do I need a Stripe account?',
    a: 'Only if you want to collect deposits. Free plan artists can receive bookings without Stripe. Pro and Studio plans unlock Stripe Connect so deposits go straight to your bank.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the start of your next billing cycle.',
  },
] as const

export default function PricingPage() {
  const currentCategories = [...new Set(COMPARISON_ROWS.map((r) => r.category))]

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="py-24 sm:py-28 bg-gradient-ink border-b border-ink-800 text-center px-4">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-5xl sm:text-6xl font-bold text-parchment-100 mb-5">
            Simple, honest pricing
          </h1>
          <p className="text-lg text-ink-400">
            Start free. Upgrade when your books are full.
            No commission on your earnings, ever.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="py-20 bg-ink-950 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PLANS.map((plan) => {
              const display = PLAN_DISPLAY[plan]
              const isPro   = plan === 'pro'

              return (
                <div
                  key={plan}
                  className={cn(
                    'relative flex flex-col rounded-xl border p-6 sm:p-8',
                    isPro
                      ? 'border-gold-500 bg-ink-900 shadow-gold-lg'
                      : 'border-ink-700 bg-ink-900',
                  )}
                >
                  {isPro && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-ink-950">
                        Most popular
                      </span>
                    </div>
                  )}

                  <h2 className="font-display text-lg font-bold text-parchment-100 mb-1">
                    {display.name}
                  </h2>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-parchment-100">
                      {display.price}
                    </span>
                    <span className="text-sm text-ink-400">/{display.interval}</span>
                  </div>

                  <Link
                    href="/signup"
                    className={buttonVariants({
                      variant:   isPro ? 'primary' : 'outline',
                      size:      'md',
                      className: 'w-full justify-center',
                    })}
                  >
                    {plan === 'free' ? 'Start free' : `Get ${display.name}`}
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="py-16 bg-gradient-surface border-t border-ink-800 px-4 overflow-x-auto">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-3xl font-bold text-parchment-100 mb-10 text-center">
            Compare all features
          </h2>

          <table className="w-full text-sm border-collapse">
            {/* Column headers */}
            <thead>
              <tr className="border-b border-ink-800">
                <th className="text-left py-3 pr-4 text-ink-400 font-normal w-1/2">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th
                    key={plan}
                    className={cn(
                      'py-3 px-2 text-center font-bold',
                      plan === 'pro'
                        ? 'text-gold-400'
                        : 'text-parchment-200',
                    )}
                  >
                    {PLAN_DISPLAY[plan].name}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {currentCategories.map((category) => (
                <>
                  {/* Category row */}
                  <tr key={`cat-${category}`}>
                    <td
                      colSpan={4}
                      className="pt-8 pb-2 text-xs font-bold uppercase tracking-widest text-gold-500"
                    >
                      {category}
                    </td>
                  </tr>

                  {/* Feature rows for this category */}
                  {COMPARISON_ROWS.filter((r) => r.category === category).map(
                    (row) => (
                      <tr
                        key={row.key}
                        className="border-b border-ink-800/50 hover:bg-ink-900/40 transition-colors"
                      >
                        <td className="py-3 pr-4 text-parchment-300">
                          {row.label}
                        </td>
                        {PLANS.map((plan) => {
                          const { text, active } = renderCell(
                            PLAN_LIMITS[plan][row.key],
                          )
                          return (
                            <td
                              key={plan}
                              className={cn(
                                'py-3 px-2 text-center font-medium',
                                active ? 'text-gold-400' : 'text-ink-700',
                              )}
                            >
                              {text}
                            </td>
                          )
                        })}
                      </tr>
                    ),
                  )}
                </>
              ))}
            </tbody>
          </table>

          {/* Deferred features note */}
          <p className="mt-6 text-xs text-ink-600 text-center">
            Custom domain and analytics dashboard are planned features coming in a future update.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-ink-950 border-t border-ink-800 px-4">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-bold text-parchment-100 mb-12 text-center">
            Frequently asked questions
          </h2>
          <dl className="space-y-8">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-parchment-100 mb-2">{item.q}</dt>
                <dd className="text-ink-400 leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-surface border-t border-ink-800 text-center px-4">
        <h2 className="font-display text-3xl font-bold text-parchment-100 mb-5">
          Start free today
        </h2>
        <p className="text-ink-400 mb-8 max-w-sm mx-auto">
          No credit card required. Upgrade any time from your account settings.
        </p>
        <Link
          href="/signup"
          className={buttonVariants({ variant: 'primary', size: 'lg' })}
        >
          Create your free account
        </Link>
      </section>
    </div>
  )
}
