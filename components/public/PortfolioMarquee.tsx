import Image from 'next/image'

interface MarqueeImage {
  publicUrl: string
  caption: string
}

interface PortfolioMarqueeProps {
  images: MarqueeImage[]
  accentColor: string
}

/**
 * An infinite, auto-scrolling horizontal strip of portfolio thumbnails.
 * Pauses on hover. The track is duplicated so the loop is seamless.
 */
export function PortfolioMarquee({ images, accentColor }: PortfolioMarqueeProps) {
  // Need a reasonable number of tiles for a convincing loop.
  if (images.length < 3) return null

  const track = [...images, ...images]

  return (
    <div
      className="relative overflow-hidden border-y border-white/5 bg-black py-6 marquee-paused"
      aria-hidden="true"
    >
      {/* Edge fades */}
      <div className="absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-black to-transparent" />
      <div className="absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-black to-transparent" />

      <div className="flex w-max gap-4 animate-marquee-x">
        {track.map((img, i) => (
          <div
            key={i}
            className="relative h-40 w-32 sm:h-52 sm:w-40 flex-shrink-0 rounded-xl overflow-hidden border border-white/10 group"
          >
            <Image
              src={img.publicUrl}
              alt=""
              fill
              sizes="160px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: `linear-gradient(to top, ${accentColor}30, transparent 60%)`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
