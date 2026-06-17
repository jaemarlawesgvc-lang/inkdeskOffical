import { Reveal } from '@/components/public/Reveal'

interface PublicCredential {
  id: string
  type: 'award' | 'publication'
  title: string
  issuingBody: string | null
  year: number | null
  url: string | null
  imageUrl: string | null
}

interface CredentialsSectionProps {
  credentials: PublicCredential[]
  isLicensed: boolean
  accentColor: string
}

export function CredentialsSection({ credentials, isLicensed, accentColor }: CredentialsSectionProps) {
  if (credentials.length === 0 && !isLicensed) return null

  return (
    <section id="credentials" className="px-6 py-20 sm:py-28 relative" aria-label="Credentials">
      <div className="max-w-4xl mx-auto relative z-10">
        <Reveal className="text-center mb-12 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            Recognition
          </span>
          <h2 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: '#f5f5f0' }}>
            Credentials
          </h2>
          <div className="w-12 h-[2px] mx-auto mt-4 rounded-full" style={{ backgroundColor: accentColor }} />
        </Reveal>

        {isLicensed && (
          <div className="flex justify-center mb-10">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border"
              style={{ borderColor: `${accentColor}40`, color: accentColor, backgroundColor: `${accentColor}10` }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                <path fillRule="evenodd" d="M10 1l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 13.27l-4.78 2.43.91-5.32-3.86-3.76 5.34-.78L10 1z" clipRule="evenodd" />
              </svg>
              Licensed
            </span>
          </div>
        )}

        {credentials.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {credentials.map((cred, i) => (
              <Reveal key={cred.id} delay={(i % 2) * 100}>
                <div className="flex gap-4 p-5 rounded-2xl bg-zinc-900/30 border border-white/5">
                  {cred.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cred.imageUrl}
                      alt={cred.title}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-white/10"
                    />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                      {cred.type === 'award' ? 'Award' : 'Publication'}
                    </span>
                    <h3 className="text-white font-semibold text-sm mt-0.5">
                      {cred.url ? (
                        <a href={cred.url} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-2">
                          {cred.title}
                        </a>
                      ) : (
                        cred.title
                      )}
                    </h3>
                    <p className="text-white/40 text-xs mt-1">
                      {[cred.issuingBody, cred.year].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
