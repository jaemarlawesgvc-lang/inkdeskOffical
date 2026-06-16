'use client'

import { useState, useEffect } from 'react'

export function CookieConsent() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('inkdesk_cookie_consent')
    if (!consent) {
      setShow(true)
    }
  }, [])

  const handleAcceptAll = () => {
    localStorage.setItem('inkdesk_cookie_consent', JSON.stringify({ analytics: true, necessary: true }))
    setShow(false)
  }

  const handleDecline = () => {
    localStorage.setItem('inkdesk_cookie_consent', JSON.stringify({ analytics: false, necessary: true }))
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:max-w-md z-50 animate-fade-up">
      <div className="p-6 rounded-2xl bg-zinc-950/80 backdrop-blur-xl border border-white/10 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-gold-500">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
              <path d="M11 17v.01" />
              <path d="M7 14v.01" />
            </svg>
          </div>
          <div className="space-y-1">
            <h4 className="font-serif font-bold text-base text-[#f5f5f0]">Cookie Consent</h4>
            <p className="text-xs text-white/50 leading-relaxed">
              We use strictly necessary session cookies to keep you logged in and optional analytics/error reporting cookies (Sentry) to improve your experience.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleDecline}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white/70 hover:text-white transition-all active:scale-98"
          >
            Decline Optional
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-98"
            style={{ backgroundColor: '#ffb700', color: '#080808' }}
          >
            Accept All
          </button>
        </div>
        
        <p className="text-[10px] text-center text-white/30">
          Read our{' '}
          <a href="/privacy" className="underline hover:text-white/60 transition-colors">Privacy Policy</a>
          {' '}and{' '}
          <a href="/cookies" className="underline hover:text-white/60 transition-colors">Cookie Policy</a>.
        </p>
      </div>
    </div>
  )
}
