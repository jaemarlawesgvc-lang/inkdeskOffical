interface AdminTopBarProps {
  displayName: string
}

export function AdminTopBar({ displayName }: AdminTopBarProps) {
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-black/80 backdrop-blur-md border-b border-white/10">
      {/* Mobile logo */}
      <div className="lg:hidden flex items-center gap-2">
        <span className="text-white font-bold text-base tracking-tight">Inkquire</span>
        <span className="px-2 py-0.5 bg-crimson-500/20 text-crimson-400 text-xs font-semibold rounded-full">
          Admin
        </span>
      </div>

      {/* Spacer on desktop */}
      <div className="hidden lg:block" />

      {/* Right: admin badge + avatar */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-crimson-500/20 text-crimson-400">
          Administrator
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
