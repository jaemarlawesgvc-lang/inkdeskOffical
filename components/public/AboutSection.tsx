import { Reveal } from '@/components/public/Reveal'

interface AboutSectionProps {
  title: string
  body: string
  styleTags: string[]
  yearsExperience: number | null
  instagramHandle: string | null
  accentColor: string
}

export function AboutSection({
  title,
  body,
  styleTags,
  yearsExperience,
  instagramHandle,
  accentColor,
}: AboutSectionProps) {
  return (
    <section id="about" className="px-6 py-20 sm:py-32 relative overflow-hidden bg-zinc-950/20" aria-label="About the artist">
      {/* Decorative vertical line accent */}
      <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent hidden lg:block" />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          
          {/* Left Column - Meta & Stats */}
          <Reveal as="div" className="lg:col-span-5 space-y-6">
            <div className="relative group p-8 rounded-2xl bg-zinc-900/40 backdrop-blur-md border border-white/5 shadow-xl hover:border-white/10 transition-all duration-300">
              {/* Corner decor */}
              <div className="absolute top-3 left-3 w-2.5 h-2.5 border-t border-l opacity-20 group-hover:opacity-40 transition-opacity" style={{ borderColor: accentColor }} />
              <div className="absolute top-3 right-3 w-2.5 h-2.5 border-t border-r opacity-20 group-hover:opacity-40 transition-opacity" style={{ borderColor: accentColor }} />
              <div className="absolute bottom-3 left-3 w-2.5 h-2.5 border-b border-l opacity-20 group-hover:opacity-40 transition-opacity" style={{ borderColor: accentColor }} />
              <div className="absolute bottom-3 right-3 w-2.5 h-2.5 border-b border-r opacity-20 group-hover:opacity-40 transition-opacity" style={{ borderColor: accentColor }} />

              <div className="space-y-4 text-center">
                {yearsExperience !== null && yearsExperience > 0 && (
                  <div className="space-y-1">
                    <span className="text-4xl sm:text-5xl font-bold tracking-tight font-serif" style={{ color: '#f5f5f0' }}>
                      {yearsExperience}
                    </span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                      {yearsExperience === 1 ? 'Year' : 'Years'} of Craft
                    </p>
                  </div>
                )}
                
                {yearsExperience !== null && yearsExperience > 0 && <div className="h-[1px] w-12 bg-white/10 mx-auto" />}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-white/50">Location & Availability</p>
                  <p className="text-sm font-medium text-white/80">Worldwide Bookings Open</p>
                </div>
              </div>
            </div>

            {instagramHandle && (
              <a
                href={`https://instagram.com/${instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-5 rounded-2xl bg-zinc-900/20 border border-white/5 hover:border-white/10 text-white/60 hover:text-white transition-all duration-300 group shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={`Instagram profile @${instagramHandle}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/30">Instagram</p>
                    <p className="text-sm font-semibold">@{instagramHandle}</p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" style={{ color: accentColor }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            )}
          </Reveal>

          {/* Right Column - Title, Bio, and Styles */}
          <Reveal as="div" delay={120} className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <h2
                className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-left"
                style={{ color: '#f5f5f0' }}
              >
                {title}
              </h2>
              <div className="w-10 h-[2px] rounded-full" style={{ backgroundColor: accentColor }} />
            </div>

            {body && (
              <p className="text-white/70 text-base sm:text-lg leading-relaxed whitespace-pre-line text-left font-sans max-w-xl">
                {body}
              </p>
            )}

            {styleTags.length > 0 && (
              <div className="space-y-3 pt-2 text-left">
                <p className="text-xs font-bold uppercase tracking-wider text-white/40">Signature Styles</p>
                <div className="flex flex-wrap gap-2" role="list" aria-label="Tattoo styles">
                  {styleTags.map((tag) => (
                    <span
                      key={tag}
                      role="listitem"
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-300 hover:scale-[1.03]"
                      style={{
                        borderColor: `${accentColor}25`,
                        color: accentColor,
                        backgroundColor: `${accentColor}06`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Reveal>

        </div>
      </div>
    </section>
  )
}
