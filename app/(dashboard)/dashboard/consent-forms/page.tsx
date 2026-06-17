import type { Metadata } from 'next'
import { ConsentFormsList } from '@/components/dashboard/ConsentFormsList'

export const metadata: Metadata = { title: 'Consent Forms' }

export default function ConsentFormsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Consent Forms</h1>
        <p className="text-white/40 text-sm mt-0.5">Signed consent forms submitted by your clients.</p>
      </div>
      <ConsentFormsList />
    </div>
  )
}
