import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sendConversationInvite } from '@/lib/resend/send'
import { getAppUrl } from '@/lib/app-url'
import { z } from 'zod'

interface ConversationMessageRow {
  id: string
  body: string
  sender_type: string
  read_at: string | null
  created_at: string
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select(`
      id,
      client_name,
      client_email,
      last_message_at,
      messages (
        id,
        body,
        sender_type,
        read_at,
        created_at
      )
    `)
    .eq('artist_id', artist.id)
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (conversationsError) {
    console.error('[dashboard/conversations] GET failed:', conversationsError.message)
    return NextResponse.json(
      { error: 'Failed to load conversations. Please refresh and try again.' },
      { status: 500 },
    )
  }

  const result = (conversations ?? []).map((c) => {
    const msgs = (c.messages as unknown as ConversationMessageRow[]) ?? []
    const lastMsg = msgs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    const unreadCount = msgs.filter((m) => m.sender_type === 'client' && !m.read_at).length
    return {
      id: c.id,
      clientName: c.client_name,
      clientEmail: c.client_email,
      lastMessageAt: c.last_message_at,
      lastMessagePreview: lastMsg?.body?.slice(0, 80) ?? null,
      lastMessageSender: lastMsg?.sender_type ?? null,
      unreadCount,
    }
  })

  return NextResponse.json({ conversations: result })
}

const createSchema = z.object({
  clientName: z.string().min(1).max(100),
  clientEmail: z.string().email(),
  bookingId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: artist } = await supabase
    .from('artists')
    .select('id, display_name, username')
    .eq('user_id', user.id)
    .single()

  if (!artist) {
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Validation failed' }, { status: 422 })
  }

  const { clientName, clientEmail, bookingId } = parsed.data

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('artist_id', artist.id)
    .eq('client_email', clientEmail.toLowerCase())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ conversation: { id: existing.id } })
  }

  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert({
      artist_id: artist.id,
      client_name: clientName,
      client_email: clientEmail.toLowerCase(),
      booking_id: bookingId ?? null,
    })
    .select('id, client_token')
    .single()

  if (convError) {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  // Without this email the client has no way to discover their conversation
  // link — the dashboard never surfaces client_token anywhere in the UI.
  // Failure here must not fail conversation creation; the artist can still
  // resend by recreating contact through other channels.
  await sendConversationInvite(supabase, {
    to: clientEmail.toLowerCase(),
    clientName,
    artistName: artist.display_name ?? artist.username,
    conversationUrl: `${getAppUrl()}/conversation?token=${conv.client_token}`,
    artistEmail: user.email ?? null,
  }).catch((err) => {
    console.error('[dashboard/conversations] invite email failed:', err instanceof Error ? err.message : err)
  })

  return NextResponse.json({ conversation: conv })
}
