import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const GOLD = '#d4af37'
const INK = '#0a0a0a'

const styles = StyleSheet.create({
  page: { fontSize: 10, color: '#171717', fontFamily: 'Helvetica', backgroundColor: '#ffffff' },

  header: { backgroundColor: INK, paddingTop: 36, paddingBottom: 28, paddingHorizontal: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginRight: 6 },
  brand: { fontSize: 9, color: '#a3a3a3', letterSpacing: 2 },
  headerTitle: { fontSize: 26, fontWeight: 700, color: '#ffffff', fontFamily: 'Helvetica-Bold' },
  headerSub: { fontSize: 11, color: '#d4d4d4', marginTop: 4 },
  goldLine: { height: 2, backgroundColor: GOLD, width: 40, marginTop: 14 },

  body: { padding: 40, paddingTop: 32, paddingBottom: 80 },

  twoCol: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, gap: 24 },
  col: { flex: 1 },
  colLabel: { fontSize: 8, color: '#a3a3a3', letterSpacing: 1.5, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  colValue: { fontSize: 10.5, color: '#171717', lineHeight: 1.6 },
  colValueMuted: { fontSize: 10, color: '#525252', lineHeight: 1.6 },

  divider: { height: 1, backgroundColor: '#e5e5e5', marginBottom: 24 },

  tableHeader: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e5e5', marginBottom: 4 },
  tableHeaderCell: { fontSize: 8, color: '#a3a3a3', letterSpacing: 1, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  tableCell: { fontSize: 10, color: '#171717' },
  tableCellMuted: { fontSize: 10, color: '#737373' },

  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colAmount: { flex: 1, textAlign: 'right' },

  totalSection: { marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end' },
  totalBox: { width: 200 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { fontSize: 10, color: '#737373' },
  totalValue: { fontSize: 10, color: '#171717' },
  totalDivider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 6 },
  grandTotalLabel: { fontSize: 12, color: '#171717', fontFamily: 'Helvetica-Bold' },
  grandTotalValue: { fontSize: 12, color: '#171717', fontFamily: 'Helvetica-Bold' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', marginTop: 8 },
  statusPaid: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  statusPaidText: { fontSize: 9, color: '#166534', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  statusPending: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' },
  statusPendingText: { fontSize: 9, color: '#92400e', fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },

  notes: { marginTop: 32, backgroundColor: '#fafaf9', borderLeftWidth: 3, borderLeftColor: GOLD, borderRadius: 4, padding: 14 },
  notesLabel: { fontSize: 8, color: '#a3a3a3', letterSpacing: 1, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  notesText: { fontSize: 9.5, color: '#404040', lineHeight: 1.5 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: INK, paddingVertical: 14, paddingHorizontal: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 9, color: '#a3a3a3' },
})

export interface InvoiceData {
  invoiceNumber: string
  issueDate: string
  artistName: string
  artistEmail: string
  studioName: string | null
  studioAddress: string | null
  clientName: string
  clientEmail: string
  bookingDate: string
  bookingTime: string | null
  description: string | null
  depositAmount: number | null
  depositPaid: boolean
  totalAmount: number | null
  sessionPrice: number | null
}

function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2)}`
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const sessionAmt = data.sessionPrice ?? data.totalAmount ?? 0
  const depositAmt = data.depositPaid && data.depositAmount ? data.depositAmount : 0
  const balanceDue = Math.max(0, sessionAmt - depositAmt)

  return (
    <Document title={`Invoice ${data.invoiceNumber} — ${data.artistName}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>INKQUIRE</Text>
          </View>
          <Text style={styles.headerTitle}>Invoice</Text>
          <Text style={styles.headerSub}>#{data.invoiceNumber}</Text>
          <View style={styles.goldLine} />
        </View>

        <View style={styles.body}>
          {/* Billed from / to */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.colLabel}>FROM</Text>
              <Text style={[styles.colValue, { fontFamily: 'Helvetica-Bold' }]}>{data.artistName}</Text>
              {data.studioName && <Text style={styles.colValueMuted}>{data.studioName}</Text>}
              {data.studioAddress && <Text style={styles.colValueMuted}>{data.studioAddress}</Text>}
              <Text style={styles.colValueMuted}>{data.artistEmail}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.colLabel}>BILLED TO</Text>
              <Text style={[styles.colValue, { fontFamily: 'Helvetica-Bold' }]}>{data.clientName}</Text>
              <Text style={styles.colValueMuted}>{data.clientEmail}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.colLabel}>INVOICE DATE</Text>
              <Text style={styles.colValue}>{data.issueDate}</Text>
              <View style={[styles.statusBadge, data.depositPaid ? styles.statusPaid : styles.statusPending]}>
                <Text style={data.depositPaid ? styles.statusPaidText : styles.statusPendingText}>
                  {balanceDue <= 0 ? 'PAID' : data.depositPaid ? 'DEPOSIT PAID' : 'AWAITING PAYMENT'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Line items */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>DESCRIPTION</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>AMOUNT</Text>
          </View>

          {/* Session */}
          <View style={styles.tableRow}>
            <View style={styles.colDesc}>
              <Text style={styles.tableCell}>Tattoo session — {formatDate(data.bookingDate)}{data.bookingTime ? ` at ${data.bookingTime.slice(0, 5)}` : ''}</Text>
              {data.description && (
                <Text style={[styles.tableCellMuted, { marginTop: 3 }]}>{data.description}</Text>
              )}
            </View>
            <Text style={[styles.tableCell, styles.colAmount]}>{sessionAmt > 0 ? formatCurrency(sessionAmt) : 'TBC'}</Text>
          </View>

          {/* Deposit paid */}
          {depositAmt > 0 && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellMuted, styles.colDesc]}>Deposit paid</Text>
              <Text style={[styles.tableCellMuted, styles.colAmount]}>−{formatCurrency(depositAmt)}</Text>
            </View>
          )}

          {/* Totals */}
          <View style={styles.totalSection}>
            <View style={styles.totalBox}>
              {sessionAmt > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatCurrency(sessionAmt)}</Text>
                </View>
              )}
              {depositAmt > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Deposit paid</Text>
                  <Text style={[styles.totalValue, { color: '#22c55e' }]}>−{formatCurrency(depositAmt)}</Text>
                </View>
              )}
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.grandTotalLabel}>Balance due</Text>
                <Text style={styles.grandTotalValue}>{sessionAmt > 0 ? formatCurrency(balanceDue) : 'TBC'}</Text>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Text style={styles.notesText}>
              Thank you for booking with {data.artistName}. Please contact your artist directly if you have any questions about this invoice.
              {'\n'}Late cancellations within 48 hours of the appointment may forfeit the deposit.
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Inkquire — Tattoo Booking Platform</Text>
          <Text style={styles.footerText}>Invoice #{data.invoiceNumber}</Text>
        </View>
      </Page>
    </Document>
  )
}
