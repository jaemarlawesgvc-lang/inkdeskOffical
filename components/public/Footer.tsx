import Link from 'next/link'

interface FooterProps {
  artistName: string
}

export function Footer({ artistName }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 px-6 py-10" aria-label="Footer">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <p className="text-white/40 text-sm">
          &copy; {year} {artistName}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors duration-150"
        >
          Powered by
          <span className="font-bold text-white/70">InkDesk</span>
        </Link>
      </div>
    </footer>
  )
}
