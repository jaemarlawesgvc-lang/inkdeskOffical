import type { Metadata } from 'next'
import { Suspense } from 'react'
import { MessagesView } from '@/components/dashboard/MessagesView'

export const metadata: Metadata = { title: 'Messages' }

export default function MessagesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-white/40 text-sm mt-0.5">Chat with your clients directly.</p>
      </div>
      <Suspense fallback={<div className="text-white/40 text-sm">Loading…</div>}>
        <MessagesView />
      </Suspense>
    </div>
  )
}
