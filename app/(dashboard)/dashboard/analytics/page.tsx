import type { Metadata } from 'next'
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts'

export const metadata: Metadata = { title: 'Analytics' }

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-white/40 text-sm mt-0.5">Track your revenue, bookings, and client insights.</p>
      </div>
      <AnalyticsCharts />
    </div>
  )
}
