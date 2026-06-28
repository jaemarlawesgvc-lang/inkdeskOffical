import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { InvoiceDocument } from '@/lib/pdf/InvoiceDocument'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id, display_name, username, studio_name, studio_address, profiles(email)')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, client_name, client_email, booking_date, booking_time, description, deposit_amount, deposit_paid, total_amount, created_at')
    .eq('id', id)
    .eq('artist_id', artist.id)
    .is('deleted_at', null)
    .single()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const artistProfile = artist.profiles as { email: string } | null
  const invoiceNumber = `INV-${booking.id.slice(0, 8).toUpperCase()}`
  const issueDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const buffer = await renderToBuffer(
    InvoiceDocument({
      data: {
        invoiceNumber,
        issueDate,
        artistName: artist.display_name ?? artist.username ?? 'Artist',
        artistEmail: artistProfile?.email ?? '',
        studioName: artist.studio_name ?? null,
        studioAddress: artist.studio_address ?? null,
        clientName: booking.client_name,
        clientEmail: booking.client_email,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        description: booking.description,
        depositAmount: booking.deposit_amount,
        depositPaid: booking.deposit_paid,
        totalAmount: booking.total_amount,
        sessionPrice: booking.total_amount,
      },
    }),
  )

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoiceNumber}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
