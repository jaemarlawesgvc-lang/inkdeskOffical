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
  if (!studioAddress) return null

  const apiKey = clientEnv.googleMapsApiKey
  const hasCoords = lat !== null && lng !== null
  const showMap = Boolean(apiKey) && hasCoords

  const staticMapUrl = showMap
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=640x320&scale=2&markers=color:0xffffff%7C${lat},${lng}&key=${apiKey}`
    : null

  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(studioAddress)}`

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
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/30 group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{ ['--tw-ring-color' as string]: accentColor }}
            aria-label={`Get directions to ${studioAddress}`}
          >
            {staticMapUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={staticMapUrl}
                alt={`Map showing ${studioName ?? 'the studio'} location`}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            )}
            <div className="p-5 flex items-center justify-between gap-4">
              <p className="text-white/70 text-sm">{studioAddress}</p>
              <span className="flex-shrink-0 text-xs font-semibold uppercase tracking-wide" style={{ color: accentColor }}>
                Get directions →
              </span>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  )
}
