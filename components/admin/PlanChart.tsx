interface PlanChartProps {
  distribution: { plan: string; count: number }[]
}

const DEFAULT_COLORS = { bg: 'bg-white/10', bar: 'bg-white/40' }

const PLAN_COLORS: Record<string, { bg: string; bar: string }> = {
  free:   DEFAULT_COLORS,
  pro:    { bg: 'bg-amber-500/10',   bar: 'bg-amber-500' },
  studio: { bg: 'bg-violet-500/10',  bar: 'bg-violet-500' },
}

export function PlanChart({ distribution }: PlanChartProps) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-white/40 text-sm">
        No subscriptions yet.
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Plan Distribution</h3>

      {/* Stacked bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-white/5">
        {distribution.map((d) => {
          const pct = total > 0 ? (d.count / total) * 100 : 0
          if (pct === 0) return null
          const colors = PLAN_COLORS[d.plan] ?? DEFAULT_COLORS
          return (
            <div
              key={d.plan}
              className={`${colors.bar} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${d.plan}: ${d.count} (${pct.toFixed(0)}%)`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {distribution.map((d) => {
          const pct = total > 0 ? (d.count / total) * 100 : 0
          const colors = PLAN_COLORS[d.plan] ?? DEFAULT_COLORS
          return (
            <div key={d.plan} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${colors.bar}`} />
              <span className="text-sm text-white/60 capitalize">
                {d.plan}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums">
                {d.count}
              </span>
              <span className="text-xs text-white/30">
                ({pct.toFixed(0)}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
