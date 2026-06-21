'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface Message {
  id: string
  body: string
  sender_type: 'artist' | 'client'
  read_at: string | null
  created_at: string
}

interface Props {
  conversationId: string
}

export function MessageThread({ conversationId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Polls every 5s — only toast once per failure streak, not on every cycle.
  const hasShownLoadErrorRef = useRef(false)

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/messages?conversation_id=${conversationId}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        if (!hasShownLoadErrorRef.current) {
          toast.error(data?.error ?? 'Failed to load messages.')
          hasShownLoadErrorRef.current = true
        }
        setLoading(false)
        return
      }
      const data = await res.json()
      setMessages(data.messages ?? [])
      hasShownLoadErrorRef.current = false
    } catch {
      if (!hasShownLoadErrorRef.current) {
        toast.error('Network error — could not load messages.')
        hasShownLoadErrorRef.current = true
      }
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    setLoading(true)
    setDraft('')
    loadMessages()
    const interval = setInterval(loadMessages, 5000)
    return () => clearInterval(interval)
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/dashboard/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, body: draft.trim() }),
      })
      if (res.ok) {
        setDraft('')
        await loadMessages()
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? 'Message failed to send. Please try again.')
      }
    } catch {
      toast.error('Network error — message not sent. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-white/30 text-sm py-8">No messages yet. Start the conversation below.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender_type === 'artist' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={[
                'max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                m.sender_type === 'artist'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white/10 text-white rounded-bl-md',
              ].join(' ')}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`text-[10px] mt-1 ${m.sender_type === 'artist' ? 'text-blue-200' : 'text-white/30'}`}>
                {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                {m.sender_type === 'artist' && m.read_at && ' · Read'}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
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
