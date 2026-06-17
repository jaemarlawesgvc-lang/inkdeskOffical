'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

interface Message {
  id: string
  body: string
  sender_type: 'artist' | 'client'
  read_at: string | null
  created_at: string
}

export function ClientChatView() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [messages, setMessages] = useState<Message[]>([])
  const [artistName, setArtistName] = useState('Artist')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    if (!token) return
    const res = await fetch(`/api/conversations/client?token=${token}`)
    if (!res.ok) {
      setError('Conversation not found or link has expired.')
      setLoading(false)
      return
    }
    const data = await res.json()
    setMessages(data.messages ?? [])
    setArtistName(data.artistName ?? 'Artist')
    setLoading(false)
  }, [token])

  useEffect(() => {
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!draft.trim() || sending || !token) return
    setSending(true)
    const res = await fetch('/api/conversations/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, body: draft.trim() }),
    })
    if (res.ok) {
      setDraft('')
      await loadMessages()
    }
    setSending(false)
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40">Invalid conversation link.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-bold">
            {artistName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{artistName}</p>
            <p className="text-[11px] text-white/40">InkDesk Chat</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-white/30 text-sm py-8">No messages yet.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={[
                  'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                  m.sender_type === 'client'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white/10 text-white rounded-bl-md',
                ].join(' ')}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${m.sender_type === 'client' ? 'text-blue-200' : 'text-white/30'}`}>
                  {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-black/80 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="px-4 py-2.5 bg-white text-black text-sm font-semibold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
