import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ClientChatView } from '@/components/public/ClientChatView'

export const metadata: Metadata = {
  title: 'Chat with your artist — InkDesk',
  robots: { index: false, follow: false },
}

export default function ConversationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ClientChatView />
    </Suspense>
  )
}
