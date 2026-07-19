/**
 * lib/studio/earnings.ts
 *
 * Pure computation for the studio "owed" ledger.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  REPORTING ONLY. This computes what each artist NOTIONALLY owes the studio │
 * │  (commission and/or booth rent) over a period. It moves NO money and does  │
 * │  NOT touch Stripe. Automated commission payouts would require a multi-     │
 * │  account Stripe Connect topology (separate charges / transfers between     │
 * │  connected accounts) which is deliberately out of scope for this           │
 * │  foundation — see the report / route comments.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Model:
 *   • serviceRevenuePence — the artist's collected/booked service value in the
 *     period. This is the commission BASE.
 *   • tipsPence — tips in the period. Tips pass through to the artist in full
 *     and are NOT part of the commission base (a common studio convention).
 *   • commissionOwed = round(serviceRevenue * commissionRatePct / 100)
 *   • boothRentOwed  = flat boothRentPence for the period (revenue-independent)
 *   • totalOwedToStudio = commissionOwed + boothRentOwed
 *   • artistNet = serviceRevenue + tips − totalOwedToStudio
 *
 * All amounts are integer pence.
 */

export interface MemberFinancialInput {
  artistId: string
  displayName: string
  role: string
  commissionRatePct: number | null
  boothRentPence: number | null
  serviceRevenuePence: number
  tipsPence: number
}

export interface MemberLedgerRow extends MemberFinancialInput {
  commissionOwedPence: number
  boothRentOwedPence: number
  totalOwedToStudioPence: number
  artistNetPence: number
}

export interface StudioLedger {
  rows: MemberLedgerRow[]
  totals: {
    serviceRevenuePence: number
    tipsPence: number
    commissionOwedPence: number
    boothRentOwedPence: number
    totalOwedToStudioPence: number
    artistNetPence: number
  }
}

export function computeMemberLedger(m: MemberFinancialInput): MemberLedgerRow {
  const rate = m.commissionRatePct ?? 0
  const commissionOwedPence = rate > 0 ? Math.round(m.serviceRevenuePence * (rate / 100)) : 0
  const boothRentOwedPence = m.boothRentPence ?? 0
  const totalOwedToStudioPence = commissionOwedPence + boothRentOwedPence
  const artistNetPence = m.serviceRevenuePence + m.tipsPence - totalOwedToStudioPence

  return {
    ...m,
    commissionOwedPence,
    boothRentOwedPence,
    totalOwedToStudioPence,
    artistNetPence,
  }
}

export function computeStudioLedger(inputs: MemberFinancialInput[]): StudioLedger {
  const rows = inputs.map(computeMemberLedger)

  const totals = rows.reduce(
    (acc, r) => ({
      serviceRevenuePence: acc.serviceRevenuePence + r.serviceRevenuePence,
      tipsPence: acc.tipsPence + r.tipsPence,
      commissionOwedPence: acc.commissionOwedPence + r.commissionOwedPence,
      boothRentOwedPence: acc.boothRentOwedPence + r.boothRentOwedPence,
      totalOwedToStudioPence: acc.totalOwedToStudioPence + r.totalOwedToStudioPence,
      artistNetPence: acc.artistNetPence + r.artistNetPence,
    }),
    {
      serviceRevenuePence: 0,
      tipsPence: 0,
      commissionOwedPence: 0,
      boothRentOwedPence: 0,
      totalOwedToStudioPence: 0,
      artistNetPence: 0,
    },
  )

  return { rows, totals }
}
