import type { Plan } from '@/lib/stripe/plans'
import { PLAN_DISPLAY } from '@/lib/stripe/plans'

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
      </div>
    </header>
  )
}
