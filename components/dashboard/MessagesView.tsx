'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'

export function MessagesView() {
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('c'))
  const bookingId = searchParams.get('bookingId')

  useEffect(() => {
    if (selectedId || !bookingId) return

    let active = true
    const initChat = async () => {
      try {
        const res = await fetch('/api/dashboard/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        })
        if (!res.ok) return
        const data = await res.json() as { conversation?: { id: string } }
        if (data.conversation?.id && active) {
          setSelectedId(data.conversation.id)
        }
      } catch (err) {
        console.error('Failed to auto-start conversation from booking:', err)
      }
    }
    void initChat()
    return () => {
      active = false
    }
  }, [bookingId, selectedId])

  return (
    <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
      <div className="w-80 border-r border-white/10 flex-shrink-0 hidden sm:flex flex-col">
        <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <div className="flex-1 flex flex-col">
        {selectedId ? (
          <MessageThread conversationId={selectedId} />
        ) : (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      {!selectedId && (
        <div className="sm:hidden w-full absolute inset-0">
          <ConversationList selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      )}
    </div>
  )
}
