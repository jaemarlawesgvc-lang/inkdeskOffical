import Image from 'next/image'

interface HeroImage {
  publicUrl: string
  caption: string
}

interface HeroSectionProps {
  headline: string
  subheadline: string
  ctaText: string
  accentColor: string
  artistName: string
  styleTags?: string[]
  images?: HeroImage[]
}

export function HeroSection({
  headline,
  subheadline,
  ctaText,
  accentColor,
  artistName,
  styleTags = [],
  images = [],
}: HeroSectionProps) {
  const bg = images.length > 0 ? images[0] : null
  // Up to 4 secondary images for a clean 2×2 gallery wall beside the headline.
  const galleryImages = images.slice(1, 5)

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden bg-black"
      aria-label="Introduction"
    >
      {/* ── Full-bleed background imagery with cinematic Ken Burns zoom ── */}
      {bg ? (
        <div className="absolute inset-0" aria-hidden="true">
          <Image
            src={bg.publicUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover animate-ken-burns"
          />
          {/* Legibility + mood overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
          {/* Vignette */}
          <div className="absolute inset-0 [box-shadow:inset_0_0_220px_60px_rgba(0,0,0,0.9)]" />
        </div>
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black"
          aria-hidden="true"
        />
      )}

      {/* Ambient accent glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-1/4 -left-20 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.18] animate-pulse"
          style={{
            background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
            animationDuration: '5s',
          }}
        />
      </div>

      {/* Grain texture */}
      <div
        className="absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 py-28 grid lg:grid-cols-12 gap-12 items-center">
        {/* ── Text column ── */}
        <div className="lg:col-span-7 space-y-7 text-left">
          {/* Live badge */}
          <div
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-widest bg-white/[0.04] border border-white/10 backdrop-blur-md animate-fade-up opacity-0 [animation-fill-mode:forwards] [animation-delay:100ms]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: accentColor }} />
            </span>
            <span className="text-white/75">Booking Available</span>
          </div>

          {/* Artist name — animated gradient display type */}
          <h1 className="font-serif font-bold tracking-tight leading-[0.95] animate-fade-up opacity-0 [animation-fill-mode:forwards] [animation-delay:200ms]">
            <span className="block text-sm sm:text-base font-sans font-medium uppercase tracking-[0.3em] text-white/50 mb-4">
              {headline === artistName ? 'Tattoo Artist' : artistName}
            </span>
            <span
              className="block text-5xl sm:text-7xl lg:text-8xl text-transparent bg-clip-text animate-gradient-text"
              style={{
                backgroundImage: `linear-gradient(110deg, #ffffff 0%, ${accentColor} 35%, #ffffff 70%, ${accentColor} 100%)`,
              }}
            >
              {headline}
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/65 max-w-xl leading-relaxed animate-fade-up opacity-0 [animation-fill-mode:forwards] [animation-delay:300ms]">
            {subheadline}
          </p>

          {/* Style tags */}
          {styleTags.length > 0 && (
            <div className="flex flex-wrap gap-2 animate-fade-up opacity-0 [animation-fill-mode:forwards] [animation-delay:350ms]">
              {styleTags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-sm"
                  style={{
                    borderColor: `${accentColor}30`,
                    color: '#f5f5f0',
                    backgroundColor: `${accentColor}10`,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="pt-3 flex flex-wrap items-center gap-4 animate-fade-up opacity-0 [animation-fill-mode:forwards] [animation-delay:450ms]">
            <a
              href="#book"
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl text-base font-bold transition-all duration-300 transform hover:-translate-y-1 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black overflow-hidden shadow-2xl"
              style={{
                backgroundColor: accentColor,
                color: '#0a0a0a',
                ['--tw-ring-color' as string]: accentColor,
                boxShadow: `0 10px 40px ${accentColor}40`,
              }}
            >
              <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/40 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
              <span className="relative z-10">{ctaText}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:translate-x-1.5">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
            <a
              href="#portfolio"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-xl text-base font-semibold text-white/80 border border-white/15 hover:border-white/30 hover:text-white backdrop-blur-sm transition-all duration-200"
            >
              View work
            </a>
          </div>
        </div>

        {/* ── Gallery wall (desktop, when extra images exist) ── */}
        {galleryImages.length > 0 && (
          <div className="hidden lg:block lg:col-span-5" aria-hidden="true">
            {/* Float applied to the wrapper so cards move in unison and
                never close the gap between each other. */}
            <div className="grid grid-cols-2 gap-4 animate-float-y">
              {galleryImages.map((img, i) => (
                <div
                  key={i}
                  className={[
                    'group relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 shadow-2xl',
                    // Offset the right-hand column downward for a curated rhythm.
                    i % 2 === 1 ? 'mt-10' : '',
                  ].join(' ')}
                  style={{ boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8)' }}
                >
                  <Image
                    src={img.publicUrl}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 0px, 220px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      {/* Scroll cue */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in [animation-delay:1000ms] opacity-0 [animation-fill-mode:forwards]"
        aria-hidden="true"
      >
        <span className="text-[9px] uppercase tracking-widest text-white/40 font-semibold">Scroll</span>
        <div className="w-[1px] h-10 bg-white/15 relative overflow-hidden rounded-full">
          <div
            className="absolute top-0 left-0 right-0 w-full h-1/2 rounded-full animate-shimmer"
            style={{
              background: `linear-gradient(to bottom, transparent, ${accentColor}, transparent)`,
              animationDuration: '2s',
            }}
          />
        </div>
      </div>
    </section>
  )
}
