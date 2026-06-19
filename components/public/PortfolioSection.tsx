'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Reveal } from '@/components/public/Reveal'

interface PortfolioImage {
  publicUrl: string
  caption: string
}

interface PortfolioSectionProps {
  images: PortfolioImage[]
  accentColor: string
}

export function PortfolioSection({ images, accentColor }: PortfolioSectionProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    // Restore focus to the trigger that opened the lightbox
    triggerRef.current?.focus()
  }, [])

  const goNext = useCallback(() => {
    setLightboxIndex((idx) => (idx === null ? null : (idx + 1) % images.length))
  }, [images.length])

  const goPrev = useCallback(() => {
    setLightboxIndex((idx) =>
      idx === null ? null : (idx - 1 + images.length) % images.length,
    )
  }, [images.length])

  useEffect(() => {
    if (lightboxIndex === null) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }

    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog
    closeButtonRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [lightboxIndex, closeLightbox, goNext, goPrev])

  if (images.length === 0) return null

  const activeImage = lightboxIndex !== null ? images[lightboxIndex] : null

  const openLightbox = (index: number, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setLightboxIndex(index)
  }

  return (
    <section id="portfolio" className="px-6 py-20 sm:py-32 relative" aria-label="Portfolio">
      {/* Ambient decorative glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div 
          className="absolute -top-10 left-1/4 w-[500px] h-[250px] rounded-full blur-[120px] opacity-[0.06]"
          style={{ background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)` }}
        />
        <div 
          className="absolute -bottom-10 right-1/4 w-[500px] h-[250px] rounded-full blur-[120px] opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <Reveal className="text-center mb-16 space-y-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: accentColor }}>
            Featured Art
          </span>
          <h2
            className="font-serif text-4xl sm:text-5xl font-bold tracking-tight"
            style={{ color: '#f5f5f0' }}
          >
            Portfolio
          </h2>
          <div className="w-12 h-[2px] mx-auto mt-4 rounded-full" style={{ backgroundColor: accentColor }} />
        </Reveal>

        {/* Instagram-style square grid */}
        <div className="grid grid-cols-3 gap-1 sm:gap-2" role="list">
          {images.map((img, i) => (
            <Reveal key={i} delay={(i % 3) * 90}>
              <button
                type="button"
                role="listitem"
                onClick={(e) => openLightbox(i, e.currentTarget)}
                className="block w-full aspect-square rounded-lg sm:rounded-xl overflow-hidden group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black transition-all duration-300 bg-zinc-900"
                style={{ ['--tw-ring-color' as string]: accentColor }}
                aria-label={`View ${img.caption || `portfolio image ${i + 1}`} enlarged`}
              >
                <Image
                  src={img.publicUrl}
                  alt={img.caption || `Portfolio image ${i + 1}`}
                  fill
                  sizes="(max-width: 768px) 33vw, 33vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />

                {/* Accent ring on hover */}
                <div
                  className="absolute inset-0 rounded-2xl ring-1 ring-inset opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ ['--tw-ring-color' as string]: `${accentColor}50` }}
                />

                {/* Premium Hover Card Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5 text-left">
                  <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 space-y-1">
                    {img.caption && (
                      <p className="text-sm font-semibold text-white/90 line-clamp-2 leading-snug">
                        {img.caption}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: accentColor }}>
                      <span>View Artwork</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && activeImage && (
        <div
          className="fixed inset-0 z-50 backdrop-blur-xl bg-zinc-950/90 flex items-center justify-center transition-all duration-300"
          role="dialog"
          aria-modal="true"
          aria-label={`Image ${lightboxIndex + 1} of ${images.length}`}
        >
          {/* Top Control Bar */}
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between px-6 z-10">
            <div className="text-white/60 text-sm font-medium tabular-nums">
              Artwork {lightboxIndex + 1} of {images.length}
            </div>
            
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeLightbox}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all duration-200"
              aria-label="Close lightbox"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all duration-200 z-10"
              aria-label="Previous image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <div className="relative max-w-[90vw] max-h-[75vh] w-full h-full flex flex-col items-center justify-center p-4">
            <Image
              src={activeImage.publicUrl}
              alt={activeImage.caption || `Portfolio image ${lightboxIndex + 1}`}
              width={1200}
              height={1600}
              sizes="90vw"
              className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl shadow-2xl transition-transform duration-300"
              priority
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={goNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white transition-all duration-200 z-10"
              aria-label="Next image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Bottom Details Overlay Card */}
          {activeImage.caption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-[calc(100%-3rem)] bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center shadow-xl">
              <p className="text-sm font-medium text-white/90 leading-relaxed">
                {activeImage.caption}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
