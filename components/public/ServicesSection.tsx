import { Reveal } from '@/components/public/Reveal'

interface Service {
  name: string
  description: string
  priceFrom: string
}

interface ServicesSectionProps {
  services: Service[]
  accentColor: string
}

export function ServicesSection({ services, accentColor }: ServicesSectionProps) {
  if (services.length === 0) return null

  return (
    <section
      id="services"
      className="px-6 py-20 sm:py-32 relative overflow-hidden bg-zinc-950/40"
      aria-label="Services"
    >
      {/* Background visual accents */}
      <div className="absolute inset-0 bg-noise opacity-[0.05] pointer-events-none" aria-hidden="true" />
      
      <div className="max-w-5xl mx-auto relative z-10">
        <Reveal className="text-center mb-16 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            Offerings
          </span>
          <h2
            className="font-serif text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ color: '#f5f5f0' }}
          >
            Services &amp; Pricing
          </h2>
          <div className="w-12 h-[2px] mx-auto mt-4 rounded-full" style={{ backgroundColor: accentColor }} />
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <Reveal key={i} delay={(i % 3) * 100} className="h-full">
              <div className="group relative flex flex-col justify-between h-full p-6 rounded-2xl bg-zinc-900/30 border border-white/5 hover:border-white/10 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden">
              {/* Subtle vertical glow accent */}
              <div 
                className="absolute top-0 bottom-0 left-0 w-[2px] bg-transparent group-hover:bg-current transition-colors duration-300"
                style={{ color: accentColor }}
              />

              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-white font-bold text-lg group-hover:text-[#f5f5f0] transition-colors">
                    {service.name}
                  </h3>
                </div>
                <p className="text-white/50 text-sm leading-relaxed min-h-[4rem]">
                  {service.description}
                </p>
              </div>

              <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/30">Price Estimate</span>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-white/[0.03] border border-white/5 shadow-inner"
                  style={{ color: accentColor, borderColor: `${accentColor}25` }}
                >
                  From {service.priceFrom}
                </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
