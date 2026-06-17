'use client'

import { useState } from 'react'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'

export function MessagesView() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
