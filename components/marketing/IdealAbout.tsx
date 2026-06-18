'use client'

import { useEffect, useRef } from 'react'

const SPECIALTIES = [
  {
    name: 'Neo-Traditional',
    description: 'A modern evolution of American traditional. Featuring rich illustrative details, illustrative shading, and deep contrasted palettes combined with subtle gold line accents.',
    keywords: ['Bold Lines', 'Contour Shading', 'Organic Motifs'],
  },
  {
    name: 'Fine-Line & Dotwork',
    description: 'Created with precision single-needle configurations. We specialize in delicate botanical illustration, micro-geometric symbols, and ultra-smooth dotwork shading gradients.',
    keywords: ['Single Needle', 'Stipple Shading', 'Delicate Florals'],
  },
  {
    name: 'Ornamental Blackwork',
    description: 'Heavy, saturated solid black blocks combined with complex mandala symmetries. Engineered to sit perfectly against the muscular contours of your body for an striking silhouette.',
    keywords: ['High Saturation', 'Geometric Patterns', 'Anatomy Alignment'],
  },
]

export function IdealAbout() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    const elements = sectionRef.current?.querySelectorAll('.reveal')
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} id="about" className="relative py-24 sm:py-32 bg-[#050505] overflow-hidden border-t border-white/5">
      <div className="mx-auto max-w-7xl px-6 sm:px-12 relative z-10">
        
        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* Left: Philosophy and Studio details */}
          <div className="lg:col-span-5 space-y-8">
            <div className="reveal">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-400 mb-4">
                The Philosophy
              </p>
              <h2 className="font-display text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Designed For<br />A Lifetime.
              </h2>
            </div>
            
            <p className="reveal text-sm sm:text-base text-ink-300 font-light leading-relaxed">
              At Ideal, we believe tattoos are architecture for the skin. We design permanent installations that are optimized to gracefully withstand the natural changes of aging. 
            </p>
            
            <p className="reveal text-sm sm:text-base text-ink-400 font-light leading-relaxed">
              Our studio operates under strict clinical safety standards in a private, distraction-free environment. Each guest receives one-on-one attention to ensure their art is perfectly personalized.
            </p>

            <div className="reveal pt-4">
              <div className="p-6 border border-white/5 bg-black space-y-3">
                <h4 className="font-display text-base font-bold text-white uppercase tracking-wider">
                  The Private Studio Experience
                </h4>
                <p className="text-xs text-ink-400 leading-relaxed">
                  Located in the creative heart of London. Private session rooms, luxury amenities, and top-tier clinical sanitation protocols.
                </p>
              </div>
            </div>
          </div>
          
          {/* Right: Specialist grid */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="reveal text-xs font-bold uppercase tracking-[0.25em] text-ink-500 mb-8">
              Specialized Art Disciplines
            </h3>
            
            <div className="grid grid-cols-1 gap-6">
              {SPECIALTIES.map((spec, index) => (
                <div 
                  key={index} 
                  className="reveal p-8 border border-white/5 bg-black/60 hover:bg-black hover:border-white/10 transition-all duration-300 space-y-4"
                >
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-display text-lg sm:text-xl font-bold text-white">
                      {spec.name}
                    </h4>
                    <span className="text-[10px] text-gold-500/70 font-mono tracking-widest">
                      0{index + 1}
                    </span>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-ink-400 font-light leading-relaxed">
                    {spec.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    {spec.keywords.map((kw, i) => (
                      <span 
                        key={i} 
                        className="text-[9px] font-semibold tracking-wider uppercase bg-white/5 text-parchment-200 px-2.5 py-1 rounded-none border border-white/5"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </section>
  )
}
