'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

const PORTFOLIO_ITEMS = [
  {
    title: 'Mystical Rose & Skull',
    style: 'Neo-Traditional',
    image: '/assets/images/portfolio/neo-traditional.png',
    description: 'High-contrast detailed piece merging botanical roses with custom geometric skull forms.',
    size: 'Large Sleeve',
    colSpan: 'md:col-span-3',
    height: 'h-[450px]',
  },
  {
    title: 'Geometric Wolf Mandala',
    style: 'Blackwork',
    image: '/assets/images/portfolio/blackwork.png',
    description: 'Extensive dotwork detailing combined with sharp geometric lines.',
    size: 'Backpiece / Forearm',
    colSpan: 'md:col-span-2',
    height: 'h-[350px] md:mt-24',
  },
  {
    title: 'Lunar Ferns & Geometry',
    style: 'Fine-Line',
    image: '/assets/images/portfolio/fineline.png',
    description: 'Minimalist composition capturing moon phases and delicate botanical fronds.',
    size: 'Ribs / Wrist',
    colSpan: 'md:col-span-2',
    height: 'h-[400px]',
  },
  {
    title: 'Cybernetic Bio-Sleeve',
    style: 'Biomechanical / Abstract',
    image: '/assets/images/portfolio/metallic.png',
    description: 'Cyberpunk mechanical textures layered with sharp metal highlights.',
    size: 'Full Arm',
    colSpan: 'md:col-span-3',
    height: 'h-[500px] md:-mt-12',
  },
]

export function IdealPortfolio() {
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
    <section ref={sectionRef} id="portfolio" className="relative py-24 sm:py-32 bg-black overflow-hidden">
      {/* Background decoration */}
      <div className="absolute right-0 top-1/4 w-[400px] h-[400px] rounded-full bg-neutral-900/40 blur-3xl pointer-events-none" />
      <div className="absolute left-0 bottom-1/4 w-[400px] h-[400px] rounded-full bg-neutral-950/60 blur-3xl pointer-events-none" />

      <div className="mx-auto max-w-7xl px-6 sm:px-12 relative z-10">
        {/* Header */}
        <div className="reveal text-center max-w-3xl mx-auto mb-20">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-400 mb-4">
            Curated Creation
          </p>
          <h2 className="font-display text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            Portfolio Gallery
          </h2>
          <div className="w-12 h-[1px] bg-gold-500 mx-auto mt-6 mb-8" />
          <p className="text-sm sm:text-base text-ink-400 font-light leading-relaxed">
            A selection of bespoke designs engineered specifically for clean contours and maximum aesthetic longevity. Each piece is custom drawn and never duplicated.
          </p>
        </div>

        {/* Mesh Grid / Masonry Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          {PORTFOLIO_ITEMS.map((item, index) => (
            <div
              key={index}
              className={`reveal group relative overflow-hidden bg-neutral-950 border border-white/5 shadow-2xl transition-all duration-500 ${item.colSpan} ${item.height}`}
            >
              {/* Image element */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(min-width: 768px) 60vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10 group-hover:via-black/50 transition-all duration-300" />
              </div>

              {/* Grid content over image */}
              <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-8">
                {/* Meta details */}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gold-400 border-b border-gold-500/30 pb-0.5">
                    {item.style}
                  </span>
                  <span className="text-[10px] tracking-wider text-ink-400">
                    {item.size}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white mb-2 leading-tight group-hover:text-gold-300 transition-colors duration-300">
                  {item.title}
                </h3>

                {/* Description - expandable or revealing on hover */}
                <p className="text-xs text-ink-300 font-light leading-relaxed max-h-0 opacity-0 overflow-hidden group-hover:max-h-20 group-hover:opacity-100 transition-all duration-500 delay-75">
                  {item.description}
                </p>

                {/* Decorative border highlight */}
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-gold-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
