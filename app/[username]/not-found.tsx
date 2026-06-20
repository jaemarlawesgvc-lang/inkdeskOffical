import Link from 'next/link'

export default function ArtistNotFound() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
      <h1 className="font-serif text-5xl font-bold mb-3" style={{ color: '#f5f5f0' }}>
        Artist not found
      </h1>
      <p className="text-white/50 text-base max-w-md mb-8">
        This page doesn&rsquo;t exist or the artist hasn&rsquo;t finished setting up their booking page yet.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
      >
        Back to Inkquire
      </Link>
    </div>
  )
}
