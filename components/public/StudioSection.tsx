import { Reveal } from '@/components/public/Reveal'
import { clientEnv } from '@/lib/env.client'

interface StudioSectionProps {
  studioName: string | null
  studioAddress: string | null
  lat: number | null
  lng: number | null
  accentColor: string
}

export function StudioSection({ studioName, studioAddress, lat, lng, accentColor }: StudioSectionProps) {
  // Render if we have anything to point at — an address or coordinates.
  const hasCoords = lat !== null && lng !== null
  if (!studioAddress && !hasCoords) return null

  // What we point Google Maps at: precise coords if we have them, else the address.
  const query = hasCoords ? `${lat},${lng}` : (studioAddress as string)
  const encodedQuery = encodeURIComponent(query)

  // Keyless interactive embed — works with no API key at all.
  const embedUrl = `https://www.google.com/maps?q=${encodedQuery}&z=15&output=embed`

  // Keyless directions deep-link — opens Google Maps with the destination set.
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedQuery}`

  // If a Google Maps key IS configured, use a crisp static image instead of the
  // interactive iframe (optional upgrade; falls back to the keyless embed).
  const apiKey = clientEnv.googleMapsApiKey
  const staticMapUrl =
    apiKey && hasCoords
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=640x320&scale=2&markers=color:0xffffff%7C${lat},${lng}&key=${apiKey}`
      : null

  return (
    <section id="studio" className="px-6 py-20 sm:py-28 relative" aria-label="Studio location">
      <div className="max-w-3xl mx-auto relative z-10">
        <Reveal className="text-center mb-10 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            Studio
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: '#f5f5f0' }}>
            {studioName ?? 'Find us'}
          </h2>
          <div className="w-12 h-[2px] mx-auto mt-4 rounded-full" style={{ backgroundColor: accentColor }} />
        </Reveal>

        <Reveal>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/30">
            {/* Map picture */}
            {staticMapUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                style={{ ['--tw-ring-color' as string]: accentColor }}
                aria-label={`Get directions to ${studioAddress ?? studioName ?? 'the studio'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staticMapUrl}
                  alt={`Map showing ${studioName ?? 'the studio'} location`}
                  className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </a>
            ) : (
              <iframe
                src={embedUrl}
                title={`Map showing ${studioName ?? 'the studio'} location`}
                className="w-full h-64 sm:h-80 border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            )}

            {/* Address + directions button */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {studioAddress && (
                <p className="text-white/70 text-sm">{studioAddress}</p>
              )}
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 flex-shrink-0 rounded-xl px-5 py-2.5 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
                style={{ backgroundColor: accentColor, color: '#0a0a0a' }}
                aria-label={`Get directions to ${studioAddress ?? studioName ?? 'the studio'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                </svg>
                Get directions
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
