import type { Metadata } from 'next'
import { MessagesView } from '@/components/dashboard/MessagesView'

export const metadata: Metadata = { title: 'Messages' }

export default function MessagesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-white/40 text-sm mt-0.5">Chat with your clients directly.</p>
      </div>
      <MessagesView />
    </div>
  )
}
