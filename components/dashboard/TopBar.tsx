import type { Plan } from '@/lib/stripe/plans'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'
import { signOutAction } from '@/lib/auth/actions'
import { SupportModal } from '@/components/dashboard/SupportModal'

interface TopBarProps {
  displayName: string
  plan: Plan
}

const PLAN_BADGE_STYLES: Record<Plan, string> = {
  free: 'bg-white/[0.06] text-white/55 border border-white/10',
  pro: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
  studio: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
}

export function TopBar({ displayName, plan }: TopBarProps) {
  const initial = displayName.charAt(0).toUpperCase()
  const isPaid = plan !== 'free'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.07] bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6">
      {/* Mobile wordmark */}
      <span className="flex items-center gap-2 font-display text-base font-bold tracking-tight text-white lg:hidden">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-500 shadow-gold" aria-hidden="true" />
        Inkquire
      </span>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <SupportModal />

        <span
          className={[
            'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex',
            PLAN_BADGE_STYLES[plan],
          ].join(' ')}
          aria-label={`Current plan: ${PLAN_DISPLAY[plan].name}`}
        >
          {isPaid && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 1l2.39 4.84 5.34.78-3.86 3.77.91 5.32L10 13.99l-4.78 2.52.91-5.32L2.27 6.62l5.34-.78L10 1z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {PLAN_DISPLAY[plan].name}
        </span>

        <div
          className={[
            'flex h-8 w-8 select-none items-center justify-center rounded-full text-sm font-semibold text-parchment-100',
            'bg-gradient-to-br from-ink-700 to-ink-900 ring-1',
            isPaid ? 'ring-gold-500/40' : 'ring-white/10',
          ].join(' ')}
          aria-label={`Signed in as ${displayName}`}
        >
          {initial}
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  )
}
