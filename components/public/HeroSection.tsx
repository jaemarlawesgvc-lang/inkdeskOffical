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
  primaryColor?: string
  artistName: string
  instagramHandle?: string | null
  styleTags?: string[]
  images?: HeroImage[]
  yearsExperience?: number | null
  rating?: number | null
  reviewCount?: number
  isLicensed?: boolean
}

interface Stat {
  value: string
  label: string
}

export function HeroSection({
  headline,
  subheadline,
  ctaText,
  accentColor,
  primaryColor = '#000000',
  artistName,
  instagramHandle,
  styleTags = [],
  images = [],
  yearsExperience,
  rating,
  reviewCount = 0,
  isLicensed = false,
}: HeroSectionProps) {
  const avatar = images[0] ?? null
  const backdrop = images[0] ?? null
  const handle = instagramHandle?.replace(/^@/, '') || null

  const stats: Stat[] = []
  if (rating && reviewCount > 0) stats.push({ value: rating.toFixed(1), label: `★ (${reviewCount})` })
  if (yearsExperience && yearsExperience > 0) stats.push({ value: `${yearsExperience}y`, label: 'experience' })

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden" style={{ backgroundColor: primaryColor }} aria-label="Profile">
      {/* ── Atmospheric backdrop ── */}
      {backdrop ? (
        <div className="absolute inset-0" aria-hidden="true">
          <Image src={backdrop.publicUrl} alt="" fill priority sizes="100vw" className="scale-110 object-cover blur-2xl opacity-40 animate-ken-burns" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${primaryColor}b3, ${primaryColor}d9, ${primaryColor})` }} />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${primaryColor}, ${primaryColor})` }} aria-hidden="true" />
      )}

      {/* Accent glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-24 top-1/4 h-[34rem] w-[34rem] rounded-full opacity-[0.16] blur-[140px]"
          style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.12] mix-blend-overlay" aria-hidden="true" />

      {/* ── Profile card ── */}
      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 py-28 sm:px-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl sm:p-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="rounded-full p-[3px]" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}40)` }}>
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-[3px] border-black sm:h-32 sm:w-32">
                  {avatar ? (
                    <Image src={avatar.publicUrl} alt={artistName} fill sizes="128px" priority className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-900 font-display text-4xl font-bold text-white/80">
                      {artistName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
                <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{headline}</h1>
                {isLicensed && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold" style={{ backgroundColor: `${accentColor}22`, color: accentColor }}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.236 4.53-1.69-1.69a.75.75 0 00-1.06 1.061l2.31 2.31a.75.75 0 001.137-.089l3.753-5.25z" clipRule="evenodd" /></svg>
                    Licensed
                  </span>
                )}
              </div>

              {handle && (
                <a
                  href={`https://instagram.com/${handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-white/55 transition-colors hover:text-white"
                >
                  @{handle}
                </a>
              )}

              {/* Stats */}
              {stats.length > 0 && (
                <div className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-2 sm:justify-start">
                  {stats.map((s) => (
                    <div key={s.label} className="text-center sm:text-left">
                      <span className="font-display text-xl font-bold text-white">{s.value}</span>{' '}
                      <span className="text-xs text-white/45">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Bio */}
              <p className="mx-auto mt-5 max-w-md text-[0.95rem] leading-relaxed text-white/70 sm:mx-0">{subheadline}</p>
            </div>
          </div>

          {/* Style "highlights" */}
          {styleTags.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
              {styleTags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
                  style={{ borderColor: `${accentColor}35`, backgroundColor: `${accentColor}12`, color: '#f5f5f0' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="#book"
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold shadow-2xl transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
              style={{ backgroundColor: accentColor, color: '#0a0a0a', boxShadow: `0 12px 36px ${accentColor}40` }}
            >
              {ctaText}
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </a>
            <a
              href="#portfolio"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 text-base font-semibold text-white/85 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white"
            >
              View the work
            </a>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32" style={{ background: `linear-gradient(to top, ${primaryColor}, transparent)` }} />
    </section>
  )
}
