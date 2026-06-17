import type { Metadata } from 'next'
import { ClientChatView } from '@/components/public/ClientChatView'

export const metadata: Metadata = {
  title: 'Chat with your artist — InkDesk',
  robots: { index: false, follow: false },
}

export default function ConversationPage() {
  return <ClientChatView />
}
