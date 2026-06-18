'use client'

import { useEffect, useState } from 'react'

export function IdealHero() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      {/* Background Ken Burns slide */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none">
        <div 
          className="absolute inset-0 bg-[url('/assets/images/portfolio/neo-traditional.png')] bg-cover bg-center opacity-20 scale-110 blur-[2px] animate-ken-burns"
        />
        {/* Dark radial gradients to frame content */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="absolute inset-0 bg-radial-gradient(circle at center, transparent 30%, black 90%)" />
      </div>

      {/* Ambient glowing orb */}
      <div className="absolute inset-0 flex items-center justify-center z-1 pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full bg-gold-500/10 blur-[120px] animate-pulse-gold" />
      </div>

      {/* Subtle Noise Overlays */}
      <div className="absolute inset-0 z-2 bg-noise opacity-30 pointer-events-none" />

      {/* Hero Content */}
      <div className="relative z-10 text-center max-w-5xl px-6 sm:px-12 flex flex-col items-center">
        {/* Eyebrow */}
        <div 
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold-500/20 bg-gold-950/30 backdrop-blur-md mb-8 transition-all duration-1000 transform ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-gold-400">
            Luxury Fine-Line &amp; Blackwork Studio
          </span>
        </div>

        {/* Master Heading */}
        <h1 
          className={`font-display text-6xl sm:text-8xl md:text-9xl font-black leading-[0.9] text-white tracking-tighter mb-8 transition-all duration-1000 delay-300 transform ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          IDEAL
          <span className="block text-2xl sm:text-3xl md:text-4xl font-light tracking-[0.4em] uppercase text-parchment-300 mt-4">
            Tattoo Studio
          </span>
        </h1>

        {/* Subtitle / Description */}
        <p 
          className={`max-w-2xl text-base sm:text-lg md:text-xl text-ink-300 font-light leading-relaxed mb-12 transition-all duration-1000 delay-500 transform ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          A sanctuary where fine-line precision meets bold blackwork storytelling. 
          Individually tailored art pieces designed to trace the contours of your identity.
        </p>

        {/* Action Buttons */}
        <div 
          className={`flex flex-col sm:flex-row gap-4 items-center transition-all duration-1000 delay-700 transform ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <a
            href="#booking"
            className="px-8 py-4 bg-white text-black font-bold uppercase tracking-wider text-xs sm:text-sm rounded-none border border-white hover:bg-transparent hover:text-white transition-all duration-300 shadow-lg"
          >
            Book An Appointment
          </a>
          <a
            href="#portfolio"
            className="px-8 py-4 bg-transparent text-white font-bold uppercase tracking-wider text-xs sm:text-sm rounded-none border border-white/20 hover:border-white transition-all duration-300"
          >
            Explore Portfolio
          </a>
        </div>
      </div>

      {/* Decorative vertical lines */}
      <div className="absolute left-10 bottom-0 top-0 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent hidden xl:block pointer-events-none" />
      <div className="absolute right-10 bottom-0 top-0 w-[1px] bg-gradient-to-b from-transparent via-white/5 to-transparent hidden xl:block pointer-events-none" />
    </section>
  )
}
