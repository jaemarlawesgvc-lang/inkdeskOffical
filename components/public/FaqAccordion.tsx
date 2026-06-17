'use client'

import { useState } from 'react'

interface FaqItem {
  id: string
  question: string
  answer: string
}

interface FaqAccordionProps {
  faqs: FaqItem[]
  accentColor: string
}

export function FaqAccordion({ faqs, accentColor }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null)

  return (
    <div className="space-y-3" role="list">
      {faqs.map((faq) => {
        const open = openId === faq.id
        const panelId = `faq-panel-${faq.id}`
        const buttonId = `faq-button-${faq.id}`
        return (
          <div key={faq.id} role="listitem" className="rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
            <button
              type="button"
              id={buttonId}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : faq.id)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ ['--tw-ring-color' as string]: accentColor }}
            >
              <span className="text-white font-semibold text-sm sm:text-base">{faq.question}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-5 h-5 flex-shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!open}
              className="px-5 pb-4 text-white/60 text-sm leading-relaxed whitespace-pre-line"
            >
              {faq.answer}
            </div>
          </div>
        )
      })}
    </div>
  )
}
