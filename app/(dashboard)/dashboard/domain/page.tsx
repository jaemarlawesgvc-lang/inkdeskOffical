import type { Metadata } from 'next'
import { CustomDomainManager } from '@/components/dashboard/CustomDomainManager'

export const metadata: Metadata = { title: 'Custom Domain' }

export default function DomainPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Custom Domain</h1>
        <p className="text-white/40 text-sm mt-0.5">
          Serve your public booking page from your own domain. Available on the Studio plan.
        </p>
      </div>
      <CustomDomainManager />
    </div>
  )
}
