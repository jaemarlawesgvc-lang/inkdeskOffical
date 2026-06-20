'use client'

import { useEffect, useRef, useState } from 'react'

const SUPPORT_EMAIL = 'support@inkdesk.live'

type Msg = { role: 'user' | 'assistant'; content: string }

const GREETING: Msg = {
  role: 'assistant',
  content:
    "Hi! I'm your InkDesk assistant 👋  Ask me how to do anything — set up your page, take bookings, add credentials, change your colours, upgrade… If you'd rather talk to a person, just say so.",
}

// Render assistant text safely: preserve line breaks and turn any email address
// into a clickable mailto link (opens the visitor's email client).
const EMAIL_SPLIT = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
const isEmail = (s: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)

function renderRich(text: string) {
  return text.split(EMAIL_SPLIT).map((part, i) =>
    isEmail(part) ? (
      <a key={i} href={`mailto:${part}`} className="font-medium text-white underline underline-offset-2 hover:text-white/80">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function SupportModal() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'chat'>('menu')

  const [messages, setMessages] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset to the menu each time the modal is opened.
  useEffect(() => {
    if (open) setView('menu')
  }, [open])

  // Keep the transcript scrolled to the latest message.
  useEffect(() => {
    if (view === 'chat') {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, view, sending])

  // Escape to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Drop the canned greeting; send the real exchange.
        body: JSON.stringify({ messages: next.slice(1) }),
      })
      const json = (await res.json()) as { reply?: string; error?: string }
      const reply =
        json.reply ??
        (json.error
          ? `Sorry — ${json.error}. You can also email ${SUPPORT_EMAIL}.`
          : `Sorry, something went wrong. Please email ${SUPPORT_EMAIL}.`)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Network error — please try again, or email ${SUPPORT_EMAIL}.` },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Get help"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        <span className="hidden sm:inline">Get help</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Get help">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#171717] shadow-2xl">
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2.5">
                {view === 'chat' && (
                  <button
                    type="button"
                    onClick={() => setView('menu')}
                    className="-ml-1.5 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                    aria-label="Back"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </button>
                )}
                <h2 className="text-base font-bold text-white">
                  {view === 'menu' ? 'Get help' : 'InkDesk Assistant'}
                </h2>
                {view === 'chat' && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-400">AI</span>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
              </button>
            </div>

            {/* ── Menu view ── */}
            {view === 'menu' && (
              <div className="space-y-3 p-5">
                <p className="text-sm leading-relaxed text-white/55">
                  How would you like to get help?
                </p>

                <button
                  type="button"
                  onClick={() => setView('chat')}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a8 8 0 01-11.6 7.13L3 21l1.9-5.4A8 8 0 1121 12z" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Ask the AI assistant</span>
                    <span className="block text-xs text-white/45">Instant, step-by-step help with anything on InkDesk</span>
                  </span>
                </button>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.161V6a2 2 0 00-2-2H3z" /><path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Email support</span>
                    <span className="block text-xs text-white/45">Talk to a human — opens your email app</span>
                  </span>
                </a>

                <p className="pt-1 text-center text-xs text-white/30">{SUPPORT_EMAIL}</p>
              </div>
            )}

            {/* ── Chat view ── */}
            {view === 'chat' && (
              <>
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                      <div
                        className={[
                          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                          m.role === 'user'
                            ? 'rounded-br-sm bg-white text-black'
                            : 'rounded-bl-sm bg-white/[0.06] text-white/90',
                        ].join(' ')}
                      >
                        {m.role === 'assistant' ? renderRich(m.content) : m.content}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="flex gap-1 rounded-2xl rounded-bl-sm bg-white/[0.06] px-3.5 py-3">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 p-3">
                  <div className="flex items-end gap-2">
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void send()
                        }
                      }}
                      placeholder="Ask anything about InkDesk…"
                      maxLength={2000}
                      className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
                      aria-label="Message"
                    />
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={sending || !input.trim()}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-black transition-colors hover:bg-white/90 disabled:opacity-30"
                      aria-label="Send"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.926A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.085l-1.414 4.926a.75.75 0 00.826.95 28.897 28.897 0 0015.293-7.155.75.75 0 000-1.114A28.897 28.897 0 003.105 2.289z" /></svg>
                    </button>
                  </div>
                  <p className="mt-2 px-1 text-[0.7rem] text-white/30">
                    AI answers can be imperfect. For account issues, email{' '}
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-white/50">{SUPPORT_EMAIL}</a>.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
