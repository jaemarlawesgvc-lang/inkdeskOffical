import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { bookingStatusSchema } from '@/lib/validations/booking'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl

  const parsed = bookingStatusSchema.safeParse({
    token: searchParams.get('token') ?? '',
  })

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input' },
      { status: 400 },
    )
  }

  const supabase = createSupabaseAdminClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      booking_date,
      booking_time,
      status,
      deposit_amount,
      deposit_paid,
      stripe_payment_status,
      client_name,
      created_at,
      artists (
        display_name,
        username,
        studio_name
      )
    `,
    )
    .eq('access_token', parsed.data.token)
    .is('deleted_at', null)
    .single()

  if (error || !booking) {
    // Generic error to avoid leaking whether a token exists
    return NextResponse.json(
      { error: 'Booking not found' },
      { status: 404 },
    )
  }

  const artist = booking.artists as unknown as {
    display_name: string | null
    username: string | null
    studio_name: string | null
  } | null

  return NextResponse.json({
    bookingId: booking.id,
    status: booking.status,
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    clientName: booking.client_name,
    depositAmount: booking.deposit_amount,
    depositPaid: booking.deposit_paid,
    paymentStatus: booking.stripe_payment_status,
    createdAt: booking.created_at,
    artist: artist
      ? {
          displayName: artist.display_name,
          username: artist.username,
          studioName: artist.studio_name,
        }
      : null,
  })
}
