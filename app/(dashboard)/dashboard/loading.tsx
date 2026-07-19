export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      {/* Greeting / header line */}
      <div className="h-8 w-64 max-w-full rounded-lg bg-white/[0.06]" />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>

      {/* Content blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-xl border border-white/10 bg-white/[0.04]" />
        <div className="h-64 rounded-xl border border-white/10 bg-white/[0.04]" />
      </div>

      <span className="sr-only">Loading dashboard…</span>
    </div>
  )
}
