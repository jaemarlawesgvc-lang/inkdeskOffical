export default function ArtistPageLoading() {
  return (
    <div className="min-h-screen bg-black" aria-hidden>
      <div className="animate-pulse">
        {/* Hero */}
        <div className="h-[60vh] w-full bg-white/[0.04]" />

        {/* Section placeholders */}
        <div className="mx-auto max-w-5xl px-6 py-16 space-y-10">
          <div className="h-8 w-48 max-w-full rounded-lg bg-white/[0.06]" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-white/[0.05]" />
            ))}
          </div>
          <div className="h-8 w-40 max-w-full rounded-lg bg-white/[0.06]" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-white/[0.05]" />
            <div className="h-4 w-5/6 rounded bg-white/[0.05]" />
            <div className="h-4 w-2/3 rounded bg-white/[0.05]" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading page…</span>
    </div>
  )
}
