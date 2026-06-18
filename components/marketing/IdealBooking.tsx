'use client'

import { useEffect, useRef } from 'react'

const BOOKING_STEPS = [
  {
    num: 'I',
    title: 'Submit Inquiry',
    desc: 'Describe your idea, style preference, placement, and approximate size.',
  },
  {
    num: 'II',
    title: 'Consultation',
    desc: 'Review references, map out canvas contours, and finalize style concepts.',
  },
  {
    num: 'III',
    title: 'Bespoke Draft',
    desc: 'View custom digital sketch layout options before we touch the skin.',
  },
  {
    num: 'IV',
    title: 'Secure Booking',
    desc: 'Place a secure deposit to lock in your multi-session appointment slots.',
  },
]

export function IdealBooking() {
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
    <section ref={sectionRef} id="booking" className="relative py-24 sm:py-32 bg-black border-t border-white/5 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="w-[800px] h-[400px] rounded-full bg-gold-950/20 blur-[130px] -translate-y-12" />
      </div>

      <div className="mx-auto max-w-7xl px-6 sm:px-12 relative z-10">
        
        {/* Header */}
        <div className="reveal text-center max-w-3xl mx-auto mb-20">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-400 mb-4">
            The Process
          </p>
          <h2 className="font-display text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Reserve Your Session
          </h2>
          <div className="w-12 h-[1px] bg-gold-500 mx-auto mt-6 mb-8" />
          <p className="text-sm sm:text-base text-ink-400 font-light leading-relaxed">
            Due to our detailed custom sketching and anatomical planning, appointments are limited and booking deposits are required for all confirmed projects.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-20">
          {BOOKING_STEPS.map((step, index) => (
            <div 
              key={index} 
              className="reveal p-6 bg-neutral-950/80 border border-white/5 space-y-4 hover:border-white/10 transition-all duration-300 relative group"
            >
              <div className="text-2xl font-black font-display text-gold-500/30 group-hover:text-gold-500/70 transition-colors duration-300">
                {step.num}
              </div>
              <h3 className="font-display text-base font-bold text-white">
                {step.title}
              </h3>
              <p className="text-xs text-ink-400 font-light leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Hero Booking Box */}
        <div className="reveal max-w-4xl mx-auto border border-white/10 bg-gradient-to-b from-neutral-950 to-neutral-900 p-8 sm:p-12 text-center space-y-8 shadow-2xl relative">
          <div aria-hidden className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />
          
          <div className="space-y-3">
            <h3 className="font-display text-2xl sm:text-3xl font-black text-white uppercase tracking-wider">
              Ready to start your project?
            </h3>
            <p className="text-xs sm:text-sm text-ink-300 max-w-xl mx-auto font-light leading-relaxed">
              Accepting project proposals for the upcoming quarter. Inquire now to secure a slot for Neo-Traditional sleeves, geometric Blackwork panels, or custom Fine-line illustrative pieces.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 bg-white text-black font-bold uppercase tracking-wider text-xs sm:text-sm rounded-none border border-white hover:bg-transparent hover:text-white transition-all duration-300"
            >
              Start Project Inquiry
            </a>
            <a
              href="/about"
              className="w-full sm:w-auto px-8 py-4 bg-transparent text-white font-bold uppercase tracking-wider text-xs sm:text-sm rounded-none border border-white/20 hover:border-white transition-all duration-300"
            >
              View Studio Details
            </a>
          </div>

          <p className="text-[10px] text-ink-500 leading-relaxed max-w-md mx-auto">
            * Consultations are free. A deposit of £50–£150 is required upon sketch finalization to secure the actual ink session slots.
          </p>
        </div>

      </div>
    </section>
  )
}
