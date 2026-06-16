import type { ReactNode } from 'react'

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

const ACCENT_STYLES: Record<NonNullable<Stat['accent']>, string> = {
  gold: 'bg-gold-500/10 text-gold-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  violet: 'bg-violet-500/10 text-violet-400',
  sky: 'bg-sky-500/10 text-sky-400',
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition-colors duration-150 hover:border-white/20"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-white/40 uppercase tracking-widest mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
              {stat.subtext && (
                <p className="text-xs text-white/30 mt-0.5">{stat.subtext}</p>
              )}
            </div>
            {stat.icon && (
              <div
                className={[
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                  ACCENT_STYLES[stat.accent ?? 'gold'],
                ].join(' ')}
              >
                {stat.icon}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
