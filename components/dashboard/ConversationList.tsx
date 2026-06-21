'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Conversation {
  id: string
  clientName: string
  clientEmail: string
  lastMessageAt: string
  lastMessagePreview: string | null
  lastMessageSender: string | null
  unreadCount: number
}

interface Props {
  selectedId: string | null
  onSelect: (id: string) => void
}

export function ConversationList({ selectedId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/conversations')
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) {
          toast.error(d?.error ?? 'Failed to load conversations.')
          return
        }
        setConversations(d?.conversations ?? [])
      })
      .catch(() => toast.error('Network error — could not load conversations.'))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/dashboard/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: newName.trim(), clientEmail: newEmail.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.conversation) {
        onSelect(data.conversation.id)
        setShowNew(false)
        setNewName('')
        setNewEmail('')
        const refreshRes = await fetch('/api/dashboard/conversations')
        const refreshData = await refreshRes.json()
        setConversations(refreshData.conversations ?? [])
      } else {
        toast.error(data?.error ?? 'Failed to start conversation. Please try again.')
      }
    } catch {
      toast.error('Network error — could not start conversation.')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-white/40 text-sm">Loading...</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-white/10">
        <button
          type="button"
          onClick={() => setShowNew(!showNew)}
          className="w-full px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Conversation
        </button>
      </div>

      {showNew && (
        <div className="p-3 border-b border-white/10 space-y-2">
          <input
            type="text"
            placeholder="Client name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
          <input
            type="email"
            placeholder="Client email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full px-3 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Start Conversation'}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <p className="p-4 text-white/30 text-sm text-center">No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={[
                'w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors',
                selectedId === c.id ? 'bg-white/10' : '',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white truncate">{c.clientName}</p>
                {c.unreadCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/40 truncate mt-0.5">{c.clientEmail}</p>
              {c.lastMessagePreview && (
                <p className="text-xs text-white/30 truncate mt-1">
                  {c.lastMessageSender === 'artist' ? 'You: ' : ''}
                  {c.lastMessagePreview}
                </p>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
