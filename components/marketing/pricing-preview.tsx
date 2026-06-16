import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  PLAN_DISPLAY,
  PLAN_LIMITS,
  type Plan,
  type PlanLimits,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

// ─── Feature rows shown in the preview cards ──────────────────────────────────

interface FeatureRow {
  label: string
  key:   keyof PlanLimits
}

const FEATURE_ROWS: FeatureRow[] = [
  { label: 'Portfolio images',        key: 'portfolioImages'        },
  { label: 'Bookings per month',      key: 'bookingsPerMonth'       },
  { label: 'AI site generations/mo',  key: 'aiGenerationsPerMonth'  },
  { label: 'Stripe deposits',         key: 'stripeDeposits'         },
  { label: 'Email automations',       key: 'emailAutomations'       },
  { label: 'CSV export',              key: 'csvExport'              },
  { label: 'Priority support',        key: 'prioritySupport'        },
]

const PLANS: Plan[] = ['free', 'pro', 'studio']
const PRO_PLAN:      Plan = 'pro'

// ─── Value renderer ───────────────────────────────────────────────────────────

function renderValue(val: PlanLimits[keyof PlanLimits]): string {
  if (typeof val === 'boolean') return val ? '✓' : '—'
  if (typeof val === 'number')  return val === Infinity ? 'Unlimited' : String(val)
  // clientNotesLevel ('basic' | 'full') — not shown in preview rows, but typed here for safety
  return String(val)
}

function isActive(val: PlanLimits[keyof PlanLimits]): boolean {
  if (typeof val === 'boolean') return val
  if (typeof val === 'number')  return val > 0
  return val === 'full'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PricingPreview() {
  return (
    <section className="py-24 sm:py-32 bg-gradient-surface border-t border-ink-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-xl text-center mb-16">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-parchment-100 mb-4">
            Simple, honest pricing
          </h2>
          <p className="text-lg text-ink-400">
            Start free. Upgrade when your books are full.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const display = PLAN_DISPLAY[plan]
            const limits  = PLAN_LIMITS[plan]
            const isPro   = plan === PRO_PLAN

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
                {/* Popular badge */}
                {isPro && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="inline-block rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-ink-950">
                      Most popular
                    </span>
                  </div>
                )}

                {/* Plan name & price */}
                <div className="mb-7">
                  <h3 className="font-display text-lg font-bold text-parchment-100 mb-1">
                    {display.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-parchment-100">
                      {display.price}
                    </span>
                    <span className="text-sm text-ink-400">/{display.interval}</span>
                  </div>
                </div>

                {/* Feature list */}
                <ul className="flex-1 space-y-3.5 mb-8">
                  {FEATURE_ROWS.map((row) => {
                    const val    = limits[row.key]
                    const active = isActive(val)

                    return (
                      <li
                        key={row.key}
                        className="flex items-center justify-between text-sm gap-3"
                      >
                        <span className={active ? 'text-parchment-200' : 'text-ink-600'}>
                          {row.label}
                        </span>
                        <span
                          className={cn(
                            'font-semibold shrink-0',
                            active ? 'text-gold-400' : 'text-ink-700',
                          )}
                        >
                          {renderValue(val)}
                        </span>
                      </li>
                    )
                  })}
                </ul>

                {/* CTA */}
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

        {/* Link to full pricing page */}
        <p className="mt-10 text-center text-sm">
          <Link
            href="/pricing"
            className="text-gold-500 hover:text-gold-400 transition-colors underline underline-offset-4"
          >
            Compare all features in detail →
          </Link>
        </p>
      </div>
    </section>
  )
}
