import Link from 'next/link'

interface FooterProps {
  artistName: string
  artistId?: string
  artistEmail?: string
}

export function Footer({ artistName, artistId, artistEmail }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 px-6 py-10" aria-label="Footer">
      <div className="max-w-4xl mx-auto space-y-6">
        {artistId && (
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-center">
            <a
              href={`/api/aftercare-guide?artist_id=${artistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white text-sm transition-colors duration-150 underline underline-offset-2"
            >
              Download Aftercare Guide
            </a>
            <a
              href={`/api/consent-form?artist_id=${artistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white text-sm transition-colors duration-150 underline underline-offset-2"
            >
              Download Consent Form
            </a>
          </div>
        )}
        {artistEmail && (
          <div className="text-center">
            <p className="text-white/30 text-xs">
              Having a problem?{' '}
              <a
                href={`mailto:${artistEmail}`}
                className="text-white/50 hover:text-white underline underline-offset-2 transition-colors"
              >
                Contact {artistName}
              </a>
            </p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
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
      </div>
    </footer>
  )
}
