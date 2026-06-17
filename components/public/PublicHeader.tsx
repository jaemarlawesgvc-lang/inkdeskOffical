interface PublicHeaderProps {
  artistName: string
  username: string
  accentColor: string
  showAbout: boolean
  showFaq: boolean
}

export function PublicHeader({
  artistName,
  username,
  accentColor,
  showAbout,
  showFaq,
}: PublicHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-md"
      aria-label="Artist page navigation"
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        <a
          href="#top"
          className="font-serif text-lg font-bold text-white truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
          style={{ ['--tw-ring-color' as string]: accentColor }}
        >
          {artistName}
        </a>

        <nav aria-label="Section links" className="flex items-center gap-5 sm:gap-6">
          <a
            href="#portfolio"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
            style={{ ['--tw-ring-color' as string]: accentColor }}
          >
            Portfolio
          </a>
          {showAbout && (
            <a
              href="#about"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
              style={{ ['--tw-ring-color' as string]: accentColor }}
            >
              About
            </a>
          )}
          {showFaq && (
            <a
              href={`/${username}/faq`}
              className="text-sm font-medium text-white/60 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded"
              style={{ ['--tw-ring-color' as string]: accentColor }}
            >
              FAQ
            </a>
          )}
          <a
            href="#book"
            className="text-sm font-semibold px-3.5 py-1.5 rounded-lg transition-all hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{ backgroundColor: accentColor, color: '#0a0a0a', ['--tw-ring-color' as string]: accentColor }}
          >
            Book
          </a>
        </nav>
      </div>
    </header>
  )
}
