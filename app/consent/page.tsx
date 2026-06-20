import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ConsentFormView } from '@/components/public/ConsentFormView'

export const metadata: Metadata = {
  title: 'Consent Form — Inkquire',
  robots: { index: false, follow: false },
}

export default function ConsentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ConsentFormView />
    </Suspense>
  )
}
