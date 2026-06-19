import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Stat {
  label: string
  value: string
  subtext?: string
  icon?: ReactNode
  accent?: 'gold' | 'emerald' | 'violet' | 'sky'
}

interface StatsRowProps {
  stats: Stat[]
}

const ICON_STYLES: Record<NonNullable<Stat['accent']>, string> = {
  gold: 'bg-gold-500/15 text-gold-400 ring-1 ring-gold-500/25',
  emerald: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20',
  sky: 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20',
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((stat) => {
        const isHero = stat.accent === 'gold'
        return (
          <div
            key={stat.label}
            className={cn(
              'group relative overflow-hidden rounded-2xl border px-5 py-4 shadow-inset-top transition-all duration-200',
              'hover:-translate-y-0.5',
              isHero
                ? 'border-gold-500/25 bg-gradient-surface ring-1 ring-gold-500/10 hover:border-gold-500/40'
                : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16] hover:bg-white/[0.05]',
            )}
          >
            {/* Corner glow */}
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-opacity duration-300',
                isHero ? 'bg-gold-500/[0.12] opacity-100' : 'bg-white/[0.04] opacity-0 group-hover:opacity-100',
              )}
            />

            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1.5 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-white/40">
                  {stat.label}
                </p>
                <p className="font-display text-2xl font-bold tabular-nums text-white sm:text-[1.7rem] sm:leading-none">
                  {stat.value}
                </p>
                {stat.subtext && (
                  <p className="mt-1.5 text-xs text-white/35">{stat.subtext}</p>
                )}
              </div>
              {stat.icon && (
                <div
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                    ICON_STYLES[stat.accent ?? 'gold'],
                  )}
                >
                  {stat.icon}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
