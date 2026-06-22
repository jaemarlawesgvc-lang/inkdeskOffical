'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface AnalyticsData {
  revenueChart: { month: string; revenue: number }[]
  conversionChart: { month: string; total: number; confirmed: number; rate: number }[]
  noShowChart: { month: string; noShows: number; rate: number }[]
  avgValue: number
  topClients: { name: string; total: number; bookings: number }[]
  upcomingThisMonth: number
  totalBookings: number
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-')
  if (!y || !mo) return m
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthName = months[parseInt(mo, 10) - 1] ?? mo
  return `${monthName} ${y.slice(2)}`
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-white/40 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  )
}

export function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/analytics')
      .then(async (res) => {
        if (res.status === 403) {
          setUpgradeRequired(true)
          return
        }
        if (!res.ok) throw new Error('Failed to load analytics')
        const json = await res.json()
        setData(json)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (upgradeRequired) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto bg-amber-500/20 rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-amber-400">
            <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white">Analytics requires Pro or Studio</h2>
        <p className="text-white/50 text-sm max-w-md mx-auto">
          Upgrade your plan to access detailed analytics including revenue trends, booking conversion rates, and client insights.
        </p>
        <a
          href="/dashboard/settings/billing"
          className="inline-block px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-colors"
        >
          Upgrade Plan
        </a>
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-red-400 text-sm">{error ?? 'Failed to load analytics'}</p>
  }

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#171717', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '13px' },
    labelStyle: { color: '#a3a3a3' },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bookings" value={data.totalBookings} />
        <StatCard label="Upcoming This Month" value={data.upcomingThisMonth} />
        <StatCard label="Average Tattoo Value" value={`£${data.avgValue.toFixed(2)}`} />
        <StatCard
          label="No-Show Rate"
          value={
            data.noShowChart.length > 0
              ? `${data.noShowChart.at(-1)?.rate ?? 0}%`
              : '0%'
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#737373', fontSize: 12 }} />
              <YAxis tick={{ fill: '#737373', fontSize: 12 }} tickFormatter={(v) => `£${v}`} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`£${Number(v).toFixed(2)}`, 'Revenue']} labelFormatter={(m: any) => formatMonth(String(m))} />
              <Bar dataKey="revenue" fill="#d4af37" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Booking Conversion Rate</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.conversionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#737373', fontSize: 12 }} />
              <YAxis tick={{ fill: '#737373', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`, 'Conversion']} labelFormatter={(m: any) => formatMonth(String(m))} />
              <Line type="monotone" dataKey="rate" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">No-Show Rate</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.noShowChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fill: '#737373', fontSize: 12 }} />
              <YAxis tick={{ fill: '#737373', fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [`${v}%`, 'No-Show']} labelFormatter={(m: any) => formatMonth(String(m))} />
              <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Top Clients</h3>
          {data.topClients.length === 0 ? (
            <p className="text-white/40 text-sm">No client data yet.</p>
          ) : (
            <div className="space-y-3">
              {data.topClients.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{c.name}</p>
                    <p className="text-xs text-white/40">{c.bookings} booking{c.bookings !== 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-sm font-semibold text-white">£{c.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
