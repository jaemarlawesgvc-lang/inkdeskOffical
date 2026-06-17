import type { Plan } from '@/lib/stripe/plans'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'
import { signOutAction } from '@/lib/auth/actions'
import { SupportModal } from '@/components/dashboard/SupportModal'

interface TopBarProps {
  displayName: string
  plan: Plan
}

const PLAN_BADGE_STYLES: Record<Plan, string> = {
  free: 'bg-white/10 text-white/60',
  pro: 'bg-amber-500/20 text-amber-400',
  studio: 'bg-violet-500/20 text-violet-400',
}

export function TopBar({ displayName, plan }: TopBarProps) {
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-black/80 backdrop-blur-md border-b border-white/10">
      {/* Mobile logo */}
      <span className="lg:hidden text-white font-bold text-base tracking-tight">
        InkDesk
      </span>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right: plan badge + avatar */}
      <div className="flex items-center gap-3">
        <SupportModal />
        <span
          className={[
            'hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
            PLAN_BADGE_STYLES[plan],
          ].join(' ')}
          aria-label={`Current plan: ${PLAN_DISPLAY[plan].name}`}
        >
          {PLAN_DISPLAY[plan].name}
        </span>

        <div
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold select-none"
          aria-label={`Signed in as ${displayName}`}
        >
          {initial}
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
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
