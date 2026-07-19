'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface LedgerRow {
  artistId: string
  displayName: string
  role: string
  commissionRatePct: number | null
  boothRentPence: number | null
  serviceRevenuePence: number
  tipsPence: number
  commissionOwedPence: number
  boothRentOwedPence: number
  totalOwedToStudioPence: number
  artistNetPence: number
}

interface LedgerTotals {
  serviceRevenuePence: number
  tipsPence: number
  commissionOwedPence: number
  boothRentOwedPence: number
  totalOwedToStudioPence: number
  artistNetPence: number
}

interface EarningsResponse {
  from: string
  to: string
  ledger: { rows: LedgerRow[]; totals: LedgerTotals | null }
  error?: string
}

const inputCls =
  'bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/50 transition-colors'

function gbp(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * The studio "owed" ledger — REPORTING ONLY. Shows, per artist, the commission
 * and booth rent notionally owed to the studio over a period. Moves no money.
 */
export function StudioEarnings() {
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [totals, setTotals] = useState<LedgerTotals | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/studio/earnings?from=${from}&to=${to}`)
      const json = (await res.json()) as EarningsResponse
      if (!res.ok) throw new Error(json.error ?? 'Could not load earnings')
      setRows(json.ledger?.rows ?? [])
      setTotals(json.ledger?.totals ?? null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load earnings')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-white/50">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-white/50">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
      </div>

      <p className="text-white/30 text-xs">
        Reporting only — this ledger does not move money. Commission applies to service revenue;
        tips pass through to the artist in full.
      </p>

      {loading ? (
        <p className="text-white/30 text-sm">Loading earnings…</p>
      ) : rows.length === 0 ? (
        <p className="text-white/30 text-sm">
          No artists with financial terms yet. Add members and set their commission or booth rent.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wide">
                <th className="py-2 pr-4 font-medium">Artist</th>
                <th className="py-2 pr-4 font-medium text-right">Service rev.</th>
                <th className="py-2 pr-4 font-medium text-right">Tips</th>
                <th className="py-2 pr-4 font-medium text-right">Commission</th>
                <th className="py-2 pr-4 font-medium text-right">Booth rent</th>
                <th className="py-2 pr-4 font-medium text-right">Owed to studio</th>
                <th className="py-2 font-medium text-right">Artist net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.artistId} className="border-t border-white/10 text-white/80">
                  <td className="py-2.5 pr-4 text-white">{r.displayName}</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(r.serviceRevenuePence)}</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(r.tipsPence)}</td>
                  <td className="py-2.5 pr-4 text-right">
                    {gbp(r.commissionOwedPence)}
                    {r.commissionRatePct !== null && (
                      <span className="text-white/30 text-xs"> ({r.commissionRatePct}%)</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right">{gbp(r.boothRentOwedPence)}</td>
                  <td className="py-2.5 pr-4 text-right text-white font-medium">{gbp(r.totalOwedToStudioPence)}</td>
                  <td className="py-2.5 text-right">{gbp(r.artistNetPence)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t border-white/20 text-white font-semibold">
                  <td className="py-2.5 pr-4">Total</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(totals.serviceRevenuePence)}</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(totals.tipsPence)}</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(totals.commissionOwedPence)}</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(totals.boothRentOwedPence)}</td>
                  <td className="py-2.5 pr-4 text-right">{gbp(totals.totalOwedToStudioPence)}</td>
                  <td className="py-2.5 text-right">{gbp(totals.artistNetPence)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
